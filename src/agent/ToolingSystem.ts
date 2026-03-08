import { ToolDefinition, ToolResult, AgentContext } from './types';
import { TavilyService } from '../../services/tavilyService';

export class ToolingSystem {
    private tools: Map<string, ToolDefinition> = new Map();

    constructor() {
        this.registerDefaultTools();
    }

    private registerDefaultTools() {
        // Search Tool
        this.register({
            name: 'perform_search',
            description: 'Searches the web for real-time information. REQUIRED for current events, news, weather, or specific facts not in your training data.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The optimal search query to find the information.' }
                },
                required: ['query'],
                additionalProperties: false
            },
            execute: async (args: { query: string }, context: AgentContext) => {
                if (!context.config.searchApiKey) throw new Error("Search API Key missing");
                const result = await TavilyService.search(args.query, context.config.searchApiKey, context.config.searchProvider);
                return result;
            }
        });

        // Save Tool (Note: This returns a pending action object, not a direct execution result in the traditional sense)
        this.register({
            name: 'save_to_library',
            description: "Creates a new page in the library. Use this when the user explicitly asks to 'save', 'create page', or 'remember'.",
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Title of the page.' },
                    content: { type: 'string', description: 'Markdown content.' },
                    action: { type: 'string', enum: ['create', 'update'], description: 'Action type.' }
                },
                required: ['title', 'content', 'action'],
                additionalProperties: false
            },
            execute: async (args: any, _context: AgentContext) => {
                // Return a structured object that the Orchestrator can interpret as a PendingAction
                return {
                    pendingAction: {
                        type: args.action === 'update' ? 'update_page' : 'create_page',
                        data: { title: args.title, content: args.content }
                    }
                };
            }
        });
    }

    public register(tool: ToolDefinition) {
        this.tools.set(tool.name, tool);
    }

    public getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    public getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    public async executeTool(name: string, args: any, context: AgentContext): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return { toolName: name, args, output: null, status: 'error', error: `Tool ${name} not found` };
        }

        try {
            const output = await tool.execute(args, context);
            return { toolName: name, args, output, status: 'success' };
        } catch (error: any) {
            return { toolName: name, args, output: null, status: 'error', error: error.message };
        }
    }
}
