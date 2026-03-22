// ============================================================
// LAYER 5 — THINKING ENGINE
// Orchestrează raționamentul intern al agentului.
// Construit per request, după Layer 4 Routing, înainte de generare.
//
// PRINCIPIU: Nu execută nimic. Produce un scaffold (ThinkingFrame)
// și un text injectat în system prompt care ghidează cum gândește modelul.
// ============================================================

import {
  ThinkingEngineInput,
  ThinkingEngineOutput,
  ThinkingFrame,
  ThinkingStep,
  ThinkingStepStatus,
  ReasoningMode,
  RoutingDecision,
  ThinkingEvent,
  ComplexityLevel,
  SituationalSkill,
} from './types';
import type { ThinkingStatus } from './types';

import { DEFAULT_COST_GUARD } from './types';

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — apelată o dată per request
// ─────────────────────────────────────────────────────────────
export function buildThinkingEngine(input: ThinkingEngineInput): ThinkingEngineOutput {

  const reasoningMode = selectReasoningMode(
    input.routingDecision,
    input.hasNativeThinking,
    input.iterationCount
  );

  const steps = planThinkingSteps(
    input.currentMessage,
    input.routingDecision,
    reasoningMode
  );

  const injectedPrompt = buildThinkingPrompt(reasoningMode, steps, input);

  const thinkingFrame: ThinkingFrame = {
    reasoningMode,
    steps,
    injectedPrompt,
    estimatedSteps: steps.length,
    requiresMultiTurn:
      input.isAgentMode && input.routingDecision.complexity === 'complex',
  };

  // Events inițiale — pașii planificați afișați în UI înainte ca modelul să înceapă
  const initialThinkingEvents: ThinkingEvent[] = steps
    .slice(0, 3)
    .map((step, idx) => ({
      stepId: step.id,
      label: step.label,
      detail: step.detail,
      status: idx === 0 ? ('active' as const) : ('pending' as const),
      timestamp: Date.now() + idx,
    }));

  const systemAddition =
    injectedPrompt.length > 0
      ? `\n\n---\n## THINKING SCAFFOLD (Layer 5)\n\n${injectedPrompt}`
      : '';

  // Dacă Layer 5 gestionează gândirea → spune geminiService să nu mai adauge forceXmlThinking
  const skipXmlThinking = reasoningMode !== 'direct';

  console.log(
    `[Layer 5] Mode: ${reasoningMode} · Steps: ${steps.length} · ` +
    `Native thinking: ${input.hasNativeThinking} · ` +
    `Multi-turn: ${thinkingFrame.requiresMultiTurn}`
  );

  return {
    thinkingFrame,
    systemAddition,
    initialThinkingEvents,
    skipXmlThinking,
  };
}

// ─────────────────────────────────────────────────────────────
// 5.1 — SELECTARE MOD DE RAȚIONAMENT
// ─────────────────────────────────────────────────────────────
function selectReasoningMode(
  routing: RoutingDecision,
  hasNativeThinking: boolean,
  iterationCount: number
): ReasoningMode {

  // Cost Guard — la limita de iterații, mod direct pentru a termina rapid
  if (iterationCount >= DEFAULT_COST_GUARD.warnAtIteration) {
    return 'direct';
  }

  // Ambiguitate → clarificare întotdeauna, indiferent de provider
  if (routing.complexity === 'ambiguous' || routing.needsClarification) {
    return 'clarify';
  }

  // Request simplu → direct (fără scaffold)
  if (routing.complexity === 'simple') {
    return 'direct';
  }

  // Research skill activ → verificare surse
  if (
    routing.injectedSkills.includes('research_skill') &&
    routing.complexity !== 'complex'
  ) {
    return 'verify';
  }

  // Request complex în Agent Mode → descompunere
  if (routing.complexity === 'complex' || routing.operationMode === 'agent') {
    // Modelele cu gândire nativă gestionează decompose-ul intern mai bine
    // Totuși, injectăm structura pentru a ghida execuția tool-urilor
    return 'decompose';
  }

  // Medium complexity → chain of thought
  // Dacă modelul are gândire nativă, scaffoldul e minimal
  return 'chain_of_thought';
}

