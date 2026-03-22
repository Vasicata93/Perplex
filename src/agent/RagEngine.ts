// ============================================================
// LAYER 8 — RAG ENGINE
// Semantic search over workspace files + externalized observations.
// Transparent to the model — called by tool execution layer.
// ============================================================

import {
  DocumentChunk,
  RagIndex,
  RagSearchResult,
  ExternalizedObservation,
  RagEngineInput,
  RagEngineOutput,
  DEFAULT_COST_GUARD,
} from './types';

// ─────────────────────────────────────────────────────────────
// SESSION CACHE
// Index reconstruit per sesiune, nu per request
// ─────────────────────────────────────────────────────────────
let _ragIndex: RagIndex | null = null;
let _externalizedStore: Map<string, ExternalizedObservation> = new Map();
let _searchCache: Map<string, RagEngineOutput> = new Map();

const CHUNK_SIZE_CHARS = 800;       // ~200 tokens per chunk
const CHUNK_OVERLAP_CHARS = 150;    // Overlap pentru continuitate
const MAX_CACHE_ENTRIES = 50;       // Cache maxim 50 query-uri

// ─────────────────────────────────────────────────────────────
// INDEXARE — chunking + keyword extraction
// ─────────────────────────────────────────────────────────────

/**
 * Indexează un fișier text în chunk-uri.
 * Apelat când workspace files sunt încărcate în sesiune.
 */
export function indexDocument(
  filename: string,
  content: string,
  sessionId: string
): void {
  if (!_ragIndex || _ragIndex.sessionId !== sessionId) {
    _ragIndex = {
      sessionId,
      chunks: [],
      lastUpdated: Date.now(),
      totalChunks: 0,
      sourceFiles: [],
    };
  }

  // Elimină chunk-urile existente pentru acest fișier (re-indexare)
  _ragIndex.chunks = _ragIndex.chunks.filter(c => c.sourceFile !== filename);

  const chunks = splitIntoChunks(content, filename);
  _ragIndex.chunks.push(...chunks);
  _ragIndex.totalChunks = _ragIndex.chunks.length;
  _ragIndex.lastUpdated = Date.now();

  if (!_ragIndex.sourceFiles.includes(filename)) {
    _ragIndex.sourceFiles.push(filename);
  }

  console.log(`[Layer 8] Indexed '${filename}': ${chunks.length} chunks`);
}

function splitIntoChunks(content: string, filename: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < content.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, content.length);

    // Tăiem la un separator natural (newline, punct) dacă există
    let actualEnd = end;
    if (end < content.length) {
      const lastNewline = content.lastIndexOf('\n', end);
      const lastPeriod = content.lastIndexOf('.', end);
      const naturalBreak = Math.max(lastNewline, lastPeriod);
      if (naturalBreak > start + CHUNK_SIZE_CHARS * 0.6) {
        actualEnd = naturalBreak + 1;
      }
    }

    const chunkContent = content.slice(start, actualEnd).trim();

    if (chunkContent.length > 20) {
      chunks.push({
        id: `${filename}_chunk_${chunkIndex}`,
        sourceFile: filename,
        chunkIndex,
        content: chunkContent,
        tokenCount: Math.ceil(chunkContent.length / 4),
        keywords: extractKeywords(chunkContent),
      });
      chunkIndex++;
    }

    // Overlap: pasul următor începe cu CHUNK_OVERLAP înainte de end
    start = actualEnd - CHUNK_OVERLAP_CHARS;
    if (start <= 0 || start >= content.length - 20) break;
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────
// KEYWORD EXTRACTION — simplu și rapid
// ─────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'this', 'that', 'it', 'its',
  'nu', 'să', 'și', 'că', 'cu', 'de', 'la', 'în', 'pe',
  'un', 'o', 'este', 'sunt', 'era', 'fi', 'ai', 'am', 'au',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\săâîșțĂÂÎȘȚ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
    .reduce((acc: string[], word) => {
      if (!acc.includes(word)) acc.push(word);
      return acc;
    }, [])
    .slice(0, 30); // Maxim 30 keywords per chunk
}

