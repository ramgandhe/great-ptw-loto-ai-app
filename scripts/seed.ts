#!/usr/bin/env tsx
/**
 * Seed wrapper — delegates to Nest API seed script.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const result = spawnSync('npm', ['run', 'db:seed', '-w', 'api'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
