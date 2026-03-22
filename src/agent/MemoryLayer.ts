// ============================================================
// LAYER 2 — MEMORY LOAD
// Selective retrieval based on relevance to current prompt.
// Called once per message, AFTER Layer 1, BEFORE Layer 3.
// ============================================================

import { MemoryLayerInput, MemoryLayerOutput, MemoryEntry } from './types';

// Implicit token budget for Layer 2
const DEFAULT_MEMORY_TOKEN_BUDGET = 1500;

// Max entries per memory type
const MAX_ENTRIES_PER_TYPE = {
  episodic: 3,     // Summaries of previous conversations
  semantic: 8,     // Facts about user, projects, preferences
  procedural: 4,   // Communication style, likes/dislikes
  working: 10,     // Recent messages in current session (sliding window)
};

// ─────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────
export async function loadMemoryContext(
  input: MemoryLayerInput,
  memoryManager: any   // Reference to existing memoryManager
): Promise<MemoryLayerOutput> {

  const budget = input.maxTokenBudget || DEFAULT_MEMORY_TOKEN_BUDGET;

  try {
    // 1. Selective retrieval from each memory type
    const [episodic, semantic, procedural, working] = await Promise.all([
      retrieveEpisodicMemory(input.currentPrompt, memoryManager),
      retrieveSemanticMemory(input.currentPrompt, memoryManager),
      retrieveProceduralMemory(memoryManager),
      retrieveWorkingMemory(memoryManager),
    ]);

    // 2. Format and apply budget
    const formatted = formatMemoryContext(
      { episodic, semantic, procedural, working },
      budget
    );

    const tokenEstimate = Math.ceil(formatted.length / 4);

    console.log(
      `[Layer 2] Memory loaded: ${episodic.length} episodic, ` +
      `${semantic.length} semantic, ${procedural.length} procedural, ` +
      `${working.length} working. ~${tokenEstimate} tokens.`
    );

    return {
      formattedContext: formatted,
      tokenEstimate,
      loadedEntries: {
        episodic: episodic.length,
        semantic: semantic.length,
        procedural: procedural.length,
        working: working.length,
      },
      isEmpty: formatted.trim().length === 0,
    };

  } catch (error) {
    console.warn('[Layer 2] Memory load failed, continuing without memory:', error);
    return {
      formattedContext: '',
      tokenEstimate: 0,
      loadedEntries: { episodic: 0, semantic: 0, procedural: 0, working: 0 },
      isEmpty: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// RETRIEVAL: EPISODIC MEMORY
// Relevant summaries of past conversations
// ─────────────────────────────────────────────────────────────
async function retrieveEpisodicMemory(
  _prompt: string,
  memoryManager: any
): Promise<MemoryEntry[]> {
  try {
    // Get all episodic entries from semantic memory with category "episodic"
    const allEntries = memoryManager.semanticMemory?.getAllEntries?.() || [];

    const episodic = allEntries
      .filter((e: any) =>
        e.category === 'episodic' ||
        e.category === 'conversation' ||
        e.category === 'Events' ||
        e.type === 'episode'
      )
      .slice(-MAX_ENTRIES_PER_TYPE.episodic)  // Most recent
      .map((e: any) => ({
        id: e.id || String(Math.random()),
        type: 'episodic' as const,
        content: e.content || '',
        timestamp: e.timestamp,
        category: e.category,
      }));

    return episodic;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// RETRIEVAL: SEMANTIC MEMORY
// Facts about user, active projects, preferences
// Selective: Relevance score against current prompt
// ─────────────────────────────────────────────────────────────
async function retrieveSemanticMemory(
  prompt: string,
  memoryManager: any
): Promise<MemoryEntry[]> {
  try {
    const allEntries = memoryManager.semanticMemory?.getAllEntries?.() || [];
    const promptLower = prompt.toLowerCase();

    // Calculate relevance of each memory to the prompt
    const scored = allEntries
      .filter((e: any) =>
        e.category !== 'episodic' &&
        e.category !== 'conversation' &&
        e.content?.trim().length > 0
      )
      .map((e: any) => ({
        entry: e,
        score: calculateRelevanceScore(e.content || '', promptLower),
      }))
      .filter(({ score }: { score: number }) => score > 0.05)  // Minimum relevance threshold
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, MAX_ENTRIES_PER_TYPE.semantic);

    return scored.map(({ entry, score }: { entry: any, score: number }) => ({
      id: entry.id || String(Math.random()),
      type: 'semantic' as const,
      content: entry.content,
      relevanceScore: score,
      timestamp: entry.timestamp,
      category: entry.category,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// RETRIEVAL: PROCEDURAL MEMORY
// Preferred communication style, detected patterns
// No scoring needed — always loaded (few and important)
// ─────────────────────────────────────────────────────────────
async function retrieveProceduralMemory(
  memoryManager: any
): Promise<MemoryEntry[]> {
  try {
    const allEntries = memoryManager.semanticMemory?.getAllEntries?.() || [];

    const procedural = allEntries
      .filter((e: any) =>
        e.category === 'CommunicationStyle' ||
        e.category === 'Preferences' ||
        e.category === 'procedural' ||
        e.type === 'preference'
      )
      .slice(0, MAX_ENTRIES_PER_TYPE.procedural)
      .map((e: any) => ({
        id: e.id || String(Math.random()),
        type: 'procedural' as const,
        content: e.content,
        category: e.category,
      }));

    return procedural;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// RETRIEVAL: WORKING MEMORY
// Last messages from current session (sliding window)
// ─────────────────────────────────────────────────────────────
async function retrieveWorkingMemory(
  memoryManager: any
): Promise<MemoryEntry[]> {
  try {
    const buffer = memoryManager.workingMemory?.getMessages?.() || [];

    return buffer
      .slice(-MAX_ENTRIES_PER_TYPE.working)
      .map((msg: any, idx: number) => ({
        id: `working_${idx}`,
        type: 'working' as const,
        content: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
        timestamp: msg.timestamp,
      }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// RELEVANCE SCORING
// Simple and fast — keyword overlap + category boost
// ─────────────────────────────────────────────────────────────
function calculateRelevanceScore(memoryContent: string, promptLower: string): number {
  const contentLower = memoryContent.toLowerCase();

  // Extract significant words from prompt (ignore stopwords)
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why',
    'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
    'it', 'its', 'they', 'their', 'to', 'of', 'in', 'on', 'at', 'by',
    'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'nu', 'să', 'și', 'că', 'cu', 'de', 'la', 'în', 'pe', 'un', 'o',
    'este', 'sunt', 'era', 'fi', 'ai', 'am', 'au', 'ce', 'cum', 'care',
  ]);

  const promptWords = promptLower
    .split(/\W+/)
    .filter(w => w.length > 2 && !stopwords.has(w));

  if (promptWords.length === 0) return 0.1; // Prompt too short → minimal relevance

  let matches = 0;
  for (const word of promptWords) {
    if (contentLower.includes(word)) matches++;
  }

  const baseScore = matches / promptWords.length;

  // Boost if memory contains specific high-value keywords
  const highValueKeywords = [
    'project', 'proiect', 'work', 'muncă', 'prefer', 'like', 'dislike',
    'always', 'never', 'mereu', 'niciodată', 'important', 'urgent',
    'calendar', 'event', 'eveniment', 'meeting', 'întâlnire',
  ];

  let boost = 0;
  for (const kw of highValueKeywords) {
    if (contentLower.includes(kw) && promptLower.includes(kw)) {
      boost += 0.1;
    }
  }

  return Math.min(1.0, baseScore + boost);
}

// ─────────────────────────────────────────────────────────────
// CONTEXT FORMATTING
// Apply token budget and structure for injection into prompt
// ─────────────────────────────────────────────────────────────
function formatMemoryContext(
  memories: {
    episodic: MemoryEntry[];
    semantic: MemoryEntry[];
    procedural: MemoryEntry[];
    working: MemoryEntry[];
  },
  tokenBudget: number
): string {
  const charBudget = tokenBudget * 4;
  const parts: string[] = [];

  // Procedural: always first (affects response style)
  if (memories.procedural.length > 0) {
    const lines = memories.procedural.map(e => `- ${e.content}`).join('\n');
    parts.push(`### Communication Preferences\n${lines}`);
  }

  // Semantic: relevant facts
  if (memories.semantic.length > 0) {
    const lines = memories.semantic
      .map(e => `- [${e.category || 'fact'}] ${e.content}`)
      .join('\n');
    parts.push(`### Known Facts About You\n${lines}`);
  }

  // Episodic: relevant previous conversations
  if (memories.episodic.length > 0) {
    const lines = memories.episodic
      .map(e => `- ${e.content}`)
      .join('\n');
    parts.push(`### Previous Conversations (relevant)\n${lines}`);
  }

  // Working memory: last messages (do not duplicate if already in history)
  // Working memory is NOT included in Layer 2 context — it's already in conversation history
  // Only leave a summary if there are facts collected in the current session
  const sessionFacts = memories.working
    .filter(e => e.content.includes('[FACT]') || e.content.includes('[PREFERENCE]'))
    .slice(0, 3);

  if (sessionFacts.length > 0) {
    const lines = sessionFacts.map(e => `- ${e.content}`).join('\n');
    parts.push(`### Facts from Current Session\n${lines}`);
  }

  if (parts.length === 0) return '';

  const header = `## MEMORY CONTEXT (selective, relevant to current message)\n\n`;
  let result = header + parts.join('\n\n');

  // Apply budget
  if (result.length > charBudget) {
    result = result.substring(0, charBudget) + '\n[... memory truncated to fit token budget]';
  }

  return result;
}