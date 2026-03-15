
import { GoogleGenAI } from '@google/genai';

export class MastraGeminiEmbedder {
  private ai: GoogleGenAI;
  private model: any;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY || '' });
    this.model = this.ai.getGenerativeModel({ model: "text-embedding-004" });
  }

  async embed(text: string): Promise<number[]> {
    try {
      const result = await this.model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('[Gemini Embedder Error]:', error);
      // Fallback or rethrow
      throw error;
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
     // Gemini supports batch embedding but let's do it simply for now
     return Promise.all(texts.map(t => this.embed(t)));
  }
}

export const mastraGeminiEmbedder = new MastraGeminiEmbedder();
