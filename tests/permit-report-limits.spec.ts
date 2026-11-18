import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { GlobalExceptionFilter } from '../app/src/common/filters/global-exception.filter';
import { PermitController } from '../app/src/modules/permit/permit.controller';
import { PERMIT_REPORT_RATE_LIMIT, PERMIT_REPORT_RATE_WINDOW_MS, PERMIT_REPORT_TIMEOUT_MS } from '../app/src/modules/permit/permit-report.policy';
import { runWithinPermitReportDeadline } from '../app/src/modules/permit/permit-report.service';

function responseBody(exception: unknown): { error: { code: string; message: string; details?: unknown } } {
  let body: { error: { code: string; message: string; details?: unknown } } | undefined;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
      getResponse: () => ({
        status: () => ({
          json: (value: typeof body) => {
            body = value;
          },
        }),
      }),
    }),
  };
  new GlobalExceptionFilter().catch(exception, host as never);
  if (!body) throw new Error('The filter wrote no response.');
  return body;
}

describe('permit report limits', () => {
  it('allows ten report downloads a minute on the report route', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', PermitController.prototype.report)).toBe(PERMIT_REPORT_RATE_LIMIT);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', PermitController.prototype.report)).toBe(PERMIT_REPORT_RATE_WINDOW_MS);
    expect(PERMIT_REPORT_RATE_LIMIT).toBe(10);
    expect(PERMIT_REPORT_RATE_WINDOW_MS).toBe(60_000);
  });

  it('hides filesystem paths and storage keys from an unexpected failure', () => {
    const body = responseBody(new Error("ENOENT: no such file '/var/app/dist/assets/fonts/NotoSans-Regular.ttf' key organisations/tenant/logo"));
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain('ENOENT');
    expect(encoded).not.toContain('NotoSans');
    expect(encoded).not.toContain('organisations/tenant/logo');
  });

  it('returns a finished report and releases a stuck one', async () => {
    expect(PERMIT_REPORT_TIMEOUT_MS).toBe(30_000);
    await expect(runWithinPermitReportDeadline(Promise.resolve('pdf'), 50, () => undefined)).resolves.toBe('pdf');

    let expired = false;
    const stuck = runWithinPermitReportDeadline(new Promise(() => undefined), 20, () => {
      expired = true;
    });
    await expect(stuck).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(stuck).rejects.toThrow('The permit report took too long. Try again.');
    expect(expired).toBe(true);

    const denied = runWithinPermitReportDeadline(
      Promise.reject(new ForbiddenException('This permit report is not available.')),
      50,
      () => undefined,
    );
    await expect(denied).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps an intentional permit message and a plain rate-limit message', () => {
    const denied = responseBody(new ForbiddenException('This permit report is not available.'));
    expect(denied.error.message).toBe('This permit report is not available.');

    const limited = responseBody(new ThrottlerException());
    expect(limited.error.code).toBe('TOO_MANY_REQUESTS');
    expect(limited.error.message).toBe('Too many requests. Wait a moment and try again.');
    expect(JSON.stringify(limited)).not.toContain('ThrottlerException');
  });
});
