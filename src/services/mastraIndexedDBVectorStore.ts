import { db, STORES } from '../../services/db';

/**
 * Vector store local simplu — stochează embeddings în IndexedDB.
 * Nu mai extinde MastraVector din cauza incompatibilităților de tip în v1.8.x.
 * Folosit direct de mastraMemoryService fără instanțiere prin Mastra Memory.
 */
export class MastraIndexedDBVectorStore {
  constructor(private config: { id: string }) { }

  async upsert({ vectors, metadata, ids }: { vectors: number[][], metadata?: any[], ids?: string[] }): Promise<string[]> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const newIds: string[] = [];

    for (let i = 0; i < vectors.length; i++) {
      const id = ids?.[i] || crypto.randomUUID();
      const record = {
        id,
        embedding: vectors[i],
        metadata: metadata?.[i] || {},
        content: metadata?.[i]?.text || '',
        filename: metadata?.[i]?.filename || 'mastra',
      };
      const existingIdx = allChunks.findIndex((c: any) => c.id === id);
      if (existingIdx !== -1) allChunks[existingIdx] = record;
      else allChunks.push(record);
      newIds.push(id);
    }

    await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks);
    return newIds;
  }

  async query({ queryVector, topK = 10 }: { queryVector: number[], topK?: number }): Promise<any[]> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const results = allChunks.map((chunk: any) => ({
      id: chunk.id,
      score: this.cosineSimilarity(queryVector, chunk.embedding),
      metadata: chunk.metadata
    }));
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteVectors({ ids }: { ids: string[] }): Promise<void> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks.filter((c: any) => !ids.includes(c.id)));
  }
}