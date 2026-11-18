import sharp from "sharp";
import { renderPermitPdfProof } from "../app/src/modules/permit/pdf/permit-pdf-document";
import { readPdfText } from "./helpers/pdf-text";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
function mediaBoxes(pdf: string): Array<[number, number]> {
  const boxes: Array<[number, number]> = [];
  const pattern =
    /\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/g;
  for (const match of pdf.matchAll(pattern)) {
    boxes.push([Number(match[1]), Number(match[2])]);
  }
  return boxes;
}

describe("permit PDF renderer", () => {
  it("builds an A4 document with portrait, landscape, a continued table, images and Unicode", async () => {
    const [jpeg, webp] = await Promise.all([
      sharp(PNG).jpeg().toBuffer(),
      sharp(PNG).webp().toBuffer(),
    ]);
    const pdf = await renderPermitPdfProof({ png: PNG, jpeg, webp });
    const source = pdf.toString("latin1");

    const text = readPdfText(source);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      source.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3);
    expect(
      source.match(/\/Subtype\s*\/Image\b/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3);
    expect(source).toContain("/Filter /DCTDecode");
    expect(source).toContain("NotoSans");
    expect(text).toContain("Café — Zürich — Unicode in the body.");
    expect(text).toContain("Powered by PermitWiseAI - ViXR India Pvt. Ltd.");
    expect(text).toContain("Page 1 of");
    expect(text).toContain("Control 48");
    expect(text.match(/Item/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(text).toContain("Wide section");

    const boxes = mediaBoxes(source);
    expect(
      boxes.some(
        ([width, height]) => height > width && Math.abs(width - 595.28) < 1,
      ),
    ).toBe(true);
    expect(
      boxes.some(
        ([width, height]) => width > height && Math.abs(width - 841.89) < 1,
      ),
    ).toBe(true);
  });
});
