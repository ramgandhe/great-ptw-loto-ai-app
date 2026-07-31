import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Production deployment infra (PUS-224)', () => {
  it('ships production compose overlay and env template', () => {
    const prodCompose = readFileSync(
      join(repoRoot, 'docker-compose.prod.yml'),
      'utf8',
    );
    const envProd = readFileSync(
      join(repoRoot, '.env.production.example'),
      'utf8',
    );

    expect(prodCompose).toMatch(/NODE_ENV: production/);
    expect(prodCompose).toMatch(/POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?/);
    expect(prodCompose).toMatch(/REDIS_PASSWORD: \$\{REDIS_PASSWORD:\?/);
    expect(prodCompose).toMatch(/condition: service_healthy/);
    expect(prodCompose).toMatch(/127\.0\.0\.1:4000:4000/);
    expect(envProd).toMatch(/NODE_ENV=production/);
    expect(envProd).toMatch(/CHANGE_ME_POSTGRES_PASSWORD/);
    expect(envProd).toMatch(/SECURITY_TRUST_PROXY=true/);
  });

  it('documents go-live deploy path and validates CI compose step', () => {
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    const ci = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

    expect(deployment).toMatch(/Production deployment \(SP-08\.03\)/);
    expect(deployment).toMatch(/Go-live sequence/);
    expect(deployment).toMatch(/docker-compose\.prod\.yml/);
    expect(ci).toMatch(/Validate compose configs/);
    expect(ci).toMatch(/docker-compose\.prod\.yml/);
    expect(ci).toMatch(/\.env\.production\.example/);
  });
});
