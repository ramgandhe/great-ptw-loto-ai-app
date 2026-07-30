#!/usr/bin/env node
/**
 * Bulk-update Linear issues from data/processed/linear-all-payloads.json
 * Requires LINEAR_API_KEY environment variable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const payloads = JSON.parse(
  fs.readFileSync(path.join(root, 'data/processed/linear-all-payloads.json'), 'utf8'),
);

const API_KEY = process.env.LINEAR_API_KEY;
if (!API_KEY) {
  console.error('LINEAR_API_KEY is required');
  process.exit(1);
}

async function gql(query, variables = {}) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

async function resolveIssueId(identifier) {
  const data = await gql(
    `query($id: String!) { issue(id: $id) { id identifier } }`,
    { id: identifier },
  );
  return data.issue?.id;
}

async function resolveLabelIds(names) {
  if (!names?.length) return [];
  const data = await gql(`query { issueLabels { nodes { id name } } }`);
  const byName = new Map(data.issueLabels.nodes.map((l) => [l.name, l.id]));
  const ids = [];
  const missing = [];
  for (const name of names) {
    const id = byName.get(name);
    if (id) ids.push(id);
    else missing.push(name);
  }
  if (missing.length) throw new Error(`Unknown labels: ${missing.join(', ')}`);
  return ids;
}

async function updateIssue(payload) {
  const issueId = await resolveIssueId(payload.id);
  if (!issueId) throw new Error(`Issue not found: ${payload.id}`);

  const input = {
    description: payload.description,
    priority: payload.priority,
  };
  if (payload.labels) {
    input.labelIds = await resolveLabelIds(payload.labels);
  }

  await gql(
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { identifier } }
    }`,
    { id: issueId, input },
  );
  return payload.id;
}

const concurrency = 12;
const results = { updated: [], failed: [] };

async function runPool(items, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      try {
        const id = await worker(item);
        results.updated.push(id);
        process.stdout.write(`OK ${id}\n`);
      } catch (err) {
        results.failed.push({ id: item.id, error: String(err.message || err) });
        process.stderr.write(`FAIL ${item.id}: ${err.message || err}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

await runPool(payloads, updateIssue);

const summary = {
  total: payloads.length,
  updated: results.updated.length,
  failed: results.failed.length,
  failures: results.failed,
};
fs.writeFileSync(
  path.join(root, 'data/processed/linear-update-results.json'),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
