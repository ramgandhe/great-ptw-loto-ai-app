#!/usr/bin/env tsx
/**
 * Migrate wrapper — delegates to Nest API migrate script.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const result = spawnSync('npm', ['run', 'db:migrate', '-w', 'api'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
