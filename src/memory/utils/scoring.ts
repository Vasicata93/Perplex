/**
 * Memory Score Formula
 * memory_score = importance_score × recency_factor × frequency_factor
 */

export function calculateMemoryScore(
  importance_score: number,
  last_accessed: number,
  access_count: number,
  current_time: number = Date.now()
): number {
  // Recency factor: Decays over time. 
  // Let's use an exponential decay or a simple inverse log function.
  // For simplicity, let's say 1 day = 86400000 ms.
  const ageInDays = Math.max(0, (current_time - last_accessed) / (1000 * 60 * 60 * 24));
  
  // Recency factor: 1.0 for brand new, decaying towards 0.1 over a year.
  const recency_factor = Math.max(0.1, Math.exp(-ageInDays / 30)); // Half-life ~20 days

  // Frequency factor: Logarithmic scaling based on access count.
  // 0 accesses = 1.0, 10 accesses ~ 2.0, 100 accesses ~ 3.0
  const frequency_factor = 1 + Math.log10(Math.max(1, access_count));

  return importance_score * recency_factor * frequency_factor;
}
