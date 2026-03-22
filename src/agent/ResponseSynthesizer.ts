// ============================================================
// LAYER 7 — RESPONSE SYNTHESIZER
// Post-processing al răspunsului modelului.
// Nu generează conținut nou — structurează ce există.
// ============================================================

import {
  SynthesisInput,
  SynthesisOutput,
  SynthesisQualityCheck,
  ResponseFormat,
  Citation,
  RelatedQuestion,
  ConfidenceLevel,
  ExecutionLog,
  RoutingDecision,
} from './types';

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ
// ─────────────────────────────────────────────────────────────
export function synthesizeResponse(input: SynthesisInput): SynthesisOutput {

  // 1. Curăță output-ul brut al modelului
  const cleanedText = cleanModelOutput(input.rawModelOutput || "");

  // 2. Detectează formatul răspunsului
  const format = detectResponseFormat(cleanedText, input.routingDecision);

  // 3. Extrage și normalizează citările
  const citations = extractCitations(cleanedText, input.searchResults || []);

  // 4. Generează întrebări sugestive (Rule 8 din Layer 1)
  const relatedQuestions = extractOrGenerateRelatedQuestions(
    cleanedText,
    input.currentMessage,
    format
  );

  // 5. Detectează PendingAction dacă există
  const pendingAction = detectPendingAction(cleanedText, input.executionLog);

  // 6. Evaluează nivelul de încredere
  const confidence = assessConfidence(cleanedText, input.executionLog, input.routingDecision);

  // 7. Quality Check
  const qualityCheck = runQualityCheck({
    text: cleanedText,
    format,
    citations,
    input,
  });

  // 8. Textul final (cu citări normalizate)
  const finalText = normalizeCitations(cleanedText, citations);

  console.log(
    `[Layer 7] Synthesis complete. Format: ${format} · ` +
    `Citations: ${citations.length} · ` +
    `Related: ${relatedQuestions.length} · ` +
    `Quality: ${qualityCheck.passed ? 'OK' : 'WARNINGS: ' + qualityCheck.warnings.join(', ')}`
  );

  return {
    finalText,
    format,
    citations,
    relatedQuestions,
    pendingAction,
    qualityCheck,
    confidence,
    operationMode: input.routingDecision.operationMode,
    reasoning: buildSynthesisReasoning(format, citations.length, qualityCheck),
  };
}

// ─────────────────────────────────────────────────────────────
// 7.1 — CURĂȚARE OUTPUT BRUT
// Elimină artefacte ale modelului care nu trebuie afișate
// ─────────────────────────────────────────────────────────────
function cleanModelOutput(raw: string): string {
  let text = raw;

  // Elimină thinking tags (dacă modelul le-a lăsat în output)
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  // Elimină thinking tags incomplete (model a oprit generarea în mijloc)
  text = text.replace(/<thinking>[\s\S]*/gi, '').trim();

  // Elimină prefix-uri auto-generate de unele modele
  text = text.replace(/^(Assistant:|AI:|Perplex:)\s*/i, '');

  // Normalizează newline-uri multiple (maxim 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Elimină spații trailing per linie
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  return text.trim();
}

