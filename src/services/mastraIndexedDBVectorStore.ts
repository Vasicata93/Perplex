import { db, STORES } from '../../services/db';

/**
 * Vector store local — stochează embeddings în IndexedDB.
 * Clasă standalone, fără extends, evită incompatibilitățile de tip cu @mastra/core v1.8.x
 */
export class MastraIndexedDBVectorStore {
  constructor(_config: { id: string }) { }

  async upsert(params: { vectors: number[][], metadata?: any[], ids?: string[] }): Promise<string[]> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const newIds: string[] = [];

    for (let i = 0; i < params.vectors.length; i++) {
      const id = params.ids?.[i] || crypto.randomUUID();
      const record = {
        id,
        embedding: params.vectors[i],
        metadata: params.metadata?.[i] || {},
        content: params.metadata?.[i]?.text || '',
        filename: params.metadata?.[i]?.filename || 'mastra',
      };
      const existingIdx = allChunks.findIndex((c: any) => c.id === id);
      if (existingIdx !== -1) allChunks[existingIdx] = record;
      else allChunks.push(record);
      newIds.push(id);
    }

    await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks);
    return newIds;
  }

  async queryVector(params: { queryVector: number[], topK?: number }): Promise<any[]> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const topK = params.topK ?? 10;
    const results = allChunks.map((chunk: any) => ({
      id: chunk.id,
      score: this.cosineSimilarity(params.queryVector, chunk.embedding),
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

  async deleteVectors(params: { ids: string[] }): Promise<void> {
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    await db.set(STORES.EMBEDDINGS, 'all_chunks',
      allChunks.filter((c: any) => !params.ids.includes(c.id))
    );
  }
}