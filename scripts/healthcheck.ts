#!/usr/bin/env tsx
/**
 * Healthcheck — pings API system health endpoint.
 */
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function check(path: string): Promise<void> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  const body = (await response.json()) as { success?: boolean };
  if (body.success === false) {
    throw new Error(`${path} reported failure`);
  }
  console.log(`OK ${path}`);
}

async function main(): Promise<void> {
  await check('/health');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
