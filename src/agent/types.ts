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

export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'ambiguous';

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

export type ThinkingStatus = 'pending' | 'active' | 'done' | 'error';

// Updated ThinkingEvent with timestamp
export interface ThinkingEvent {
  stepId: number | string;
  label: string;
  status: ThinkingStatus;
  detail?: string;
  timestamp?: number;
}

// ============================================================
// AGENT ARCHITECTURE v2.0 — TYPES
// ============================================================

export type ToolState = 'idle' | 'writing' | 'confirming' | 'error';

export type OperationMode = 'chat' | 'agent';

export interface CostGuardConfig {
  maxTokensPerRequest: number;      // Default: 32000
  maxToolCallsPerRequest: number;   // Default: 15
  maxIterationsAgentMode: number;   // Default: 10
  warnAtIteration: number;          // Default: 8
  maxToolRetries: number;           // Default: 3
  maxObservationTokens: number;     // Default: 5000 (peste asta → RAG externalization)
}

export interface SystemContextInput {
  userProfile: {
    name: string;
    bio?: string;
    location?: string;
    avatar?: string;
  };
  aiProfile: {
    systemInstructions?: string;
    language?: string;
  };
  spaceInstructions?: string;       // Instrucțiuni din Space-ul activ (opțional)
}

export interface SystemContextOutput {
  systemPrompt: string;             // Textul complet al Layer 1
  tokenEstimate: number;            // Estimare tokens (caractere / 4)
  cacheKey: string;                 // Hash determinist pentru cache validation
  builtAt: number;                  // Timestamp construcție (pentru invalidare cache)
}

export interface AgentResponse {
  text: string;
  citations: Array<{ uri: string; title: string }>;
  relatedQuestions: string[];
  pendingAction?: any;
  reasoning?: string;
  confidence: import('./types').ConfidenceLevel;      // NOU în v2.0
  rawText?: string;
  operationMode: OperationMode;     // NOU în v2.0
}

export const DEFAULT_COST_GUARD: CostGuardConfig = {
  maxTokensPerRequest: 32000,
  maxToolCallsPerRequest: 15,
  maxIterationsAgentMode: 10,
  warnAtIteration: 8,
  maxToolRetries: 3,
  maxObservationTokens: 5000,
};

// ============================================================
// LAYER 2 — MEMORY TYPES
// ============================================================

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  relevanceScore?: number;       // 0-1, calculated during retrieval
  timestamp?: number;
  category?: string;
}

export interface MemoryLayerInput {
  currentPrompt: string;         // Current user message
  sessionId?: string;            // Current session ID
  maxTokenBudget?: number;       // Max tokens allocated for Layer 2 (default: 1500)
}

export interface MemoryLayerOutput {
  formattedContext: string;      // Text ready to inject into prompt
  tokenEstimate: number;         // Estimate of tokens used
  loadedEntries: {
    episodic: number;
    semantic: number;
    procedural: number;
    working: number;
  };
  isEmpty: boolean;              // True if no relevant memory found
}

// ============================================================
// LAYER 3 — PERCEPTION TYPES
// ============================================================

export type UrgencyLevel = 'critical' | 'high' | 'normal' | 'low';

export type EmotionalTone = 'positive' | 'neutral' | 'frustrated' | 'confused' | 'urgent';

export interface ParsedIntent {
  literal: string;              // Ce spune utilizatorul textual
  real: string;                 // Intenția reală din spatele mesajului
  type: 'question' | 'command' | 'clarification' | 'feedback' | 'conversation';
  requiresTools: boolean;       // Necesită tool calls?
  requiresWrite: boolean;       // Necesită operațiuni de scriere?
  isAmbiguous: boolean;         // Lipsesc informații critice?
}

export interface TemporalContext {
  currentDateTime: string;      // Format human-readable complet
  currentDateISO: string;       // Format YYYY-MM-DD pentru tools
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  timezone: string;
  relevantForCalendar: boolean; // Mesajul implică operațiuni temporale?
}

