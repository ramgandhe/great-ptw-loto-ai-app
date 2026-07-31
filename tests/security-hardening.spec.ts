import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { SecurityHeadersInterceptor } from '../app/src/common/interceptors/security-headers.interceptor';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Security hardening backend (PUS-215)', () => {
  it('SecurityHeadersInterceptor sets conservative headers', (done) => {
    const headers: Record<string, string> = {};
    const interceptor = new SecurityHeadersInterceptor();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({
          setHeader: (key: string, value: string) => {
            headers[key] = value;
          },
        }),
      }),
    } as unknown as ExecutionContext;

    interceptor.intercept(context, { handle: () => of({ ok: true }) } as CallHandler).subscribe({
      complete: () => {
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['Referrer-Policy']).toBe('no-referrer');
        expect(headers['Cache-Control']).toBe('no-store');
        done();
      },
    });
  });

  it('documents body limit and security toggles', () => {
    const env = readFileSync(join(__dirname, '../.env.example'), 'utf8');
    const apiRef = readFileSync(join(__dirname, '../docs/api-reference.md'), 'utf8');
    expect(env).toMatch(/API_BODY_LIMIT/);
    expect(env).toMatch(/SECURITY_HELMET_ENABLED/);
    expect(apiRef).toMatch(/SecurityHeadersInterceptor/);
  });
});
