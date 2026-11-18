import { PermitPdfDocument } from "../app/src/modules/permit/pdf/permit-pdf-document";
import { readPdfText } from "./helpers/pdf-text";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("permit report cover", () => {
  it("prints the tenant identity and document-control fields on the first page", async () => {
    const pdf = new PermitPdfDocument({
      header: "Permitwise AI",
      footer: "Powered by PermitWiseAI - ViXR India Pvt. Ltd.",
    });
    pdf.addPage("portrait");
    await pdf.drawCover({
      organisationName: "Harbour Works",
      legalName: "Harbour Works Pvt Ltd",
      registrationNumber: "U12345KL2020PTC000001",
      address: "12 Harbour Road, Kerala, 682001",
      site: "Tank farm",
      timezone: "Asia/Kolkata",
      reference: "PTW-2026-0012",
      title: "Hot work on tank roof",
      version: 2,
      lifecycleStatus: "Work in progress",
      reportStatus: "INTERIM",
      generatedAt: "17 Nov 2026, 16:10 IST",
      logo: { bytes: PNG, contentType: "image/png" },
    });
    const buffer = await pdf.finish();
    const source = buffer.toString("latin1");
    const text = readPdfText(source);

    expect(
      source.match(/\/Subtype\s*\/Image\b/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(1);
    expect(text).toContain("Harbour Works");
    expect(text).toContain("Harbour Works Pvt Ltd");
    expect(text).toContain("Registration U12345KL2020PTC000001");
    expect(text).toContain("12 Harbour Road, Kerala, 682001");
    expect(text).toContain("Site Tank farm");
    expect(text).toContain("PTW-2026-0012");
    expect(text).toContain("Hot work on tank roof");
    expect(text).toContain("Work in progress");
    expect(text).toContain("INTERIM");
    expect(text).toContain("Asia/Kolkata");
    expect(text).toContain("17 Nov 2026, 16:10 IST");
    expect(text).toContain("Powered by PermitWiseAI - ViXR India Pvt. Ltd.");
  });
});
