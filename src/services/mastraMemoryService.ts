/**
 * mastraMemoryService.ts
 * 
 * Instanța Mastra Memory care rulează în BROWSER.
 * Folosește MastraIndexedDBStorage — toate datele rămân local pe dispozitiv.
 * Serverul (agentMax) primește doar contextul string, nu atinge storage-ul.
 */
import { Memory } from '@mastra/memory';
import { MastraIndexedDBStorage } from './mastraIndexedDBStorage';
import { MastraIndexedDBVectorStore } from './mastraIndexedDBVectorStore';

// Singleton — o singură instanță pentru toată aplicația
let memoryInstance: Memory | null = null;

function getMastraMemory(): Memory {
    if (!memoryInstance) {
        memoryInstance = new Memory({
            storage: new MastraIndexedDBStorage(),
            vector: new MastraIndexedDBVectorStore({ id: 'agent-max-vector' }),
            options: {
                lastMessages: 20,           // Ultimele 20 mesaje în context
                semanticRecall: {
                    topK: 5,                // Top 5 rezultate semantice relevante
                    messageRange: { before: 2, after: 2 }
                },
                workingMemory: {
                    enabled: true,
                    template: `# User Profile\n- Name:\n- Preferences:\n- Goals:\n- Context:\n`
                }
            }
        });
    }
    return memoryInstance;
}

/**
 * Apelat ÎNAINTE de a trimite requestul la server.
 * Returnează contextul de memorie relevant pentru prompt-ul curent.
 */
export async function getMemoryContext(
    threadId: string,
    resourceId: string,
    currentPrompt: string
): Promise<{ contextString: string; threadId: string }> {
    try {
        const memory = getMastraMemory();

        // Asigură că thread-ul există
        const existingThread = await memory.getThreadById({ threadId });
        if (!existingThread) {
            await memory.createThread({
                threadId,
                resourceId,
                title: `Agent Max - ${new Date().toLocaleDateString()}`,
                metadata: { type: 'agent-max' }
            });
        }

        // Preia contextul relevant pentru prompt-ul curent
        const memoryResult = await memory.query({
            threadId,
            resourceId,
            selectBy: {
                last: 20,
                vectorSearchString: currentPrompt
            }
        });

        // Formatează ca string pentru injectare în system prompt
        const messages = memoryResult.messages || [];
        if (messages.length === 0) return { contextString: '', threadId };

        const contextLines = messages
            .filter((m: any) => m.content)
            .map((m: any) => `[${m.role}]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
            .join('\n');

        const contextString = `\n\n### 🧠 MASTRA MEMORY CONTEXT\n**Conversation history and relevant facts:**\n${contextLines}`;

        return { contextString, threadId };
    } catch (e) {
        console.error('[MastraMemoryService] getMemoryContext error:', e);
        return { contextString: '', threadId };
    }
}

/**
 * Apelat DUPĂ ce serverul returnează răspunsul.
 * Salvează mesajul user și răspunsul agentului în memoria locală.
 */
export async function saveToMemory(
    threadId: string,
    resourceId: string,
    userMessage: string,
    agentResponse: string
): Promise<void> {
    try {
        const memory = getMastraMemory();

        await memory.saveMessages({
            messages: [
                {
                    id: crypto.randomUUID(),
                    threadId,
                    role: 'user',
                    content: userMessage,
                    type: 'text',
                    createdAt: new Date()
                },
                {
                    id: crypto.randomUUID(),
                    threadId,
                    role: 'assistant',
                    content: agentResponse,
                    type: 'text',
                    createdAt: new Date()
                }
            ]
        });
    } catch (e) {
        console.error('[MastraMemoryService] saveToMemory error:', e);
    }
}