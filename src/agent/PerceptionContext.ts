// ============================================================
// LAYER 3 — PERCEPTION CONTEXT
// Dynamic · Built per message · Injected after Layer 1
// Contains: temporal injection, intent parsing, situation model,
//           goal awareness, event detection, memory context
// ============================================================

import {
  PerceptionContextInput,
  PerceptionContextOutput,
  TemporalContext,
  ParsedIntent,
  SituationModel,
  DetectedEvent,
  UrgencyLevel,
  EmotionalTone,
  ComplexityLevel,
  OperationMode,
} from './types';

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — apelată la fiecare mesaj nou
// ─────────────────────────────────────────────────────────────
export function buildPerceptionContext(
  input: PerceptionContextInput
): PerceptionContextOutput {

  const temporalContext = buildTemporalContext();
  const situationModel = buildSituationModel(input);
  const parsedIntent = parseIntent(input.currentMessage, input.attachments, input.messageHistory);
  const detectedEvents = detectEvents(input.currentMessage, input.messageHistory, parsedIntent);
  const urgencyLevel = assessUrgency(input.currentMessage, detectedEvents);
  const emotionalTone = detectEmotionalTone(input.currentMessage, input.messageHistory);
  const { complexity, mode } = assessComplexityAndMode(
    parsedIntent,
    input.isAgentMode,
    input.proMode,
    detectedEvents
  );

  const dynamicPrompt = assembleDynamicPrompt({
    temporalContext,
    situationModel,
    parsedIntent,
    detectedEvents,
    urgencyLevel,
    emotionalTone,
    complexity,
    mode,
    memoryContext: input.memoryContext,
  });

  return {
    dynamicPrompt,
    temporalContext,
    parsedIntent,
    detectedEvents,
    urgencyLevel,
    emotionalTone,
    suggestedComplexity: complexity,
    suggestedMode: mode,
  };
}

// ─────────────────────────────────────────────────────────────
// 3.1 TEMPORAL INJECTION
// Timestamp intră AICI, nu în Layer 1
// ─────────────────────────────────────────────────────────────
function buildTemporalContext(): TemporalContext {
  const now = new Date();

  const hour = now.getHours();
  let timeOfDay: TemporalContext['timeOfDay'];
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  const currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const currentDateISO = now.toISOString().split('T')[0];

  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    currentDateTime,
    currentDateISO,
    dayOfWeek,
    timeOfDay,
    timezone,
    relevantForCalendar: false, // Va fi setat în parseIntent
  };
}

