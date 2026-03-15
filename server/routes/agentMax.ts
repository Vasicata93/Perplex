import { Request, Response } from 'express';
import { Agent } from '@mastra/core/agent';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { buildAgentSystemPrompt } from '../../src/agent/AgentOrchestrator';
import { DEFAULT_AGENT_CONFIG } from '../../src/agent/types';
import { buildAgentMaxTools } from '../../src/agent/agentMaxTools';

export const handleAgentMax = async (req: Request, res: Response) => {
    const {
        prompt, threadId, provider, apiKey, modelId,
        tavilyApiKey, braveApiKey, searchProvider,
        memoryContext,   // ← vine din browser, gata pregătit
        calendarEvents, workspaceFiles, notes
    } = req.body;

    // 1. API key dinamic
    const effectiveApiKey = apiKey ||
        (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : null) ||
        process.env.API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!effectiveApiKey) {
        return res.status(400).json({ error: `API key missing for provider: ${provider}` });
    }

    // 2. Model corect pentru Mastra
    let mastraModel: any;
    try {
        if (provider === 'openrouter') {
            const openrouter = createOpenRouter({ apiKey: effectiveApiKey });
            mastraModel = openrouter(modelId || 'google/gemini-pro');
        } else {
            const google = createGoogleGenerativeAI({ apiKey: effectiveApiKey });
            mastraModel = google((modelId || 'gemini-1.5-pro-latest').replace('google/', ''));
        }
    } catch (err: any) {
        return res.status(500).json({ error: `Model init failed: ${err.message}` });
    }

    // 3. System prompt cu toate skills + memoria din browser
    const now = new Date().toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long',
        day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
    const { systemPrompt } = buildAgentSystemPrompt({
        userMessage: prompt,
        baseSystemContext: 'You are Agent Max, the highest-performance mode of this assistant.',
        memoryContext: memoryContext || '',  // ← memoria Mastra injectată
        currentDateTime: now,
        config: DEFAULT_AGENT_CONFIG
    });

    const pendingActions: any[] = [];
    const tools = buildAgentMaxTools({
        calendarEvents: calendarEvents || [],
        workspaceFiles: workspaceFiles || [],
        notes: notes || [],
        tavilyApiKey: tavilyApiKey || process.env.TAVILY_API_KEY || '',
        braveApiKey: braveApiKey || '',
        searchProvider: searchProvider || 'tavily'
    }, pendingActions);

    try {
        const dynamicAgent = new Agent({
            id: `agent-max-${threadId || 'default'}`,
            name: 'Agent Max',
            instructions: systemPrompt,
            model: mastraModel,
            tools
        });

        const result = await dynamicAgent.generate(prompt);

        res.json({
            text: result.text,
            usage: result.usage,
            pendingActions
        });
    } catch (error: any) {
        console.error('[Agent Max Error]:', error);
        res.status(500).json({ error: error.message });
    }
};
