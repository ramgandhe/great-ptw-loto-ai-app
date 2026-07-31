import { fetchApi } from "@/lib/api";

export interface AiQueryResult {
  answer: string;
  conversationId: string;
  route: string;
  sources: Array<{ id: string; title: string; score: number }>;
  cached: boolean;
}

export interface AiHealth {
  status: "ok" | "degraded";
  retriever: boolean;
  cache: boolean;
  guards: boolean;
}

export function getAiHealth(): Promise<AiHealth> {
  return fetchApi<AiHealth>("/ai/health");
}

export function askAi(
  query: string,
  conversationId?: string,
  permitId?: string,
): Promise<AiQueryResult> {
  return fetchApi<AiQueryResult>("/ai/query", {
    method: "POST",
    body: JSON.stringify({ query, conversationId, permitId }),
  });
}
