import { MemorySnapshot, WorkingMemory, EpisodicMemory, PersistentMemory } from './types';
import { MemoryService } from '../../services/memoryService';

export class MemorySystem {
    private workingMemory: WorkingMemory;
    private episodicMemory: EpisodicMemory;
    private persistentMemory: PersistentMemory;

    constructor() {
        this.workingMemory = {
            activeSubtask: undefined,
            toolOutputs: {},
            intermediateResults: [],
            scratchpad: ''
        };
        this.episodicMemory = {
            pastTurns: [],
            decisions: [],
            artifacts: []
        };
        this.persistentMemory = {
            storeId: 'default'
        };
    }

    public getSnapshot(): MemorySnapshot {
        return {
            working: this.workingMemory,
            episodic: this.episodicMemory,
            persistent: this.persistentMemory
        };
    }

    public async addToBuffer(role: 'user' | 'model' | 'tool', content: string) {
        await MemoryService.addToBuffer(role, content);
    }

    public async getContextString(query: string): Promise<string> {
        return await MemoryService.getContextString(query);
    }

    public updateWorkingMemory(key: keyof WorkingMemory, value: any) {
        this.workingMemory[key] = value;
    }

    public addDecision(intent: string, action: string, outcome: string) {
        this.episodicMemory.decisions.push({
            timestamp: Date.now(),
            intent,
            action,
            outcome
        });
    }

    public async consolidate() {
        // Trigger consolidation logic from MemoryService
        // This is async and handled by the background service usually
        // But we can expose a trigger here
    }
}
