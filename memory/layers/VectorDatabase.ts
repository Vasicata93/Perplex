import { VectorDocument } from '../types';

/**
 * Layer 7 — Vector Database (Document Memory)
 * 
 * Purpose: Stores long-form content that is too large to inject directly into context.
 * Accessed exclusively through the search_memory tool via semantic query.
 */
export class VectorDatabase {
  private documents: VectorDocument[] = [];

  constructor() {}

  public getAllDocuments(): VectorDocument[] {
    return this.documents;
  }

  public addDocument(doc: VectorDocument): void {
    this.documents.push(doc);
  }

  public search(query: string, limit: number = 3): VectorDocument[] {
    // In a real implementation this would perform cosine similarity using `doc.embedding`
    // Mock semantic search for now
    const lowerQuery = query.toLowerCase();
    
    return this.documents
      .map(doc => {
        let score = 0;
        if (doc.content.toLowerCase().includes(lowerQuery)) score += 10;
        if (doc.metadata && doc.metadata.title && doc.metadata.title.toLowerCase().includes(lowerQuery)) score += 5;
        return { doc, score };
      })
      .filter(res => res.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(res => res.doc);
  }
}
