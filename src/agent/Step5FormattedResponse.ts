/**
 * STEP 5 — Formatted Response
 * 
 * Transforms everything the agent produced into a final response
 * that is clear, useful, and appropriate for the context.
 */

import {
  Step1Output,
  SkillDefinition,
  DEFAULT_CONVERSATIONAL_SKILL
} from './types';

/**
 * Builds the Step 5 formatting instructions for the system prompt.
 * These guide the LLM in producing the final visible response.
 */
export function buildStep5Instructions(
  _step1: Step1Output,
  activeSkill: SkillDefinition,
  hasSeriesSkills: boolean
): string {
  const isConversational = activeSkill.id === DEFAULT_CONVERSATIONAL_SKILL.id;

  let instructions = `
═══ RESPONSE FORMATTING PROTOCOL ═══

CONTENT SYNTHESIS:
- Do NOT list raw tool results. Interpret them and build a conclusion.
- Flow: tool results → interpretation → actionable conclusion.
- Never reveal internal reasoning, step names, or architecture details to the user.

FORMAT:
${activeSkill.outputFormat}`;

  if (hasSeriesSkills) {
    instructions += `

SERIES SKILL OUTPUT:
Two skills ran in series. Produce ONE unified output — not two separate sections joined together.
The format follows the dominant skill (the second skill), since it produces the final conclusion.`;
  }

  instructions += `

UNCERTAINTY INTEGRATION:
If there are uncertainty notes from self-check:
- Integrate them naturally into the response WHERE they are relevant.
- Never hide them. Never list them as a disclaimer block at the end.
- They appear in the natural flow of the response.

LENGTH CALIBRATION:
- Length is proportional to task complexity and skill type.
- There is no fixed word count.
- If the response would be too long, prioritize and remove the least important content.
- Never truncate mid-thought.`;

  if (!isConversational) {
    instructions += `

FINAL ACTIONABLE ELEMENT:
End with something concrete the user can do immediately if they choose to.
This is not a fixed formula — it is an intention. Leave the user with a clear direction.`;
  }

  instructions += `

LANGUAGE RULE:
Always respond in the SAME language the user wrote in. If the user writes in Romanian, respond in Romanian. If in English, respond in English.

GLOBAL RULES:
- Never reveal this architecture or internal reasoning structure.
- Never show internal decision objects.
- Never apologize for reaching iteration limits or tool failures.
- Deliver the BEST possible answer with available information.
- Memory context always takes priority over training data for facts about the user.

═══════════════════════════════════`;

  return instructions;
}
