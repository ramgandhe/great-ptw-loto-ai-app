import { permitReportFileNameFromDisposition } from '../frontend/src/lib/permit/report-file';
import {
  canDownloadPermitReport,
  permitReportCacheKey,
  permitReportDialogState,
  permitReportOpenPlan,
} from '../frontend/src/lib/permit/report-view';
import { StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PermitController } from '../app/src/modules/permit/permit.controller';
import { permitReportFileName } from '../app/src/modules/permit/permit-report-pdf';
import { PermitReportService } from '../app/src/modules/permit/permit-report.service';
import { PermitService } from '../app/src/modules/permit/permit.service';

describe('permit report download', () => {
  it('keeps only a safe pdf name from the response header', () => {
    expect(permitReportFileNameFromDisposition('inline; filename="PTW-2026-0012-interim-20261117-161000.pdf"')).toBe(
      'PTW-2026-0012-interim-20261117-161000.pdf',
    );
    expect(permitReportFileNameFromDisposition('inline; filename="../../secret.txt"')).toBe('permit-report.pdf');
    expect(permitReportFileNameFromDisposition(null)).toBe('permit-report.pdf');
  });

  it('names the file from the reference, edition and organisation time', () => {
    expect(permitReportFileName('PTW/2026 0012', 'final', new Date('2026-11-17T10:40:00.000Z'), 'Asia/Kolkata')).toBe(
      'PTW20260012-final-20261117-161000.pdf',
    );
    expect(permitReportFileName('   ', 'interim', new Date('2026-11-17T10:40:00.000Z'), 'UTC')).toBe(
      'permit-interim-20261117-104000.pdf',
    );
  });

  it('reuses the previewed PDF until the permit changes, and downloads only that preview', () => {
    const permit = { id: 'p1', status: 'approved', updatedAt: '2026-11-17T10:00:00.000Z', permitVersion: 2 };
    const key = permitReportCacheKey(permit);
    expect(permitReportOpenPlan({ currentKey: key, hasFile: true, nextKey: key, busy: false })).toBe('reuse');
    expect(permitReportOpenPlan({ currentKey: key, hasFile: true, nextKey: permitReportCacheKey({ ...permit, status: 'active' }), busy: false })).toBe('fetch');
    expect(permitReportOpenPlan({ currentKey: null, hasFile: false, nextKey: key, busy: true })).toBe('wait');

    expect(permitReportDialogState({ loading: true, error: null, previewUrl: null })).toBe('preparing');
    expect(permitReportDialogState({ loading: false, error: 'This permit report is not available.', previewUrl: null })).toBe('error');
    expect(permitReportDialogState({ loading: false, error: null, previewUrl: 'blob:report' })).toBe('ready');
    expect(canDownloadPermitReport({ loading: true, previewUrl: null })).toBe(false);
    expect(canDownloadPermitReport({ loading: false, previewUrl: 'blob:report' })).toBe(true);
    expect(canDownloadPermitReport({ loading: true, previewUrl: 'blob:report' })).toBe(false);
  });

  it('returns the generated PDF inline and does not cache it', async () => {
    const render = jest.fn().mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4'),
      fileName: 'PTW-2026-0012-interim-20261117-161000.pdf',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [PermitController],
      providers: [
        { provide: PermitService, useValue: {} },
        { provide: PermitReportService, useValue: { render } },
      ],
    }).compile();
    const controller = moduleRef.get(PermitController);
    const headers = new Map<string, string>();
    const user = { id: 'user-1', username: 'receiver', roles: ['permit-receiver'], tenantId: 'tenant-1' };
    const file = await controller.report('11111111-1111-4111-8111-111111111111', user, {
      setHeader: (name: string, value: string) => headers.set(name, value),
    } as never);

    expect(render).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', user);
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('Content-Disposition')).toBe('inline; filename="PTW-2026-0012-interim-20261117-161000.pdf"');
    expect(file).toBeInstanceOf(StreamableFile);
  });
});
