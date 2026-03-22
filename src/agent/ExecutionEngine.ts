// ============================================================
// LAYER 6 — EXECUTION ENGINE
// Orchestrează execuția tool call-urilor.
// Append-only execution log. Retry logic. Cost Guard enforcement.
// ============================================================

import {
  ExecutionEngineInput,
  ExecutionLog,
  ExecutionLogEntry,
  ToolCallRecord,
  FallbackRule,
  ThinkingEvent,
  DEFAULT_COST_GUARD,
} from './types';

// ─────────────────────────────────────────────────────────────
// FALLBACK RULES — definite static, una per tool critic
// ─────────────────────────────────────────────────────────────
const FALLBACK_RULES: FallbackRule[] = [
  {
    failedTool: 'perform_search',
    fallbackAction: 'retry',
    maxRetries: DEFAULT_COST_GUARD.maxToolRetries,
    // La retry, reformulează query-ul (logica de reformulare e în geminiService)
  },
  {
    failedTool: 'read_workspace_files',
    fallbackAction: 'alternative_tool',
    alternativeTool: 'search_workspace_files',
    alternativeParams: (params) => ({
      queries: [params.filenames?.[0] || ''],
    }),
    maxRetries: 1,
  },
  {
    failedTool: 'get_page_structure',
    fallbackAction: 'skip',
    maxRetries: 1,
  },
  {
    failedTool: 'list_calendar_events',
    fallbackAction: 'retry',
    maxRetries: DEFAULT_COST_GUARD.maxToolRetries,
  },
  {
    failedTool: 'semantic_search_workspace',
    fallbackAction: 'alternative_tool',
    alternativeTool: 'search_workspace_files',
    alternativeParams: (params) => ({ queries: [params.query] }),
    maxRetries: 1,
  },
];

function getFallbackRule(toolName: string): FallbackRule | null {
  return FALLBACK_RULES.find(r => r.failedTool === toolName) ?? null;
}

// ─────────────────────────────────────────────────────────────
// EXECUTION LOG — append-only, imutabil după scriere
// ─────────────────────────────────────────────────────────────
export function createExecutionLog(requestId: string): ExecutionLog {
  return {
    sessionId: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()),
    requestId,
    entries: [],
    totalToolCalls: 0,
    totalDurationMs: 0,
    status: 'in_progress',
    costGuardTriggered: false,
  };
}

export function appendToLog(
  log: ExecutionLog,
  type: ExecutionLogEntry['type'],
  content: string,
  toolCall?: ToolCallRecord
): void {
  // APPEND ONLY — nu modificăm niciodată o intrare existentă
  log.entries.push({
    sequenceId: log.entries.length + 1,
    type,
    content,
    toolCall,
    timestamp: Date.now(),
  });

  if (type === 'tool_call' && toolCall) {
    log.totalToolCalls++;
  }
}

// ─────────────────────────────────────────────────────────────
// OBSERVATION EXTERNALIZATION
// Dacă un rezultat depășește maxObservationTokens → externalizare
// ─────────────────────────────────────────────────────────────
function externalizeIfNeeded(
  toolName: string,
  result: any,
  record: ToolCallRecord
): { content: string; wasExternalized: boolean } {
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
  const estimatedTokens = Math.ceil(resultStr.length / 4);

  if (estimatedTokens > DEFAULT_COST_GUARD.maxObservationTokens) {
    // Externalizare: păstrăm doar un rezumat în context
    record.wasExternalized = true;
    record.tokenCount = estimatedTokens;

    const preview = resultStr.substring(0, 400);
    return {
      content: `[EXTERNALIZED — ${estimatedTokens} tokens → RAG storage]\nTool: ${toolName}\nPreview: ${preview}...\nFull content available via read/search tools.`,
      wasExternalized: true,
    };
  }

  record.tokenCount = estimatedTokens;
  return { content: resultStr, wasExternalized: false };
}

