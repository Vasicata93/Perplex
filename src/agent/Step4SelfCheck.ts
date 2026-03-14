/**
 * STEP 4 — Dynamic Self-Check
 * 
 * Verifies the prepared response before delivering it.
 * Runs every time, for every skill, without exception.
 * 
 * 3 universal checks + 2 dynamic skill-specific checks = 5 total
 * 3 recovery levels for detected problems
 */

import { SkillDefinition, DEFAULT_CONVERSATIONAL_SKILL } from './types';

/**
 * Builds the Step 4 self-check instructions to inject into the system prompt.
 * These instructions tell the LLM to self-verify before delivering the response.
 */
export function buildStep4Instructions(
  activeSkill: SkillDefinition,
  realIntent: string
): string {
  const skillChecks = activeSkill.qualityChecks;

  return `
═══ SELF-CHECK PROTOCOL (MANDATORY — Execute before final response) ═══

Before delivering your response, you MUST verify it against these 5 checks internally.

UNIVERSAL CHECKS (always run):

1. INTENT CHECK:
   Did you answer the REAL intent: "${realIntent}"
   — not just what was literally written? Compare your response against the real intent.

2. GROUNDING CHECK:
   Does every fact, number, or claim come from:
   - Tool results you received, OR
   - Injected memory context, OR
   - Is explicitly marked as an estimate?
   If a claim comes from your training data instead → mark it or remove it. Especially critical for financial data.

3. CONTRADICTION CHECK:
   Does any part of your response contradict:
   - Another part of the same response?
   - Tool results you received?
   - User's memory context?
   - Anything said earlier in this conversation?

SKILL-SPECIFIC CHECKS:

4. ${skillChecks[0].name}:
   ${skillChecks[0].criteria}

5. ${skillChecks[1].name}:
   ${skillChecks[1].criteria}

RECOVERY PROTOCOL:

If you detect issues during self-check:

Level 1 — INLINE FIX (minor issues):
Fix directly in the text. Zero additional tool calls.
Applies: ambiguous phrasing, assumption not stated, wrong format/tone.

Level 2 — RECOVERY TOOL CALLS (missing/unconfirmed data):
Execute 1-2 targeted tool calls ONLY for the detected problem.
If resolved → proceed. If not resolved → Level 3.
Applies: important number not confirmed, specific info missing, tool failed earlier.

Level 3 — RE-PLANNING (fundamental issues):
Return to planning, form a DIFFERENT approach, make DIFFERENT tool calls.
ONE single retry — never two. If still unresolved → graceful degradation.
Applies: initial approach was wrong, Level 2 couldn't fix it, critical info structurally missing.

GRACEFUL DEGRADATION (when Level 3 doesn't fully resolve):
Structure your response in three parts:
- What was confirmed from live sources
- What could not be verified and why (+ where user can find it)
- Recommendation based ONLY on confirmed data with explicit confidence level

CONFIDENCE CALIBRATION (tone, not percentages):
- Live confirmed data → direct, affirmative tone
- Partial data → "based on available data..."
- Estimate from memory → "based on your history..."
- Missing information → "I could not confirm X, but..."
- Partially confirmed hypothesis → "data suggests, without confirming with certainty..."

═══════════════════════════════════════════════════════════════════════`;
}

/**
 * Returns the Step 4 instructions for the default conversational skill.
 */
export function buildDefaultStep4Instructions(realIntent: string): string {
  return buildStep4Instructions(DEFAULT_CONVERSATIONAL_SKILL, realIntent);
}