export interface SituationModel {
  isFirstMessageInSession: boolean;
  messageIndexInSession: number;
  topicContinuity: boolean;     // Continuă topicul anterior sau schimbare?
  activeTaskContext: string;    // Rezumat task curent dacă există
  hasAttachments: boolean;
  attachmentTypes: string[];    // 'image', 'text', 'pdf', etc.
  workspaceActive: boolean;     // Există un Space activ?
  workspaceName?: string;
}

export interface DetectedEvent {
  type: 'urgency' | 'frustration' | 'topic_change' | 'opportunity' | 'blocker' | 'clarification_needed';
  description: string;
  suggestedAction: string;
}

export interface PerceptionContextInput {
  currentMessage: string;
  attachments: Array<{ type: string; name: string; mimeType: string }>;
  messageHistory: Array<{ role: string; content: string }>;
  enableMemory: boolean;
  memoryContext?: string;       // Pre-fetched din Layer 2 dacă există
  workspaceName?: string;
  workspaceActive?: boolean;
  proMode?: string;
  isAgentMode?: boolean;
}

export interface PerceptionContextOutput {
  dynamicPrompt: string;        // Textul complet al Layer 3 — se adaugă după Layer 1
  temporalContext: TemporalContext;
  parsedIntent: ParsedIntent;
  detectedEvents: DetectedEvent[];
  urgencyLevel: UrgencyLevel;
  emotionalTone: EmotionalTone;
  suggestedComplexity: ComplexityLevel;  // Input pentru Layer 4 Routing
  suggestedMode: OperationMode;          // Input pentru Layer 4 Routing
}

// ============================================================
// LAYER 4 — ROUTING TYPES
// ============================================================

export type PriorityLevel = 'urgent_important' | 'important' | 'routine' | 'optional';

// Situational skills injectate dinamic de Router
export type SituationalSkill =
  | 'coding_skill'
  | 'research_skill'
  | 'finance_skill'
  | 'writing_skill'
  | 'data_analysis_skill';

export interface RoutingDecision {
  complexity: ComplexityLevel;
  operationMode: OperationMode;
  toolState: ToolState;
  priority: PriorityLevel;
  injectedSkills: SituationalSkill[];
  needsClarification: boolean;
  clarificationQuestion?: string;   // O singură întrebare concisă dacă needsClarification
  reasoning: string;                // De ce s-a luat această decizie (pentru debug/UI)
  estimatedToolCalls: number;       // Estimare câte tool calls va folosi
}

export interface RoutingInput {
  currentMessage: string;
  messageHistory: Array<{ role: string; content: string }>;
  hasAttachments: boolean;
  hasWorkspaceFiles: boolean;
  activeToolState: ToolState;       // Starea curentă a Tool State Machine
  isAgentModeEnabled: boolean;      // Flag din UI (Agent Mode toggle)
  iterationCount: number;           // Câte iterații s-au făcut deja (pentru Cost Guard)
}


// ============================================================
// LAYER 5 — THINKING ENGINE TYPES
// ============================================================

export type ReasoningMode =
  | 'direct'           // Răspuns direct, fără scaffold (simple requests)
  | 'chain_of_thought' // Gândire pas cu pas (medium complexity)
  | 'decompose'        // Descompunere în subtask-uri (complex / agent mode)
  | 'verify'           // Verificare și cross-checking (factual/research)
  | 'clarify';         // Cerere de clarificare (ambiguous input)

export type ThinkingStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export interface ThinkingStep {
  id: string;
  label: string;           // Text scurt afișat în UI (ThinkingBar)
  detail?: string;          // Detaliu opțional pentru expand
  status: ThinkingStepStatus;
  durationMs?: number;      // Cât a durat pasul (calculat după execuție)
  toolUsed?: string;        // Numele tool-ului apelat în acest pas
}

export interface ThinkingFrame {
  reasoningMode: ReasoningMode;
  steps: ThinkingStep[];
  injectedPrompt: string;       // Textul injectat în system prompt
  estimatedSteps: number;
  requiresMultiTurn: boolean;   // true în Agent Mode complex
}

