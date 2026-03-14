/**
 * STEP 3 — ReAct Loop with Tools
 * 
 * Core execution step where all real work happens.
 * Uses the REASON → ACT → OBSERVE loop with max 5 iterations per skill.
 * 
 * This module builds the system prompt instructions that encode the ReAct
 * behavior. The actual tool execution happens through the existing
 * generateGeminiResponse / generateGenericResponse infrastructure.
 */

import {
  Step1Output,
  Step2Output,
  Step3Output,
  ComplexityLevel
} from './types';

/**
 * Builds the ReAct loop instructions to inject into the system prompt.
 * These instructions guide the LLM's behavior during execution.
 */
export function buildStep3Instructions(
  step1: Step1Output,
  step2: Step2Output,
  isSecondSkillInSeries: boolean = false,
  skill1Context: string = ''
): string {
  const primarySkill = step1.selectedSkills[0];
  const isResearch = primarySkill.skillId === 'skill_research';
  const maxIterations = 5;

  let instructions = `
═══ EXECUTION ENGINE: ReAct Loop ═══

You are now in the execution phase. Follow this loop structure strictly.

CORE LOOP — For each task, cycle through:
1. REASON: Think internally — what do I already know? What am I missing? Which tool resolves what I need most efficiently?
2. ACT: Execute ONE tool call with precise parameters and a clear reason.
3. OBSERVE: Evaluate the result — did this answer what I needed? Do I have enough now?

DECISION AFTER EACH OBSERVATION:
- Sufficient information → Stop calling tools. Proceed to synthesize the answer.
- Partial information → One more targeted tool call.
- Unexpected result → Reassess direction before continuing.
- Tool failure → Attempt ONE alternative tool. If that also fails, continue without that data.
- NEVER retry the same failed tool with the same parameters.

HARD LIMIT: Maximum ${maxIterations} tool call iterations. When reached, stop immediately and synthesize the best answer from available information. Never apologize for reaching the limit.

PARALLEL TOOL CALLS: If you need two completely independent pieces of information, request both simultaneously in a single turn.

EARLY EXIT: If after 2-3 tool calls you have sufficient information for a quality answer, STOP. Do not consume remaining iterations unnecessarily.`;

  // Add micro-checks
  instructions += `

MICRO-CHECKS:
- After your 2nd tool call: Verify internally — am I going in the right direction relative to the real intent? Are the tools I'm calling relevant?
- After your 4th tool call: Verify — do I have enough for a quality answer? What is still critically missing? Prioritize exactly what is missing.`;

  // Add vector DB first call instruction if needed
  if (step2.needsVectorDB) {
    instructions += `

FIRST ACTION: Your very first tool call MUST be search_memory to retrieve deep user context. This prevents making 3 tool calls and only then realizing critical user context was missing.`;
  }

  // Add plan context
  if (step2.planLevel > 0 && step2.subSteps.length > 0) {
    const planSteps = step2.subSteps.map(s => `  ${s.id}: ${s.description}`).join('\n');
    instructions += `

EXECUTION PLAN (follow this order):
${planSteps}`;
  }

  // Add skill_research specific phases
  if (isResearch) {
    instructions += `

═══ RESEARCH PHASES (within your ${maxIterations}-iteration budget) ═══

Phase 1 — FOCUSED INTENT:
Formulate ONE precise central question that the entire research must answer. Use this question to guide ALL tool calls. Discard information that does not directly answer this central question.

Phase 2 — PRELIMINARY DATA (2-3 tool calls):
Exploratory calls to understand the landscape BEFORE forming any hypothesis. The hypothesis MUST be based on real data, not training assumptions.

Phase 3 — HYPOTHESIS FORMATION:
Form a provisional hypothesis based ONLY on Phase 2 data. Label it explicitly as provisional.
- CONFIRMS: minimum 2 data points that would support it
- INVALIDATES: minimum 1 data point that would fully contradict it
- If INVALIDATES cannot be defined, the hypothesis is too vague — reformulate.

Internal checkpoint: if data supports → continue. If data contradicts → revise hypothesis. If inconclusive → broaden search.

Phase 4 — TARGETED ReAct:
Search specifically for what tests the hypothesis. Actively search for CONTRADICTING evidence, not only confirming.`;
  }

  // Add series context if this is the second skill
  if (isSecondSkillInSeries && skill1Context) {
    instructions += `

═══ SERIES EXECUTION — SKILL 2 CONTEXT ═══
You are now executing the second skill in a series. The first skill has completed and produced the following context:

${skill1Context}

Use this enriched context as your starting point. Your independent iteration budget is ${maxIterations} iterations.`;
  }

  // Add skill instruction block from Step 2
  instructions += `

${step2.skillInstructionBlock}`;

  instructions += `
═══════════════════════════════════`;

  return instructions;
}

/**
 * Creates an empty Step3Output structure for initialization.
 * The actual population happens during execution in the orchestrator.
 */
export function createEmptyStep3Output(): Step3Output {
  return {
    toolResults: [],
    iterationsUsed: 0,
    dataGaps: [],
    enrichedContext: ''
  };
}

/**
 * Evaluates whether the ReAct loop should continue or exit based on
 * iteration count and collected results.
 */
export function shouldContinueLoop(
  iterationsUsed: number,
  maxIterations: number,
  hasToolCalls: boolean,
  complexity: ComplexityLevel
): { continue: boolean; reason: string } {
  // Hard limit
  if (iterationsUsed >= maxIterations) {
    return { continue: false, reason: 'Maximum iterations reached' };
  }

  // No more tool calls - LLM is done
  if (!hasToolCalls) {
    return { continue: false, reason: 'No tool calls — LLM ready to respond' };
  }

  // For simple tasks, suggest early exit at iteration 2
  if (complexity === 'simple' && iterationsUsed >= 2) {
    return { continue: true, reason: 'Simple task — consider early exit if sufficient data collected' };
  }

  return { continue: true, reason: 'Continuing execution' };
}