// ─────────────────────────────────────────────────────────────
// 5.2 — PLANIFICARE PAȘI
// ─────────────────────────────────────────────────────────────
function planThinkingSteps(
  message: string,
  routing: RoutingDecision,
  mode: ReasoningMode
): ThinkingStep[] {
  switch (mode) {
    case 'direct':
      return [];

    case 'clarify':
      return [
        {
          id: 'clarify_identify',
          label: 'Identifying missing information',
          detail: 'Message is too ambiguous to proceed',
          status: 'pending',
        },
      ];

    case 'chain_of_thought':
      return buildChainOfThoughtSteps(routing);

    case 'decompose':
      return buildDecompositionSteps(routing);

    case 'verify':
      return buildVerificationSteps(routing);

    default:
      return [];
  }
}

function buildChainOfThoughtSteps(routing: RoutingDecision): ThinkingStep[] {
  const steps: ThinkingStep[] = [
    {
      id: 'cot_understand',
      label: 'Understanding the request',
      detail: `${routing.complexity} complexity · ${routing.priority} priority`,
      status: 'pending',
    },
  ];

  if (routing.estimatedToolCalls > 0) {
    steps.push({
      id: 'cot_gather',
      label: 'Gathering information',
      detail: `~${routing.estimatedToolCalls} tool call(s) planned`,
      status: 'pending',
    });
  }

  if (routing.injectedSkills.includes('data_analysis_skill')) {
    steps.push({
      id: 'cot_analyze',
      label: 'Analyzing data',
      status: 'pending',
    });
  }

  steps.push({
    id: 'cot_compose',
    label: 'Composing response',
    status: 'pending',
  });

  return steps;
}

function buildDecompositionSteps(routing: RoutingDecision): ThinkingStep[] {
  const steps: ThinkingStep[] = [
    {
      id: 'decomp_parse',
      label: 'Parsing goal into subtasks',
      detail: 'Breaking the request into sequential steps',
      status: 'pending',
    },
    {
      id: 'decomp_plan',
      label: 'Building execution plan',
      detail: `~${routing.estimatedToolCalls} operations planned`,
      status: 'pending',
    },
  ];

  // Pași specifici per skill-urile active injectate de Layer 4
  const skillStepMap: Partial<Record<SituationalSkill, ThinkingStep>> = {
    coding_skill: {
      id: 'decomp_code',
      label: 'Writing & executing code',
      detail: 'Verifying via execute_code tool',
      status: 'pending',
    },
    research_skill: {
      id: 'decomp_research',
      label: 'Searching & synthesizing sources',
      detail: 'Minimum 3 independent sources required',
      status: 'pending',
    },
    data_analysis_skill: {
      id: 'decomp_data',
      label: 'Analyzing data & building visualization',
      detail: 'Calculations via execute_code (Python)',
      status: 'pending',
    },
    finance_skill: {
      id: 'decomp_finance',
      label: 'Processing financial data',
      detail: 'Currency and period validation',
      status: 'pending',
    },
    writing_skill: {
      id: 'decomp_writing',
      label: 'Drafting content',
      detail: 'Tone and structure per context',
      status: 'pending',
    },
  };

  for (const skill of routing.injectedSkills) {
    const step = skillStepMap[skill];
    if (step) steps.push(step);
  }

  steps.push({
    id: 'decomp_synthesize',
    label: 'Synthesizing final response',
    status: 'pending',
  });

  return steps;
}

