import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class Tracer {
  private readonly logger = new Logger(Tracer.name);

  start(name: string): {
    end: (meta?: Record<string, unknown>) => void;
    fail: (error: unknown) => void;
  } {
    const started = Date.now();
    return {
      end: (meta) => {
        this.logger.debug(
          JSON.stringify({
            type: 'span',
            name,
            durationMs: Date.now() - started,
            ok: true,
            ...meta,
          }),
        );
      },
      fail: (error) => {
        this.logger.debug(
          JSON.stringify({
            type: 'span',
            name,
            durationMs: Date.now() - started,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      },
    };
  }
}
