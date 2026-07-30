#!/usr/bin/env node
/**
 * Process remaining Linear issues via save_issue pattern.
 * Reads run-batch-*.json files and outputs processing status.
 * MCP calls must be made externally per payload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const remainingDir = path.join(root, 'data/processed/linear-remaining');
const resultsPath = path.join(root, 'data/processed/linear-update-results.json');

function loadResults() {
  return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
}

function saveResults(r) {
  r.updatedCount = r.updated.length;
  r.remainingCount = r.remaining.length;
  r.failedCount = r.failures.length;
  fs.writeFileSync(resultsPath, JSON.stringify(r, null, 2));
}

export function markSuccess(id) {
  const r = loadResults();
  if (!r.updated.includes(id)) r.updated.push(id);
  r.remaining = r.remaining.filter((x) => x !== id);
  saveResults(r);
}

export function markFailure(id, error) {
  const r = loadResults();
  if (!r.failures.find((f) => f.id === id)) r.failures.push({ id, error: String(error) });
  saveResults(r);
}

export function loadRunBatch(n) {
  const file = path.join(remainingDir, `run-batch-${String(n).padStart(2, '0')}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadAllRemaining() {
  const all = [];
  for (let i = 1; i <= 8; i++) {
    try {
      all.push(...loadRunBatch(i));
    } catch {
      break;
    }
  }
  return all;
}

if (process.argv[2] === 'success') markSuccess(process.argv[3]);
if (process.argv[2] === 'fail') markFailure(process.argv[3], process.argv[4]);
if (process.argv[2] === 'status') {
  const r = loadResults();
  console.log(JSON.stringify({ updatedCount: r.updatedCount, remainingCount: r.remainingCount, failedCount: r.failedCount }));
}
