/**
 * Offline evaluation runner against the golden dataset.
 * Run after API is available, or unit-test pipeline pieces via Jest.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface GoldenCase {
  id: string;
  query: string;
  expectRoute: string;
  expectSourceId: string;
}

interface GoldenDataset {
  cases: GoldenCase[];
}

async function main(): Promise<void> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
  const datasetPath = path.join(__dirname, 'golden_dataset.json');
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as GoldenDataset;
  const results: Array<Record<string, unknown>> = [];

  for (const testCase of dataset.cases) {
    const response = await fetch(`${apiBase}/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EVAL_TOKEN ?? 'dev'}`,
      },
      body: JSON.stringify({ query: testCase.query }),
    });
    const body = (await response.json()) as {
      success?: boolean;
      data?: { route?: string; sources?: Array<{ id: string }> };
      error?: { message?: string };
    };
    const route = body.data?.route;
    const sourceIds = body.data?.sources?.map((s) => s.id) ?? [];
    results.push({
      id: testCase.id,
      ok:
        response.ok &&
        route === testCase.expectRoute &&
        sourceIds.includes(testCase.expectSourceId),
      route,
      sourceIds,
      error: body.error?.message,
    });
  }

  const outDir = path.join(__dirname, 'eval_results');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `offline-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Wrote ${outFile}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
