import { MemorySnapshot, WorkingMemory, EpisodicMemory, PersistentMemory } from './types';
import { memoryManager } from '../../memory';
import { Role } from '../../types';

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
        let mappedRole: Role;
        if (role === 'user') mappedRole = Role.USER;
        else if (role === 'model') mappedRole = Role.MODEL;
        else mappedRole = Role.SYSTEM;
        
        await memoryManager.processNewMessage({ id: crypto.randomUUID(), role: mappedRole, content, timestamp: Date.now() }, 'current_session');
    }

    public async getContextString(query: string): Promise<string> {
        return await memoryManager.formatContextString(query);
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
        // Trigger consolidation logic from MemoryManager
        memoryManager.memoryConsolidation.runConsolidation();
    }
}