// ─────────────────────────────────────────────────────────────
// 3.2 INPUT PARSING — Intent, tip, cerințe
// ─────────────────────────────────────────────────────────────
function parseIntent(
  message: string,
  attachments: PerceptionContextInput['attachments'],
  history: PerceptionContextInput['messageHistory']
): ParsedIntent {
  const lowerMsg = message.toLowerCase();

  // Detectare tip mesaj
  const isQuestion = message.includes('?') ||
    /^(what|who|where|when|why|how|can you|could you|ce|cine|unde|când|cum|poți|ai putea)/i.test(message.trim());

  const isCommand = /^(create|make|build|generate|add|delete|remove|update|edit|save|search|find|show|list|get|open|close|fa|creează|adaugă|șterge|modifică|salvează|caută|găsește|arată|listează)/i.test(message.trim());

  const isClarification = history.length > 0 &&
    (lowerMsg.includes('no, i mean') || lowerMsg.includes('nu, vreau') ||
     lowerMsg.includes('actually') || lowerMsg.includes('de fapt') ||
     lowerMsg.includes('i meant') || message.length < 20);

  const isConversation = !isQuestion && !isCommand && !isClarification &&
    (lowerMsg.includes('hello') || lowerMsg.includes('salut') ||
     lowerMsg.includes('thanks') || lowerMsg.includes('mulțumesc') ||
     lowerMsg.includes('ok') || lowerMsg.includes('great'));

  let type: ParsedIntent['type'] = 'question';
  if (isCommand) type = 'command';
  else if (isClarification) type = 'clarification';
  else if (isConversation) type = 'conversation';

  // Detectare nevoi de tools
  const calendarKeywords = ['calendar', 'event', 'meeting', 'appointment', 'schedule',
    'tomorrow', 'today', 'next week', 'mâine', 'azi', 'săptămâna viitoare',
    'eveniment', 'întâlnire', 'programare'];

  const searchKeywords = ['search', 'find', 'look up', 'current', 'latest', 'news',
    'caută', 'găsește', 'actual', 'recent', 'știri', "what's happening"];

  const codeKeywords = ['code', 'script', 'run', 'execute', 'python', 'javascript',
    'calculate', 'cod', 'rulează', 'execută', 'calculează'];

  const writeKeywords = ['create', 'add', 'delete', 'update', 'save', 'edit',
    'creează', 'adaugă', 'șterge', 'modifică', 'salvează', 'editează'];

  const requiresCalendar = calendarKeywords.some(k => lowerMsg.includes(k));
  const requiresSearch = searchKeywords.some(k => lowerMsg.includes(k));
  const requiresCode = codeKeywords.some(k => lowerMsg.includes(k));
  const requiresLibrary = lowerMsg.includes('page') || lowerMsg.includes('note') ||
    lowerMsg.includes('library') || lowerMsg.includes('pagină') ||
    lowerMsg.includes('notiță') || lowerMsg.includes('bibliotecă');

  const requiresTools = requiresCalendar || requiresSearch || requiresCode ||
    requiresLibrary || attachments.length > 0;

  const requiresWrite = writeKeywords.some(k => lowerMsg.includes(k)) ||
    (requiresCalendar && isCommand);

  // Detectare ambiguitate
  const isAmbiguous = message.trim().length < 10 ||
    (isCommand && !message.includes(' ')) ||
    (requiresCalendar && !requiresSearch &&
     !lowerMsg.includes('today') && !lowerMsg.includes('tomorrow') &&
     !lowerMsg.includes('azi') && !lowerMsg.includes('mâine') &&
     !/\d{1,2}[\/\-\.]\d{1,2}/.test(message) &&
     !/\b(january|february|march|april|may|june|july|august|september|october|november|december|ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/i.test(message));

  // Real intent — inferit din context
  let real = message;
  if (requiresCalendar && !requiresSearch) {
    real = `User wants to perform a calendar operation: ${message}`;
  } else if (requiresSearch) {
    real = `User needs current/external information about: ${message}`;
  } else if (requiresCode) {
    real = `User wants to execute or generate code: ${message}`;
  } else if (requiresLibrary && isCommand) {
    real = `User wants to create or modify a library page: ${message}`;
  }

  return {
    literal: message,
    real,
    type,
    requiresTools,
    requiresWrite,
    isAmbiguous,
  };
}

// ─────────────────────────────────────────────────────────────
// 3.3 SITUATION MODEL — unde suntem în conversație
// ─────────────────────────────────────────────────────────────
function buildSituationModel(input: PerceptionContextInput): SituationModel {
  const relevantHistory = input.messageHistory.filter(m => m.role !== 'system');

  // Topic continuity — compară ultimele 2 mesaje
  let topicContinuity = true;
  if (relevantHistory.length >= 2) {
    const lastMessage = relevantHistory[relevantHistory.length - 1]?.content || '';
    const currentWords = new Set(input.currentMessage.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    const lastWords = new Set(lastMessage.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    const intersection = [...currentWords].filter(w => lastWords.has(w));
    topicContinuity = intersection.length > 0 || input.currentMessage.length < 30;
  }

  // Active task context — ultimul răspuns al agentului
  const lastAssistantMessage = [...relevantHistory]
    .reverse()
    .find(m => m.role === 'assistant' || m.role === 'model');
  const activeTaskContext = lastAssistantMessage
    ? lastAssistantMessage.content.substring(0, 200) + (lastAssistantMessage.content.length > 200 ? '...' : '')
    : '';

  return {
    isFirstMessageInSession: relevantHistory.length === 0,
    messageIndexInSession: relevantHistory.filter(m => m.role === 'user').length,
    topicContinuity,
    activeTaskContext,
    hasAttachments: input.attachments.length > 0,
    attachmentTypes: input.attachments.map(a => a.type),
    workspaceActive: input.workspaceActive || false,
    workspaceName: input.workspaceName,
  };
}

// ─────────────────────────────────────────────────────────────
// 3.5 EVENT DETECTION — urgență, frustrare, oportunități
// ─────────────────────────────────────────────────────────────
function detectEvents(
  message: string,
  history: PerceptionContextInput['messageHistory'],
  intent: ParsedIntent
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const lowerMsg = message.toLowerCase();
  const relevantHistory = history.filter(m => m.role === 'user');

  // Urgență
  const urgencySignals = ['urgent', 'asap', 'immediately', 'right now', 'critical',
    'emergency', 'urgent', 'imediat', 'acum', 'rapid', 'grabă', 'important'];
  if (urgencySignals.some(s => lowerMsg.includes(s))) {
    events.push({
      type: 'urgency',
      description: 'User indicated urgency or high priority',
      suggestedAction: 'Prioritize response speed over comprehensiveness',
    });
  }

  // Frustrare — repetare sau ton negativ
  if (relevantHistory.length >= 2) {
    const previousMessages = relevantHistory.slice(-3).map(m => m.content.toLowerCase());
    const currentCore = lowerMsg.replace(/[^a-zăâîșț\s]/g, '').trim();
    const isRepeat = previousMessages.some(prev => {
      const prevCore = prev.replace(/[^a-zăâîșț\s]/g, '').trim();
      return prevCore.length > 10 && (
        currentCore.includes(prevCore.substring(0, 20)) ||
        prevCore.includes(currentCore.substring(0, 20))
      );
    });

    const frustrationSignals = ["doesn't work", "not working", "wrong", "again", 'nu merge',
      'nu funcționează', 'greșit', 'iar', 'din nou', 'you said', 'ai spus',
      "that's not", 'nu asta'];

    if (isRepeat || frustrationSignals.some(s => lowerMsg.includes(s))) {
      events.push({
        type: 'frustration',
        description: 'User may be frustrated — repeated request or negative signal detected',
        suggestedAction: 'Change approach completely, acknowledge the issue directly',
      });
    }
  }

  // Schimbare de topic
  if (relevantHistory.length > 0) {
    const lastMsg = relevantHistory[relevantHistory.length - 1]?.content.toLowerCase() || '';
    const calendarInCurrent = /calendar|event|schedule|eveniment|calendar|programare/.test(lowerMsg);
    const codeInCurrent = /code|script|python|cod|script/.test(lowerMsg);
    const calendarInLast = /calendar|event|schedule|eveniment|calendar/.test(lastMsg);
    const codeInLast = /code|script|python|cod/.test(lastMsg);

    if ((calendarInCurrent && codeInLast) || (codeInCurrent && calendarInLast) ||
        (calendarInLast && !calendarInCurrent && message.length > 30)) {
      events.push({
        type: 'topic_change',
        description: 'Significant topic change detected from previous message',
        suggestedAction: 'Reset active task context, start fresh for new topic',
      });
    }
  }

  // Clarificare necesară
  if (intent.isAmbiguous) {
    events.push({
      type: 'clarification_needed',
      description: 'Message is ambiguous or lacks critical information',
      suggestedAction: 'Ask one specific clarifying question before proceeding',
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────
// URGENCY & EMOTIONAL TONE ASSESSMENT
// ─────────────────────────────────────────────────────────────
function assessUrgency(message: string, events: DetectedEvent[]): UrgencyLevel {
  const hasUrgencyEvent = events.some(e => e.type === 'urgency');
  const hasFrustration = events.some(e => e.type === 'frustration');
  const lowerMsg = message.toLowerCase();

  if (hasUrgencyEvent) return 'critical';
  if (hasFrustration) return 'high';
  if (lowerMsg.includes('when you have time') || lowerMsg.includes('no rush') ||
      lowerMsg.includes('când ai timp') || lowerMsg.includes('fără grabă')) return 'low';

  return 'normal';
}

function detectEmotionalTone(
  message: string,
  _history: PerceptionContextInput['messageHistory']
): EmotionalTone {
  const lowerMsg = message.toLowerCase();

  const positiveSignals = ['thanks', 'great', 'perfect', 'excellent', 'love it', 'awesome',
    'mulțumesc', 'super', 'perfect', 'excelent', 'minunat', '👍', '✅', '🎉'];
  const frustratedSignals = ["doesn't work", 'wrong', 'bad', 'terrible', 'useless',
    'nu merge', 'greșit', 'rău', 'inutil', '😤', '😠', '🤦'];
  const confusedSignals = ["i don't understand", 'confused', 'unclear', 'what do you mean',
    'nu înțeleg', 'confuz', 'neclar', 'ce vrei să spui', '?', 'huh', 'what?'];
  const urgentSignals = ['urgent', 'asap', 'immediately', 'right now', 'imediat', 'acum', 'rapid'];

  if (urgentSignals.some(s => lowerMsg.includes(s))) return 'urgent';
  if (frustratedSignals.some(s => lowerMsg.includes(s))) return 'frustrated';
  if (positiveSignals.some(s => lowerMsg.includes(s))) return 'positive';
  if (confusedSignals.some(s => lowerMsg.includes(s))) return 'confused';

  return 'neutral';
}

// ─────────────────────────────────────────────────────────────
// COMPLEXITY & MODE ASSESSMENT — output pentru Layer 4 Routing
// ─────────────────────────────────────────────────────────────
function assessComplexityAndMode(
  intent: ParsedIntent,
  isAgentMode?: boolean,
  proMode?: string,
  _events?: DetectedEvent[]
): { complexity: ComplexityLevel; mode: OperationMode } {

  // Agent Mode explicit activat de user
  if (isAgentMode) return { complexity: 'complex', mode: 'agent' };

  // ProMode Research sau Reasoning → agent
  if (proMode === 'research' || proMode === 'reasoning') {
    return { complexity: 'complex', mode: 'agent' };
  }

  // Ambiguitate → clarify first (tot chat mode)
  if (intent.isAmbiguous) return { complexity: 'ambiguous', mode: 'chat' };

  // Conversație simplă
  if (intent.type === 'conversation' || intent.type === 'clarification') {
    return { complexity: 'simple', mode: 'chat' };
  }

  // Necesită tools de scriere → medium sau complex
  if (intent.requiresWrite && intent.requiresTools) {
    return { complexity: 'medium', mode: 'chat' }; // Chat cu tools
  }

  // Necesită tools de citire simple
  if (intent.requiresTools && !intent.requiresWrite) {
    return { complexity: 'medium', mode: 'chat' };
  }

  return { complexity: 'simple', mode: 'chat' };
}

// ─────────────────────────────────────────────────────────────
// ASAMBLARE PROMPT DINAMIC — textul final al Layer 3
// ─────────────────────────────────────────────────────────────
function assembleDynamicPrompt(params: {
  temporalContext: TemporalContext;
  situationModel: SituationModel;
  parsedIntent: ParsedIntent;
  detectedEvents: DetectedEvent[];
  urgencyLevel: UrgencyLevel;
  emotionalTone: EmotionalTone;
  complexity: ComplexityLevel;
  mode: OperationMode;
  memoryContext?: string;
}): string {

  const {
    temporalContext, situationModel, parsedIntent,
    detectedEvents, urgencyLevel, emotionalTone,
    complexity, mode, memoryContext,
  } = params;

  const parts: string[] = [];

  // ── Separator Layer 1 → Layer 3 ──
  parts.push(`\n\n---\n## RUNTIME PERCEPTION (Layer 3 — injected per message)`);

  // ── 3.1 Temporal Context ──
  parts.push(`\n### Current Time & Date
**Now:** ${temporalContext.currentDateTime}
**ISO Date:** ${temporalContext.currentDateISO}
**Day:** ${temporalContext.dayOfWeek}
**Time of Day:** ${temporalContext.timeOfDay}
**Timezone:** ${temporalContext.timezone}

**Date Interpretation Rules (apply to this message):**
- "today" = ${temporalContext.currentDateISO}
- "tomorrow" = ${offsetDate(temporalContext.currentDateISO, 1)}
- "yesterday" = ${offsetDate(temporalContext.currentDateISO, -1)}
- "next week" = week starting ${offsetDate(temporalContext.currentDateISO, 7)}
- If user gives date without year and it has already passed this year → use next year
- ALWAYS calculate the absolute ISO date internally before calling any calendar tool`);

  // ── 3.2 Situation Model ──
  const sessionContext = situationModel.isFirstMessageInSession
    ? 'First message in this session.'
    : `Message ${situationModel.messageIndexInSession + 1} in session. ${situationModel.topicContinuity ? 'Continuing previous topic.' : 'Topic change detected.'}`;

  parts.push(`\n### Session Context
${sessionContext}${situationModel.workspaceActive ? `\nActive Workspace: **${situationModel.workspaceName || 'Unnamed Space'}**` : ''}${situationModel.hasAttachments ? `\nAttachments present: ${situationModel.attachmentTypes.join(', ')}` : ''}`);

  // ── Memory Context (din Layer 2, dacă există) ──
  if (memoryContext && memoryContext.trim().length > 0) {
    parts.push(`\n### Memory Context (relevant to this message)\n${memoryContext}`);
  }

  // ── 3.4 Goal Awareness (din events și intent) ──
  if (detectedEvents.length > 0) {
    const eventLines = detectedEvents
      .map(e => `- **${e.type.toUpperCase()}**: ${e.description} → ${e.suggestedAction}`)
      .join('\n');
    parts.push(`\n### Detected Events\n${eventLines}`);
  }

  // ── Urgency & Tone ──
  if (urgencyLevel !== 'normal' || emotionalTone !== 'neutral') {
    const urgencyNote = urgencyLevel !== 'normal'
      ? `Urgency: **${urgencyLevel.toUpperCase()}**` : '';
    const toneNote = emotionalTone !== 'neutral'
      ? `User tone: **${emotionalTone}**` : '';
    const notes = [urgencyNote, toneNote].filter(Boolean).join(' · ');

    parts.push(`\n### Response Guidance
${notes}${emotionalTone === 'frustrated' ? '\n→ Acknowledge directly. Change approach. Do not repeat the same strategy.' : ''}${emotionalTone === 'confused' ? '\n→ Simplify. Use concrete examples. Avoid jargon.' : ''}${urgencyLevel === 'critical' ? '\n→ Skip preamble. Deliver answer immediately.' : ''}`);
  }

  // ── 3.1/3.4 Routing Suggestion pentru Layer 4 ──
  parts.push(`\n### Routing Suggestion (for Layer 4)
Complexity: **${complexity}** · Mode: **${mode}**
Intent type: ${parsedIntent.type} · Requires tools: ${parsedIntent.requiresTools} · Requires write: ${parsedIntent.requiresWrite}${parsedIntent.isAmbiguous ? '\n⚠ AMBIGUOUS — ask one clarifying question before proceeding' : ''}`);

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────
// UTILITAR — offset dată simplă
// ─────────────────────────────────────────────────────────────
function offsetDate(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}