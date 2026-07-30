#!/usr/bin/env node
/**
 * Emit save_issue MCP argument batches from remaining issues.
 * Used by agent to drive parallel MCP save_issue calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const progressPath = path.join(root, 'data/processed/linear-update-progress.json');
const entriesPath = path.join(root, 'data/processed/linear-remaining-all.json');

const SKIP = new Set([
  'PUS-152', 'PUS-116', 'PUS-153', 'PUS-164', 'PUS-165',
  'PUS-118', 'PUS-161', 'PUS-162', 'PUS-163',
]);

function loadProgress() {
  if (fs.existsSync(progressPath)) {
    return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  }
  return { updated: [], failed: [] };
}

function toArgs(e) {
  const args = { id: e.id, description: e.description, priority: e.priority };
  if (e.labels) args.labels = e.labels;
  return args;
}

const progress = loadProgress();
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
const done = new Set([...SKIP, ...progress.updated]);
const pending = entries.filter((e) => !done.has(e.id));

const batchSize = Number(process.argv[2] || 15);
const batch = pending.slice(0, batchSize).map(toArgs);

const outDir = path.join(root, 'data/processed/linear-mcp-chunks');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'current-batch.json'), JSON.stringify(batch));

batch.forEach((a) => {
  fs.writeFileSync(path.join(outDir, 'current', `${a.id}.json`), JSON.stringify(a));
});

console.log(JSON.stringify({
  count: batch.length,
  ids: batch.map((b) => b.id),
  remaining: pending.length - batch.length,
}));
