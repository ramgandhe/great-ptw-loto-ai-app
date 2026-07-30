#!/usr/bin/env node
/**
 * Output save_issue MCP arguments for a chunk of Linear issues.
 * Usage: node scripts/linear-mcp-process-chunk.mjs <chunk-number>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const chunkNum = String(Number(process.argv[2] || 1)).padStart(2, '0');
const chunkPath = path.join(root, 'data/processed/linear-mcp-chunks', `chunk-${chunkNum}.json`);

if (!fs.existsSync(chunkPath)) {
  console.error(`Chunk not found: ${chunkPath}`);
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
const args = entries.map((e) => {
  const out = { id: e.id, description: e.description, priority: e.priority };
  if (e.labels) out.labels = e.labels;
  return out;
});

console.log(JSON.stringify(args, null, 2));
