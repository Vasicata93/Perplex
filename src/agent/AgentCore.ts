import { AgentContext, AgentConfig, AgentResult, AgentEvent } from './types';
import { ToolingSystem } from './ToolingSystem';
import { MemorySystem } from './MemorySystem';
import { LLMClient } from './LLMClient';
import { Orchestrator } from './Orchestrator';
import { Message, UserProfile, AiProfile } from '../../types';

export class AgentCore {
    private context: AgentContext;
    private tooling: ToolingSystem;
    private memory: MemorySystem;
    private llm: LLMClient;
    private orchestrator: Orchestrator;

    constructor(config: AgentConfig, userProfile: UserProfile, aiProfile: AiProfile) {
        this.context = {
            sessionId: crypto.randomUUID(),
            turnCount: 0,
            history: [],
            userProfile,
            aiProfile,
            config,
            memory: {
                working: { toolOutputs: {}, intermediateResults: [], scratchpad: '' },
                episodic: { pastTurns: [], decisions: [], artifacts: [] },
                persistent: { storeId: 'default' }
            }
        };

        this.tooling = new ToolingSystem();
        this.memory = new MemorySystem();
        this.llm = new LLMClient({
            provider: config.provider,
            apiKey: config.apiKey,
            modelId: config.modelId,
            localModel: config.localModel,
            openRouterKey: config.openRouterKey, // Assuming config has these fields
            openAiKey: config.openAiKey
        });

        this.orchestrator = new Orchestrator(
            this.context,
            this.tooling,
            this.memory,
            this.llm,
            this.handleEvent.bind(this)
        );
    }

    private handleEvent(event: AgentEvent) {
        console.log(`[Agent Event] ${event.type}:`, event);
        // Dispatch to UI listeners if needed
    }

    public async sendMessage(message: string, history: Message[]): Promise<AgentResult> {
        this.context.history = history;
        this.context.turnCount++;
        
        return await this.orchestrator.run(message);
    }
}
