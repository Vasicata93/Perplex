
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MastraCompositeStore } from '@mastra/core/storage';
import { allMastraTools } from './mastraTools';
import { MastraIndexedDBStorage } from './mastraIndexedDBStorage';
import { MastraIndexedDBVectorStore } from './mastraIndexedDBVectorStore';
import { ALL_AGENT_SKILLS } from '../agent/skills';

// Initialize my custom adapter
const mastraMemoryStorage = new MastraIndexedDBStorage();

// Wrap it in a MastraCompositeStore
const storage = new MastraCompositeStore({
  id: 'mastra-indexeddb-store',
  domains: {
    memory: mastraMemoryStorage as any,
  }
});

const vectorStore = new MastraIndexedDBVectorStore({ id: 'main-vector-store' });

// Initialize Memory with custom storage
const memory = new Memory({
  storage: mastraMemoryStorage as any,
});

export const mastra = new Mastra({
  storage,
  vectors: {
    main: vectorStore,
  },
});

// Skills injection logic
function getDynamicInstructions(intent: string) {
    const relevantSkills = ALL_AGENT_SKILLS.filter(skill => 
        intent.toLowerCase().includes(skill.name.toLowerCase()) || 
        intent.toLowerCase().includes(skill.id.split('_')[1])
    );
    
    if (relevantSkills.length === 0) return '';
    
    return `\n\nRELEVANT SKILLS ACTIVATED:\n${relevantSkills.map(s => `--- ${s.name} ---\n${s.instructions}`).join('\n\n')}`;
}

export const agentMax = new Agent({
  id: 'agent-max',
  name: 'Agent Max',
  instructions: `You are Agent Max, a high-performance Mastra-powered assistant. 
  You have advanced memory capabilities and access to professional skills.
  Always lead with the most relevant information and use your tools to provide accurate, real-time data.`,
  model: {
    id: 'google/gemini-1.5-pro-latest',
    apiKey: (process as any).env.API_KEY,
  } as any,
  memory,
  tools: allMastraTools,
});

// Helper to interact with Agent Max
export async function askAgentMax(prompt: string, threadId: string = 'default-max-thread') {
    const dynamicInstructions = getDynamicInstructions(prompt);
    const fullPrompt = `${prompt}${dynamicInstructions}`;
    
    const result = await agentMax.generate(fullPrompt, {
        memory: {
            thread: threadId,
            resource: 'user-1',
        }
    });
    
    return result;
}
