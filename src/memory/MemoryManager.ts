import { WorkingMemory } from './layers/WorkingMemory';
import { ShortTermMemory } from './layers/ShortTermMemory';
import { SemanticMemory } from './layers/SemanticMemory';
import { EpisodicMemory } from './layers/EpisodicMemory';
import { ReflectionMemory } from './layers/ReflectionMemory';
import { MemoryConsolidation } from './layers/MemoryConsolidation';
import { VectorDatabase } from './layers/VectorDatabase';
import { Message, MemoryInjectionContext } from './types';

/**
 * Agent Memory System Orchestrator
 * Manages the 7 distinct layers of memory and handles injection logic.
 */
export class MemoryManager {
  public workingMemory: WorkingMemory;
  public shortTermMemory: ShortTermMemory;
  public semanticMemory: SemanticMemory;
  public episodicMemory: EpisodicMemory;
  public reflectionMemory: ReflectionMemory;
  public memoryConsolidation: MemoryConsolidation;
  public vectorDatabase: VectorDatabase;

  constructor() {
    this.workingMemory = new WorkingMemory();
    this.shortTermMemory = new ShortTermMemory();
    this.semanticMemory = new SemanticMemory();
    this.episodicMemory = new EpisodicMemory();
    this.reflectionMemory = new ReflectionMemory();
    this.memoryConsolidation = new MemoryConsolidation(
      this.semanticMemory,
      this.episodicMemory,
      this.reflectionMemory
    );
    this.vectorDatabase = new VectorDatabase();
  }

  /**
   * Called after every user message to update working memory and check triggers.
   */
  public async processNewMessage(message: Message, sessionContext: string): Promise<void> {
    // 1. Update Working Memory
    this.workingMemory.addMessage(message);

    // 2. Trigger 1 - Real-time semantic detection (Lightweight check)
    this.detectAndSaveSemanticInfo(message.content);

    // 3. Reflection trigger (Every 7-8 messages)
    if (this.reflectionMemory.incrementMessageCount()) {
      await this.runReflection();
    }

    // 4. Consolidation trigger (Every 50-100 messages)
    if (this.memoryConsolidation.incrementMessageCount()) {
      this.memoryConsolidation.runConsolidation();
    }
  }

  /**
   * Called at the end of a session to extract summaries and important facts.
   */
  public async endSession(sessionId: string): Promise<void> {
    const messages = this.workingMemory.getMessages();
    
    // In a real implementation, this would call an LLM to extract topics, decisions, etc.
    // For now, we mock the extraction.
    const summary = {
      session_date: Date.now(),
      topics_discussed: ['General discussion'],
      decisions_made: [],
      open_threads: [],
      context_for_next_session: 'Continue from previous topics.',
    };
    this.shortTermMemory.addSummary(summary);

    // Trigger 2 - End of session extraction for Semantic Memory
    // ... LLM call to extract new facts ...

    this.workingMemory.clear();
  }

  /**
   * Prepares the memory context for injection into the LLM prompt.
   * Target size: 100-300 tokens total for layers 1-4 combined.
   */
  public getInjectionContext(currentQuery: string): MemoryInjectionContext {
    // 1. Relevant Semantic Memory entries (top entries only)
    const semantic = this.semanticMemory.getRelevantEntries(currentQuery, 5);

    // 2. Relevant Episodic Memory events (top 3 most relevant)
    const episodic = this.episodicMemory.getRelevantEvents(currentQuery, 3);

    // 3. Relevant Reflection insights (only when topic-relevant)
    const reflection = this.reflectionMemory.getRelevantInsights(currentQuery, 2);

    // 4. Short-term Memory summary (only when prior session context is relevant)
    const shortTerm = this.shortTermMemory.getRelevantSummaries(currentQuery);

    // 5. Working Memory (always, full current conversation)
    const working = this.workingMemory.getMessages();

    return {
      workingMemory: working,
      shortTermMemory: shortTerm.length > 0 ? shortTerm : undefined,
      semanticMemory: semantic,
      episodicMemory: episodic,
      reflectionMemory: reflection,
    };
  }

  /**
   * Explicit user request to save information (Trigger 3)
   */
  public saveExplicitMemory(content: string, category: import('./types').SemanticCategory = 'Another'): void {
    this.semanticMemory.addOrUpdateEntry(
      category,
      content,
      8, // High importance for explicit requests
      ['explicit_save'],
      'user_statement',
      1.0 // 100% confidence
    );
  }

  // --- Private Helper Methods ---

  private detectAndSaveSemanticInfo(content: string): void {
    // Lightweight local check (regex or simple NLP) to detect explicit preferences, decisions, etc.
    // Example: "I prefer dark mode" -> Save to Semantic Memory (Preferences)
    if (content.toLowerCase().includes('i prefer')) {
      this.semanticMemory.addOrUpdateEntry(
        'Preferences',
        content,
        6,
        ['preference'],
        'user_statement',
        0.9
      );
    }
  }

  private async runReflection(): Promise<void> {
    // LLM call to analyze recent messages and generate insights
    // For now, we mock the insight generation.
    const messages = this.workingMemory.getMessages();
    if (messages.length > 0) {
      this.reflectionMemory.addInsight(
        'User is actively engaging with the memory system implementation.',
        'Engagement',
        0.8,
        ['current_session']
      );
    }
  }
}
