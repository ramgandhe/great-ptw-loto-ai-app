#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const resultsPath = path.join(root, 'data/processed/linear-update-results.json');

export function loadResults() {
  return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
}

export function recordSuccess(id) {
  const r = loadResults();
  if (!r.updated.includes(id)) {
    r.updated.push(id);
    r.updatedCount = r.updated.length;
    r.remaining = r.remaining.filter((x) => x !== id);
    r.remainingCount = r.remaining.length;
    fs.writeFileSync(resultsPath, JSON.stringify(r, null, 2));
  }
}

export function recordFailure(id, error) {
  const r = loadResults();
  const existing = r.failures.find((f) => f.id === id);
  if (!existing) {
    r.failures.push({ id, error });
    r.failedCount = r.failures.length;
    fs.writeFileSync(resultsPath, JSON.stringify(r, null, 2));
  }
}

if (process.argv[2] === 'success') recordSuccess(process.argv[3]);
if (process.argv[2] === 'fail') recordFailure(process.argv[3], process.argv[4] || 'unknown');
