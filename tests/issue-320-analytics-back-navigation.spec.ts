import { getPreviousPage, isFromAnalytics, NOT_A_BACK_TARGET, pageLabel, recordVisit } from '../frontend/src/lib/nav-history';
import * as fs from 'fs';
import * as path from 'path';

describe('Issue #320: Analytics detail views Back navigation', () => {
  const frontendDir = path.resolve(__dirname, '../frontend/src');

  describe('Navigation history & label resolution', () => {
    it('resolves pageLabel for /analytics as "Analytics"', () => {
      expect(pageLabel('/analytics')).toBe('Analytics');
      expect(pageLabel('/analytics?days=90')).toBe('Analytics');
      expect(pageLabel('/analytics?days=30&site=site-123')).toBe('Analytics');
    });

    it('records visit and preserves previous URL with filter parameters', () => {
      // Simulate visiting analytics with filters, then navigating to execution
      recordVisit('/analytics?days=90&site=site-1');
      recordVisit('/execution?filter=overdue&from=analytics');

      const prev = getPreviousPage('/execution');
      expect(prev).toBe('/analytics?days=90&site=site-1');
      expect(pageLabel(prev!)).toBe('Analytics');
    });

    it('records form pages like /permits/new and preserves caller as previous page', () => {
      recordVisit('/permits?view=live&status=suspended');
      recordVisit('/permits/new');

      const prev = getPreviousPage('/permits/new');
      expect(prev).toBe('/permits?view=live&status=suspended');
      expect(pageLabel(prev!)).toBe('Permits');
    });

    it('skips redirect stubs like /simops/conflicts when determining back target', () => {
      recordVisit('/analytics?days=90');
      recordVisit('/simops/conflicts?from=analytics');
      recordVisit('/simops?view=active&from=analytics');

      const prev = getPreviousPage('/simops');
      expect(prev).toBe('/analytics?days=90');
      expect(pageLabel(prev!)).toBe('Analytics');
    });

    it('identifies redirect stubs as NOT_A_BACK_TARGET', () => {
      expect(NOT_A_BACK_TARGET.test('/simops/conflicts')).toBe(true);
      expect(NOT_A_BACK_TARGET.test('/permits/new')).toBe(true);
      expect(NOT_A_BACK_TARGET.test('/permits/123/edit')).toBe(true);
      expect(NOT_A_BACK_TARGET.test('/analytics')).toBe(false);
      expect(NOT_A_BACK_TARGET.test('/simops')).toBe(false);
    });

    it('accurately identifies from=analytics drill-downs and prevents self-loops', () => {
      // Drill-down link with from=analytics
      recordVisit('/analytics?days=30');
      recordVisit('/simops?view=active&from=analytics');
      expect(isFromAnalytics('/simops')).toBe(true);

      // Self-loop protection: on /analytics, never return true
      recordVisit('/analytics?from=analytics');
      expect(isFromAnalytics('/analytics')).toBe(false);

      // Sidebar navigation from analytics to reports (no from=analytics)
      recordVisit('/analytics');
      recordVisit('/reports');
      expect(isFromAnalytics('/reports')).toBe(false);
    });

    it('preserves multi-parameter filters (days, site, location) on return path', () => {
      recordVisit('/analytics?days=30&site=site-42&workLocationId=loc-99');
      recordVisit('/incidents?from=analytics');

      const prev = getPreviousPage('/incidents');
      expect(prev).toBe('/analytics?days=30&site=site-42&workLocationId=loc-99');
      expect(pageLabel(prev!)).toBe('Analytics');
    });

    it('does not identify non-analytics origin as analytics', () => {
      // Normal sidebar navigation from dashboard to execution
      recordVisit('/dashboard');
      recordVisit('/execution');

      const prev = getPreviousPage('/execution');
      expect(prev).toBe('/dashboard');
      expect(prev?.split('?')[0]).not.toBe('/analytics');
    });

    it('supports two-level drill-down from analytics to list to detail and back', () => {
      // Step 1: Analytics -> Permits list (suspended view)
      recordVisit('/analytics?days=90&site=main-plant');
      recordVisit('/permits?view=live&status=suspended&from=analytics');

      expect(getPreviousPage('/permits')).toBe('/analytics?days=90&site=main-plant');
      expect(pageLabel(getPreviousPage('/permits')!)).toBe('Analytics');

      // Step 2: Permits list -> Specific permit workspace
      recordVisit('/permits/permit-abc-123');
      expect(getPreviousPage('/permits/permit-abc-123')).toBe('/permits?view=live&status=suspended&from=analytics');
      expect(pageLabel(getPreviousPage('/permits/permit-abc-123')!)).toBe('Permits');

      // Step 3: Navigating back to permits list preserves analytics as the prior step
      recordVisit('/permits?view=live&status=suspended&from=analytics');
      expect(getPreviousPage('/permits')).toBe('/analytics?days=90&site=main-plant');
      expect(pageLabel(getPreviousPage('/permits')!)).toBe('Analytics');
    });
  });

  describe('Analytics page drill-down links and state sync', () => {
    it('includes from=analytics in all attention tile and stat tile links', () => {
      const analyticsPageContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/analytics/page.tsx'),
        'utf8',
      );

      // Verify drill-down tiles pass from=analytics
      expect(analyticsPageContent).toContain('href="/execution?filter=overdue&from=analytics"');
      expect(analyticsPageContent).toContain('href="/approvals?from=analytics"');
      expect(analyticsPageContent).toContain('href="/simops?view=active&from=analytics"');
      expect(analyticsPageContent).toContain('href="/incidents?from=analytics"');
      expect(analyticsPageContent).toContain('href="/permits?view=live&status=suspended&from=analytics"');
    });

    it('synchronizes analytics filter state with URL search parameters in Suspense', () => {
      const analyticsPageContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/analytics/page.tsx'),
        'utf8',
      );

      expect(analyticsPageContent).toContain('useSearchParams');
      expect(analyticsPageContent).toContain('setParams');
      expect(analyticsPageContent).toContain('<Suspense');
    });
  });

  describe('Header and custom view integration', () => {
    it('defines AnalyticsBackLink and useFromAnalytics in page-header.tsx', () => {
      const pageHeaderContent = fs.readFileSync(
        path.join(frontendDir, 'components/layout/page-header.tsx'),
        'utf8',
      );

      expect(pageHeaderContent).toContain('export function useFromAnalytics()');
      expect(pageHeaderContent).toContain('export function AnalyticsBackLink(');
      expect(pageHeaderContent).toContain('fromAnalytics');
      expect(pageHeaderContent).toContain('effectiveBack');
    });

    it('renders AnalyticsBackLink in execution page', () => {
      const executionContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/execution/page.tsx'),
        'utf8',
      );

      expect(executionContent).toContain('import { AnalyticsBackLink } from "@/components/layout/page-header"');
      expect(executionContent).toContain('<AnalyticsBackLink />');
    });

    it('renders AnalyticsBackLink in approvals page', () => {
      const approvalsContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/approvals/page.tsx'),
        'utf8',
      );

      expect(approvalsContent).toContain('import { AnalyticsBackLink } from "@/components/layout/page-header"');
      expect(approvalsContent).toContain('<AnalyticsBackLink />');
    });

    it('renders AnalyticsBackLink in permits page', () => {
      const permitsContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/permits/page.tsx'),
        'utf8',
      );

      expect(permitsContent).toContain('import { AnalyticsBackLink } from "@/components/layout/page-header"');
      expect(permitsContent).toContain('<AnalyticsBackLink />');
    });

    it('forwards query parameters and handles array params in simops/conflicts redirect', () => {
      const simopsRedirectContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/simops/conflicts/page.tsx'),
        'utf8',
      );

      expect(simopsRedirectContent).toContain('searchParams');
      expect(simopsRedirectContent).toContain('params.set("view", "active")');
      expect(simopsRedirectContent).toContain('Array.isArray(v)');
      expect(simopsRedirectContent).toContain('redirect(`/simops?${params.toString()}`)');
    });

    it('preserves from=analytics in simops and incidents summary stat tiles', () => {
      const simopsContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/simops/page.tsx'),
        'utf8',
      );
      const incidentsContent = fs.readFileSync(
        path.join(frontendDir, 'app/(app)/incidents/page.tsx'),
        'utf8',
      );

      expect(simopsContent).toContain('params.get("from") === "analytics"');
      expect(incidentsContent).toContain('params.get("from") === "analytics"');
    });

    it('ensures BackLink provides touch-accessible classes for mobile breakpoints', () => {
      const pageHeaderContent = fs.readFileSync(
        path.join(frontendDir, 'components/layout/page-header.tsx'),
        'utf8',
      );

      expect(pageHeaderContent).toContain('inline-flex items-center gap-1.5 rounded-full');
      expect(pageHeaderContent).toContain('print:hidden');
      expect(pageHeaderContent).toContain('focus-visible:ring');
    });
  });
});
