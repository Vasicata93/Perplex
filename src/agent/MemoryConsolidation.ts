// ============================================================
// LAYER 10 — MEMORY CONSOLIDATION
// Asynchronous. Runs after response is returned to UI.
// Extracts and saves relevant information to long-term memory.
// NEVER blocks the response. Fails silently if needed.
// ============================================================

import {
  ConsolidationInput,
  ConsolidationOutput,
  ExtractedMemory,
  MemoryExtractionCategory,
  ConfidenceLevel,
} from './types';

// ─────────────────────────────────────────────────────────────
// EXTRACTION RULES — pattern-based, fără LLM call
// Suficient pentru Layer 10 în această etapă
// ─────────────────────────────────────────────────────────────

interface ExtractionRule {
  category: MemoryExtractionCategory;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray, fullText: string) => string | null;
  confidence: ConfidenceLevel;
}

const EXTRACTION_RULES: ExtractionRule[] = [

  // ── Preferințe declarate explicit ──
  {
    category: 'Preference',
    patterns: [
      /prefer(?:ez)?\s+(.{5,60})(?:\.|,|$)/i,
      /îmi place\s+(.{5,60})(?:\.|,|$)/i,
      /i (?:prefer|like|love|enjoy)\s+(.{5,60})(?:\.|,|$)/i,
      /always (?:use|prefer|do)\s+(.{5,60})(?:\.|,|$)/i,
    ],
    extract: (match) => `User prefers: ${match[1].trim()}`,
    confidence: 'high',
  },

  // ── Lucruri pe care nu le place ──
  {
    category: 'Preference',
    patterns: [
      /(?:nu|don't|do not|hate|dislike)\s+(?:îmi place|like|want|need)\s+(.{5,60})(?:\.|,|$)/i,
      /evit\s+(.{5,60})(?:\.|,|$)/i,
      /avoid\s+(.{5,60})(?:\.|,|$)/i,
    ],
    extract: (match) => `User dislikes/avoids: ${match[1].trim()}`,
    confidence: 'high',
  },

  // ── Fapte personale ──
  {
    category: 'PersonalFact',
    patterns: [
      /(?:sunt|lucrez ca|I am|I work as|my job is|job-ul meu este)\s+(?:un |o |a |an )?(.{3,50})(?:\.|,|$)/i,
      /(?:locuiesc în|trăiesc în|I live in|I'm based in|I'm from)\s+(.{3,50})(?:\.|,|$)/i,
      /(?:am|I have)\s+(\d+)\s+(?:ani|years old)/i,
    ],
    extract: (match) => `About user: ${match[0].trim()}`,
    confidence: 'high',
  },

  // ── Proiecte active ──
  {
    category: 'ActiveProject',
    patterns: [
      /(?:lucrez la|working on|building|am creat|developing)\s+(.{5,80})(?:\.|,|$)/i,
      /(?:proiectul meu|my project|our project)\s+(?:se numește|is called|is named)?\s*(.{3,60})(?:\.|,|$)/i,
    ],
    extract: (match) => `Active project: ${match[1]?.trim() || match[0].trim()}`,
    confidence: 'medium',
  },

  // ── Stil de comunicare ──
  {
    category: 'CommunicationStyle',
    patterns: [
      /(?:răspunde|please|te rog|poți)\s+(?:mereu|always|întotdeauna)\s+(.{5,60})(?:\.|,|$)/i,
      /(?:keep|păstrează)\s+(?:it|răspunsurile?)\s+(.{5,60})(?:\.|,|$)/i,
      /(?:use|folosește)\s+(.{3,40})\s+(?:format|language|tone|stil)/i,
    ],
    extract: (match) => `Communication preference: ${match[1]?.trim() || match[0].trim()}`,
    confidence: 'high',
  },

  // ── Corecții ──
  {
    category: 'Correction',
    patterns: [
      /(?:nu|no|wrong|greșit|incorect|that's not right)\s*[,.]?\s+(?:de fapt|actually|în realitate|the truth is)\s+(.{5,100})(?:\.|$)/i,
      /(?:am corectat|I corrected)\s+(.{5,80})(?:\.|$)/i,
    ],
    extract: (match) => `Correction noted: ${match[1]?.trim() || match[0].trim()}`,
    confidence: 'high',
  },
];

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — asincronă, non-blocking
// ─────────────────────────────────────────────────────────────
export async function consolidateMemory(
  input: ConsolidationInput,
  memoryManager: any       // Referință la memoryManager existent
): Promise<ConsolidationOutput> {
  const startTime = Date.now();

  const output: ConsolidationOutput = {
    extracted: [],
    saved: 0,
    replaced: 0,
    skipped: 0,
    durationMs: 0,
  };

  try {
    // 1. Extrage memorii din mesajul curent al utilizatorului
    const fromUser = extractFromText(
      input.currentPrompt,
      0,
      input.conversationHistory.length - 1
    );

    // 2. Extrage memorii din răspunsul agentului
    // (fapte confirmate, preferințe identificate de agent)
    const fromAgent = extractFromAgentResponse(
      input.currentResponse,
      input.currentPrompt
    );

    output.extracted = [...fromUser, ...fromAgent];

    if (output.extracted.length === 0) {
      console.log('[Layer 10] No new memories to consolidate');
      output.durationMs = Date.now() - startTime;
      return output;
    }

    // 3. Deduplicare față de memoriile existente
    const deduplicated = deduplicateMemories(
      output.extracted,
      input.existingMemories || []
    );

    output.skipped = output.extracted.length - deduplicated.length;

    // 4. Salvare în memoryManager
    for (const memory of deduplicated) {
      try {
        await saveMemoryEntry(memory, memoryManager);
        output.saved++;
      } catch (e) {
        console.warn(`[Layer 10] Failed to save memory: ${memory.content}`, e);
        output.skipped++;
      }
    }

    // 5. Rezumat episodic opțional
    if (input.enableEpisodicSummary && input.conversationHistory.length >= 6) {
      output.episodicSummary = buildEpisodicSummary(
        input.conversationHistory,
        input.currentPrompt,
        input.currentResponse
      );

      if (output.episodicSummary) {
        try {
          await saveEpisodicSummary(output.episodicSummary, memoryManager);
          output.saved++;
        } catch (e) {
          console.warn('[Layer 10] Failed to save episodic summary', e);
        }
      }
    }

    console.log(
      `[Layer 10] Consolidation complete: ` +
      `${output.saved} saved, ${output.replaced} replaced, ` +
      `${output.skipped} skipped · ${Date.now() - startTime}ms`
    );

  } catch (error) {
    // Layer 10 eșuează silently — nu blochează nimic
    console.warn('[Layer 10] Consolidation failed silently:', error);
  }

  output.durationMs = Date.now() - startTime;
  return output;
}

// ─────────────────────────────────────────────────────────────
// EXTRAGERE DIN TEXT UTILIZATOR
// ─────────────────────────────────────────────────────────────
function extractFromText(
  text: string,
  messageIndex: number,
  _historyLength: number // unused
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (const rule of EXTRACTION_RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        const content = rule.extract(match, text);
        if (content && content.length > 10) {
          memories.push({
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category: rule.category,
            content,
            confidence: rule.confidence,
            sourceMessageIndex: messageIndex,
          });
          break; // Un singur match per rule per text
        }
      }
    }
  }

  return memories;
}

