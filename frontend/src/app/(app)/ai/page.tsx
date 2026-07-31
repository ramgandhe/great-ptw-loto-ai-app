"use client";

import { FormEvent, useEffect, useState } from "react";
import { askAi, getAiHealth, type AiQueryResult } from "@/lib/ai/api";
import { ApiError } from "@/lib/api";

export default function AiAssistantPage() {
  const [query, setQuery] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [result, setResult] = useState<AiQueryResult | null>(null);
  const [health, setHealth] = useState<string>("checking…");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getAiHealth()
      .then((h) => setHealth(h.status))
      .catch(() => setHealth("unreachable"));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await askAi(query, conversationId);
      setResult(response);
      setConversationId(response.conversationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">AI assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about permit lifecycle, LOTO, or SIMOPS. Backend health: {health}
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="ai-query">
          Question
        </label>
        <textarea
          id="ai-query"
          className="min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are the permit lifecycle states?"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-3 rounded-md border border-border p-4" aria-live="polite">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Route: {result.route}
            {result.cached ? " · cached" : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm">{result.answer}</p>
          {result.sources.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.sources.map((source) => (
                <li key={source.id}>
                  {source.title} ({source.score.toFixed(2)})
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
