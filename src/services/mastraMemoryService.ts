/**
 * mastraMemoryService.ts
 * 
 * Gestionează memoria Mastra cu stocare locală (IndexedDB).
 * Evită instanțierea Memory în browser (incompatibilități Node.js).
 * Folosește direct MastraIndexedDBStorage pentru operații CRUD.
 */
import { MastraIndexedDBStorage } from './mastraIndexedDBStorage';

// Singleton storage
const storage = new MastraIndexedDBStorage();

/**
 * Apelat ÎNAINTE de request la server.
 * Citește istoricul conversației din IndexedDB și îl formatează ca context string.
 */
export async function getMemoryContext(
    threadId: string,
    _resourceId: string,
    _currentPrompt: string
): Promise<{ contextString: string; threadId: string }> {
    try {
        // Asigură că thread-ul există
        const existingThread = await storage.getThreadById({ threadId });
        if (!existingThread) {
            await storage.saveThread({
                thread: {
                    id: threadId,
                    resourceId: 'agent-max-user',
                    title: `Agent Max - ${new Date().toLocaleDateString()}`,
                    metadata: { type: 'agent-max' },
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any
            });
        }

        // Citește ultimele mesaje din thread
        const result = await storage.listMessages({ threadId });
        const messages = result.messages || [];

        if (messages.length === 0) return { contextString: '', threadId };

        // Ia ultimele 20 mesaje
        const recent = messages.slice(-20);

        const contextLines = messages
            .filter((m: any) => m.content)
            .map((m: any) => {
                const content = typeof m.content === 'string'
                    ? m.content
                    : Array.isArray(m.content)
                        ? m.content.map((c: any) => c.text || c.content || '').join(' ')
                        : JSON.stringify(m.content);
                return `[${m.role}]: ${content}`;
            })
            .join('\n');

        const contextString = `\n\n### 🧠 AGENT MAX MEMORY\n${contextLines}`;
        return { contextString, threadId };

    } catch (e) {
        console.error('[MastraMemoryService] getMemoryContext error:', e);
        return { contextString: '', threadId };
    }
}

/**
 * Apelat DUPĂ ce serverul returnează răspunsul.
 * Salvează mesajul user și răspunsul agentului în IndexedDB local.
 */
export async function saveToMemory(
    threadId: string,
    _resourceId: string,
    userMessage: string,
    agentResponse: string
): Promise<void> {
    try {
        await storage.saveMessages({
            messages: [
                {
                    id: crypto.randomUUID(),
                    threadId,
                    role: 'user',
                    content: [{ type: 'text', text: userMessage }],
                    type: 'text',
                    createdAt: new Date()
                } as any,
                {
                    id: crypto.randomUUID(),
                    threadId,
                    role: 'assistant',
                    content: [{ type: 'text', text: agentResponse }],
                    type: 'text',
                    createdAt: new Date()
                } as any
            ]
        });
    } catch (e) {
        console.error('[MastraMemoryService] saveToMemory error:', e);
    }
}