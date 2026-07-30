import { Injectable } from '@nestjs/common';

export interface FeedbackEvent {
  conversationId: string;
  rating: 'up' | 'down';
  comment?: string;
  at: string;
}

@Injectable()
export class FeedbackCapture {
  private readonly events: FeedbackEvent[] = [];

  capture(conversationId: string, rating: 'up' | 'down', comment?: string): FeedbackEvent {
    const event: FeedbackEvent = {
      conversationId,
      rating,
      comment,
      at: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  list(): FeedbackEvent[] {
    return [...this.events];
  }
}