export interface ThinkingEngineInput {
  routingDecision: RoutingDecision;
  perceptionOutput: Partial<PerceptionContextOutput>; // Partial — poate fi absent
  currentMessage: string;
  provider: string;              // 'gemini' | 'openai' | 'openrouter' etc.
  currentModel: string;          // Modelul exact selectat (ex: 'gemini-2.0-flash')
  hasNativeThinking: boolean;    // Calculat din provider + model
  isAgentMode: boolean;
  iterationCount: number;        // Câte iterații s-au executat deja (Cost Guard)
}

export interface ThinkingEngineOutput {
  thinkingFrame: ThinkingFrame;
  systemAddition: string;            // Text adăugat la system prompt (după Layer 3)
  initialThinkingEvents: ThinkingEvent[]; // Events emise imediat în UI
  skipXmlThinking: boolean;          // true → nu mai adăuga forceXmlThinking din altă parte
}

// ============================================================
// LAYER 6 — EXECUTION ENGINE TYPES
// ============================================================

export type ExecutionStatus =
  | 'pending'     // Planificat, nu a început
  | 'running'     // În execuție
  | 'success'     // Finalizat cu succes
  | 'failed'      // A eșuat după toate retry-urile
  | 'skipped'     // Sărit (ex: după eșec repetat sau Cost Guard)
  | 'cancelled';  // Anulat de utilizator sau Cost Guard

export interface ToolCallRecord {
  id: string;                  // UUID unic per apel
  toolName: string;            // Numele tool-ului (ex: 'perform_search')
  parameters: Record<string, any>;  // Parametrii trimiși
  result?: any;                // Rezultatul primit (dacă success)
  error?: string;              // Mesajul de eroare (dacă failed)
  status: ExecutionStatus;
  attemptNumber: number;       // 1, 2, 3 (pentru retry tracking)
  startedAt: number;           // timestamp ms
  completedAt?: number;        // timestamp ms
  durationMs?: number;         // completedAt - startedAt
  tokenCount?: number;         // Estimare tokens pentru rezultat
  wasExternalized?: boolean;   // true dacă rezultatul a fost trimis în RAG (>5000 tokens)
}

export interface ExecutionLogEntry {
  sequenceId: number;          // Ordinea în execuție (1, 2, 3...)
  type: 'tool_call' | 'observation' | 'error' | 'cost_guard' | 'retry' | 'skip';
  content: string;             // Textul înregistrat (append-only)
  toolCall?: ToolCallRecord;   // Prezent doar pentru type: 'tool_call'
  timestamp: number;
}

export interface ExecutionLog {
  sessionId: string;
  requestId: string;           // UUID unic per request
  entries: ExecutionLogEntry[];
  totalToolCalls: number;
  totalDurationMs: number;
  status: 'in_progress' | 'complete' | 'aborted';
  costGuardTriggered: boolean;
}

export interface ExecutionEngineInput {
  thinkingFrame: ThinkingFrame;           // Din Layer 5
  routingDecision: RoutingDecision;       // Din Layer 4
  currentMessage: string;
  availableTools: Set<string>;            // Din Layer 4 getActiveTools()
  onToolCallStart?: (toolName: string, params: any) => void;
  onToolCallComplete?: (record: ToolCallRecord) => void;
  onThinkingEvent?: (event: ThinkingEvent) => void;
  onCostGuardWarning?: (iteration: number) => void;
}

export interface ExecutionEngineOutput {
  executionLog: ExecutionLog;
  observationContext: string;  // Text formatat cu toate observațiile — injectat în Layer 7
  completedStepIds: string[];  // ID-urile pașilor din ThinkingFrame care s-au finalizat
  wasAborted: boolean;
  abortReason?: string;
}

// Fallback map — ce faci când un tool eșuează
export interface FallbackRule {
  failedTool: string;
  fallbackAction: 'retry' | 'alternative_tool' | 'skip' | 'abort';
  alternativeTool?: string;
  alternativeParams?: (originalParams: any) => any;
  maxRetries: number;
}

