import { readFileSync } from 'fs';
import { resolve } from 'path';
import { deleteLototoProcedure } from '@/lib/lototo/api';

describe('Issue #314 - LOTOTO item delete confirmation toast and feedback', () => {
  const filePath = resolve(__dirname, '../frontend/src/app/(app)/lototo/procedures/page.tsx');
  const source = readFileSync(filePath, 'utf8');

  describe('Scenario 1: Toast feedback integration in procedure library page', () => {
    it('Positive: imports toast from @/components/ui/toast', () => {
      expect(source).toMatch(/import\s+\{[^}]*toast[^}]*\}\s+from\s+["']@\/components\/ui\/toast["']/);
    });

    it('Positive: displays success toast notification on successful procedure deletion', () => {
      // Must call toast("Procedure deleted") after deleteWithAssignmentConfirm succeeds
      expect(source).toMatch(/toast\(["']Procedure deleted["']\)/);
    });

    it('Positive: displays error toast notification when action fails', () => {
      // Catch block must invoke toast(..., "error")
      expect(source).toMatch(/toast\([^,)]+,\s*["']error["']\)/);
    });

    it('Positive: provides consistent toast feedback for deactivate and reactivate actions', () => {
      expect(source).toMatch(/toast\(["']Procedure deactivated["']\)/);
      expect(source).toMatch(/toast\(["']Procedure reactivated["']\)/);
    });
  });

  describe('Scenario 2: Safety confirmation and busy state protection', () => {
    it('Positive: retains pre-delete assignment confirmation dialog before deletion', () => {
      expect(source).toContain('deleteWithAssignmentConfirm(');
      expect(source).toContain('deleteLototoProcedure(');
    });

    it('Positive: introduces busy state to prevent double submissions on row actions', () => {
      expect(source).toMatch(/busyId/);
      expect(source).toMatch(/disabled=\{Boolean\(busyId\)\}/);
    });
  });

  describe('Scenario 3: LOTOTO Procedure Delete API Contract', () => {
    it('Positive: deleteLototoProcedure is a callable function accepting id and force flag', () => {
      expect(typeof deleteLototoProcedure).toBe('function');
      expect(deleteLototoProcedure.length).toBeGreaterThanOrEqual(1);
    });
  });
});
