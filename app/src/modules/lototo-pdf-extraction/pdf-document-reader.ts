import type { LototoPdfExtractedImage, LototoPdfPage, LototoPdfTextLine } from './lototo-pdf-extraction.types';

type MupdfModule = {
  PDFDocument: {
    openDocument: (data: Buffer, magic: string) => {
      countPages: () => number;
      loadPage: (index: number) => {
        getBounds: () => PdfRect;
        run: (device: { close: () => void }, matrix: unknown) => void;
        toStructuredText: (mode: string) => {
          asText: () => string;
          walk: (walker: {
            beginLine?: (bbox: PdfRect) => void;
            onChar?: (value: string) => void;
            endLine?: () => void;
            onImageBlock?: (bbox: PdfRect, transform: unknown, image: PdfImage) => void;
          }) => void;
        };
        toPixmap: (matrix: unknown, colorspace: unknown, alpha: boolean) => { asPNG: () => Uint8Array };
      };
    };
  };
  Matrix: { identity: unknown; scale: (x: number, y: number) => unknown };
  ColorSpace: { DeviceRGB: unknown };
  Pixmap: new (
    colorspace: unknown,
    bbox: PdfRect,
    alpha: boolean,
  ) => { clear: (value?: number) => void; asPNG: () => Uint8Array };
  DrawDevice: new (matrix: unknown, pixmap: unknown) => { close: () => void };
};

type PdfRect = [number, number, number, number];

type PdfImage = {
  getImageMask: () => boolean;
  toPixmap: () => { asPNG: () => Uint8Array };
};

const MAX_MODEL_PAGES = 8;
const PAGE_COVER_FRACTION = 0.75;
const MIN_PHOTO_SHORT_SIDE_PT = 80;
const CROP_PAD_PT = 4;
const CROP_SCALE = 2;

/** A procedure photo is a cropped figure. A page-sized scan and small logos or icons are not. */
export function isProcedurePhoto(bbox: PdfRect, page: PdfRect): boolean {
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];
  const pageWidth = page[2] - page[0];
  const pageHeight = page[3] - page[1];
  if (width <= 0 || height <= 0 || pageWidth <= 0 || pageHeight <= 0) return false;
  if (width / pageWidth >= PAGE_COVER_FRACTION && height / pageHeight >= PAGE_COVER_FRACTION) return false;
  return Math.min(width, height) >= MIN_PHOTO_SHORT_SIDE_PT;
}

export async function readLototoPdf(buffer: Buffer): Promise<{
  pages: LototoPdfPage[];
  images: LototoPdfExtractedImage[];
  lines: LototoPdfTextLine[];
}> {
  // TypeScript's CommonJS emit rewrites import() to require(), and mupdf is ESM-only.
  const loadMupdf = new Function('return import("mupdf")') as () => Promise<MupdfModule>;
  const mupdf = await loadMupdf();
  const doc = mupdf.PDFDocument.openDocument(buffer, 'application/pdf');
  const pages: LototoPdfPage[] = [];
  const images: LototoPdfExtractedImage[] = [];
  const lines: LototoPdfTextLine[] = [];

  for (let index = 0; index < doc.countPages(); index += 1) {
    const page = doc.loadPage(index);
    const structured = page.toStructuredText('preserve-whitespace,preserve-images');
    const text = structured.asText();
    const png = Buffer.from(
      page.toPixmap(mupdf.Matrix.scale(1.25, 1.25), mupdf.ColorSpace.DeviceRGB, false).asPNG(),
    );
    if (pages.length < MAX_MODEL_PAGES) {
      pages.push({ pageNumber: index + 1, text, png });
    } else {
      pages.push({ pageNumber: index + 1, text, png: Buffer.alloc(0) });
    }
    const pageBounds = page.getBounds();
    const pageNumber = index + 1;
    let lineText = '';
    let lineBox: PdfRect | null = null;
    structured.walk({
      beginLine(bbox) {
        lineText = '';
        lineBox = bbox;
      },
      onChar(value) {
        lineText += value;
      },
      endLine() {
        const text = lineText.trim();
        if (!text || !lineBox) return;
        lines.push({
          pageNumber,
          text,
          centerY: (lineBox[1] + lineBox[3]) / 2,
        });
      },
      onImageBlock(bbox, _transform, image) {
        if (image.getImageMask() || !isProcedurePhoto(bbox, pageBounds)) return;
        const bytes = cropPage(mupdf, page, bbox, pageBounds);
        images.push({
          index: images.length,
          fileName: `figure-${images.length + 1}.png`,
          contentType: 'image/png',
          bytes,
          pageNumber,
          centerY: (bbox[1] + bbox[3]) / 2,
          height: bbox[3] - bbox[1],
        });
      },
    });
  }

  return { pages, images, lines };
}

function cropPage(mupdf: MupdfModule, page: { run: (device: { close: () => void }, matrix: unknown) => void }, bbox: PdfRect, pageBounds: PdfRect) {
  const clip: PdfRect = [
    Math.max(pageBounds[0], bbox[0] - CROP_PAD_PT),
    Math.max(pageBounds[1], bbox[1] - CROP_PAD_PT),
    Math.min(pageBounds[2], bbox[2] + CROP_PAD_PT),
    Math.min(pageBounds[3], bbox[3] + CROP_PAD_PT),
  ];
  const pixmap = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [clip[0] * CROP_SCALE, clip[1] * CROP_SCALE, clip[2] * CROP_SCALE, clip[3] * CROP_SCALE],
    false,
  );
  pixmap.clear(255);
  const device = new mupdf.DrawDevice(mupdf.Matrix.scale(CROP_SCALE, CROP_SCALE), pixmap);
  page.run(device, mupdf.Matrix.identity);
  device.close();
  return Buffer.from(pixmap.asPNG());
}
