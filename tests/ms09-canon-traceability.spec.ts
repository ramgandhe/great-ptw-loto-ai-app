import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type MatrixRequirement = {
  prdId: string;
  planSection: string;
  sprint: string;
  linearId: string;
  linearUrl: string;
  codePaths: string[];
  testPaths: string[];
  releaseEvidence: string[];
  aliases?: string[];
  status: string;
};

type AliasRow = {
  planAlias: string;
  canonIds: string[];
  note: string;
};

type CanonMatrix = {
  expectedCount: number;
  matrixOwnerIssue: string;
  aliases: AliasRow[];
  requirements: MatrixRequirement[];
};

const repoRoot = join(__dirname, '..');
const matrixPath = join(repoRoot, 'docs/specs/traceability/ms09-canon-matrix.json');
const planPath = join(repoRoot, 'docs/specs/IMPLEMENTATION PLAN.md');
const humanMatrixPath = join(repoRoot, 'docs/specs/traceability/MS-09-CANON-TRACEABILITY.md');
const signoffPath = join(repoRoot, 'docs/specs/traceability/MS-09-RELEASE-SIGNOFF.md');
const prdPath = join(repoRoot, 'docs/specs/merged_prd.md');

function expandExpectedIds(): string[] {
  const ids: string[] = [];
  const pushRange = (prefix: string, start: number, end: number) => {
    for (let i = start; i <= end; i += 1) {
      ids.push(`${prefix}-${String(i).padStart(3, '0')}`);
    }
  };
  pushRange('FR-ROL', 1, 4);
  pushRange('FR-PTW', 13, 30);
  pushRange('FR-SIM', 11, 21);
  ids.push('FR-MDP-009');
  ids.push('FR-INC-011');
  pushRange('FR-NOT', 2, 8);
  pushRange('FR-DAS', 2, 8);
  pushRange('FR-BIL', 2, 5);
  return ids;
}

describe('MS-09 canon-to-plan traceability (PUS-249 / SP-09.08)', () => {
  const expected = expandExpectedIds();
  let matrix: CanonMatrix;
  let planText: string;
  let prdText: string;

  beforeAll(() => {
    expect(existsSync(matrixPath)).toBe(true);
    expect(existsSync(planPath)).toBe(true);
    expect(existsSync(humanMatrixPath)).toBe(true);
    expect(existsSync(signoffPath)).toBe(true);
    expect(existsSync(prdPath)).toBe(true);
    matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as CanonMatrix;
    planText = readFileSync(planPath, 'utf8');
    prdText = readFileSync(prdPath, 'utf8');
  });

  it('covers exactly the 53 canon requirement IDs', () => {
    expect(expected).toHaveLength(53);
    expect(matrix.expectedCount).toBe(53);
    expect(matrix.requirements).toHaveLength(53);
    expect(matrix.requirements.map((r) => r.prdId).sort()).toEqual([...expected].sort());
  });

  it('fails when any PRD ID lacks implementation-plan and Linear mapping', () => {
    const missingPlan: string[] = [];
    const missingLinear: string[] = [];

    for (const id of expected) {
      const row = matrix.requirements.find((r) => r.prdId === id);
      expect(row).toBeDefined();
      if (!row) continue;

      if (!planText.includes(id)) {
        missingPlan.push(id);
      }
      if (!row.linearId || !/^PUS-\d+$/.test(row.linearId)) {
        missingLinear.push(id);
      }
      expect(row.planSection).toMatch(/MS-09/);
      expect(row.sprint).toMatch(/^SP-09\.\d{2}$/);
      expect(row.codePaths.length).toBeGreaterThan(0);
      expect(row.testPaths.length).toBeGreaterThan(0);
      expect(row.releaseEvidence.length).toBeGreaterThan(0);
    }

    expect(missingPlan).toEqual([]);
    expect(missingLinear).toEqual([]);
  });

  it('keeps every matrix ID present in the PRD', () => {
    for (const row of matrix.requirements) {
      expect(prdText).toContain(`**${row.prdId}**`);
    }
  });

  it('resolves NOT/NTF and DAS/DSH aliases explicitly (never prove canon from alias alone)', () => {
    expect(matrix.aliases.length).toBeGreaterThan(0);
    const aliasIds = matrix.aliases.map((a) => a.planAlias);
    expect(aliasIds.some((id) => id.startsWith('FR-NTF-'))).toBe(true);
    expect(aliasIds.some((id) => id.startsWith('FR-DSH-'))).toBe(true);

    for (const alias of matrix.aliases) {
      expect(alias.canonIds.length).toBeGreaterThan(0);
      expect(alias.note.toLowerCase()).toMatch(/canon|not prove|alias|source of truth|sufficient/);
      for (const canonId of alias.canonIds) {
        if (expected.includes(canonId)) {
          const row = matrix.requirements.find((r) => r.prdId === canonId);
          expect(row?.aliases ?? []).toContain(alias.planAlias);
        }
      }
    }

    // Plan must state aliases are not proof.
    expect(planText).toMatch(/FR-NTF/);
    expect(planText).toMatch(/FR-DSH/);
    expect(planText).toMatch(/do not prove|not proof|alias/i);
  });

  it('documents the matrix owner as PUS-249 / SP-09.08', () => {
    expect(matrix.matrixOwnerIssue).toBe('PUS-249');
    expect(planText).toContain('SP-09.08');
    expect(planText).toContain('PUS-249');
    expect(humanMatrixPath.length).toBeGreaterThan(0);
    expect(readFileSync(humanMatrixPath, 'utf8')).toContain('53');
  });
});
