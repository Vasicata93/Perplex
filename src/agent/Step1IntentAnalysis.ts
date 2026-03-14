/**
 * STEP 1 — Intent Analysis + Clarification + Skill Detection
 * 
 * Produces an internal decision object (never shown to user) that guides all subsequent steps.
 * Three components analyzed simultaneously in a single reasoning pass:
 * 1. Intent Analysis (surface, real, context levels)
 * 2. Clarification Decision (proceed, assume, or ask)
 * 3. Skill Detection (1-2 skills from global list with complexity)
 */

import {
  Step1Output,
  IntentLevels,
  ClarificationDecision,
  SkillSelection,
  SkillDefinition,
  ComplexityLevel,
  DEFAULT_CONVERSATIONAL_SKILL
} from './types';

/**
 * Builds the Step 1 analysis prompt that instructs the LLM to perform
 * intent analysis, clarification decision, and skill detection.
 */
export function buildStep1Prompt(
  userMessage: string,
  globalSkills: SkillDefinition[],
  memoryContext: string
): string {
  const skillsList = globalSkills.map(s =>
    `- ${s.id}: ${s.name} — ${s.description}`
  ).join('\n');

  return `You are performing Step 1 of the agent pipeline: Intent Analysis + Clarification + Skill Detection.
Analyze the user message on three levels and produce a structured decision.

USER MESSAGE: "${userMessage}"

INJECTED MEMORY CONTEXT:
${memoryContext || '(no memory context available)'}

AVAILABLE SKILLS:
${skillsList || '- skill_conversational: Conversational — Default conversational mode'}

INSTRUCTIONS:

1. INTENT ANALYSIS — Analyze on three levels:
   - SURFACE: What the user literally wrote.
   - REAL: What the user actually wants to achieve (often different from surface).
   - CONTEXT: What you already know about this user from injected memory that helps interpret the message.
   Always respond to REAL intent, not surface. Consult CONTEXT before deciding anything is ambiguous.

2. CLARIFICATION DECISION — Apply these rules:
   - If the message is clear → type: "proceed"
   - If a small detail is missing → type: "assume", state the assumption
   - If ambiguity would fundamentally change the approach → type: "ask", ask ONE specific question
   - ALWAYS check memory before deciding something is ambiguous
   - Never ask more than one question
   - Never ask confirmation for things already known from memory

3. SKILL DETECTION — Select from the available skills:
   - One skill detected → activate it
   - Two skills detected → order by information dependency (data producer first)
   - No clear skill detected → use "skill_conversational"
   - Doubt between two → choose the more complex one
   - For each skill, estimate complexity: "simple", "medium", or "complex"

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "intent": {
    "surface": "...",
    "real": "...",
    "context": "..."
  },
  "clarification": {
    "type": "proceed" | "assume" | "ask",
    "assumption": "..." (only if type is "assume"),
    "question": "..." (only if type is "ask")
  },
  "selectedSkills": [
    {
      "skillId": "...",
      "skillName": "...",
      "complexity": "simple" | "medium" | "complex"
    }
  ]
}`;
}

/**
 * Parses the LLM's JSON response into a typed Step1Output.
 * Falls back to sensible defaults if parsing fails.
 */
export function parseStep1Response(
  rawResponse: string,
  userMessage: string,
  globalSkills: SkillDefinition[]
): Step1Output {
  try {
    // Try to extract JSON from the response
    let jsonStr = rawResponse.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    
    // Try to find JSON object in the text
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and extract intent
    const intent: IntentLevels = {
      surface: parsed.intent?.surface || userMessage.substring(0, 100),
      real: parsed.intent?.real || userMessage.substring(0, 100),
      context: parsed.intent?.context || ''
    };

    // Validate and extract clarification
    let clarification: ClarificationDecision = { type: 'proceed' };
    if (parsed.clarification?.type === 'assume' && parsed.clarification?.assumption) {
      clarification = { type: 'assume', assumption: parsed.clarification.assumption };
    } else if (parsed.clarification?.type === 'ask' && parsed.clarification?.question) {
      clarification = { type: 'ask', question: parsed.clarification.question };
    }

    // Validate and extract skills
    let selectedSkills: SkillSelection[] = [];
    if (Array.isArray(parsed.selectedSkills) && parsed.selectedSkills.length > 0) {
      selectedSkills = parsed.selectedSkills.slice(0, 2).map((s: any) => {
        // Validate that the skill exists in the global list
        const validSkill = globalSkills.find(gs => gs.id === s.skillId);
        const validComplexity: ComplexityLevel =
          ['simple', 'medium', 'complex'].includes(s.complexity) ? s.complexity : 'simple';

        return {
          skillId: validSkill ? s.skillId : DEFAULT_CONVERSATIONAL_SKILL.id,
          skillName: validSkill ? s.skillName : DEFAULT_CONVERSATIONAL_SKILL.name,
          complexity: validComplexity
        };
      });
    }

    // Fallback to conversational if no skills selected
    if (selectedSkills.length === 0) {
      selectedSkills = [{
        skillId: DEFAULT_CONVERSATIONAL_SKILL.id,
        skillName: DEFAULT_CONVERSATIONAL_SKILL.name,
        complexity: 'simple'
      }];
    }

    return { intent, clarification, selectedSkills };

  } catch (_e) {
    // Fallback: return defaults with surface intent
    return {
      intent: {
        surface: userMessage.substring(0, 200),
        real: userMessage.substring(0, 200),
        context: ''
      },
      clarification: { type: 'proceed' },
      selectedSkills: [{
        skillId: DEFAULT_CONVERSATIONAL_SKILL.id,
        skillName: DEFAULT_CONVERSATIONAL_SKILL.name,
        complexity: 'simple'
      }]
    };
  }
}
