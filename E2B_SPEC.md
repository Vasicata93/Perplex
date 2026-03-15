# E2B SANDBOX INTEGRATION — IMPLEMENTATION SPECIFICATION

## Overview

This document describes the complete implementation of E2B sandbox integration into the Perplex agent. The integration adds code execution capability to the agent through a hybrid approach — execute_code is available as a tool in the global tools list, and skill_coding defines explicitly when and how to use it. Additionally, the Settings UI receives a new section for E2B API key management, consistent with the existing AI models settings design.

---

## Part 1 — Backend Implementation

### 1.1 E2B SDK Installation

Install the official E2B TypeScript SDK into the existing Node.js backend server. No additional infrastructure is needed — E2B runs in their cloud, the backend only needs the SDK to communicate with it.

### 1.2 API Key Management

The E2B API key is stored locally on the user's device, consistent with the existing bring-your-own-key architecture of Perplex. The key is never sent to any server other than E2B directly. It is stored in the same local storage mechanism used for existing API keys in the application.

The key is loaded at runtime when execute_code is called. If the key is not present, the tool returns a specific error indicating that the E2B API key is not configured, and the agent handles this gracefully.

### 1.3 Execute Code Endpoint

Create a single endpoint on the Node.js backend server that handles all code execution requests. This endpoint is called by the agent's tool execution layer when execute_code is invoked.

The endpoint receives the following input:

```
code          → the code to execute, as a string
language      → "python" or "typescript"
timeout       → maximum execution time in seconds, default 30
packages      → optional array of packages to install before execution
session_id    → optional, for persistent sandbox sessions across messages
```

The endpoint performs these steps in order:

Step 1 — Retrieve the E2B API key from local storage. If not found, return an error immediately without contacting E2B.

Step 2 — Determine sandbox mode. If session_id is provided and a sandbox is already active for that session, reuse it. Otherwise create a new sandbox.

Step 3 — If packages are specified, install them inside the sandbox before executing the code.

Step 4 — Execute the code with the specified timeout.

Step 5 — Collect and return the full result.

Step 6 — If the execution was per-request (no session_id), destroy the sandbox immediately after execution.

The endpoint returns the following output to the agent:

```
success          → boolean
stdout           → standard output of the execution
stderr           → error output if any
exit_code        → 0 for success, non-zero for failure
execution_time   → actual execution duration in milliseconds
sandbox_mode     → "e2b_cloud" or "local_fallback"
error_type       → "api_key_missing" | "timeout" | "execution_error" | null
```

### 1.4 Local Fallback

When E2B is unavailable — no API key configured, no internet connection, or E2B service error — the endpoint falls back to local execution using Web Workers in the browser for JavaScript and TypeScript only. Python is not available in local fallback mode.

The response includes sandbox_mode set to "local_fallback" so the agent knows which mode was used and can communicate this to the user if relevant.

Fallback conditions:
```
E2B API key not configured → local fallback
No internet connection → local fallback
E2B service returns error → local fallback
Language is Python AND fallback is active → return error, Python not available offline
```

### 1.5 Session Management

For conversations where the user is iterating on code across multiple messages, persistent sandbox sessions are available. The session is tied to the conversation ID. The sandbox stays alive for the duration of the conversation and is destroyed when the conversation ends or after 30 minutes of inactivity.

Session mode preserves: installed packages, created files, defined variables and functions from previous executions.

---

## Part 2 — Global Tools List Update

Add execute_code to the global tools list available to the agent. The tool definition must include a clear description so the agent understands when to use it and what it receives back.

The tool entry in the global tools list:

```
execute_code
→ purpose: executes code in an isolated sandbox and returns the result
→ input: code string, language, optional timeout, optional packages
→ output: stdout, stderr, exit_code, execution_time, sandbox_mode
→ availability: always available, falls back to local execution if E2B key not configured
→ languages supported: python and typescript in E2B cloud mode, typescript only in local fallback
```

No other tools are modified. execute_code is additive to the existing tools list.

---

## Part 3 — skill_coding Update

Add explicit rules to skill_coding defining when execute_code must be called, when it is optional, and when it should not be called. These rules are part of the skill's instruction block injected in Step 2.

### When execute_code is MANDATORY

```
User requests functional code for their project
→ generate code → execute → include result in response

User explicitly asks to run or test code
→ execute immediately, no generation step needed

User is debugging and wants to verify a fix works
→ apply fix → execute → confirm fix resolves the issue

Code involves calculations or data processing where
output correctness matters
→ generate → execute → verify output is correct
```

### When execute_code is OPTIONAL

```
User asks for code explanation or educational example
→ agent decides based on whether running adds value

User asks for a small snippet or utility function
→ agent may run it to show output if helpful
→ not required if code is straightforward and correct
```

### When execute_code should NOT be called

```
User asks for pseudocode or conceptual explanation
→ do not execute

User asks for architecture or design patterns
→ do not execute

Code is a template with placeholder values
→ do not execute

User explicitly says they just want to see the code
→ do not execute
```

### How to use execute_code in the ReAct loop

When execute_code is needed, it counts as one iteration in the Step 3 ReAct loop. The agent follows this sequence:

