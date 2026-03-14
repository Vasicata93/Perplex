import { VectorDocument } from '../types';

/**
 * Layer 7 — Vector Database (Document Memory)
 * Purpose: Stores long-form content that is too large to inject directly into context.
 * Accessed through semantic search when needed.
 */
export class VectorDatabase {
  private documents: VectorDocument[] = [];

  public addDocument(content: string, metadata: Record<string, any> = {}): void {
    const newDoc: VectorDocument = {
      id: crypto.randomUUID(),
      content,
      metadata,
      // In a real implementation, generate an embedding here using an LLM API
      embedding: [], 
    };
    this.documents.push(newDoc);
  }

  public searchMemory(query: string, limit: number = 3): VectorDocument[] {
    // In a real implementation, this would compute the cosine similarity between the query embedding and document embeddings.
    // For now, we use a simple keyword search.
    const queryWords = query.toLowerCase().split(' ');
    
    const scoredDocs = this.documents.map(doc => {
      let score = 0;
      const contentLower = doc.content.toLowerCase();
      queryWords.forEach(word => {
        if (contentLower.includes(word)) score++;
      });
      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    return scoredDocs.slice(0, limit).map(sd => sd.doc);
  }

  public getAllDocuments(): VectorDocument[] {
    return [...this.documents];
  }
}
