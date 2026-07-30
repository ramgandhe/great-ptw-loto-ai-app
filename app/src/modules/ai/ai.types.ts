export interface AiQueryRequest {
  query: string;
  conversationId?: string;
  permitId?: string;
}

export interface AiSourceRef {
  id: string;
  title: string;
  score: number;
}

export interface AiQueryResponse {
  answer: string;
  conversationId: string;
  route: string;
  sources: AiSourceRef[];
  cached: boolean;
}

export interface AiHealthStatus {
  status: 'ok' | 'degraded';
  retriever: boolean;
  cache: boolean;
  guards: boolean;
}
