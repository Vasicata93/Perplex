import { ShortTermMemoryEntry } from '../types';

/**
 * Layer 2 — Short-term Memory
 * Purpose: Stores condensed summaries of recent sessions for continuity across conversations.
 */
export class ShortTermMemory {
  private entries: ShortTermMemoryEntry[] = [];
  private readonly RETENTION_DAYS = 14; // 7-14 days retention window

  public addSummary(entry: Omit<ShortTermMemoryEntry, 'id'>): void {
    const newEntry: ShortTermMemoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };
    this.entries.push(newEntry);
    this.cleanUpExpired();
  }

  public getRelevantSummaries(_currentContext: string): ShortTermMemoryEntry[] {
    // In a real implementation, this would use semantic search or keyword matching
    // to determine if prior context is relevant to the current message.
    // For now, we return recent entries.
    return this.entries.slice(-3);
  }

  private cleanUpExpired(): void {
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    this.entries = this.entries.filter(entry => (now - entry.session_date) <= retentionMs);
  }

  public getAllEntries(): ShortTermMemoryEntry[] {
    return [...this.entries];
  }
}
