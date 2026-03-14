import { Message } from '../types';

/**
 * Layer 1 — Working Memory
 * Purpose: Stores the active conversation context for the current session.
 */
export class WorkingMemory {
  private messages: Message[] = [];
  private readonly MAX_MESSAGES = 12; // 6-12 messages as per spec

  public addMessage(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages.shift(); // Keep only the last N messages
    }
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  public clear(): void {
    this.messages = [];
  }

  public getMessageCount(): number {
    return this.messages.length;
  }
}