```
REASON → determine that execution is needed and why
ACT → call execute_code with the generated code
OBSERVE → evaluate the result

If exit_code is 0 and stdout is as expected
→ include result in response, proceed to Step 4

If exit_code is non-zero or stderr contains errors
→ analyze the error
→ fix the code
→ execute again (counts as next iteration)
→ maximum 2 execution attempts within the iteration budget

If sandbox_mode is "local_fallback"
→ mention to user that full validation was not available
→ note that Python is not supported in offline mode if relevant

If error_type is "api_key_missing"
→ inform user that E2B API key is not configured in Settings
→ offer to deliver code without execution
```

### What to include in the response when code was executed

```
The code block
→ always included

Execution result
→ stdout if relevant to the user
→ brief note if execution succeeded with no output

Execution context
→ mention if E2B cloud was used for full validation
→ mention if local fallback was used with its limitations
→ mention if execution was not run and why
```

### Self-check criteria for skill_coding — updated

The two skill-specific criteria in Step 4 are updated to include execution:

Criterion 1 — The code is complete and functional, not pseudocode or skeleton. If execute_code was called and returned exit_code 0, this criterion is confirmed by the execution result. If execution was not called, the agent verifies logic manually.

Criterion 2 — Edge cases are covered or explicitly mentioned. Execution result is used as additional evidence — if execution revealed an unexpected edge case, it must be addressed before delivering the response.

---

## Part 4 — Settings UI

### 4.1 New Section in AI Models Settings

Add a new section to the existing Settings page where AI models and API keys are configured. The new section is called "Code Execution" and follows the exact same visual design language as the existing API key sections in the settings page.

The section must be visually consistent with existing settings sections in every detail — same card style, same input field style, same spacing, same typography, same color scheme, same interactive states.

### 4.2 Section Content and Layout

The Code Execution section contains the following elements in order:

**Section header:**
Title: "Code Execution"
Subtitle: "Connect E2B to enable secure code execution in an isolated cloud sandbox."

**E2B API Key input field:**
Label: "E2B API Key"
Input type: password field with show/hide toggle, consistent with existing API key fields in the application
Placeholder: "e2b_..."
The key is stored locally on the device using the same storage mechanism as other API keys in the application. Never transmitted to any server except E2B directly.

**Connection status indicator:**
Shown below the input field after the user saves a key.
Three states:
```
No key configured → neutral state, no indicator shown
Key saved, not verified → show "Saved" in neutral color
Key verified successfully → show "Connected" with success color
Key invalid → show "Invalid key" with error color
```

**Test connection button:**
Label: "Test Connection"
Behavior: sends a minimal test request to E2B API using the saved key to verify it works. Updates the status indicator based on the result. Uses the same button style as other action buttons in the settings page.

**Sandbox mode indicator:**
A small read-only field or tag showing the current active mode.
```
E2B API key configured and verified → "Cloud Sandbox (E2B)"
No key or key invalid → "Local Fallback (JS/TS only)"
```

**Information note:**
A subtle note below the section explaining:
"When E2B is active, code runs in an isolated cloud environment supporting Python and TypeScript. Without a key, code runs locally in the browser with TypeScript support only. Get your API key at e2b.dev."
The note style must be consistent with other informational notes in the settings page.

### 4.3 Behavior on Save

When the user saves an API key:
- Store the key locally using the existing storage mechanism for API keys
- Automatically trigger a test connection
- Update the status indicator based on the result
- If the key is valid, update the sandbox mode indicator to "Cloud Sandbox (E2B)"
- No page reload required — all updates are reactive

### 4.4 Behavior on Key Removal

When the user clears the API key field and saves:
- Remove the key from local storage
- Reset status indicator
- Update sandbox mode indicator to "Local Fallback (JS/TS only)"
- The agent continues to function normally using local fallback

### 4.5 Placement in Settings Page

The Code Execution section is placed after the existing AI model API key sections and before any other settings sections that may exist. It is a peer-level section, not nested inside another section.

---

## Part 5 — Error Handling and Edge Cases

### Agent behavior when E2B is not configured

When execute_code returns error_type "api_key_missing", the agent must not fail silently. It informs the user naturally within the response:

"Code execution requires an E2B API key. You can add it in Settings under Code Execution. In the meantime, here is the code — I was unable to run it to verify the output."

The agent then delivers the code without execution results. It does not repeat the settings instruction in subsequent messages of the same conversation unless the user asks.

### Agent behavior on execution timeout

When execute_code returns error_type "timeout", the agent informs the user that the code exceeded the time limit and suggests either optimizing the code or increasing the timeout if the operation is expected to take longer.

### Agent behavior on execution error

When the code returns a non-zero exit_code, the agent analyzes stderr, fixes the issue, and re-executes once. If the second execution also fails, the agent delivers the code with a clear explanation of the error encountered and what the likely cause is, without a third execution attempt.

---

## Summary of Changes

```
Backend
→ new execute_code endpoint on Node.js server
→ E2B SDK integrated
→ local fallback via Web Workers for TypeScript
→ session management for persistent sandboxes

Global Tools List
→ execute_code added as a new tool

skill_coding
→ updated with explicit rules for when to use execute_code
→ updated self-check criteria to include execution validation

Settings UI
→ new Code Execution section in AI Models settings
→ E2B API key input with local storage
→ connection test and status indicator
→ sandbox mode indicator
→ consistent with existing settings design language
```