// ============================================================
// LAYER 7 — RESPONSE SYNTHESIS TYPES
// ============================================================

export type ResponseFormat =
  | 'plain_text'      // Răspuns simplu, fără formatare specială
  | 'markdown'        // Markdown cu headere, liste, bold
  | 'code_block'      // Bloc de cod cu output
  | 'widget'          // Widget HTML/SVG/JS interactiv
  | 'pending_action'  // Operațiune de scriere care necesită confirmare
  | 'clarification'   // Întrebare de clarificare
  | 'error_response'; // Răspuns la eșec de tool sau eroare internă

export interface Citation {
  index: number;       // [1], [2], etc.
  uri: string;
  title: string;
  snippet?: string;    // Preview text din sursă
}

export interface RelatedQuestion {
  text: string;
  category?: 'follow_up' | 'deeper_dive' | 'related_topic';
}

export interface SynthesisQualityCheck {
  hasCitationsWhenNeeded: boolean;   // Search results citate corect?
  hasConfidenceWhenNeeded: boolean;  // Nivel de încredere declarat?
  hasWidgetWhenNeeded: boolean;      // Widget generat pentru date vizuale?
  lengthAppropriate: boolean;        // Lungimea răspunsului e potrivită?
  noInventedData: boolean;           // Nicio dată personală inventată?
  passed: boolean;                   // true dacă toate checks sunt ok
  warnings: string[];                // Lista de avertismente dacă nu a trecut
}

export interface SynthesisInput {
  rawModelOutput: string;            // Textul brut de la model
  executionLog: ExecutionLog | null; // Din Layer 6
  routingDecision: RoutingDecision;  // Din Layer 4
  thinkingFrame: ThinkingFrame;      // Din Layer 5
  searchResults?: Array<{            // Rezultatele search dacă există
    uri: string;
    title: string;
    snippet?: string;
  }>;
  currentMessage: string;
  isAgentMode: boolean;
}

export interface SynthesisOutput {
  finalText: string;                 // Textul final procesat
  format: ResponseFormat;
  citations: Citation[];
  relatedQuestions: RelatedQuestion[];
  pendingAction?: any;               // PendingAction dacă există operațiune de scriere
  qualityCheck: SynthesisQualityCheck;
  confidence: ConfidenceLevel;
  operationMode: OperationMode;
  reasoning?: string;                // Rezumat intern pentru debugging
}

// ============================================================
// LAYER 8 — RAG & WORKSPACE INTELLIGENCE TYPES
// ============================================================

export interface DocumentChunk {
  id: string;
  sourceFile: string;          // Numele fișierului sursă
  chunkIndex: number;          // Poziția chunk-ului în document
  content: string;             // Textul efectiv al chunk-ului
  tokenCount: number;          // Estimare tokens
  keywords: string[];          // Cuvinte cheie extrase
  embedding?: number[];        // Vector embedding (opțional, pentru viitor)
}

export interface RagIndex {
  sessionId: string;
  chunks: DocumentChunk[];
  lastUpdated: number;
  totalChunks: number;
  sourceFiles: string[];
}

export interface RagSearchResult {
  chunk: DocumentChunk;
  score: number;               // 0-1, relevanță față de query
  matchType: 'keyword' | 'semantic' | 'hybrid';
}

export interface ExternalizedObservation {
  id: string;
  requestId: string;           // Din ExecutionLog
  toolName: string;
  query: string;               // Query-ul original care a generat observația
  fullContent: string;         // Conținutul complet externalizat
  summary: string;             // Rezumat de 100 tokens
  tokenCount: number;
  storedAt: number;
}

export interface RagEngineInput {
  query: string;               // Query-ul de căutare
  topK?: number;               // Numărul maxim de rezultate (default: 5)
  sourceFiles?: string[];      // Filtrare opțională pe fișiere specifice
  includeExternalized?: boolean; // Include și observații externalizate
  sessionId: string;
}

