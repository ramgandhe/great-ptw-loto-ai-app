import { existsSync, readFileSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import sharp from "sharp";

/** Noto Sans (SIL Open Font License). Nest copies it to dist; the source path covers a watch build that has not copied assets yet. */
function fontFile(): string {
  const candidates = [
    path.join(__dirname, "../../../assets/fonts/NotoSans-Regular.ttf"),
    path.join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}
const FONT_NAME = "NotoSans";

const MARGIN = { top: 64, bottom: 56, left: 48, right: 48 };

export type PdfPageLayout = "portrait" | "landscape";

export type PermitReportCover = {
  organisationName: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  site?: string | null;
  timezone: string;
  reference: string;
  title: string;
  version: number;
  lifecycleStatus: string;
  reportStatus: string;
  generatedAt: string;
  logo?: { bytes: Buffer; contentType: string } | null;
};

export type PermitPdfOptions = {
  header: string;
  /** Right side of the footer. */
  footer: string;
  /** Left side of the footer. Page number stays in the centre. */
  footerLeft?: string;
  /** Uncompressed streams keep the proof readable. Permit reports can turn this on later. */
  compress?: boolean;
};

/**
 * Server-side permit PDF. One document, A4, portrait by default, with a landscape
 * page where a section asks for it. Headers and footers are stamped after the body
 * so every page can show "Page n of m".
 */
export class PermitPdfDocument {
  private readonly doc: PDFKit.PDFDocument;
  private readonly header: string;
  private readonly footer: string;
  private readonly footerLeft: string;
  private layout: PdfPageLayout = "portrait";
  private sectionOpen = false;
  private sectionTitle = "";
  private sectionNumber = "";
  private readonly chunks: Buffer[] = [];
  private readonly finished: Promise<Buffer>;

  constructor(options: PermitPdfOptions) {
    this.header = options.header;
    this.footer = options.footer;
    this.footerLeft = options.footerLeft ?? "";
    this.doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      compress: options.compress ?? false,
      size: "A4",
      layout: "portrait",
      margins: MARGIN,
      info: { Producer: "Permitwise AI" },
    });
    this.doc.registerFont(FONT_NAME, readFileSync(fontFile()));
    this.finished = new Promise((resolve, reject) => {
      this.doc.on("data", (chunk: Buffer) => this.chunks.push(chunk));
      this.doc.on("end", () => resolve(Buffer.concat(this.chunks)));
      this.doc.on("error", reject);
    });
  }

  /** First-page identity: tenant mark, site and the document-control fields. */
  async drawCover(cover: PermitReportCover, number = 1): Promise<void> {
    if (this.doc.page == null) this.addPage("portrait");
    const top = this.doc.y;
    let textX = MARGIN.left;
    let textWidth = this.contentWidth();
    if (cover.logo) {
      const printable = await imageBytesForPdf(
        cover.logo.bytes,
        cover.logo.contentType,
      );
      this.doc.image(printable, MARGIN.left, top, { fit: [88, 48] });
      textX = MARGIN.left + 100;
      textWidth = this.contentWidth() - 100;
    }
    this.doc.font(FONT_NAME).fontSize(14).fillColor("#111111");
    this.doc.text(cover.organisationName, textX, top, { width: textWidth });
    this.doc.fontSize(9);
    const details = [
      cover.legalName,
      cover.registrationNumber
        ? `Registration ${cover.registrationNumber}`
        : null,
      cover.address,
      cover.site ? `Site ${cover.site}` : null,
    ].filter((line): line is string => Boolean(line));
    for (const line of details) {
      this.doc.text(line, textX, this.doc.y, { width: textWidth });
    }
    this.doc.y = Math.max(this.doc.y, top + (cover.logo ? 52 : 0)) + 6;
    this.doc.font(FONT_NAME).fontSize(12).fillColor("#111111");
    this.doc.text("PERMIT TO WORK", MARGIN.left, this.doc.y, {
      width: this.contentWidth(),
      align: "center",
    });
    this.doc.moveDown(0.4);
    this.section(number, "Document control");
    this.fieldPair(["Permit", cover.reference], ["Title", cover.title]);
    this.fieldPair(
      ["Version", String(cover.version)],
      ["Permit status", cover.lifecycleStatus],
    );
    this.fieldPair(
      ["Report status", cover.reportStatus],
      ["Generated", cover.generatedAt],
    );
    this.field("Time zone", cover.timezone);
  }

  /** Numbered form block. Later rows continue the same block across pages. */
  section(number: number, title: string): void {
    this.closeSection();
    this.sectionNumber = String(number);
    this.sectionTitle = title;
    this.ensureSpace(22);
    this.sectionOpen = true;
    this.drawSectionBar(false);
  }

  closeSection(): void {
    if (!this.sectionOpen || this.doc.page == null) return;
    this.drawSectionRule();
    this.sectionOpen = false;
  }

  /** A labelled break inside the open section, one block per lifecycle step. */
  stage(label: string): void {
    this.ensureSpace(40);
    this.doc.y += 6;
    const y = this.doc.y;
    const width = this.contentWidth();
    this.doc.save();
    this.doc.rect(MARGIN.left, y, width, 16).fillAndStroke("#e7edf2", "#c5ced6");
    this.doc.fillColor("#1b2838").font(FONT_NAME).fontSize(9);
    this.doc.text(label, MARGIN.left + 6, y + 3, {
      width: width - 12,
      height: 12,
      lineBreak: false,
      ellipsis: true,
    });
    this.doc.restore();
    this.doc.fillColor("#111111");
    this.doc.y = y + 16;
  }

  field(label: string, value: string): void {
    this.formRow([{ label, value }]);
  }

  fieldPair(left: [string, string], right: [string, string]): void {
    this.formRow([
      { label: left[0], value: left[1] },
      { label: right[0], value: right[1] },
    ]);
  }

  /** Checked rows, two to a line. The mark is text, not colour alone. */
  ticks(items: string[]): void {
    for (let index = 0; index < items.length; index += 2) {
      this.tickRow(items[index], items[index + 1]);
    }
  }

  addPage(layout: PdfPageLayout = "portrait"): void {
    const continueSection = this.sectionOpen;
    if (continueSection) this.drawSectionRule();
    this.layout = layout;
    this.doc.addPage({ size: "A4", layout, margins: MARGIN });
    this.doc.font(FONT_NAME).fontSize(11).fillColor("#111111");
    if (continueSection) this.drawSectionBar(true);
  }

  heading(value: string): void {
    this.ensureSpace(28);
    this.doc.font(FONT_NAME).fontSize(16).text(value, { paragraphGap: 8 });
    this.doc.fontSize(11);
  }

  paragraph(value: string): void {
    this.ensureSpace(24);
    this.doc.font(FONT_NAME).fontSize(11).text(value, { paragraphGap: 6 });
  }

  /**
   * Draws a table and continues it on the next page of the same layout.
   * The column headings are repeated after each page break.
   */
  table(headers: string[], rows: string[][]): void {
    const columns = headers.length;
    const drawHeadings = () => {
      this.row(headers, columns, true);
    };
    this.ensureSpace(36);
    drawHeadings();
    for (const row of rows) {
      if (this.doc.y + 18 > this.contentBottom()) {
        this.addPage(this.layout);
        drawHeadings();
      }
      this.row(row, columns, false);
    }
    this.doc.moveDown(0.6);
  }

  async image(bytes: Buffer, contentType: string, wide = false): Promise<void> {
    const printable = await imageBytesForPdf(
      bytes,
      contentType,
      wide ? { maxEdge: 1200 } : undefined,
    );
    const max: [number, number] = wide ? [this.contentWidth(), 220] : [96, 64];
    const fitted = await fittedImageSize(printable, max);
    this.ensureSpace(fitted.height + 8);
    const y = this.doc.y;
    this.doc.image(printable, MARGIN.left, y, {
      width: fitted.width,
      height: fitted.height,
    });
    this.doc.y = y + fitted.height + 6;
  }

  async finish(): Promise<Buffer> {
    this.closeSection();
    this.stampPages();
    this.doc.end();
    return this.finished;
  }

  private tickRow(left: string, right?: string): void {
    const columns = right ? [left, right] : [left];
    const columnWidth = this.contentWidth() / columns.length;
    const mark = 22;
    this.doc.font(FONT_NAME).fontSize(9);
    const height = Math.max(
      18,
      ...columns.map(
        (item) =>
          this.doc.heightOfString(item, { width: columnWidth - mark - 10 }) + 8,
      ),
    );
    this.ensureSpace(height);
    const y = this.doc.y;
    columns.forEach((item, index) => {
      const x = MARGIN.left + index * columnWidth;
      this.doc.save();
      this.doc.rect(x, y, mark, height).fillAndStroke("#eef1f4", "#c5ced6");
      this.doc.rect(x + mark, y, columnWidth - mark, height).stroke("#c5ced6");
      this.doc.restore();
      this.doc.fillColor("#111111").font(FONT_NAME).fontSize(8);
      this.doc.text("[x]", x + 3, y + 4, {
        width: mark - 4,
        height: height - 6,
        lineBreak: false,
      });
      this.doc
        .fontSize(9)
        .text(item, x + mark + 4, y + 4, {
          width: columnWidth - mark - 8,
          height: height - 6,
        });
    });
    this.doc.y = y + height;
    this.doc.fillColor("#111111");
  }

  private formRow(cells: { label: string; value: string }[]): void {
    const columnWidth = this.contentWidth() / cells.length;
    const labelWidth = Math.min(108, columnWidth * 0.38);
    this.doc.font(FONT_NAME).fontSize(9);
    const height = Math.max(
      18,
      ...cells.map((cell) => {
        const valueHeight = this.doc.heightOfString(cell.value || "-", {
          width: columnWidth - labelWidth - 10,
        });
        return valueHeight + 8;
      }),
    );
    this.ensureSpace(height);
    const y = this.doc.y;
    cells.forEach((cell, index) => {
      const x = MARGIN.left + index * columnWidth;
      this.doc.save();
      this.doc
        .rect(x, y, labelWidth, height)
        .fillAndStroke("#eef1f4", "#c5ced6");
      this.doc
        .rect(x + labelWidth, y, columnWidth - labelWidth, height)
        .stroke("#c5ced6");
      this.doc.restore();
      this.doc.fillColor("#334155").font(FONT_NAME).fontSize(8);
      this.doc.text(cell.label, x + 4, y + 4, {
        width: labelWidth - 8,
        height: height - 6,
        lineBreak: false,
        ellipsis: true,
      });
      this.doc.fillColor("#111111").fontSize(9);
      this.doc.text(cell.value || "-", x + labelWidth + 4, y + 4, {
        width: columnWidth - labelWidth - 10,
        height: height - 6,
      });
    });
    this.doc.y = y + height;
    this.doc.fillColor("#111111");
  }

  private drawSectionBar(continued: boolean): void {
    const y = this.doc.y;
    const width = this.contentWidth();
    const label = continued
      ? `${this.sectionNumber}. ${this.sectionTitle} (continued)`
      : `${this.sectionNumber}. ${this.sectionTitle}`;
    this.doc.save();
    this.doc.rect(MARGIN.left, y, width, 16).fill("#1b2838");
    this.doc.fillColor("#ffffff").font(FONT_NAME).fontSize(9);
    this.doc.text(label, MARGIN.left + 6, y + 3, {
      width: width - 12,
      height: 12,
      lineBreak: false,
      ellipsis: true,
    });
    this.doc.restore();
    this.doc.fillColor("#111111");
    this.doc.y = y + 16;
  }

  private drawSectionRule(): void {
    if (this.doc.page == null) return;
    const y = Math.min(this.doc.y, this.contentBottom());
    this.doc.save();
    this.doc
      .moveTo(MARGIN.left, y)
      .lineTo(MARGIN.left + this.contentWidth(), y)
      .strokeColor("#1b2838")
      .lineWidth(1)
      .stroke();
    this.doc.restore();
    this.doc.y = y + 8;
  }

  private row(cells: string[], columns: number, heading: boolean): void {
    const width = this.contentWidth() / columns;
    const y = this.doc.y;
    this.doc.font(FONT_NAME).fontSize(heading ? 9 : 10);
    cells.forEach((cell, index) => {
      this.doc.text(cell, MARGIN.left + index * width, y, {
        width: width - 6,
        height: 16,
        lineBreak: false,
        ellipsis: true,
      });
    });
    this.doc.y = y + 18;
  }

  private ensureSpace(height: number): void {
    if (this.doc.page == null || this.doc.y + height > this.contentBottom()) {
      this.addPage(this.layout);
    }
  }

  private contentBottom(): number {
    return this.doc.page.height - this.doc.page.margins.bottom;
  }

  private contentWidth(): number {
    return (
      this.doc.page.width -
      this.doc.page.margins.left -
      this.doc.page.margins.right
    );
  }

  private stampPages(): void {
    const range = this.doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      this.doc.switchToPage(index);
      const savedBottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      const width = this.doc.page.width - MARGIN.left - MARGIN.right;
      this.doc.font(FONT_NAME).fontSize(8).fillColor("#333333");
      this.doc.text(this.header, MARGIN.left, 28, {
        width,
        height: 14,
        lineBreak: false,
      });
      const footerY = this.doc.page.height - 32;
      const footerLine = { width, height: 14, lineBreak: false as const };
      this.doc.text(this.footerLeft, MARGIN.left, footerY, footerLine);
      this.doc.text(`Page ${index + 1} of ${range.count}`, MARGIN.left, footerY, { ...footerLine, align: "center" });
      this.doc.text(this.footer, MARGIN.left, footerY, { ...footerLine, align: "right" });
      this.doc.page.margins.bottom = savedBottom;
    }
  }
}

