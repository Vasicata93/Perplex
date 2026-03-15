import { Request, Response } from 'express';
import { Agent } from '@mastra/core/agent';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { buildAgentSystemPrompt } from '../../src/agent/AgentOrchestrator';
import { DEFAULT_AGENT_CONFIG } from '../../src/agent/types';

function buildServerTools(clientData: {
    memoryContext: string;
    calendarEvents: any[];
    workspaceFiles: any[];
    notes: any[];
    tavilyApiKey: string;
    braveApiKey: string;
    searchProvider: string;
}, pendingActions: any[]) {

    const webSearchTool = createTool({
        id: 'web_search',
        description: 'Searches the web for real-time information. Use for current events, news, prices, weather.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ context }) => {
            const useBrave = clientData.searchProvider === 'brave' && clientData.braveApiKey;
            if (useBrave) {
                const url = new URL('https://api.search.brave.com/res/v1/web/search');
                url.searchParams.set('q', context.query);
                url.searchParams.set('count', '5');
                const r = await fetch(url.toString(), {
                    headers: { 'Accept': 'application/json', 'X-Subscription-Token': clientData.braveApiKey }
                });
                const data = await r.json();
                return data.web?.results?.map((x: any) => `${x.title}: ${x.description}`).join('\n') || 'No results';
            }
            if (!clientData.tavilyApiKey) return 'Search unavailable: no API key';
            const r = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: clientData.tavilyApiKey, query: context.query, max_results: 5 })
            });
            const data = await r.json();
            return data.results?.map((x: any) => `${x.title}: ${x.content}`).join('\n') || 'No results';
        }
    });

    const calendarReadTool = createTool({
        id: 'list_calendar_events',
        description: 'Lists calendar events for a date range.',
        inputSchema: z.object({ startDate: z.string(), endDate: z.string() }),
        execute: async ({ context }) => {
            const start = new Date(context.startDate).getTime();
            const end = new Date(context.endDate).getTime();
            const filtered = clientData.calendarEvents.filter(
                (e: any) => e.startDate <= end && e.endDate >= start
            );
            return filtered.length > 0 ? JSON.stringify(filtered) : 'No events in this period';
        }
    });

    const calendarAddTool = createTool({
        id: 'add_calendar_event',
        description: 'Adds a new event to the calendar. Only when user explicitly asks.',
        inputSchema: z.object({
            title: z.string(),
            startDate: z.string(),
            endDate: z.string(),
            description: z.string().optional()
        }),
        execute: async ({ context }) => {
            pendingActions.push({ type: 'add_calendar_event', payload: context });
            return `Event "${context.title}" scheduled`;
        }
    });

    const workspaceSearchTool = createTool({
        id: 'search_workspace',
        description: 'Searches user workspace files, library pages and notes.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ context }) => {
            const q = context.query.toLowerCase();
            const results: string[] = [];
            for (const f of clientData.workspaceFiles) {
                if (f.content?.toLowerCase().includes(q)) {
                    results.push(`[File: ${f.name}]\n${f.content.substring(0, 600)}`);
                }
            }
            for (const n of clientData.notes) {
                if (n.content?.toLowerCase().includes(q) || n.title?.toLowerCase().includes(q)) {
                    results.push(`[Note: ${n.title}]\n${(n.content || '').substring(0, 600)}`);
                }
            }
            return results.slice(0, 3).join('\n\n---\n\n') || 'No results found';
        }
    });

    const saveLibraryTool = createTool({
        id: 'save_to_library',
        description: 'Saves content to user library. ONLY when user explicitly says "save this".',
        inputSchema: z.object({ title: z.string(), content: z.string(), action: z.enum(['create', 'update']) }),
        execute: async ({ context }) => {
            pendingActions.push({ type: 'save_to_library', payload: context });
            return `"${context.title}" queued for saving`;
        }
    });

    return { web_search: webSearchTool, list_calendar_events: calendarReadTool, add_calendar_event: calendarAddTool, search_workspace: workspaceSearchTool, save_to_library: saveLibraryTool };
}

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
    const tools = buildServerTools({
        memoryContext: memoryContext || '',
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
