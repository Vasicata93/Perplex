
import { GoogleGenAI } from '@google/genai';

export class MastraGeminiEmbedder {
  private ai: GoogleGenAI;

  public readonly dimensions = 768; // Gemini text-embedding-004 dimensions
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY || '' });
  }

  async embed(text: string): Promise<number[]> {
    try {
      const result = await (this.ai.models as any).embedContent({
        model: "text-embedding-004",
        contents: [text]
      });
      return result.embeddings?.[0]?.values || [];
    } catch (error) {
      console.error('[Gemini Embedder Error]:', error);
      throw error;
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    // Per spec, batching to avoid rate limits.
    const embeddings: number[][] = [];
    const batchSize = 10; // As per spec
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      // Note: The @google/genai SDK might support batching directly.
      // This sequential implementation follows the spec's request.
      const batchEmbeddings = await Promise.all(batch.map(t => this.embed(t)));
      embeddings.push(...batchEmbeddings);
    }
    return embeddings;
  }
}

export const mastraGeminiEmbedder = new MastraGeminiEmbedder();
