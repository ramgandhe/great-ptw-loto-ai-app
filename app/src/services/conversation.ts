import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

/** Conversation memory for AI assistant sessions. */
@Injectable()
export class ConversationService {
  private readonly conversations = new Map<string, ConversationTurn[]>();

  ensureId(conversationId?: string): string {
    return conversationId?.trim() || randomUUID();
  }

  append(conversationId: string, role: ConversationTurn['role'], content: string): void {
    const turns = this.conversations.get(conversationId) ?? [];
    turns.push({ role, content, at: new Date().toISOString() });
    this.conversations.set(conversationId, turns.slice(-20));
  }

  history(conversationId: string): ConversationTurn[] {
    return this.conversations.get(conversationId) ?? [];
  }
}