function buildVerificationSteps(routing: RoutingDecision): ThinkingStep[] {
  return [
    {
      id: 'verify_search',
      label: 'Searching for sources',
      detail: 'Finding minimum 2–3 independent sources',
      status: 'pending',
    },
    {
      id: 'verify_crosscheck',
      label: 'Cross-checking claims',
      detail: 'Identifying contradictions between sources',
      status: 'pending',
    },
    {
      id: 'verify_confidence',
      label: 'Assessing confidence level',
      detail: 'Confirmed · Likely · Uncertain',
      status: 'pending',
    },
    {
      id: 'verify_compose',
      label: 'Composing cited response',
      status: 'pending',
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// 5.3 — CONSTRUIREA THINKING PROMPT
// Textul injectat în system prompt pentru a ghida raționamentul modelului
// ─────────────────────────────────────────────────────────────
function buildThinkingPrompt(
  mode: ReasoningMode,
  steps: ThinkingStep[],
  input: ThinkingEngineInput
): string {
  if (mode === 'direct') return '';

  const maxTools = DEFAULT_COST_GUARD.maxToolCallsPerRequest;
  const maxRetries = DEFAULT_COST_GUARD.maxToolRetries;

  switch (mode) {

    case 'clarify':
      return `The user's message is ambiguous. Before attempting any action:
1. Identify exactly what critical information is missing
2. Ask ONE specific, concise question — never multiple questions at once
3. Do NOT attempt to guess and proceed`;

    case 'chain_of_thought':
      if (input.hasNativeThinking) {
        // Gemini cu thinking nativ — scaffoldul e minimal, modelul gândește intern
        return `Work through this step by step. Use tools for any information not in current context. Prioritize accuracy over speed.`;
      }
      // Modele fără thinking nativ (OpenAI standard, OpenRouter generic)
      return `Before answering, reason through your approach inside <thinking>...</thinking> tags:
1. What exactly is the user asking for?
2. Do I need to call any tools? Which ones and in what order?
3. What is the most direct, complete answer?

Then provide your response outside the tags. Keep <thinking> focused — maximum 3–4 sentences.`;

    case 'decompose':
      const stepList = steps
        .filter(s => s.id !== 'decomp_parse' && s.id !== 'decomp_synthesize')
        .map((s, i) => `${i + 1}. ${s.label}${s.detail ? ` (${s.detail})` : ''}`)
        .join('\n');

      const thinkingOpen = input.hasNativeThinking ? '' : 'Use <thinking>...</thinking> for your internal execution plan.\n\n';

      return `${thinkingOpen}This is a complex, multi-step task. Execute it completely — do NOT present a plan without executing it.

**Execution rules:**
- Complete each subtask fully before moving to the next
- Maximum ${maxTools} tool calls for this request
- If a subtask fails after ${maxRetries} retries: skip it, note it in the final response
- Deliver partial results if complete execution is not possible

**Planned subtasks:**
${stepList}

**Final response must:** synthesize all results coherently. Do not just list outputs — connect them into a useful answer.`;

    case 'verify':
      const thinkingVerify = input.hasNativeThinking ? '' : 'Use <thinking>...</thinking> for your verification process.\n\n';

      return `${thinkingVerify}This request requires verified factual information.

**Verification protocol:**
1. Search for information from at least 2 independent sources via perform_search
2. Cross-check: do sources agree? If they contradict, present both positions
3. For each major claim, mark confidence explicitly:
   - ✓ **Confirmed** — multiple sources agree
   - ≈ **Likely** — single source or expert opinion
   - ? **Uncertain** — cannot verify, based on inference
4. Cite every factual claim with [source number]
5. Never invent citations or present uncertain claims as facts`;

    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORTED HELPERS — folosite în geminiService.ts (Layer 5B)
// ─────────────────────────────────────────────────────────────

/**
 * Detectează dacă modelul curent are gândire nativă (thinking tokens).
 * Actualizează lista când adaugi modele noi în aplicație.
 */
export function detectNativeThinking(provider: string, model: string): boolean {
  const modelLower = (model || '').toLowerCase();

  const nativeThinkingModels = [
    // Gemini
    'gemini-2.0-flash-thinking',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    // OpenAI reasoning
    'o1', 'o1-mini', 'o1-preview',
    'o3', 'o3-mini',
    // Anthropic extended thinking
    'claude-3-7-sonnet',
    // Open source reasoning
    'deepseek-r1',
    'qwq',
    'qwen3',
  ];

  return nativeThinkingModels.some(m => modelLower.includes(m));
}

/**
 * Convertește un ThinkingStep în ThinkingEvent pentru UI.
 * Folosit în geminiService când un pas se finalizează.
 */
export function stepToThinkingEvent(
  step: ThinkingStep,
  status: ThinkingStatus
): ThinkingEvent {
  return {
    stepId: step.id,
    label: step.label,
    detail: step.detail,
    status: status,
    timestamp: Date.now(),
  };
}

/**
 * Returnează un ThinkingEvent de tip routing summary.
 * Apelat la începutul fiecărui request pentru a afișa decizia Layer 4 în UI.
 */
export function buildRoutingEvent(routing: RoutingDecision): ThinkingEvent {
  const modeLabel = routing.operationMode === 'agent' ? '⚡ Agent Mode' : '💬 Chat Mode';
  const complexityLabel = {
    simple: 'Simple',
    medium: 'Medium',
    complex: 'Complex',
    ambiguous: 'Needs clarification',
  }[routing.complexity];

  return {
    stepId: 'layer4_routing',
    label: `${modeLabel} · ${complexityLabel}`,
    detail: routing.reasoning,
    status: 'done' as const,
    timestamp: Date.now(),
  };
}