// ─────────────────────────────────────────────────────────────
// COST GUARD CHECK
// ─────────────────────────────────────────────────────────────
export function checkCostGuard(
  log: ExecutionLog,
  input: ExecutionEngineInput
): { shouldStop: boolean; reason?: string } {
  const toolCallCount = log.entries.filter(e => e.type === 'tool_call').length;

  if (toolCallCount >= DEFAULT_COST_GUARD.maxToolCallsPerRequest) {
    log.costGuardTriggered = true;
    return {
      shouldStop: true,
      reason: `Cost Guard: reached maximum ${DEFAULT_COST_GUARD.maxToolCallsPerRequest} tool calls per request`,
    };
  }

  // Warning la warnAtIteration
  if (
    toolCallCount === DEFAULT_COST_GUARD.warnAtIteration &&
    input.onCostGuardWarning
  ) {
    input.onCostGuardWarning(toolCallCount);
  }

  return { shouldStop: false };
}

// ─────────────────────────────────────────────────────────────
// TOOL CALL RECORD BUILDER
// ─────────────────────────────────────────────────────────────
function buildToolCallRecord(
  toolName: string,
  parameters: Record<string, any>,
  attemptNumber: number = 1
): ToolCallRecord {
  return {
    id: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now() + Math.random()),
    toolName,
    parameters,
    status: 'running',
    attemptNumber,
    startedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────
// CORE: processToolCall
// Execută un singur tool call cu retry logic
// NOTĂ: Execuția reală este delegată la geminiService prin callback
// Layer 6 gestionează logica — nu apelează direct tool-urile
// ─────────────────────────────────────────────────────────────
export async function processToolCall(
  toolName: string,
  parameters: Record<string, any>,
  executeTool: (name: string, params: any) => Promise<any>,
  log: ExecutionLog,
  input: ExecutionEngineInput
): Promise<ToolCallRecord> {

  // Verifică Cost Guard înainte de fiecare apel
  const guard = checkCostGuard(log, input);
  if (guard.shouldStop) {
    const skippedRecord: ToolCallRecord = {
      ...buildToolCallRecord(toolName, parameters),
      status: 'skipped',
      error: guard.reason,
      completedAt: Date.now(),
    };
    appendToLog(log, 'cost_guard', guard.reason!, skippedRecord);
    return skippedRecord;
  }

  // Verifică dacă tool-ul este în lista de tools active (Layer 4)
  if (input.availableTools.size > 0 && !input.availableTools.has(toolName)) {
    const blockedRecord: ToolCallRecord = {
      ...buildToolCallRecord(toolName, parameters),
      status: 'skipped',
      error: `Tool '${toolName}' is not active in current Tool State (Layer 4)`,
      completedAt: Date.now(),
    };
    appendToLog(log, 'skip', blockedRecord.error!, blockedRecord);
    return blockedRecord;
  }

  const fallbackRule = getFallbackRule(toolName);
  const maxRetries = fallbackRule?.maxRetries ?? DEFAULT_COST_GUARD.maxToolRetries;
  let lastError = '';

  // Notifică UI că tool-ul a început
  if (input.onToolCallStart) {
    input.onToolCallStart(toolName, parameters);
  }

  // Emite ThinkingEvent pentru tool call în curs
  if (input.onThinkingEvent) {
    input.onThinkingEvent({
      stepId: `tool_${toolName}_${Date.now()}`,
      label: `Calling ${toolName}`,
      detail: JSON.stringify(parameters).substring(0, 100),
      status: 'active',
      timestamp: Date.now(),
    });
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const record = buildToolCallRecord(toolName, parameters, attempt);

    if (attempt > 1) {
      appendToLog(log, 'retry', `Retry ${attempt}/${maxRetries} for ${toolName}`, record);
    }

    try {
      const result = await executeTool(toolName, parameters);

      record.status = 'success';
      record.result = result;
      record.completedAt = Date.now();
      record.durationMs = record.completedAt - record.startedAt;

      const { content, wasExternalized } = externalizeIfNeeded(toolName, result, record);
      record.wasExternalized = wasExternalized;

      appendToLog(log, 'tool_call', `✓ ${toolName} (${record.durationMs}ms)`, record);
      appendToLog(log, 'observation', `[${toolName}]\n${content}`);

      // Notifică UI că tool-ul s-a terminat
      if (input.onToolCallComplete) input.onToolCallComplete(record);
      if (input.onThinkingEvent) {
        input.onThinkingEvent({
          stepId: `tool_${toolName}_done`,
          label: `${toolName} complete`,
          detail: wasExternalized ? 'Result externalized (large)' : `${record.tokenCount} tokens`,
          status: 'done',
          timestamp: Date.now(),
        });
      }

      return record;

    } catch (error: any) {
      lastError = error?.message || String(error);
      record.status = attempt < maxRetries ? 'running' : 'failed';
      record.error = lastError;
      record.completedAt = Date.now();
      record.durationMs = record.completedAt - record.startedAt;

      appendToLog(log, 'error', `✗ ${toolName} attempt ${attempt}: ${lastError}`, record);

      console.warn(`[Layer 6] ${toolName} attempt ${attempt}/${maxRetries} failed:`, lastError);
    }
  }

  // Toate retry-urile au eșuat — aplică fallback
  const failedRecord = buildToolCallRecord(toolName, parameters, maxRetries);
  failedRecord.status = 'failed';
  failedRecord.error = lastError;
  failedRecord.completedAt = Date.now();

  if (fallbackRule?.fallbackAction === 'alternative_tool' && fallbackRule.alternativeTool) {
    // Încearcă tool-ul alternativ
    const altTool = fallbackRule.alternativeTool;
    const altParams = fallbackRule.alternativeParams
      ? fallbackRule.alternativeParams(parameters)
      : parameters;

    appendToLog(log, 'error', `Falling back from ${toolName} → ${altTool}`);

    return processToolCall(altTool, altParams, executeTool, log, input);
  }

  if (fallbackRule?.fallbackAction === 'skip') {
    failedRecord.status = 'skipped';
    appendToLog(log, 'skip', `Skipping ${toolName} after ${maxRetries} failures: ${lastError}`, failedRecord);
  } else {
    appendToLog(log, 'error', `${toolName} failed after all retries: ${lastError}`, failedRecord);
  }

  if (input.onToolCallComplete) input.onToolCallComplete(failedRecord);
  if (input.onThinkingEvent) {
    input.onThinkingEvent({
      stepId: `tool_${toolName}_error`,
      label: `${toolName} failed`,
      detail: lastError,
      status: 'error',
      timestamp: Date.now(),
    });
  }

  return failedRecord;
}

// ─────────────────────────────────────────────────────────────
// OBSERVATION CONTEXT BUILDER
// Construiește textul formatat cu toate observațiile pentru Layer 7
// ─────────────────────────────────────────────────────────────
export function buildObservationContext(log: ExecutionLog): string {
  const observations = log.entries.filter(e => e.type === 'observation');

  if (observations.length === 0) return '';

  const lines = observations.map((entry, idx) =>
    `### Observation ${idx + 1}\n${entry.content}`
  );

  const costGuardNote = log.costGuardTriggered
    ? `\n\n⚠ **Cost Guard triggered** — some tool calls were skipped. Deliver results based on information available above.`
    : '';

  return `## TOOL OBSERVATIONS (Layer 6 — Execution Results)\n\n${lines.join('\n\n')}${costGuardNote}`;
}

// ─────────────────────────────────────────────────────────────
// PASUL FINALIZAT — marchează un ThinkingStep ca done
// ─────────────────────────────────────────────────────────────
export function markStepDone(
  stepId: string,
  onThinkingEvent?: (event: ThinkingEvent) => void
): void {
  if (onThinkingEvent) {
    onThinkingEvent({
      stepId,
      label: stepId,
      status: 'done',
      timestamp: Date.now(),
    });
  }
}