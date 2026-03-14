import { SemanticMemoryEntry, EpisodicMemoryEntry } from '../types';

/**
 * Calculates the memory score used for retrieval ranking across layers.
 * 
 * Formula: memory_score = importance_score * recency_factor * frequency_factor
 * 
 * - importance_score: 1 to 10
 * - recency_factor: higher for recently accessed entries
 * - frequency_factor: higher for entries accessed many times
 */
export function calculateMemoryScore(entry: SemanticMemoryEntry | EpisodicMemoryEntry): number {
  const importance = entry.importance_score;
  
  // Recency factor calculation
  const now = Date.now();
  const timeSinceAccessMs = now - entry.last_accessed;
  const matchDays = Math.max(0, timeSinceAccessMs / (1000 * 60 * 60 * 24));
  
  // Halfs-life of 30 days for recency
  const recency_factor = Math.exp(-matchDays / 30);
  
  // Frequency factor calculation
  // Logarithmic scaling starting from 1
  const frequency_factor = 1 + Math.log10(entry.access_count + 1);
  
  return importance * recency_factor * frequency_factor;
}
