import { SemanticMemoryEntry, SemanticCategory } from '../types';
import { calculateMemoryScore } from '../utils/scoring';

/**
 * Layer 3 — Semantic Memory
 * Purpose: Stores stable, long-term facts about the user organized by category.
 */
export class SemanticMemory {
  private entries: SemanticMemoryEntry[] = [];

  public addOrUpdateEntry(
    category: SemanticCategory,
    content: string,
    importance_score: number,
    tags: string[],
    source: 'user_statement' | 'inference' | 'reflection',
    confidence: number
  ): void {
    if (importance_score < 6) return; // Only store meaningful information

    // Deduplication logic: search for similar entries in the same category
    const similarEntry = this.findSimilarEntry(category, content);

    if (similarEntry) {
      // Update existing entry
      similarEntry.content = content; // Or merge contents
      similarEntry.importance_score = Math.max(similarEntry.importance_score, importance_score);
      similarEntry.last_updated = Date.now();
      similarEntry.tags = Array.from(new Set([...similarEntry.tags, ...tags]));
      similarEntry.confidence = Math.max(similarEntry.confidence, confidence);
    } else {
      // Create new entry
      const newEntry: SemanticMemoryEntry = {
        id: crypto.randomUUID(),
        category,
        content,
        importance_score,
        created_at: Date.now(),
        last_updated: Date.now(),
        last_accessed: Date.now(),
        access_count: 0,
        tags,
        source,
        confidence,
      };
      this.entries.push(newEntry);
    }
  }

  private findSimilarEntry(category: SemanticCategory, content: string): SemanticMemoryEntry | undefined {
    // In a real implementation, this would use semantic similarity (embeddings).
    // For now, we use simple keyword overlap or exact match.
    return this.entries.find(e => e.category === category && e.content.toLowerCase() === content.toLowerCase());
  }

  public getRelevantEntries(_query: string, limit: number = 5): SemanticMemoryEntry[] {
    const now = Date.now();

    // Calculate score for all entries
    const scoredEntries = this.entries.map(entry => ({
      entry,
      score: calculateMemoryScore(entry.importance_score, entry.last_accessed, entry.access_count, now)
    }));

    // Sort by score descending
    scoredEntries.sort((a, b) => b.score - a.score);

    // Update access stats for the retrieved entries
    const topEntries = scoredEntries.slice(0, limit).map(se => {
      se.entry.last_accessed = now;
      se.entry.access_count += 1;
      return se.entry;
    });

    return topEntries;
  }

  public getAllEntries(): SemanticMemoryEntry[] {
    return [...this.entries];
  }

  public deleteEntry(id: string): void {
    this.entries = this.entries.filter(e => e.id !== id);
  }

  public clear(): void {
    this.entries = [];
  }
}
