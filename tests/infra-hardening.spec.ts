import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Infrastructure hardening (PUS-219)', () => {
  it('documents Redis/BullMQ/rate-limit/security env knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    expect(envExample).toMatch(/REDIS_PASSWORD/);
    expect(envExample).toMatch(/BULLMQ_WORKER_CONCURRENCY/);
    expect(envExample).toMatch(/RATE_LIMIT_TTL_MS/);
    expect(envExample).toMatch(/RATE_LIMIT_LIMIT/);
    expect(envExample).toMatch(/SECURITY_HELMET_ENABLED/);
  });

  it('compose and deployment docs cover hardening + rollback', () => {
    const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(compose).toMatch(/REDIS_PASSWORD/);
    expect(compose).toMatch(/BULLMQ_WORKER_CONCURRENCY/);
    expect(compose).toMatch(/condition: service_healthy/);
    expect(deployment).toMatch(/Infrastructure hardening \(SP-08\.02\)/);
    expect(deployment).toMatch(/Rollback path/);
  });
});