// ─────────────────────────────────────────────────────────────
// SCORING — keyword overlap + position boost
// ─────────────────────────────────────────────────────────────
function scoreChunk(chunk: DocumentChunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const chunkKeywords = new Set(chunk.keywords);
  const contentLower = chunk.content.toLowerCase();

  let score = 0;

  // Keyword overlap score
  let keywordMatches = 0;
  for (const token of queryTokens) {
    if (chunkKeywords.has(token)) keywordMatches++;
  }
  score += (keywordMatches / queryTokens.length) * 0.6;

  // Exact phrase bonus (token apare în content, nu doar în keywords)
  let phraseMatches = 0;
  for (const token of queryTokens) {
    if (contentLower.includes(token)) phraseMatches++;
  }
  score += (phraseMatches / queryTokens.length) * 0.3;

  // Position boost: chunk-urile de la începutul documentului sunt mai relevante
  const positionBoost = Math.max(0, 0.1 - chunk.chunkIndex * 0.01);
  score += positionBoost;

  return Math.min(1.0, score);
}

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — căutare RAG
// ─────────────────────────────────────────────────────────────
export function ragSearch(input: RagEngineInput): RagEngineOutput {
  const cacheKey = `${input.query}_${input.topK || 5}_${input.sourceFiles?.join(',') || 'all'}`;

  // Verifică cache
  if (_searchCache.has(cacheKey)) {
    const cached = _searchCache.get(cacheKey)!;
    console.log(`[Layer 8] Cache hit for query: "${input.query.substring(0, 50)}"`);
    return { ...cached, fromCache: true };
  }

  const topK = input.topK || 5;
  const queryTokens = extractKeywords(input.query);

  // Căutare în index
  let chunks = _ragIndex?.chunks || [];

  // Filtrare pe fișiere specifice dacă e cerut
  if (input.sourceFiles && input.sourceFiles.length > 0) {
    chunks = chunks.filter(c => input.sourceFiles!.includes(c.sourceFile));
  }

  // Scoring
  const scored: RagSearchResult[] = chunks
    .map(chunk => ({
      chunk,
      score: scoreChunk(chunk, queryTokens),
      matchType: 'hybrid' as const,
    }))
    .filter(r => r.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Căutare în observații externalizate
  const externalizedResults: ExternalizedObservation[] = [];
  if (input.includeExternalized) {
    for (const obs of _externalizedStore.values()) {
      const obsTokens = extractKeywords(obs.fullContent);
      const matchCount = queryTokens.filter(t => obsTokens.includes(t)).length;
      if (matchCount > 0) {
        externalizedResults.push(obs);
      }
    }
  }

  const output: RagEngineOutput = {
    results: scored,
    externalizedResults,
    totalFound: scored.length + externalizedResults.length,
    queryTokens,
    fromCache: false,
  };

  // Salvează în cache (cu eviction simplă)
  if (_searchCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = _searchCache.keys().next().value;
    if (firstKey) _searchCache.delete(firstKey);
  }
  _searchCache.set(cacheKey, output);

  console.log(
    `[Layer 8] RAG search: "${input.query.substring(0, 50)}" → ` +
    `${scored.length} chunks, ${externalizedResults.length} externalized`
  );

  return output;
}

// ─────────────────────────────────────────────────────────────
// EXTERNALIZED OBSERVATION STORAGE
// Stochează observații mari trimise din Layer 6
// ─────────────────────────────────────────────────────────────
export function storeExternalizedObservation(
  requestId: string,
  toolName: string,
  query: string,
  fullContent: string
): ExternalizedObservation {
  const id = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const observation: ExternalizedObservation = {
    id,
    requestId,
    toolName,
    query,
    fullContent,
    summary: buildSummary(fullContent),
    tokenCount: Math.ceil(fullContent.length / 4),
    storedAt: Date.now(),
  };

  _externalizedStore.set(id, observation);
  console.log(
    `[Layer 8] Stored externalized observation: ${id} ` +
    `(${observation.tokenCount} tokens from ${toolName})`
  );

  return observation;
}

export function retrieveExternalized(id: string): ExternalizedObservation | null {
  return _externalizedStore.get(id) ?? null;
}

function buildSummary(content: string): string {
  // Primele 400 caractere ca summary (~100 tokens)
  const firstChunk = content.substring(0, 400).trim();
  return firstChunk.length < content.length
    ? firstChunk + '...'
    : firstChunk;
}

// ─────────────────────────────────────────────────────────────
// FORMAT RESULTS — pentru injectare în context
// ─────────────────────────────────────────────────────────────
export function formatRagResults(
  output: RagEngineOutput,
  maxTokenBudget: number = 3000
): string {
  if (output.totalFound === 0) {
    return 'No relevant content found in workspace files.';
  }

  const parts: string[] = [];
  let tokenCount = 0;
  const charBudget = maxTokenBudget * 4;

  for (const result of output.results) {
    const entry =
      `**[${result.chunk.sourceFile} — chunk ${result.chunk.chunkIndex + 1}]** ` +
      `(relevance: ${Math.round(result.score * 100)}%)\n` +
      result.chunk.content;

    if (tokenCount + result.chunk.tokenCount > maxTokenBudget) {
      parts.push('[Additional results truncated — token budget reached]');
      break;
    }

    parts.push(entry);
    tokenCount += result.chunk.tokenCount;
  }

  // Adaugă observații externalizate relevante
  for (const obs of output.externalizedResults.slice(0, 2)) {
    parts.push(
      `**[Externalized from ${obs.toolName}]**\n` +
      `Summary: ${obs.summary}`
    );
  }

  return parts.join('\n\n---\n\n');
}

// ─────────────────────────────────────────────────────────────
// INVALIDARE CACHE
// ─────────────────────────────────────────────────────────────
export function invalidateRagCache(): void {
  _ragIndex = null;
  _searchCache.clear();
  _externalizedStore.clear();
  console.log('[Layer 8] RAG cache invalidated');
}

export function getRagIndexStats(): {
  totalChunks: number;
  sourceFiles: string[];
  externalizedCount: number;
  cacheEntries: number;
} {
  return {
    totalChunks: _ragIndex?.totalChunks ?? 0,
    sourceFiles: _ragIndex?.sourceFiles ?? [],
    externalizedCount: _externalizedStore.size,
    cacheEntries: _searchCache.size,
  };
}