export interface RagEngineOutput {
  results: RagSearchResult[];
  externalizedResults: ExternalizedObservation[];
  totalFound: number;
  queryTokens: string[];       // Cuvintele cheie extrase din query
  fromCache: boolean;
}

// ============================================================
// LAYER 9 — OUTPUT RENDERER TYPES
// ============================================================

export type RenderBlockType =
  | 'text'            // Paragraf text simplu sau markdown
  | 'code'            // Bloc de cod cu language tag
  | 'widget'          // Widget HTML/SVG/JS interactiv
  | 'pending_action'  // Dialog confirmare operațiune scriere
  | 'citation_list'   // Lista de surse la finalul răspunsului
  | 'related_questions' // Întrebări sugestive
  | 'error'           // Mesaj de eroare formatat
  | 'thinking_summary'; // Rezumat al procesului de gândire

export interface RenderBlock {
  id: string;
  type: RenderBlockType;
  content: string;          // Conținut text sau HTML
  metadata?: {
    language?: string;      // Pentru code blocks
    title?: string;         // Pentru widgets
    citations?: Citation[]; // Pentru text cu citări
    pendingAction?: any;    // Pentru pending_action blocks
    relatedQuestions?: string[]; // Pentru related_questions
    isStreaming?: boolean;  // true dacă blocul e în curs de streaming
  };
  order: number;            // Ordinea în layout
}

export interface StreamingState {
  isStreaming: boolean;
  currentBlockId: string | null;
  bufferedText: string;
  lastUpdateMs: number;
}

export interface RendererInput {
  synthesisOutput: SynthesisOutput;   // Din Layer 7
  enableStreaming: boolean;
  theme: 'light' | 'dark' | 'system';
  onPendingActionConfirm?: (data: any) => void;
  onPendingActionCancel?: () => void;
  onRelatedQuestionClick?: (question: string) => void;
}

export interface RendererOutput {
  blocks: RenderBlock[];              // Blocuri ordonate pentru randare
  streamingState: StreamingState;
  hasWidget: boolean;
  hasPendingAction: boolean;
  totalBlocks: number;
}

// ============================================================
// LAYER 10 — MEMORY CONSOLIDATION TYPES
// ============================================================

export type MemoryExtractionCategory =
  | 'PersonalFact'        // Fapte despre utilizator (nume, vârstă, job)
  | 'Preference'          // Preferințe declarate sau detectate
  | 'CommunicationStyle'  // Cum preferă să comunice
  | 'ActiveProject'       // Proiecte sau taskuri în desfășurare
  | 'Decision'            // Decizii luate în conversație
  | 'Correction'          // Utilizatorul a corectat agentul
  | 'EpisodicSummary';    // Rezumat al unei conversații importante

export interface ExtractedMemory {
  id: string;
  category: MemoryExtractionCategory;
  content: string;              // Faptul/preferința în formă canonică
  confidence: ConfidenceLevel;  // Cât de siguri suntem că e corect
  sourceMessageIndex: number;   // Index în conversație
  shouldReplace?: string;       // ID-ul unei memorii existente de înlocuit
  expiresAt?: number;           // Timestamp opțional de expirare
}

export interface ConsolidationInput {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  currentPrompt: string;
  currentResponse: string;
  sessionId: string;
  existingMemories?: MemoryEntry[];   // Din Layer 2 — pentru deduplicare
  enableEpisodicSummary?: boolean;    // Generează rezumat episodic?
  provider: string;
  apiKey?: string;                    // Necesar dacă folosim LLM pentru extragere
}

export interface ConsolidationOutput {
  extracted: ExtractedMemory[];
  saved: number;                      // Câte memorii au fost salvate efectiv
  replaced: number;                   // Câte memorii vechi au fost înlocuite
  skipped: number;                    // Câte au fost sărite (duplicate, low confidence)
  episodicSummary?: string;           // Rezumatul episodic dacă a fost generat
  durationMs: number;
}
