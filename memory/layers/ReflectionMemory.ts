import { ReflectionMemoryEntry } from '../types';

/**
 * Layer 5 — Reflection Memory
 * Purpose: Stores behavioral insights and patterns derived from analyzing conversation history.
 */
export class ReflectionMemory {
  private entries: ReflectionMemoryEntry[] = [];
  private messageCountSinceLastReflection = 0;
  private readonly REFLECTION_INTERVAL = 8; // Every 7-8 messages

  public addInsight(
    insight: string,
    pattern_detected: string,
    confidence: number,
    based_on_sessions: string[]
  ): void {
    const newEntry: ReflectionMemoryEntry = {
      id: crypto.randomUUID(),
      insight,
      pattern_detected,
      confidence,
      generated_at: Date.now(),
      based_on_sessions,
    };
    this.entries.push(newEntry);
  }

  public getRelevantInsights(_query: string, limit: number = 2): ReflectionMemoryEntry[] {
    // In a real implementation, this would use semantic search or keyword matching
    // to determine if prior context is relevant to the current message.
    // For now, we return recent entries.
    return this.entries.slice(-limit);
  }

  public incrementMessageCount(): boolean {
    this.messageCountSinceLastReflection++;
    if (this.messageCountSinceLastReflection >= this.REFLECTION_INTERVAL) {
      this.messageCountSinceLastReflection = 0;
      return true; // Trigger reflection
    }
    return false;
  }

  public getAllEntries(): ReflectionMemoryEntry[] {
    return [...this.entries];
  }
}
