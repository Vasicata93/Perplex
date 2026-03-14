import { AgentContext, AgentEvent, AgentResult, Plan } from './types';
import { ToolingSystem } from './ToolingSystem';
import { MemorySystem } from './MemorySystem';
import { LLMClient } from './LLMClient';

export class Orchestrator {
    private tooling: ToolingSystem;
    private memory: MemorySystem;
    private llm: LLMClient;
    private context: AgentContext;
    private eventEmitter: (event: AgentEvent) => void;

    constructor(
        context: AgentContext,
        tooling: ToolingSystem,
        memory: MemorySystem,
        llm: LLMClient,
        eventEmitter: (event: AgentEvent) => void
    ) {
        this.context = context;
        this.tooling = tooling;
        this.memory = memory;
        this.llm = llm;
        this.eventEmitter = eventEmitter;
    }

    public async run(prompt: string): Promise<AgentResult> {
        // 1. Analyze Request (Task Interpreter)
        const intent = await this.analyzeIntent(prompt);
        this.memory.updateWorkingMemory('activeSubtask', intent);
        this.eventEmitter({ type: 'thinking', content: `Analyzing request: ${intent}` });

        // 2. Plan Actions (Planner Engine)
        const plan = await this.createPlan(intent);
        this.eventEmitter({ type: 'thinking', content: `Created plan: ${plan.goal}` });

        // 3. Reasoning Loop
        let turns = 0;
        const maxTurns = 5;
        let finalResult: AgentResult = { text: '', citations: [], relatedQuestions: [] };

        while (turns < maxTurns) {
            // Context Builder
            const messages = this.buildContext(prompt, plan);
            
            // LLM Reasoning Call
            const response = await this.llm.generateCompletion(messages, this.tooling.getAllTools());
            
            // Tool Decision Router
            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const call of response.toolCalls) {
                    this.eventEmitter({ type: 'tool_start', tool: call.name, args: call.args });
                    
                    // Tool Executor
                    const result = await this.tooling.executeTool(call.name, call.args, this.context);
                    
                    // Observation Parser
                    this.memory.addToBuffer('tool', JSON.stringify(result));
                    this.eventEmitter({ type: 'tool_end', tool: call.name, result: result.output });

                    // Handle Pending Actions (Save)
                    if (result.output && result.output.pendingAction) {
                        finalResult.pendingAction = result.output.pendingAction;
                        return finalResult; // Exit loop on pending action
                    }
                }
            } else {
                // Completion Evaluator
                finalResult.text = response.text;
                // Extract reasoning if available
                // ...
                break; // Done
            }

            turns++;
        }

        // 4. Finalizer
        // Result Aggregator
        // ...
        
        this.eventEmitter({ type: 'complete', result: finalResult });
        return finalResult;
    }

    private async analyzeIntent(prompt: string): Promise<string> {
        // Simple heuristic or LLM call
        return "User Intent: " + prompt.substring(0, 50);
    }

    private async createPlan(intent: string): Promise<Plan> {
        // Simple plan creation
        return {
            id: 'plan-1',
            goal: intent,
            tasks: [{ id: 'task-1', description: intent, status: 'pending', dependencies: [] }]
        };
    }

    private buildContext(prompt: string, plan: Plan): any[] {
        // Build messages array
        return [
            { role: 'system', content: `You are an AI agent. Goal: ${plan.goal}` },
            ...this.context.history,
            { role: 'user', content: prompt }
        ];
    }
}
