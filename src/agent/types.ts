/**
 * Agent Architecture Types
 * Defines all types for the 5-step agent pipeline.
 * Skills are separate instruction blocks injected dynamically in Step 2.
 */

// ─── Skill Definitions ───────────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  /** The full instruction block injected into context during Step 2 */
  instructions: string;
  /** Preferred tools for this skill (tool names from global list) */
  preferredTools: string[];
  /** Output format guidance */
  outputFormat: string;
  /** 2 skill-specific quality checks for Step 4 */
  qualityChecks: [SkillQualityCheck, SkillQualityCheck];
}

export interface SkillQualityCheck {
  name: string;
  description: string;
  /** What to verify */
  criteria: string;
}

// ─── Step 1: Intent Analysis + Clarification + Skill Detection ───────

export interface IntentLevels {
  /** What the user literally wrote */
  surface: string;
  /** What the user actually wants to achieve */
  real: string;
  /** Relevant context from injected memory */
  context: string;
}

export type ClarificationDecision =
  | { type: 'proceed' }
  | { type: 'assume'; assumption: string }
  | { type: 'ask'; question: string };

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

export interface SkillSelection {
  skillId: string;
  skillName: string;
  complexity: ComplexityLevel;
}

export interface Step1Output {
  intent: IntentLevels;
  clarification: ClarificationDecision;
  /** 1 or 2 skills, ordered by execution dependency */
  selectedSkills: SkillSelection[];
}

// ─── Step 2: Adaptive Planning + Skill Injection ─────────────────────

export type PlanLevel = 0 | 1 | 2;

export interface PlanSubStep {
  id: string;
  description: string;
  toolsNeeded?: string[];
  dependsOn?: string[];
}

export interface SeriesCheckpoint {
  /** What skill 1 must produce */
  skill1Output: string;
  /** What skill 2 requires as input */
  skill2Input: string;
}

export interface Step2Output {
  planLevel: PlanLevel;
  subSteps: PlanSubStep[];
  /** Whether the first tool call in Step 3 should be search_memory */
  needsVectorDB: boolean;
  /** The full skill instruction block to inject into context */
  skillInstructionBlock: string;
  /** Only present when 2 skills are running in series */
  seriesCheckpoint?: SeriesCheckpoint;
}

// ─── Step 3: ReAct Loop with Tools ───────────────────────────────────

export interface ReActIteration {
  iterationNumber: number;
  /** Internal reasoning about what is known/missing */
  reason: string;
  /** Tool call executed (null if no tool needed) */
  action?: {
    toolName: string;
    args: Record<string, any>;
    /** Why this specific tool at this moment */
    rationale: string;
  };
  /** Tool result received */
  observation?: string;
  /** Decision after observation: continue, exit, reassess, retry */
  decision: 'continue' | 'exit' | 'reassess' | 'retry_alternative';
}

export interface HypothesisStatus {
  hypothesis: string;
  isProvisional: boolean;
  confirms: string[];
  invalidates: string[];
  currentVerdict: 'supported' | 'contradicted' | 'inconclusive';
}

export interface Step3Output {
  /** All tool results collected */
  toolResults: Array<{
    toolName: string;
    args: Record<string, any>;
    result: any;
    status: 'success' | 'error';
  }>;
  /** Number of iterations used */
  iterationsUsed: number;
  /** Hypothesis and its status if skill_research was active */
  hypothesis?: HypothesisStatus;
  /** Internal notes about tool failures or data gaps */
  dataGaps: string[];
  /** The enriched context string from all gathered information */
  enrichedContext: string;
}

// ─── Step 4: Dynamic Self-Check ──────────────────────────────────────

export type CheckStatus = 'pass' | 'minor_issue' | 'major_issue';

export interface SelfCheckResult {
  checkName: string;
  status: CheckStatus;
  details: string;
}

export type RecoveryLevel = 0 | 1 | 2 | 3;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Step4Output {
  /** Results of all 5 checks (3 universal + 2 skill-specific) */
  checkResults: SelfCheckResult[];
  /** Which recovery level was applied (0 = no issues found) */
  recoveryApplied: RecoveryLevel;
  /** Overall confidence level */
  confidence: ConfidenceLevel;
  /** Adjusted response text after fixes */
  adjustedResponse: string;
  /** What was confirmed, what could not be verified, recommendations */
  gracefulDegradation?: {
    confirmed: string[];
    unverified: string[];
    recommendation: string;
  };
}

// ─── Step 5: Formatted Response ──────────────────────────────────────

export interface Step5Output {
  /** The final formatted response text */
  responseText: string;
  /** Whether uncertainty notes were integrated */
  hasUncertaintyNotes: boolean;
}

// ─── Agent Orchestrator Config ───────────────────────────────────────

export interface AgentConfig {
  /** Global list of available skills */
  globalSkills: SkillDefinition[];
  /** Maximum ReAct iterations per skill execution */
  maxIterationsPerSkill: number;
  /** Maximum recovery tool calls in Step 4 Level 2 */
  maxRecoveryToolCalls: number;
}

import { SKILL_CONVERSATION, ALL_AGENT_SKILLS } from './skills';

/** Default conversational skill used when no specific skill is detected */
export const DEFAULT_CONVERSATIONAL_SKILL: SkillDefinition = SKILL_CONVERSATION;

/** Default agent configuration with all 5 professional skills */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  globalSkills: ALL_AGENT_SKILLS,
  maxIterationsPerSkill: 5,
  maxRecoveryToolCalls: 2
};
