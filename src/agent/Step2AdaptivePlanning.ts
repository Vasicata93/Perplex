/**
 * STEP 2 — Adaptive Planning + Skill Injection
 * 
 * Decides plan complexity, checks vector DB need, injects skill instructions,
 * and defines series checkpoints for 2-skill execution.
 * 
 * Plan Levels:
 *   0 — No plan: simple task, single skill, clear intent → jump to Step 3
 *   1 — Short internal plan: medium complexity, 2-3 sub-steps in reasoning
 *   2 — Explicit plan: complex task, 3-5 sub-steps with dependencies
 */

import {
  Step1Output,
  Step2Output,
  PlanLevel,
  PlanSubStep,
  SeriesCheckpoint,
  SkillDefinition,
  DEFAULT_CONVERSATIONAL_SKILL
} from './types';

/**
 * Determines the plan level based on Step 1 output.
 */
function determinePlanLevel(step1: Step1Output): PlanLevel {
  const primarySkill = step1.selectedSkills[0];
  const hasSeriesSkills = step1.selectedSkills.length === 2;

  // Level 2: Complex task, two skills in series, or deep research
  if (hasSeriesSkills || primarySkill.complexity === 'complex') {
    return 2;
  }

  // Level 1: Medium complexity, single skill
  if (primarySkill.complexity === 'medium') {
    return 1;
  }

  // Level 0: Simple task, single skill, clear intent
  return 0;
}

/**
 * Generates plan sub-steps based on plan level and skills.
 */
function generateSubSteps(
  step1: Step1Output,
  planLevel: PlanLevel,
  needsVectorDB: boolean
): PlanSubStep[] {
  if (planLevel === 0) return [];

  const steps: PlanSubStep[] = [];
  let stepCounter = 1;

  // If vector DB is needed, add it as the first step
  if (needsVectorDB) {
    steps.push({
      id: `step-${stepCounter++}`,
      description: 'Retrieve deep user context from vector memory (search_memory)',
      toolsNeeded: ['search_memory']
    });
  }

  if (planLevel === 1) {
    // Short plan: 2-3 sub-steps
    steps.push({
      id: `step-${stepCounter++}`,
      description: `Execute primary task: ${step1.intent.real}`,
      toolsNeeded: [],
      dependsOn: needsVectorDB ? ['step-1'] : undefined
    });
    steps.push({
      id: `step-${stepCounter++}`,
      description: 'Synthesize result and verify quality',
      dependsOn: [`step-${stepCounter - 1}`]
    });
  } else if (planLevel === 2) {
    // Explicit plan: 3-5 sub-steps
    if (step1.selectedSkills.length === 2) {
      // Series execution plan
      const skill1 = step1.selectedSkills[0];
      const skill2 = step1.selectedSkills[1];

      steps.push({
        id: `step-${stepCounter++}`,
        description: `Skill 1 (${skill1.skillName}): Gather and process initial data`,
        dependsOn: needsVectorDB ? ['step-1'] : undefined
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: `Checkpoint: Validate Skill 1 output before proceeding`,
        dependsOn: [`step-${stepCounter - 1}`]
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: `Skill 2 (${skill2.skillName}): Process with enriched context from Skill 1`,
        dependsOn: [`step-${stepCounter - 1}`]
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: 'Final synthesis and quality verification',
        dependsOn: [`step-${stepCounter - 1}`]
      });
    } else {
      // Single skill, complex execution
      steps.push({
        id: `step-${stepCounter++}`,
        description: 'Preliminary research and data gathering',
        dependsOn: needsVectorDB ? ['step-1'] : undefined
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: 'Deep analysis and targeted tool calls',
        dependsOn: [`step-${stepCounter - 1}`]
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: 'Verify completeness and check for gaps',
        dependsOn: [`step-${stepCounter - 1}`]
      });
      steps.push({
        id: `step-${stepCounter++}`,
        description: 'Synthesize final response',
        dependsOn: [`step-${stepCounter - 1}`]
      });
    }
  }

  return steps;
}

/**
 * Checks whether the plan requires deep context from the vector database
 * that is not present in the injected memory.
 */
function checkVectorDBNeed(step1: Step1Output): boolean {
  const realIntent = step1.intent.real.toLowerCase();
  const hasContext = step1.intent.context.length > 0;

  // If context is empty and the question seems personal/historical, we need vector DB
  const personalPatterns = [
    'my', 'mine', 'i have', 'i said', 'i prefer', 'i want',
    'last time', 'previously', 'remember when',
    'al meu', 'mea', 'am avut', 'am spus', 'prefer', 'vreau',
    'data trecută', 'anterior', 'îți amintești'
  ];

  const needsPersonalContext = personalPatterns.some(p => realIntent.includes(p));

  // Need vector DB if the question seems personal but we have no context from injected memory
  return needsPersonalContext && !hasContext;
}

/**
 * Builds the skill instruction block to inject into the active context.
 */
function buildSkillInstructionBlock(skill: SkillDefinition): string {
  return `
═══ ACTIVE SKILL: ${skill.name} ═══
${skill.instructions}

PREFERRED TOOLS: ${skill.preferredTools.length > 0 ? skill.preferredTools.join(', ') : 'none specific'}
OUTPUT FORMAT: ${skill.outputFormat}

QUALITY CHECKS (for Step 4):
1. ${skill.qualityChecks[0].name}: ${skill.qualityChecks[0].criteria}
2. ${skill.qualityChecks[1].name}: ${skill.qualityChecks[1].criteria}
═══════════════════════════════════
`.trim();
}

/**
 * Defines the series checkpoint between two skills.
 */
function buildSeriesCheckpoint(
  step1: Step1Output,
  globalSkills: SkillDefinition[]
): SeriesCheckpoint | undefined {
  if (step1.selectedSkills.length < 2) return undefined;

  const skill1 = globalSkills.find(s => s.id === step1.selectedSkills[0].skillId);
  const skill2 = globalSkills.find(s => s.id === step1.selectedSkills[1].skillId);

  return {
    skill1Output: `Complete output from ${skill1?.name || 'Skill 1'}: all gathered data, tool results, and intermediate conclusions.`,
    skill2Input: `${skill2?.name || 'Skill 2'} requires: full enriched context from Skill 1 including all tool results and data points.`
  };
}

/**
 * Main Step 2 execution: builds the adaptive plan.
 */
export function executeStep2(
  step1: Step1Output,
  globalSkills: SkillDefinition[]
): Step2Output {
  const planLevel = determinePlanLevel(step1);
  const needsVectorDB = checkVectorDBNeed(step1);
  const subSteps = generateSubSteps(step1, planLevel, needsVectorDB);

  // Find the primary skill definition
  const primarySkillDef = globalSkills.find(s => s.id === step1.selectedSkills[0].skillId)
    || DEFAULT_CONVERSATIONAL_SKILL;

  const skillInstructionBlock = buildSkillInstructionBlock(primarySkillDef);
  const seriesCheckpoint = buildSeriesCheckpoint(step1, globalSkills);

  return {
    planLevel,
    subSteps,
    needsVectorDB,
    skillInstructionBlock,
    seriesCheckpoint
  };
}
