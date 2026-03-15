import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type ClientData = {
    calendarEvents: any[];
    workspaceFiles: any[];
    notes: any[];
    tavilyApiKey: string;
    braveApiKey: string;
    searchProvider: string;
};

export function buildAgentMaxTools(clientData: ClientData, pendingActions: any[]) {

    const webSearchTool = createTool({
        id: 'web_search',
        description: 'Searches the web for real-time information. Use for current events, news, prices, weather.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
            const useBrave = clientData.searchProvider === 'brave' && clientData.braveApiKey;
            if (useBrave) {
                const url = new URL('https://api.search.brave.com/res/v1/web/search');
                url.searchParams.set('q', query);
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
                body: JSON.stringify({ api_key: clientData.tavilyApiKey, query, max_results: 5 })
            });
            const data = await r.json();
            return data.results?.map((x: any) => `${x.title}: ${x.content}`).join('\n') || 'No results';
        }
    });

    const calendarReadTool = createTool({
        id: 'list_calendar_events',
        description: 'Lists calendar events for a date range.',
        inputSchema: z.object({ startDate: z.string(), endDate: z.string() }),
        execute: async ({ startDate, endDate }) => {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
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
        execute: async ({ title, startDate, endDate, description }) => {
            pendingActions.push({ type: 'add_calendar_event', payload: { title, startDate, endDate, description } });
            return `Event "${title}" scheduled`;
        }
    });

    const workspaceSearchTool = createTool({
        id: 'search_workspace',
        description: 'Searches user workspace files, library pages and notes.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
            const q = query.toLowerCase();
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
        execute: async ({ title, content, action }) => {
            pendingActions.push({ type: 'save_to_library', payload: { title, content, action } });
            return `"${title}" queued for saving`;
        }
    });

    return { web_search: webSearchTool, list_calendar_events: calendarReadTool, add_calendar_event: calendarAddTool, search_workspace: workspaceSearchTool, save_to_library: saveLibraryTool };
}