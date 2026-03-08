import { Message, Citation, PendingAction, ModelProvider, ProMode, UserProfile, AiProfile, LocalModelConfig } from '../../types';

// --- Core Agent Types ---

export interface AgentContext {
    sessionId: string;
    turnCount: number;
    history: Message[];
    userProfile: UserProfile;
    aiProfile: AiProfile;
    config: AgentConfig;
    memory: MemorySnapshot;
}

export interface AgentConfig {
    provider: ModelProvider;
    modelId: string;
    apiKey?: string;
    useSearch: boolean;
    proMode: ProMode;
    enableMemory: boolean;
    localModel?: LocalModelConfig;
    searchProvider: 'tavily' | 'brave';
    searchApiKey?: string;
    openRouterKey?: string;
    openAiKey?: string;
}

export interface MemorySnapshot {
    working: WorkingMemory;
    episodic: EpisodicMemory;
    persistent: PersistentMemory;
}

export interface WorkingMemory {
    activeSubtask?: string;
    toolOutputs: Record<string, any>;
    intermediateResults: string[];
    scratchpad: string;
}

export interface EpisodicMemory {
    pastTurns: Message[];
    decisions: DecisionLog[];
    artifacts: string[]; // IDs of created artifacts
}

export interface PersistentMemory {
    // Interface to long-term storage (DB/Files)
    storeId: string;
}

export interface DecisionLog {
    timestamp: number;
    intent: string;
    action: string;
    outcome: string;
}

// --- Task & Planning ---

export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    dependencies: string[]; // Task IDs
    result?: string;
}

export interface Plan {
    id: string;
    goal: string;
    tasks: Task[];
    currentTaskId?: string;
}

// --- Tooling ---

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any; // JSON Schema
    execute: (args: any, context: AgentContext) => Promise<any>;
}

export interface ToolResult {
    toolName: string;
    args: any;
    output: any;
    status: 'success' | 'error';
    error?: string;
}

// --- Orchestrator Events ---

export type AgentEvent = 
    | { type: 'thinking', content: string }
    | { type: 'tool_start', tool: string, args: any }
    | { type: 'tool_end', tool: string, result: any }
    | { type: 'chunk', content: string }
    | { type: 'error', message: string }
    | { type: 'complete', result: AgentResult };

export interface AgentResult {
    text: string;
    citations: Citation[];
    relatedQuestions: string[];
    searchImages: string[];
    pendingAction?: PendingAction;
    reasoning?: string;
}
