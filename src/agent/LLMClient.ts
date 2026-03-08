import { GoogleGenAI } from "@google/genai";
import { ModelProvider, LocalModelConfig } from '../../types';

export interface LLMResponse {
    text: string;
    toolCalls?: any[];
    usage?: any;
}

export class LLMClient {
    private geminiClient: GoogleGenAI | null = null;

    constructor(private config: {
        provider: ModelProvider;
        apiKey?: string;
        modelId: string;
        localModel?: LocalModelConfig;
        openRouterKey?: string;
        openAiKey?: string;
    }) {
        if (config.provider === ModelProvider.GEMINI && config.apiKey) {
            this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
        }
    }

    public async generateCompletion(
        messages: any[], 
        tools: any[], 
        systemInstruction?: string
    ): Promise<LLMResponse> {
        if (this.config.provider === ModelProvider.GEMINI) {
            return this.generateGemini(messages, tools, systemInstruction);
        } else {
            return this.generateGeneric(messages, tools, systemInstruction);
        }
    }

    private async generateGemini(messages: any[], tools: any[], systemInstruction?: string): Promise<LLMResponse> {
        if (!this.geminiClient) throw new Error("Gemini Client not initialized");
        
        // Convert tools to Gemini format
        const geminiTools = tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }));

        const chat = this.geminiClient.chats.create({
            model: this.config.modelId,
            history: messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            })),
            config: {
                tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
                systemInstruction: systemInstruction
            }
        });

        const lastMsg = messages[messages.length - 1];
        const result = await chat.sendMessage(lastMsg.content);
        const response = result;
        
        // Extract tool calls
        const functionCalls = response.functionCalls;
        const toolCalls = functionCalls ? functionCalls.map((fc: any) => ({
            name: fc.name,
            args: fc.args
        })) : undefined;
        
        return {
            text: response.text || "",
            toolCalls: toolCalls
        };
    }

    private async generateGeneric(_messages: any[], _tools: any[], _systemInstruction?: string): Promise<LLMResponse> {
        // Implementation for OpenAI/OpenRouter/Local
        // ...
        return { text: "Generic response placeholder" };
    }
}
