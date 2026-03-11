import { db, STORES } from './db';
import { GoogleGenAI } from '@google/genai';

export interface DocumentChunk {
    id: string; // e.g., `${fileId}_chunk_${index}`
    spaceId: string;
    fileId: string;
    filename: string;
    content: string;
    embedding: number[];
    chunkIndex: number;
}

export class RAGService {
    private static CHUNK_SIZE = 1000;
    private static CHUNK_OVERLAP = 200;

    /**
     * Splits text into overlapping chunks.
     */
    private static chunkText(text: string): string[] {
        if (!text) return [];
        const chunks: string[] = [];
        let i = 0;
        while (i < text.length) {
            const end = Math.min(i + this.CHUNK_SIZE, text.length);
            let chunk = text.substring(i, end);
            
            // Try to break at a natural boundary (newline or period) if not at the end
            if (end < text.length) {
                const lastNewline = chunk.lastIndexOf('\n');
                const lastPeriod = chunk.lastIndexOf('. ');
                const breakPoint = Math.max(lastNewline, lastPeriod);
                
                if (breakPoint > this.CHUNK_SIZE / 2) {
                    chunk = chunk.substring(0, breakPoint + 1);
                    i += breakPoint + 1;
                } else {
                    i += this.CHUNK_SIZE - this.CHUNK_OVERLAP;
                }
            } else {
                i = end;
            }
            
            if (chunk.trim().length > 0) {
                chunks.push(chunk.trim());
            }
        }
        return chunks;
    }

    /**
     * Generates embeddings for a list of texts using Gemini.
     */
    private static async generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
        const ai = new GoogleGenAI({ apiKey });
        const embeddings: number[][] = [];
        
        // Process in small batches to avoid rate limits
        const BATCH_SIZE = 5;
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (text) => {
                try {
                    const result = await ai.models.embedContent({
                        model: 'text-embedding-004',
                        contents: [{ parts: [{ text }] }]
                    });
                    return result.embeddings?.[0]?.values || [];
                } catch (e) {
                    console.error("Failed to generate embedding for chunk:", e);
                    return [];
                }
            });
            
            const batchResults = await Promise.all(promises);
            embeddings.push(...batchResults);
            
            // Small delay between batches
            if (i + BATCH_SIZE < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        return embeddings;
    }

    /**
     * Indexes a document: chunks it, embeds it, and saves to IndexedDB.
     */
    public static async indexDocument(spaceId: string, fileId: string, filename: string, content: string, apiKey: string, onProgress?: (progress: number) => void): Promise<void> {
        // 1. Check if already indexed
        const existingChunks = await this.getChunksForFile(fileId);
        if (existingChunks.length > 0) {
            console.log(`[RAG] File ${filename} already indexed.`);
            if (onProgress) onProgress(100);
            return;
        }

        console.log(`[RAG] Indexing file ${filename}...`);
        
        // 2. Chunk text
        const textChunks = this.chunkText(content);
        if (textChunks.length === 0) {
             if (onProgress) onProgress(100);
             return;
        }

        // 3. Generate embeddings
        const embeddings = await this.generateEmbeddings(textChunks, apiKey);

        // 4. Save to DB
        const allChunks = await db.get<DocumentChunk[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
        
        for (let i = 0; i < textChunks.length; i++) {
            if (embeddings[i] && embeddings[i].length > 0) {
                allChunks.push({
                    id: `${fileId}_chunk_${i}`,
                    spaceId,
                    fileId,
                    filename,
                    content: textChunks[i],
                    embedding: embeddings[i],
                    chunkIndex: i
                });
            }
            if (onProgress) {
                onProgress(Math.round(((i + 1) / textChunks.length) * 100));
            }
        }

        await db.set(STORES.EMBEDDINGS, 'all_chunks', allChunks);
        console.log(`[RAG] Finished indexing ${filename} (${textChunks.length} chunks).`);
    }

    /**
     * Calculates cosine similarity between two vectors.
     */
    private static cosineSimilarity(vecA: number[], vecB: number[]): number {
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

    /**
     * Searches the vector database for the most relevant chunks.
     */
    public static async search(query: string, spaceId: string | undefined, apiKey: string, topK: number = 5, filenames?: string[]): Promise<{ chunk: DocumentChunk, score: number }[]> {
        console.log(`[RAG] Searching for: "${query}" in space: ${spaceId || 'all'}, filenames: ${filenames?.join(', ')}`);
        
        // 1. Embed query
        const ai = new GoogleGenAI({ apiKey });
        let queryEmbedding: number[] = [];
        try {
            const result = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: [{ parts: [{ text: query }] }]
            });
            queryEmbedding = result.embeddings?.[0]?.values || [];
        } catch (e) {
            console.error("[RAG] Failed to embed query:", e);
            return [];
        }

        if (queryEmbedding.length === 0) return [];

        // 2. Retrieve all chunks
        const allChunks = await db.get<DocumentChunk[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
        
        // Filter chunks
        let targetChunks = allChunks;
        if (spaceId) {
            targetChunks = targetChunks.filter(c => c.spaceId === spaceId);
        }
        if (filenames && filenames.length > 0) {
            targetChunks = targetChunks.filter(c => filenames.includes(c.filename));
        }

        if (targetChunks.length === 0) {
            console.log(`[RAG] No indexed chunks found matching criteria.`);
            return [];
        }

        // 3. Calculate similarities
        const scoredChunks = targetChunks.map(chunk => ({
            chunk,
            score: this.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // 4. Sort and return top K
        scoredChunks.sort((a, b) => b.score - a.score);
        return scoredChunks.slice(0, topK);
    }

    /**
     * Gets all chunks for a specific file.
     */
    public static async getChunksForFile(fileId: string): Promise<DocumentChunk[]> {
        const allChunks = await db.get<DocumentChunk[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
        return allChunks.filter(c => c.fileId === fileId);
    }

    /**
     * Deletes all chunks for a specific file.
     */
    public static async deleteDocument(fileId: string): Promise<void> {
        const allChunks = await db.get<DocumentChunk[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
        const remainingChunks = allChunks.filter(c => c.fileId !== fileId);
        await db.set(STORES.EMBEDDINGS, 'all_chunks', remainingChunks);
    }

    /**
     * Deletes all chunks for a specific space.
     */
    public static async deleteSpace(spaceId: string): Promise<void> {
        const allChunks = await db.get<DocumentChunk[]>(STORES.EMBEDDINGS, 'all_chunks') || [];
        const remainingChunks = allChunks.filter(c => c.spaceId !== spaceId);
        await db.set(STORES.EMBEDDINGS, 'all_chunks', remainingChunks);
    }
}
