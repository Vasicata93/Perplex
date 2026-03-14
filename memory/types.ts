import { Role as GlobalRole, MemoryCategory } from '../types';

export type Role = GlobalRole;

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export interface ShortTermMemoryEntry {
  id: string;
  session_date: number;
  topics_discussed: string[];
  decisions_made: string[];
  open_threads: string[];
  context_for_next_session: string;
}

export type SemanticCategory = MemoryCategory;

export interface SemanticMemoryEntry {
  id: string;
  category: SemanticCategory;
  content: string;
  importance_score: number; // 1 to 10
  created_at: number;
  last_updated: number;
  last_accessed: number;
  access_count: number;
  tags: string[];
  source: 'user_statement' | 'inference' | 'reflection';
  confidence: number; // 0 to 1
}

export interface EpisodicMemoryEntry {
  event_id: string;
  timestamp: number;
  summary: string;
  importance_score: number; // 1 to 10
  tags: string[];
  session_reference: string;
  last_accessed: number;
  access_count: number;
}

export interface ReflectionMemoryEntry {
  id: string;
  insight: string;
  pattern_detected: string;
  confidence: number; // 0 to 1
  generated_at: number;
  based_on_sessions: string[];
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface MemoryInjectionContext {
  workingMemory: Message[];
  shortTermMemory?: ShortTermMemoryEntry[];
  semanticMemory: SemanticMemoryEntry[];
  episodicMemory: EpisodicMemoryEntry[];
  reflectionMemory: ReflectionMemoryEntry[];
}
