import { EpisodicMemoryEntry } from '../types';
import { calculateMemoryScore } from '../utils/scoring';

/**
 * Layer 4 — Episodic Memory
 * Purpose: Stores specific important events from interactions as time-stamped records.
 */
export class EpisodicMemory {
  private entries: EpisodicMemoryEntry[] = [];
  private readonly RETENTION_DAYS = 90; // 30-90 days retention window

  public addEvent(
    summary: string,
    importance_score: number,
    tags: string[],
    session_reference: string
  ): void {
    const newEntry: EpisodicMemoryEntry = {
      event_id: crypto.randomUUID(),
      timestamp: Date.now(),
      summary,
      importance_score,
      tags,
      session_reference,
      last_accessed: Date.now(),
      access_count: 0,
    };
    this.entries.push(newEntry);
  }

  public getRelevantEvents(_query: string, limit: number = 3): EpisodicMemoryEntry[] {
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

  public getExpiredEntries(): EpisodicMemoryEntry[] {
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return this.entries.filter(entry => (now - entry.timestamp) > retentionMs);
  }

  public deleteEntry(event_id: string): void {
    this.entries = this.entries.filter(e => e.event_id !== event_id);
  }

  public getAllEntries(): EpisodicMemoryEntry[] {
    return [...this.entries];
  }
}