// ─────────────────────────────────────────────────────────────
// EXTRAGERE DIN RĂSPUNSUL AGENTULUI
// Agentul poate identifica explicit fapte despre utilizator
// ─────────────────────────────────────────────────────────────
function extractFromAgentResponse(
  response: string,
  userPrompt: string
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  // Detectează când agentul confirmă explicit o preferință
  const preferenceConfirmPatterns = [
    /I(?:'ve)? noted that you prefer\s+(.{5,80})(?:\.|$)/i,
    /Am notat că preferi\s+(.{5,80})(?:\.|$)/i,
    /You (?:mentioned|said) you\s+(.{5,80})(?:\.|$)/i,
    /Ai menționat că\s+(.{5,80})(?:\.|$)/i,
    /\[FACT\]\s+(.{5,120})(?:\n|$)/,
    /\[PREFERENCE\]\s+(.{5,120})(?:\n|$)/,
  ];

  for (const pattern of preferenceConfirmPatterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      memories.push({
        id: `mem_agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category: 'Preference',
        content: match[1].trim(),
        confidence: 'medium',
        sourceMessageIndex: -1, // -1 = din răspunsul agentului
      });
    }
  }

  // Detectează corecții: utilizatorul a corectat agentul
  const correctionSignals = [
    'no,', 'nu,', "that's wrong", 'greșit', 'incorect',
    "you're wrong", 'actually', 'de fapt', 'în realitate',
  ];
  const promptLower = userPrompt.toLowerCase();
  const hasCorrectionSignal = correctionSignals.some(s => promptLower.startsWith(s));

  if (hasCorrectionSignal) {
    memories.push({
      id: `mem_correction_${Date.now()}`,
      category: 'Correction',
      content: `User corrected agent: "${userPrompt.substring(0, 100)}"`,
      confidence: 'high',
      sourceMessageIndex: -1,
    });
  }

  return memories;
}

// ─────────────────────────────────────────────────────────────
// DEDUPLICARE
// Evită salvarea aceluiași fapt de două ori
// ─────────────────────────────────────────────────────────────
function deduplicateMemories(
  newMemories: ExtractedMemory[],
  existingMemories: any[]
): ExtractedMemory[] {
  if (existingMemories.length === 0) return newMemories;

  return newMemories.filter(newMem => {
    const newContentLower = newMem.content.toLowerCase();

    const isDuplicate = existingMemories.some(existing => {
      const existingContent = (existing.content || '').toLowerCase();
      // Similaritate simplă: overlap de cuvinte > 70%
      const newWords = new Set(newContentLower.split(/\s+/).filter((w: string) => w.length > 3));
      const existingWords = new Set(existingContent.split(/\s+/).filter((w: string) => w.length > 3));
      if (newWords.size === 0) return false;

      const intersection = [...newWords].filter(w => existingWords.has(w));
      const similarity = intersection.length / newWords.size;
      return similarity > 0.7;
    });

    if (isDuplicate) {
      console.log(`[Layer 10] Skipping duplicate: "${newMem.content.substring(0, 50)}"`);
    }

    return !isDuplicate;
  });
}

// ─────────────────────────────────────────────────────────────
// SALVARE ÎN MEMORY MANAGER
// Adaptare la API-ul existent din aplicație
// ─────────────────────────────────────────────────────────────
async function saveMemoryEntry(
  memory: ExtractedMemory,
  memoryManager: any
): Promise<void> {
  // Adaptare la API-ul existent al memoryManager din Perplex
  // Poate fi memoryManager.addFact(), memoryManager.save(), etc.
  // Verifică API-ul real din memory.ts și ajustează

  if (memoryManager.semanticMemory?.addEntry) {
    await memoryManager.semanticMemory.addEntry({
      id: memory.id,
      category: memory.category,
      content: memory.content,
      confidence: memory.confidence,
      timestamp: Date.now(),
      type: memory.category === 'CommunicationStyle' ? 'preference' : 'fact',
    });
    return;
  }

  if (memoryManager.addFact) {
    await memoryManager.addFact(memory.content, memory.category);
    return;
  }

  if (memoryManager.save) {
    await memoryManager.save({
      content: memory.content,
      category: memory.category,
      timestamp: Date.now(),
    });
    return;
  }

  // Fallback generic
  console.warn(
    '[Layer 10] Cannot find save method on memoryManager. ' +
    'Check memory.ts API and update saveMemoryEntry().'
  );
}

// ─────────────────────────────────────────────────────────────
// REZUMAT EPISODIC
// Construit din ultimele mesaje, fără LLM call
// ─────────────────────────────────────────────────────────────
function buildEpisodicSummary(
  history: ConsolidationInput['conversationHistory'],
  currentPrompt: string,
  currentResponse: string
): string | undefined {
  // Luăm ultimele 6 mesaje + mesajul curent
  const recentMessages = history.slice(-6);

  // Detectăm dacă conversația a abordat un topic important
  const allText = recentMessages.map(m => m.content).join(' ').toLowerCase();

  const importantTopics = [
    { keyword: 'calendar', label: 'calendar management' },
    { keyword: 'proiect', label: 'project discussion' },
    { keyword: 'project', label: 'project discussion' },
    { keyword: 'buget', label: 'budget/finance' },
    { keyword: 'budget', label: 'budget/finance' },
    { keyword: 'cod', label: 'coding session' },
    { keyword: 'code', label: 'coding session' },
    { keyword: 'decizie', label: 'decision making' },
    { keyword: 'decision', label: 'decision making' },
  ];

  const detectedTopic = importantTopics.find(t => allText.includes(t.keyword));

  if (!detectedTopic) return undefined;

  // Construiește rezumat minimal
  const userMessages = recentMessages
    .filter(m => m.role === 'user')
    .map(m => m.content.substring(0, 80))
    .join('; ');

  const summary =
    `[${new Date().toLocaleDateString()}] Session about ${detectedTopic.label}. ` +
    `User asked about: ${userMessages.substring(0, 200)}. ` +
    // Integrate currentPrompt and currentResponse (Warning 11 & 12)
    `Latest interaction: Q: "${currentPrompt.substring(0, 50)}..." A: "${currentResponse.substring(0, 50)}..."`;

  return summary;
}

async function saveEpisodicSummary(
  summary: string,
  memoryManager: any
): Promise<void> {
  await saveMemoryEntry(
    {
      id: `episodic_${Date.now()}`,
      category: 'EpisodicSummary',
      content: summary,
      confidence: 'medium',
      sourceMessageIndex: -1,
    },
    memoryManager
  );
}

// ─────────────────────────────────────────────────────────────
// EXPORT: Trigger asincron pentru geminiService
// ─────────────────────────────────────────────────────────────

/**
 * Fire-and-forget wrapper.
 * Apelat după return din runCoreGeneration.
 * Nu returnează nimic — orice eroare e logată și ignorată.
 */
export function triggerConsolidation(
  input: ConsolidationInput,
  memoryManager: any
): void {
  // setTimeout 0 asigură că rulează DUPĂ ce response-ul a ajuns în UI
  setTimeout(async () => {
    try {
      const result = await consolidateMemory(input, memoryManager);
      if (result.saved > 0) {
        console.log(
          `[Layer 10] Background consolidation: ` +
          `${result.saved} memories saved in ${result.durationMs}ms`
        );
      }
    } catch (e) {
      console.warn('[Layer 10] Background consolidation error (non-blocking):', e);
    }
  }, 0);
}