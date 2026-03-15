
import { GoogleGenAI } from '@google/genai';

export class MastraGeminiEmbedder {
  private ai: GoogleGenAI;

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
     // Gemini supports batch embedding but let's do it simply for now
     return Promise.all(texts.map(t => this.embed(t)));
  }
}

export const mastraGeminiEmbedder = new MastraGeminiEmbedder();
