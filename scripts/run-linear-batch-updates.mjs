#!/usr/bin/env node
/**
 * Reads linear-all-payloads.json and prints batch index ranges for MCP processing.
 * Usage: node scripts/run-linear-batch-updates.mjs [batchNumber]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const payloads = JSON.parse(
  fs.readFileSync(path.join(root, 'data/processed/linear-all-payloads.json'), 'utf8'),
);

const batchSize = 15;
const batchNum = Number(process.argv[2] || 1);
const start = (batchNum - 1) * batchSize;
const batch = payloads.slice(start, start + batchSize);

if (!batch.length) {
  console.error(`No payloads for batch ${batchNum}`);
  process.exit(1);
}

console.log(JSON.stringify({ batchNum, start, count: batch.length, ids: batch.map((p) => p.id) }));
