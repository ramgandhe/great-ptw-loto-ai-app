import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');
const matrixPath = join(repoRoot, 'docs/ms-09-traceability-matrix.md');

/** All 53 MS-09 canonical requirement IDs (PUS-249). */
const MS09_REQUIREMENTS = [
  'FR-ROL-001',
  'FR-ROL-002',
  'FR-ROL-003',
  'FR-ROL-004',
  ...Array.from({ length: 18 }, (_, i) => `FR-PTW-${String(i + 13).padStart(3, '0')}`),
  ...Array.from({ length: 11 }, (_, i) => `FR-SIM-${String(i + 11).padStart(3, '0')}`),
  'FR-MDP-009',
  'FR-INC-011',
  ...Array.from({ length: 7 }, (_, i) => `FR-NOT-${String(i + 2).padStart(3, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `FR-DAS-${String(i + 2).padStart(3, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `FR-BIL-${String(i + 2).padStart(3, '0')}`),
] as const;

function parseRequirementRanges(text: string): Set<string> {
  const covered = new Set<string>();
  const rangePattern = /FR-([A-Z]+)-(\d{3})[–-](\d{3})/g;
  let match: RegExpExecArray | null;
  while ((match = rangePattern.exec(text)) !== null) {
    const prefix = match[1];
    const start = Number(match[2]);
    const end = Number(match[3]);
    for (let n = start; n <= end; n += 1) {
      covered.add(`FR-${prefix}-${String(n).padStart(3, '0')}`);
    }
  }

  const singlePattern = /FR-[A-Z]+-\d{3}/g;
  while ((match = singlePattern.exec(text)) !== null) {
    covered.add(match[0]);
  }

  return covered;
}

function extractTableRows(matrix: string): string[] {
  return matrix
    .split('\n')
    .filter((line) => line.startsWith('| FR-'))
    .map((line) => line.trim());
}

function resolveTestFiles(matrix: string): string[] {
  const files = new Set<string>();
  const testsDir = join(repoRoot, 'tests');
  const allTests = readdirSync(testsDir).filter((name) => name.endsWith('.spec.ts'));
  const pattern = /`([a-z0-9._/*-]+\.spec\.ts)`/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(matrix)) !== null) {
    const reference = match[1];
    if (reference.includes('*')) {
      const prefix = reference.split('*')[0];
      const suffix = reference.split('*').slice(1).join('*');
      for (const file of allTests) {
        if (file.startsWith(prefix) && file.endsWith(suffix.replace('*', ''))) {
          files.add(file);
        }
      }
      continue;
    }
    files.add(reference);
  }
  return [...files];
}

describe('MS-09 traceability matrix (PUS-249)', () => {
  const matrix = readFileSync(matrixPath, 'utf8');
  const covered = parseRequirementRanges(matrix);
  const rows = extractTableRows(matrix);

  it('defines exactly 53 canonical requirement IDs', () => {
    expect(MS09_REQUIREMENTS).toHaveLength(53);
  });

  it('maps every requirement ID in the traceability matrix', () => {
    const missing = MS09_REQUIREMENTS.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it('includes primary code and test references for each matrix row', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells[2].length).toBeGreaterThan(0);
      expect(cells[3].length).toBeGreaterThan(0);
    }
  });

  it('references existing automated test files', () => {
    const testFiles = resolveTestFiles(matrix);
    expect(testFiles.length).toBeGreaterThan(0);
    const missing = testFiles.filter((file) => !existsSync(join(repoRoot, 'tests', file)));
    expect(missing).toEqual([]);
  });

  it('resolves NOT/NTF and DAS/DSH naming aliases explicitly', () => {
    expect(matrix).toMatch(/FR-NOT-\*/);
    expect(matrix).toMatch(/FR-DAS-\*/);
    for (const row of rows) {
      expect(row).not.toMatch(/\| FR-NTF-/);
      expect(row).not.toMatch(/\| FR-DSH-/);
    }
  });
});
