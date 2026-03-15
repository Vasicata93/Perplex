import { MastraVector } from '@mastra/core/vector';
import type { QueryResult, QueryVectorParams, UpsertVectorParams, IndexStats, CreateIndexParams, DescribeIndexParams, DeleteIndexParams, UpdateVectorParams, DeleteVectorParams, DeleteVectorsParams } from '@mastra/core/vector';
import { db, STORES } from '../../services/db';

export class MastraIndexedDBVectorStore extends MastraVector {
  constructor({ id }: { id: string }) {
    super({ id });
  }

  async createIndex(params: CreateIndexParams): Promise<void> {
    console.log(`[MastraVector] Created index: ${params.indexName}`);
  }

  async listIndexes(): Promise<string[]> {
    return ['mastra_index'];
  }

  async describeIndex(_params: DescribeIndexParams): Promise<IndexStats> {
    const all = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    return {
      dimension: all[0]?.embedding?.length || 0,
      count: all.length,
      metric: 'cosine'
    };
  }

  async deleteIndex(_params: DeleteIndexParams): Promise<void> {
    await db.set(STORES.EMBEDDINGS, 'all_chunks', []);
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    const { vectors, metadata, ids } = params;
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
            spaceId: metadata?.[i]?.spaceId || 'mastra_space'
        };
        
        const existingIdx = allChunks.findIndex((c: any) => c.id === id);
        if (existingIdx !== -1) {
            allChunks[existingIdx] = record;
        } else {
            allChunks.push(record);
        }
        newIds.push(id);
    }
    
    await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks);
    return newIds;
  }

  async query(params: QueryVectorParams): Promise<QueryResult[]> {
    const { queryVector, topK = 10 } = params;
    if (!queryVector) return [];

    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    
    const results = allChunks.map((chunk: any) => ({
        id: chunk.id,
        score: this.cosineSimilarity(queryVector, chunk.embedding),
        metadata: chunk.metadata,
        vector: chunk.embedding
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async updateVector(params: UpdateVectorParams): Promise<void> {
    const { id, update } = params as any;
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const idx = allChunks.findIndex((c: any) => c.id === id);
    if (idx !== -1) {
        if (update.vector) allChunks[idx].embedding = update.vector;
        if (update.metadata) allChunks[idx].metadata = { ...allChunks[idx].metadata, ...update.metadata };
        await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks);
    }
  }

  async deleteVector(params: DeleteVectorParams): Promise<void> {
    const { id } = params;
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    const filtered = allChunks.filter((c: any) => c.id !== id);
    await db.set(STORES.EMBEDDINGS, 'all_chunks', filtered);
  }

  async deleteVectors(params: DeleteVectorsParams): Promise<void> {
    const { ids, filter } = params;
    const allChunks = await db.get<any[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
    let filtered = allChunks;
    if (ids) {
        filtered = allChunks.filter((c: any) => !ids.includes(c.id));
    } else if (filter) {
        filtered = allChunks.filter((c: any) => {
            return !Object.entries(filter).every(([key, value]) => c.metadata?.[key] === value);
        });
    }
    await db.set(STORES.EMBEDDINGS, 'all_chunks', filtered);
  }
}
