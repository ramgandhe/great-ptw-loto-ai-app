import { mdpEvidenceReportName } from "../app/src/modules/permit/permit-report-files";
import { renderPermitReportPdf } from "../app/src/modules/permit/permit-report-pdf";
import type { PermitReport } from "../app/src/modules/permit/permit-report.model";
import { readPdfText } from "./helpers/pdf-text";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function report(): PermitReport {
  return {
    edition: "interim",
    editionLabel: "INTERIM",
    generatedAt: "17 Nov 2026, 16:10 (Asia/Kolkata)",
    timezone: "Asia/Kolkata",
    organisation: {
      name: "Harbour Works",
      legalName: "Harbour Works Pvt Ltd",
      registrationNumber: "U12345KL2020PTC000001",
      address: "12 Harbour Road",
      site: "Tank farm",
      place: "Tank farm · Roof",
    },
    permit: {
      id: "permit-1",
      reference: "PTW-2026-0012",
      title: "Hot work on tank roof",
      type: "Hot work",
      version: 2,
      status: "active",
      statusLabel: "Work in progress",
      workScope: "Weld the roof patch",
      siteNotes: null,
      emergencyPhone: null,
      plannedStart: "17 Nov 2026, 09:00 (Asia/Kolkata)",
      plannedEnd: "17 Nov 2026, 17:00 (Asia/Kolkata)",
    },
    people: [{ id: "asha", name: "Asha Menon", role: "permit-approver" }],
    hazards: [{ name: "Hot surface", controls: ["Fire blanket"] }],
    ppe: [{ name: "Face shield", quantity: 2 }],
    gasTesting: [{ parameter: "LEL", unit: "%", minimum: 0, maximum: 10 }],
    isolations: [
      { number: "IC-4", title: "Tank inlet", status: "isolated_verified" },
    ],
    simops: [
      {
        summary: "Hot work beside painting",
        severity: "high",
        status: "review_required",
        detectedAt: "17 Nov 2026, 08:30 (Asia/Kolkata)",
        detail: "Decision: allow with controls",
        comments: "Keep a fire watch",
        otherPermits: ["PTW-2026-0099 · Painting"],
        controls: ["Fire watch on the boundary · Asha Menon"],
      },
    ],
    forms: [
      {
        name: "Hot work checklist",
        answers: [{ label: "Fire watch", value: "Named" }],
      },
    ],
    execution: {
      activatedAt: "17 Nov 2026, 09:30 (Asia/Kolkata)",
      actualStartAt: null,
      workState: "in_progress",
      suspensionReason: null,
    },
    multiDay: true,
    days: [
      {
        date: "2026-11-17",
        progress: "submitted: Roof patch fitted · Asha Menon",
        handovers: [
          "Asha Menon to Ravi · accepted · 17 Nov 2026, 18:00 (Asia/Kolkata)",
        ],
        secure: "submitted · Asha Menon",
        reopen: "passed · Area clear · Asha Menon",
      },
    ],
    verification: null,
    closure: null,
    attachments: [
      {
        fileName: "site.jpg",
        contentType: "image/png",
        fileSize: PNG.length,
        image: true,
        uploadedBy: "Asha Menon",
        uploadedAt: "17 Nov 2026, 16:10 (Asia/Kolkata)",
        bytes: PNG,
      },
      {
        fileName: mdpEvidenceReportName({
          kind: "daily_progress",
          operationalDate: "2026-11-17",
          fileName: "roof.jpg",
        }),
        contentType: "image/png",
        fileSize: PNG.length,
        image: true,
        uploadedBy: "Asha Menon",
        uploadedAt: "17 Nov 2026, 18:10 (Asia/Kolkata)",
        bytes: PNG,
      },
      {
        fileName: "method.pdf",
        contentType: "application/pdf",
        fileSize: 4000,
        image: false,
        uploadedBy: "Asha Menon",
        uploadedAt: "17 Nov 2026, 16:12 (Asia/Kolkata)",
      },
      {
        fileName: "scan.gif",
        contentType: "image/gif",
        fileSize: 900,
        image: true,
        uploadedBy: null,
        uploadedAt: null,
      },
    ],
    history: [
      {
        id: "approval-1",
        at: "17 Nov 2026, 08:00 (Asia/Kolkata)",
        action: "approved",
        actor: "Asha Menon",
        role: "permit-approver",
        fromStatus: "pending_approval",
        toStatus: "approved",
        comment: "Site accepted",
        signature: true,
      },
    ],
    sections: [
      "cover",
      "summary",
      "scope",
      "people",
      "hazards",
      "controls",
      "forms",
      "gas_testing",
      "lototo",
      "simops",
      "approvals",
      "execution",
      "multi_day",
      "evidence",
      "history",
      "audit",
    ],
  };
}

describe("permit report PDF", () => {
  it("prints the dossier sections, signature and a landscape history page", async () => {
    const pdf = await renderPermitReportPdf(report(), {
      bytes: PNG,
      contentType: "image/png",
    });
    const source = pdf.toString("latin1");
    const text = readPdfText(source);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(text).toContain("Harbour Works");
    expect(text).toContain("PTW-2026-0012");
    expect(text).toContain("INTERIM");
    expect(text).toContain("Work in progress");
    expect(text).toContain("Weld the roof patch");
    expect(text).toContain("Asha Menon");
    expect(text).toContain("Hot surface");
    expect(text).toContain("Fire blanket");
    expect(text).toContain("Face shield");
    expect(text).toContain("LEL");
    expect(text).toContain("IC-4");
    expect(text).toContain("Hot work beside painting");
    expect(text).toContain("Decision: allow with controls");
    expect(text).toContain("PTW-2026-0099 · Painting");
    expect(text).toContain("Fire watch on the");
    expect(text).toContain("boundary · Asha Menon");
    expect(text).toContain("operational day");
    expect(text).toContain("2026-11-17");
    expect(text).toContain("submitted: Roof");
    expect(text).toContain("patch fitted · Asha Menon");
    expect(text).toContain("Asha Menon to Ravi");
    expect(text).toContain("submitted · Asha");
    expect(text).toContain("passed · Area clear");
    expect(text).toContain("Fire watch");
    expect(text).toContain("Electronically signed");
    expect(text).toContain("site.jpg");
    expect(text).toContain("Daily progress");
    expect(text).toContain("roof.jpg");
    expect(text).toContain("Asha Menon");
    expect(text).toContain("method.pdf");
    expect(text).toContain("scan.gif");
    expect(text).toContain("Image not embedded.");
    expect(
      (source.match(/\/Subtype\s*\/Image/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(text).toContain("Powered by PermitWiseAI - ViXR India Pvt. Ltd.");
    expect(text).toContain("Page 1 of");
    expect(source).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+841\.89\s+595\.28\s*\]/);
  });
});