// ─────────────────────────────────────────────────────────────
// 7.2 — DETECTARE FORMAT RĂSPUNS
// ─────────────────────────────────────────────────────────────
function detectResponseFormat(text: string, routing: RoutingDecision): ResponseFormat {

  // Widget — sintaxa :::widget din Layer 1 Core Skill 4
  if (/^:::widget/m.test(text)) return 'widget';

  // PendingAction — JSON special în răspuns
  if (/```json[\s\S]*?"type"\s*:\s*"pending_action"/i.test(text) ||
      (text.includes('"pendingAction"') && text.includes('{')) ||
      text.includes('PENDING_ACTION:')) {
    return 'pending_action';
  }

  // Clarificare
  if (routing.needsClarification || routing.complexity === 'ambiguous') {
    return 'clarification';
  }

  // Bloc de cod dominant
  const codeBlockMatches = text.match(/```[\s\S]*?```/g) || [];
  const codeBlockLength = codeBlockMatches.reduce((sum, b) => sum + b.length, 0);
  if (codeBlockLength > text.length * 0.4) return 'code_block';

  // Markdown structurat (headere, liste)
  if (/^#{1,3}\s/m.test(text) || /^\*\s/m.test(text) || /^-\s/m.test(text)) {
    return 'markdown';
  }

  // Error response
  if (/^(Error|Eroare|Failed|Eșuat|Nu am putut|Could not|Unable to)/i.test(text.trim())) {
    return 'error_response';
  }

  return 'plain_text';
}

// ─────────────────────────────────────────────────────────────
// 7.3 — EXTRAGERE CITĂRI
// Normalizează citările [1], [2] din textul modelului
// cu datele reale din search results
// ─────────────────────────────────────────────────────────────
function extractCitations(
  text: string,
  searchResults: SynthesisInput['searchResults']
): Citation[] {
  if (!searchResults || searchResults.length === 0) return [];

  const citations: Citation[] = [];
  const citationPattern = /\[(\d+)\]/g;
  const foundIndices = new Set<number>();

  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    const idx = parseInt(match[1], 10);
    if (!isNaN(idx) && idx >= 1 && !foundIndices.has(idx)) {
      foundIndices.add(idx);
      const source = searchResults[idx - 1]; // 1-indexed
      if (source) {
        citations.push({
          index: idx,
          uri: source.uri,
          title: source.title,
          snippet: source.snippet,
        });
      }
    }
  }

  // Sortare după index
  return citations.sort((a, b) => a.index - b.index);
}

// Normalizează citările în textul final
// (se asigură că nu există referințe la surse inexistente)
function normalizeCitations(text: string, citations: Citation[]): string {
  if (citations.length === 0) {
    // Elimină orice [N] rămas dacă nu avem surse reale
    return text.replace(/\[\d+\]/g, '').trim();
  }
  return text;
}

// ─────────────────────────────────────────────────────────────
// 7.4 — RELATED QUESTIONS (Rule 8 din Layer 1)
// Extrage din textul modelului sau marchează ca lipsă
// ─────────────────────────────────────────────────────────────
function extractOrGenerateRelatedQuestions(
  text: string,
  _currentMessage: string,
  format: ResponseFormat
): RelatedQuestion[] {

  // Nu generăm întrebări pentru confirmări, erori sau clarificări
  const skipFormats: ResponseFormat[] = ['error_response', 'clarification', 'pending_action'];
  if (skipFormats.includes(format)) return [];

  // Modelul ar trebui să fi generat deja întrebările sugestive după `---`
  // Extragere din formatul definit în Rule 8:
  // ---
  // - Întrebare 1?
  // - Întrebare 2?
  // - Întrebare 3?
  const separatorPattern = /\n---\n([\s\S]+)$/;
  const match = text.match(separatorPattern);

  if (match) {
    const questionsSection = match[1];
    const questionLines = questionsSection
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 5 && line.includes('?'));

    if (questionLines.length > 0) {
      return questionLines.slice(0, 3).map(q => ({
        text: q,
        category: 'follow_up' as const,
      }));
    }
  }

  // Dacă modelul nu a generat întrebări sugestive → returnăm array gol
  // Nu generăm întrebări inventate în Layer 7 — modelul ar trebui să o facă
  return [];
}

// ─────────────────────────────────────────────────────────────
// 7.5 — DETECTARE PENDING ACTION
// Extrage PendingAction din răspunsul modelului dacă există
// ─────────────────────────────────────────────────────────────
function detectPendingAction(
  text: string,
  executionLog: ExecutionLog | null
): any | undefined {

  // Modelul poate genera PendingAction ca JSON în răspuns
  // Format așteptat: ```json\n{ "type": "pending_action", ... }\n```
  const jsonBlockPattern = /```json\s*([\s\S]*?)\s*```/gi;
  let match;

  while ((match = jsonBlockPattern.exec(text)) !== null) {
    try {
      // Try to parse the JSON content inside the block
      const content = match[1].trim();
      if (!content.startsWith('{')) continue;
      
      const parsed = JSON.parse(content);
      if (parsed.type === 'pending_action' || parsed.pendingAction) {
        return parsed.pendingAction || parsed;
      }
    } catch {
      // Invalid JSON inside block, continue searching
    }
  }

  // Verifică dacă există write tools în execution log care necesită confirmare
  if (executionLog) {
    const writeToolsExecuted = executionLog.entries
      .filter(e =>
        e.type === 'tool_call' &&
        e.toolCall?.status === 'success' &&
        [
          'add_calendar_event', 'update_calendar_event', 'delete_calendar_event',
          'create_page', 'update_page', 'insert_block', 'replace_block',
          'delete_block', 'update_table_cell',
        ].includes(e.toolCall?.toolName || '')
      );

    if (writeToolsExecuted.length > 0) {
      // Write tools au rulat — PendingAction ar trebui să fi fost generat de model
      // Dacă nu a fost, loghează avertisment
      console.warn('[Layer 7] Write tools executed but no PendingAction detected in response');
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────
// 7.6 — EVALUARE NIVEL DE ÎNCREDERE
// ─────────────────────────────────────────────────────────────
function assessConfidence(
  text: string,
  executionLog: ExecutionLog | null,
  routing: RoutingDecision
): ConfidenceLevel {
  const lowerText = text.toLowerCase();

  // Semnale de încredere scăzută
  const lowConfidenceSignals = [
    "i'm not sure", "nu sunt sigur", "i think", "cred că",
    "might be", "ar putea fi", "possibly", "posibil",
    "i cannot verify", "nu pot verifica", "uncertain", "incert",
    "you should verify", "ar trebui să verifici", '?',
  ];

  // Semnale de încredere ridicată
  const highConfidenceSignals = [
    'confirmed', 'confirmat', 'verified', 'verificat',
    'according to', 'conform', 'source:', 'sursă:',
  ];

  const lowCount = lowConfidenceSignals.filter(s => lowerText.includes(s)).length;
  const highCount = highConfidenceSignals.filter(s => lowerText.includes(s)).length;

  // Dacă au existat tool calls de search cu succes → medium minim
  const hasSuccessfulSearch = executionLog?.entries.some(
    e => e.type === 'tool_call' &&
    e.toolCall?.toolName === 'perform_search' &&
    e.toolCall?.status === 'success'
  ) ?? false;

  if (lowCount >= 2) return 'low';
  if (highCount >= 2 || hasSuccessfulSearch) return 'high';
  return 'medium';
}

// ─────────────────────────────────────────────────────────────
// 7.7 — QUALITY CHECK
// Verificări minimale înainte de a returna răspunsul
// ─────────────────────────────────────────────────────────────
function runQualityCheck(params: {
  text: string;
  format: ResponseFormat;
  citations: Citation[];
  input: SynthesisInput;
}): SynthesisQualityCheck {
  const { text, format, citations, input } = params;
  const warnings: string[] = [];

  // Check 1: Citări prezente când search a rulat
  const searchWasUsed = input.executionLog?.entries.some(
    e => e.toolCall?.toolName === 'perform_search' && e.toolCall?.status === 'success'
  ) ?? false;
  const hasCitationsWhenNeeded = searchWasUsed ? citations.length > 0 : true;
  if (!hasCitationsWhenNeeded) {
    warnings.push('Search was used but no citations found in response');
  }

  // Check 2: Nivel de încredere menționat pentru claims factuale
  const hasFactualClaims = searchWasUsed || input.routingDecision.injectedSkills.includes('research_skill');
  const confidenceSignals = /i'm confident|sunt sigur|i cannot verify|nu pot verifica|high confidence|low confidence/i.test(text);
  const hasConfidenceWhenNeeded = hasFactualClaims ? confidenceSignals || citations.length > 0 : true;
  if (!hasConfidenceWhenNeeded) {
    warnings.push('Factual claims present but no confidence declaration detected');
  }

  // Check 3: Widget generat pentru date vizuale
  const dataSkillActive = input.routingDecision.injectedSkills.includes('data_analysis_skill');
  const hasNumericalData = /\d+[.,]\d+|\d{4,}/.test(text) && dataSkillActive;
  const hasWidgetWhenNeeded = hasNumericalData ? format === 'widget' || format === 'code_block' : true;
  if (!hasWidgetWhenNeeded) {
    warnings.push('Numerical data present but no widget generated');
  }

  // Check 4: Lungimea răspunsului adecvată
  const wordCount = text.split(/\s+/).length;
  const isSimple = input.routingDecision.complexity === 'simple';
  const lengthAppropriate = isSimple ? wordCount < 150 : wordCount > 10;
  if (!lengthAppropriate) {
    warnings.push(isSimple
      ? 'Response too long for simple request'
      : 'Response suspiciously short for complex request'
    );
  }

  // Check 5: Nicio dată personală inventată (verificare de bază)
  // Detectăm pattern-uri care sugerează date inventate (ID-uri, UUID-uri în răspuns direct)
  const hasInventedIds = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}\b/i.test(text) &&
    !input.executionLog?.entries.some(e => e.type === 'observation');
  const noInventedData = !hasInventedIds;
  if (!noInventedData) {
    warnings.push('Possible invented IDs detected in response without tool data');
  }

  const passed = warnings.length === 0;

  if (warnings.length > 0) {
    console.warn('[Layer 7] Quality check warnings:', warnings);
  }

  return {
    hasCitationsWhenNeeded,
    hasConfidenceWhenNeeded,
    hasWidgetWhenNeeded,
    lengthAppropriate,
    noInventedData,
    passed,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER — reasoning summary pentru debugging
// ─────────────────────────────────────────────────────────────
function buildSynthesisReasoning(
  format: ResponseFormat,
  citationCount: number,
  quality: SynthesisQualityCheck
): string {
  return [
    `Format: ${format}`,
    `Citations: ${citationCount}`,
    `Quality: ${quality.passed ? 'passed' : quality.warnings.join('; ')}`,
  ].join(' · ');
}