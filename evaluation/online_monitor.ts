/**
 * Online monitor stub — records latency samples for AI health.
 */
export function recordLatency(route: string, durationMs: number): void {
  console.log(
    JSON.stringify({
      type: 'online_monitor',
      route,
      durationMs,
      at: new Date().toISOString(),
    }),
  );
}
