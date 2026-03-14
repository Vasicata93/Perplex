import { Message } from '../types';

/**
 * Layer 1 — Working Memory
 * 
 * Purpose: Stores the active conversation context for the current session.
 * Behavior: Containes the last 6-12 messages.
 * Cleared at session end.
 */
export class WorkingMemory {
  private messages: Message[] = [];
  private readonly MAX_MESSAGES = 12;

  public addMessage(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.MAX_MESSAGES) {
       // Keep only the last MAX_MESSAGES
       this.messages = this.messages.slice(-this.MAX_MESSAGES);
    }
  }

  public getMessages(): Message[] {
    return this.messages;
  }

  public clear(): void {
    this.messages = [];
  }
}