async function fittedImageSize(
  bytes: Buffer,
  max: [number, number],
): Promise<{ width: number; height: number }> {
  const meta = await sharp(bytes).metadata();
  const sourceWidth = meta.width || max[0];
  const sourceHeight = meta.height || max[1];
  const scale = Math.min(max[0] / sourceWidth, max[1] / sourceHeight, 1);
  return {
    width: Math.max(1, sourceWidth * scale),
    height: Math.max(1, sourceHeight * scale),
  };
}

export async function imageBytesForPdf(
  bytes: Buffer,
  contentType: string,
  options?: { maxEdge?: number },
): Promise<Buffer> {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") {
    throw new Error(
      `This report cannot embed a ${type || "file"} as an image.`,
    );
  }
  if (!options?.maxEdge && type !== "image/webp") return bytes;
  let pipeline = sharp(bytes).rotate();
  if (options?.maxEdge) {
    pipeline = pipeline.resize({
      width: options.maxEdge,
      height: options.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  if (type === "image/jpeg") return pipeline.jpeg({ quality: 80 }).toBuffer();
  return pipeline.png().toBuffer();
}

/** Sample document used to prove the renderer before permit data is connected. */
export async function renderPermitPdfProof(images: {
  png: Buffer;
  jpeg: Buffer;
  webp: Buffer;
}): Promise<Buffer> {
  const pdf = new PermitPdfDocument({
    header: "Permitwise AI  ·  Renderer proof",
    footer: "Powered by PermitWiseAI - ViXR India Pvt. Ltd.",
  });
  pdf.addPage("portrait");
  pdf.heading("Permit report renderer");
  pdf.paragraph("Café — Zürich — Unicode in the body.");
  await pdf.image(images.png, "image/png");
  await pdf.image(images.jpeg, "image/jpeg");
  await pdf.image(images.webp, "image/webp");
  pdf.table(
    ["Item", "Detail"],
    Array.from({ length: 48 }, (_, index) => [
      `Control ${index + 1}`,
      `Applies for the whole task ${index + 1}`,
    ]),
  );
  pdf.addPage("landscape");
  pdf.heading("Wide section");
  pdf.table(
    ["Point", "Isolation", "Verification", "Restoration"],
    [["1", "Main breaker", "Verified", "Pending"]],
  );
  return pdf.finish();
}
