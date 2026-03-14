import { WorkingMemory } from './layers/WorkingMemory';
import { ShortTermMemory } from './layers/ShortTermMemory';
import { SemanticMemory } from './layers/SemanticMemory';
import { EpisodicMemory } from './layers/EpisodicMemory';
import { ReflectionMemory } from './layers/ReflectionMemory';
import { MemoryConsolidation } from './layers/MemoryConsolidation';
import { VectorDatabase } from './layers/VectorDatabase';
import { Message, MemoryInjectionContext } from './types';
import { db, STORES } from '../services/db';

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

  private isInitialized = false;

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

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const shortTermData = await db.get<any[]>(STORES.MEMORIES, 'layer2_shortterm');
      if (shortTermData) this.shortTermMemory['entries'] = shortTermData;

      const semanticData = await db.get<any[]>(STORES.MEMORIES, 'layer3_semantic');
      if (semanticData) this.semanticMemory['entries'] = semanticData;

      const episodicData = await db.get<any[]>(STORES.MEMORIES, 'layer4_episodic');
      if (episodicData) this.episodicMemory['entries'] = episodicData;

      const reflectionData = await db.get<any[]>(STORES.MEMORIES, 'layer5_reflection');
      if (reflectionData) this.reflectionMemory['entries'] = reflectionData;

      const vectorData = await db.get<any[]>(STORES.MEMORIES, 'layer7_vector');
      if (vectorData) this.vectorDatabase['documents'] = vectorData;

      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize MemoryManager from DB", e);
    }
  }

  public async saveState(): Promise<void> {
    try {
      await db.set(STORES.MEMORIES, 'layer2_shortterm', this.shortTermMemory.getAllEntries());
      await db.set(STORES.MEMORIES, 'layer3_semantic', this.semanticMemory.getAllEntries());
      await db.set(STORES.MEMORIES, 'layer4_episodic', this.episodicMemory.getAllEntries());
      await db.set(STORES.MEMORIES, 'layer5_reflection', this.reflectionMemory.getAllEntries());
      await db.set(STORES.MEMORIES, 'layer7_vector', this.vectorDatabase.getAllDocuments());
    } catch (e) {
      console.error("Failed to save MemoryManager state to DB", e);
    }
  }

  /**
   * Called after every user message to update working memory and check triggers.
   */
  public async processNewMessage(message: Message, _sessionContext: string): Promise<void> {
    await this.init();

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

    await this.saveState();
  }

  /**
   * Called at the end of a session to extract summaries and important facts.
   */
  public async endSession(_sessionId: string): Promise<void> {
    await this.init();
    const messages = this.workingMemory.getMessages();
    
    if (messages.length === 0) return;

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
    await this.saveState();
  }

  /**
   * Prepares the memory context for injection into the LLM prompt.
   * Target size: 100-300 tokens total for layers 1-4 combined.
   */
  public async getInjectionContext(currentQuery: string): Promise<MemoryInjectionContext> {
    await this.init();

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

    // Save state because retrieval updates access_count and last_accessed
    await this.saveState();

    return {
      workingMemory: working,
      shortTermMemory: shortTerm.length > 0 ? shortTerm : undefined,
      semanticMemory: semantic,
      episodicMemory: episodic,
      reflectionMemory: reflection,
    };
  }

  public async formatContextString(currentQuery: string): Promise<string> {
    const context = await this.getInjectionContext(currentQuery);
    
    let contextStr = `\n\n### 🧠 MEMORY SYSTEM ACTIVE`;

    if (context.semanticMemory.length > 0) {
      contextStr += `\n**RELEVANT FACTS (Semantic Memory):**\n${context.semanticMemory.map(m => `- [${m.category}] ${m.content}`).join('\n')}`;
    }

    if (context.episodicMemory.length > 0) {
      contextStr += `\n**PAST EVENTS (Episodic Memory):**\n${context.episodicMemory.map(m => `- ${m.summary}`).join('\n')}`;
    }

    if (context.reflectionMemory.length > 0) {
      contextStr += `\n**INSIGHTS (Reflection Memory):**\n${context.reflectionMemory.map(m => `- ${m.insight} (Pattern: ${m.pattern_detected})`).join('\n')}`;
    }

    if (context.shortTermMemory && context.shortTermMemory.length > 0) {
      contextStr += `\n**RECENT SESSIONS (Short-Term Memory):**\n${context.shortTermMemory.map(m => `- Topics: ${m.topics_discussed.join(', ')}`).join('\n')}`;
    }

    return contextStr;
  }

  /**
   * Explicit user request to save information (Trigger 3)
   */
  public async saveExplicitMemory(content: string, category: import('./types').SemanticCategory = 'other'): Promise<void> {
    await this.init();
    this.semanticMemory.addOrUpdateEntry(
      category,
      content,
      8, // High importance for explicit requests
      ['explicit_save'],
      'user_statement',
      1.0 // 100% confidence
    );
    await this.saveState();
  }

  // --- Private Helper Methods ---

  private detectAndSaveSemanticInfo(content: string): void {
    // Lightweight local check (regex or simple NLP) to detect explicit preferences, decisions, etc.
    if (content.toLowerCase().includes('i prefer')) {
      this.semanticMemory.addOrUpdateEntry(
        'preferences',
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

export const memoryManager = new MemoryManager();
