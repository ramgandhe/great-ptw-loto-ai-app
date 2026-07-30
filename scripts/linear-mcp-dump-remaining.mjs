#!/usr/bin/env node
/**
 * Output remaining issue batches for MCP save_issue processing.
 * Usage: node scripts/linear-mcp-dump-remaining.mjs [batchIndex]
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

function toArgs(e) {
  const args = { id: e.id, description: e.description, priority: e.priority };
  if (e.labels) args.labels = e.labels;
  return args;
}

const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
const done = new Set([...SKIP, ...progress.updated]);
const pending = entries.filter((e) => !done.has(e.id)).map(toArgs);

const batchSize = 15;
const batchIndex = Number(process.argv[2] || 0);
const batch = pending.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

if (!batch.length) {
  console.log(JSON.stringify({ done: true, pending: pending.length }));
} else {
  console.log(JSON.stringify({ batchIndex, count: batch.length, batch }));
}
