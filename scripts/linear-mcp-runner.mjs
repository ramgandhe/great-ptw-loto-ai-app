#!/usr/bin/env node
/**
 * Process all remaining Linear issues via MCP save_issue.
 * Reads payloads from data/processed/linear-remaining-all.json
 * Writes progress to data/processed/linear-update-results.json
 *
 * This script is invoked by the agent with chunk index; it outputs
 * the next batch of save_issue arguments as JSON for MCP calls.
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

const ALREADY_DONE = new Set(['PUS-159']);

function toArgs(e) {
  const args = { id: e.id, description: e.description, priority: e.priority };
  if (e.labels) args.labels = e.labels;
  return args;
}

function loadProgress() {
  if (fs.existsSync(progressPath)) {
    return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  }
  return { updated: [], failed: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

function writeFinalResults(progress, total = 141) {
  const updated = [...new Set([
    'PUS-152', 'PUS-116', 'PUS-153', 'PUS-164', 'PUS-165',
    'PUS-118', 'PUS-161', 'PUS-162', 'PUS-163',
    ...progress.updated,
  ])];
  const results = {
    total,
    updated: updated.sort(),
    failed: progress.failed,
    updatedCount: updated.length,
    failedCount: progress.failed.length,
  };
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  return results;
}

const cmd = process.argv[2];

if (cmd === 'list-pending') {
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  const progress = loadProgress();
  const done = new Set([...SKIP, ...ALREADY_DONE, ...progress.updated]);
  const pending = entries.filter((e) => !done.has(e.id));
  console.log(JSON.stringify(pending.map((e) => e.id)));
} else if (cmd === 'get-batch') {
  const size = Number(process.argv[3] || 15);
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  const progress = loadProgress();
  const done = new Set([...SKIP, ...ALREADY_DONE, ...progress.updated]);
  const pending = entries.filter((e) => !done.has(e.id)).slice(0, size);
  console.log(JSON.stringify(pending.map(toArgs)));
} else if (cmd === 'record-success') {
  const ids = process.argv.slice(3);
  const progress = loadProgress();
  for (const id of ids) {
    if (!progress.updated.includes(id)) progress.updated.push(id);
  }
  saveProgress(progress);
  console.log(JSON.stringify({ recorded: ids.length, totalUpdated: progress.updated.length }));
} else if (cmd === 'record-failure') {
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
  const progress = loadProgress();
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  const done = new Set([...SKIP, ...ALREADY_DONE, ...progress.updated]);
  console.log(JSON.stringify({
    pending: entries.filter((e) => !done.has(e.id)).length,
    updated: progress.updated.length,
    failed: progress.failed.length,
  }));
} else {
  console.error('Usage: linear-mcp-runner.mjs <list-pending|get-batch|record-success|record-failure|finalize|status> [args...]');
  process.exit(1);
}
