import { createServer } from 'http';
import { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import express from 'express';

/**
 * Guards the multer + type-is dependency trap:
 * nested type-is@1.6 + media-typer@1.x rejects multipart Content-Types that
 * include a boundary, so multer skips the body and req.file is missing.
 */
describe('multer multipart regression', () => {
  // multer 2 ships without DefinitelyTyped in this repo; require keeps TS quiet.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const multer = require('multer') as any;

  it('type-is used by multer accepts multipart with a boundary parameter', () => {
    const typeIsPath = require.resolve('type-is', {
      paths: [dirname(require.resolve('multer'))],
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const multerTypeIs = require(typeIsPath) as any;
    const req = {
      headers: {
        'content-type':
          'multipart/form-data; boundary=------------------------abc123',
        'content-length': '100',
      },
    };
    expect(multerTypeIs(req, ['multipart'])).toBe('multipart');
  });

  it('multer.single populates req.file.buffer for an .xlsx upload', async () => {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });
    app.post('/upload', upload.single('file'), (req: express.Request, res: express.Response) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (req as any).file as
        | { size: number; originalname: string; buffer: Buffer }
        | undefined;
      res.json({
        hasFile: Boolean(file),
        size: file?.size ?? 0,
        name: file?.originalname ?? null,
        bufferLength: file?.buffer?.length ?? 0,
      });
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const xlsx = readFileSync(
        join(__dirname, '../docs/specs/lototo_procedure_template.xlsx'),
      );
      const form = new FormData();
      form.append(
        'file',
        new Blob([xlsx], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'procedure.xlsx',
      );

      const response = await fetch(`http://127.0.0.1:${port}/upload`, {
        method: 'POST',
        body: form,
      });
      const body = (await response.json()) as {
        hasFile: boolean;
        size: number;
        name: string | null;
        bufferLength: number;
      };

      expect(response.status).toBe(200);
      expect(body.hasFile).toBe(true);
      expect(body.name).toBe('procedure.xlsx');
      expect(body.size).toBeGreaterThan(1000);
      expect(body.bufferLength).toBe(body.size);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
