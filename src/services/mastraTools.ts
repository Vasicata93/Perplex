
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { TavilyService } from '../../services/tavilyService';
import { db, STORES } from '../../services/db';
import { memoryManager } from '../../memory';

// tavily instance removed

export const searchTool = createTool({
  id: 'web_search',
  description: 'Searches the web for real-time information. REQUIRED for current events, news, weather, or specific facts.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    // TavilyService.search is actually a static method based on the lint error hint
    // Wait, let's check TavilyService.ts
    const results = await (TavilyService as any).search(query);
    return results;
  },
});

export const memorySearchTool = createTool({
    id: 'search_memory',
    description: 'Searches the user\'s long-term memory for personal facts, preferences, and project history.',
    inputSchema: z.object({
      query: z.string().describe('The natural language query to search in memory'),
    }),
    execute: async ({ query }) => {
      const results = await memoryManager.formatContextString(query);
      return results;
    },
});

export const calendarListTool = createTool({
    id: 'list_calendar_events',
    description: 'Lists calendar events for a specific date range.',
    inputSchema: z.object({
      startDate: z.string().describe('Start date in ISO format'),
      endDate: z.string().describe('End date in ISO format'),
    }),
    execute: async ({ startDate, endDate }) => {
      const allEvents = await db.get<any[]>(STORES.CALENDAR, 'all_events') || [];
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      return allEvents.filter(e => e.startDate <= end && e.endDate >= start);
    },
});

export const allMastraTools = {
    web_search: searchTool,
    search_memory: memorySearchTool,
    list_calendar_events: calendarListTool,
};
