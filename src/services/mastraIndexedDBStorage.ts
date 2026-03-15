
import { MemoryStorage } from '@mastra/core/storage';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { db, STORES } from '../../services/db';

export class MastraIndexedDBStorage extends MemoryStorage {
  constructor() {
    super();
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = await db.get<StorageThreadType>(STORES.MASTRA_THREADS, threadId);
    return thread || null;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await db.set(STORES.MASTRA_THREADS, thread.id, thread);
    return thread;
  }

  async updateThread({ id, title, metadata }: { id: string; title: string; metadata: Record<string, unknown> }): Promise<StorageThreadType> {
    const existing = await this.getThreadById({ threadId: id });
    if (!existing) {
      throw new Error(`Thread ${id} not found`);
    }
    const updated = { ...existing, title, metadata, updatedAt: new Date() } as StorageThreadType;
    await db.set(STORES.MASTRA_THREADS, id, updated);
    return updated;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messages = await this.listMessages({ threadId });
    for (const msg of messages.messages) {
      await db.delete(STORES.MASTRA_MESSAGES, msg.id);
    }
    await db.delete(STORES.MASTRA_THREADS, threadId);
  }

  async listThreads({ filter }: { filter?: { resourceId?: string; metadata?: Record<string, unknown> } } = {}): Promise<{ threads: StorageThreadType[]; total: number; page: number; perPage: number | false; hasMore: boolean }> {
    const allThreads = await db.getAll<StorageThreadType>(STORES.MASTRA_THREADS);
    let threads = allThreads;
    if (filter?.resourceId) {
      threads = threads.filter((t: any) => t.resourceId === filter.resourceId);
    }
    if (filter?.metadata) {
       threads = threads.filter((t: any) => {
           return Object.entries(filter.metadata!).every(([k, v]) => t.metadata?.[k] === v);
       });
    }
    return { 
      threads,
      total: threads.length,
      page: 0,
      perPage: false,
      hasMore: false
    };
  }

  async listMessages({ threadId }: { threadId: string | string[] }): Promise<{ messages: MastraDBMessage[]; total: number; page: number; perPage: number | false; hasMore: boolean }> {
    const allMessages = await db.getAll<MastraDBMessage>(STORES.MASTRA_MESSAGES);
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];
    const filtered = allMessages
      .filter((m: any) => m.threadId && threadIds.includes(m.threadId))
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { 
      messages: filtered,
      total: filtered.length,
      page: 0,
      perPage: false,
      hasMore: false
    };
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    for (const msg of messages) {
      await db.set(STORES.MASTRA_MESSAGES, msg.id, msg);
    }
    return { messages };
  }

  async updateMessages({ messages }: { messages: any[] }): Promise<MastraDBMessage[]> {
    const updatedMsgs: MastraDBMessage[] = [];
    for (const msg of messages) {
      const existing = await db.get<MastraDBMessage>(STORES.MASTRA_MESSAGES, msg.id);
      if (existing) {
        const updated = { ...existing, ...msg };
        await db.set(STORES.MASTRA_MESSAGES, updated.id, updated);
        updatedMsgs.push(updated);
      }
    }
    return updatedMsgs;
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    const results: MastraDBMessage[] = [];
    for (const id of messageIds) {
      const msg = await db.get<MastraDBMessage>(STORES.MASTRA_MESSAGES, id);
      if (msg) results.push(msg);
    }
    return { messages: results };
  }

  async dangerouslyClearAll(): Promise<void> {
    await db.clear(STORES.MASTRA_MESSAGES);
    await db.clear(STORES.MASTRA_THREADS);
  }
}
