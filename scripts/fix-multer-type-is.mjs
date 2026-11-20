/**
 * multer@2 nests type-is@1.6, which resolves the hoisted media-typer@1.x.
 * media-typer@1 rejects Content-Type values that include a boundary parameter,
 * so multer's multipart check fails and every upload arrives with no file.
 *
 * Removing multer's nested type-is makes it use the workspace type-is@2.x,
 * which understands multipart Content-Types with boundaries.
 */
import { createRequire } from 'node:module';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const searchRoots = [
  join(process.cwd(), 'app'),
  process.cwd(),
];

for (const root of searchRoots) {
  let multerDir;
  try {
    multerDir = dirname(require.resolve('multer/package.json', { paths: [root] }));
  } catch {
    continue;
  }
  const nestedTypeIs = join(multerDir, 'node_modules', 'type-is');
  if (existsSync(nestedTypeIs)) {
    rmSync(join(multerDir, 'node_modules'), { recursive: true, force: true });
    console.log(`fix-multer-type-is: removed nested type-is under ${multerDir}`);
  }
}
