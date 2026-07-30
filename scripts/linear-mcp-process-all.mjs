#!/usr/bin/env node
/**
 * Process all remaining Linear issues via save_issue MCP calls.
 * Reads payloads from data/processed/linear-remaining-all.json
 * Tracks progress in data/processed/linear-update-progress.json
 * 
 * This script outputs batch instructions for the agent to execute via CallMcpTool.
 * Run: node scripts/linear-mcp-process-all.mjs process-next
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entriesPath = path.join(root, 'data/processed/linear-remaining-all.json');
const progressPath = path.join(root, 'data/processed/linear-update-progress.json');
const resultsPath = path.join(root, 'data/processed/linear-update-results.json');

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

function saveProgress(progress) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

function toArgs(e) {
  const args = { id: e.id, description: e.description, priority: e.priority };
  if (e.labels) args.labels = e.labels;
  return args;
}

function getPending() {
  const progress = loadProgress();
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  const done = new Set([...SKIP, ...progress.updated]);
  return { progress, pending: entries.filter((e) => !done.has(e.id)) };
}

function writeFinalResults(progress) {
  const updated = [...new Set([
    'PUS-152', 'PUS-116', 'PUS-153', 'PUS-164', 'PUS-165',
    'PUS-118', 'PUS-161', 'PUS-162', 'PUS-163',
    ...progress.updated,
  ])].sort();
  const results = {
    total: 141,
    updated,
    failed: progress.failed,
    updatedCount: updated.length,
    failedCount: progress.failed.length,
  };
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  return results;
}

const cmd = process.argv[2];

if (cmd === 'process-next') {
  const batchSize = Number(process.argv[3] || 15);
  const { progress, pending } = getPending();
  if (pending.length === 0) {
    const results = writeFinalResults(progress);
    console.log(JSON.stringify({ done: true, results }));
    process.exit(0);
  }
  const batch = pending.slice(0, batchSize).map(toArgs);
  const outPath = path.join(root, 'data/processed/linear-mcp-chunks/current-batch.json');
  fs.writeFileSync(outPath, JSON.stringify(batch));
  console.log(JSON.stringify({ done: false, batch, remaining: pending.length - batch.length }));
} else if (cmd === 'record-batch') {
  const ids = process.argv.slice(3);
  const progress = loadProgress();
  for (const id of ids) {
    if (!progress.updated.includes(id)) progress.updated.push(id);
  }
  saveProgress(progress);
  console.log(JSON.stringify({ recorded: ids.length, totalUpdated: progress.updated.length }));
} else if (cmd === 'record-fail') {
  const id = process.argv[3];
  const error = process.argv.slice(4).join(' ');
  const progress = loadProgress();
  progress.failed.push({ id, error });
  saveProgress(progress);
  console.log(JSON.stringify({ recorded: id }));
} else if (cmd === 'finalize') {
  const progress = loadProgress();
  const results = writeFinalResults(progress);
  console.log(JSON.stringify(results, null, 2));
} else if (cmd === 'status') {
  const { progress, pending } = getPending();
  console.log(JSON.stringify({
    pending: pending.length,
    updated: progress.updated.length,
    failed: progress.failed.length,
  }));
} else {
  console.error('Usage: process-next|record-batch|record-fail|finalize|status');
  process.exit(1);
}
