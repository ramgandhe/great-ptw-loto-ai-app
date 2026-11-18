import { PermitPdfDocument } from "./pdf/permit-pdf-document";
import type { PermitReport, PermitReportEvent } from "./permit-report.model";
import {
  PERMIT_REPORT_SECTIONS,
  type PermitReportSectionId,
} from "./permit-report.policy";

const SECTION_LABELS = new Map(
  PERMIT_REPORT_SECTIONS.map((section) => [section.id, section.label]),
);
const FOOTER = "Powered by PermitWiseAI - ViXR India Pvt. Ltd.";

export function permitReportFileName(
  reference: string,
  edition: "interim" | "final",
  at: Date,
  timeZone: string,
): string {
  const safeReference =
    reference.replace(/[^A-Za-z0-9-]+/g, "").slice(0, 40) || "permit";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone.trim() || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const stamp = `${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}${value("second")}`;
  return `${safeReference}-${edition}-${stamp}.pdf`;
}

export async function renderPermitReportPdf(
  report: PermitReport,
  logo?: { bytes: Buffer; contentType: string } | null,
): Promise<Buffer> {
  const pdf = new PermitPdfDocument({
    header: `${report.organisation.name}  ·  ${report.permit.reference}  ·  ${report.editionLabel}`,
    footer: FOOTER,
    footerLeft: report.permit.reference,
  });
  pdf.addPage("portrait");
  for (let index = 0; index < report.sections.length; index += 1) {
    await drawSection(pdf, report, report.sections[index], index + 1, logo);
  }
  return pdf.finish();
}

async function drawSection(
  pdf: PermitPdfDocument,
  report: PermitReport,
  section: PermitReportSectionId,
  number: number,
  logo?: { bytes: Buffer; contentType: string } | null,
): Promise<void> {
  if (section === "cover") {
    await pdf.drawCover(
      {
        organisationName: report.organisation.name,
        legalName: report.organisation.legalName,
        registrationNumber: report.organisation.registrationNumber,
        address: report.organisation.address,
        site: report.organisation.site,
        timezone: report.timezone,
        reference: report.permit.reference,
        title: report.permit.title,
        version: report.permit.version,
        lifecycleStatus: report.permit.statusLabel,
        reportStatus: report.editionLabel,
        generatedAt: report.generatedAt,
        logo,
      },
      number,
    );
    return;
  }

  if (section === "history" || section === "audit") {
    pdf.closeSection();
    pdf.addPage("landscape");
  }
  pdf.section(number, SECTION_LABELS.get(section) ?? section);

  if (section === "summary") {
    pdf.fieldPair(
      ["Permit type", report.permit.type],
      ["Version", String(report.permit.version)],
    );
    pdf.fieldPair(
      ["Permit status", report.permit.statusLabel],
      ["Report status", report.editionLabel],
    );
    if (report.permit.emergencyPhone)
      pdf.field("Emergency phone", report.permit.emergencyPhone);
    return;
  }
  if (section === "scope") {
    pdf.field(
      "Work scope",
      report.permit.workScope ?? "No work scope is recorded.",
    );
    pdf.field(
      "Place",
      report.organisation.place ?? report.organisation.site ?? "Not recorded",
    );
    pdf.fieldPair(
      ["Planned start", report.permit.plannedStart ?? "Not recorded"],
      ["Planned end", report.permit.plannedEnd ?? "Not recorded"],
    );
    if (report.permit.siteNotes)
      pdf.field("Site notes", report.permit.siteNotes);
    return;
  }
  if (section === "people") {
    if (report.people.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    for (const person of report.people) {
      pdf.fieldPair(
        ["Name", person.name],
        ["Role", person.role ? readable(person.role) : "Not recorded"],
      );
    }
    return;
  }
  if (section === "hazards") {
    if (report.hazards.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    pdf.ticks(report.hazards.map((hazard) => hazard.name));
    return;
  }
  if (section === "controls") {
    const controls = report.hazards.flatMap((hazard) =>
      hazard.controls.map((control) => `${hazard.name}: ${control}`),
    );
    const ppe = report.ppe.map((item) => `${item.name} x ${item.quantity}`);
    const lines = [...controls, ...ppe];
    if (lines.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    pdf.ticks(lines);
    return;
  }
  if (section === "forms") {
    if (report.forms.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    for (const form of report.forms) {
      pdf.field("Form", form.name);
      if (form.answers.length === 0) {
        pdf.field("Record", "None recorded.");
        continue;
      }
      for (const answer of form.answers) pdf.field(answer.label, answer.value);
    }
    return;
  }
  if (section === "gas_testing") {
    if (report.gasTesting.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    for (const test of report.gasTesting) {
      pdf.fieldPair(["Parameter", test.parameter], ["Unit", test.unit]);
      pdf.fieldPair(
        ["Minimum", String(test.minimum)],
        ["Maximum", String(test.maximum)],
      );
    }
    return;
  }
  if (section === "lototo") {
    if (report.isolations.length === 0) {
      pdf.field("Record", "Isolation is required. No certificate is attached.");
      return;
    }
    for (const item of report.isolations) {
      pdf.fieldPair(
        ["Certificate", item.number],
        ["Status", item.status.replace(/_/g, " ")],
      );
      pdf.field("Title", item.title);
    }
    return;
  }
  if (section === "simops") {
    if (report.simops.length === 0) {
      pdf.field(
        "Record",
        "No simultaneous-operations case is recorded on this permit.",
      );
      return;
    }
    for (const item of report.simops) {
      pdf.field(
        "Case",
        [item.severity, item.status.replace(/_/g, " "), item.detectedAt]
          .filter(Boolean)
          .join(" · "),
      );
      pdf.field("Summary", item.summary);
      if (item.detail) pdf.field("Decision", item.detail);
      if (item.comments) pdf.field("Comments", item.comments);
      if (item.otherPermits.length > 0)
        pdf.field("With", item.otherPermits.join("; "));
      for (const control of item.controls) pdf.field("Control", control);
    }
    return;
  }
  if (section === "approvals") {
    const signatures = report.history.filter((event) => event.signature);
    if (signatures.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    for (const event of signatures) drawEvent(pdf, event, true);
    return;
  }
  if (section === "execution") {
    if (!report.execution) {
      pdf.field("Record", "None recorded.");
      return;
    }
    pdf.field("Activated", report.execution.activatedAt ?? "Not recorded");
    pdf.field("Work started", report.execution.actualStartAt ?? "Not recorded");
    pdf.field(
      "Work state",
      report.execution.workState
        ? readable(report.execution.workState)
        : "Not recorded",
    );
    return;
  }
  if (section === "multi_day") {
    if (report.multiDay)
      pdf.field(
        "Schedule",
        `This permit runs across more than one operational day (${report.timezone}).`,
      );
    if (report.days.length === 0) {
      pdf.field(
        "Record",
        "No daily progress, handover, secure or reopen is recorded.",
      );
      return;
    }
    for (const day of report.days) {
      pdf.field("Operational day", day.date);
      if (day.progress) pdf.field("Progress", day.progress);
      for (const handover of day.handovers) pdf.field("Handover", handover);
      if (day.secure) pdf.field("Day secure", day.secure);
      if (day.reopen) pdf.field("Reopen", day.reopen);
    }
    return;
  }
  if (section === "suspension") {
    const events = report.history.filter(
      (event) =>
        event.action === "suspended" ||
        event.action === "revalidated" ||
        event.action === "resumed",
    );
    if (report.execution?.suspensionReason)
      pdf.field("Suspension reason", report.execution.suspensionReason);
    if (events.length === 0 && !report.execution?.suspensionReason)
      pdf.field("Record", "None recorded.");
    for (const event of events) drawEvent(pdf, event, false);
    return;
  }
  if (section === "closure") {
    if (report.verification) {
      pdf.field("Verified by", report.verification.actor);
      pdf.field("Verified at", report.verification.at);
      if (report.verification.comment)
        pdf.field("Comment", report.verification.comment);
    }
    if (report.closure) {
      pdf.field("Closed by", report.closure.actor);
      pdf.field("Closed at", report.closure.at);
      if (report.closure.actualEnd)
        pdf.field("Actual end", report.closure.actualEnd);
      if (report.closure.comment) pdf.field("Comment", report.closure.comment);
    }
    if (!report.verification && !report.closure)
      pdf.field("Record", "None recorded.");
    return;
  }
  if (section === "evidence") {
    if (report.attachments.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    for (const file of report.attachments) {
      pdf.field("File", attachmentLine(file));
      if (!file.image) continue;
      if (!file.bytes) {
        pdf.field("Image", "Image not embedded.");
        continue;
      }
      try {
        await pdf.image(file.bytes, file.contentType, true);
      } catch {
        pdf.field("Image", "Image not embedded.");
      }
    }
    return;
  }
  if (section === "history" || section === "audit") {
    if (report.history.length === 0) {
      pdf.field("Record", "None recorded.");
      return;
    }
    report.history.forEach((event, index) => {
      const action = readable(event.action);
      const label = action.charAt(0).toUpperCase() + action.slice(1);
      pdf.stage(`${index + 1}. ${label} · ${event.at}`);
      drawEvent(pdf, event, section === "audit", true);
    });
  }
}

function drawEvent(
  pdf: PermitPdfDocument,
  event: PermitReportEvent,
  showReference: boolean,
  headed = false,
): void {
  const change = [event.fromStatus, event.toStatus]
    .filter(Boolean)
    .join(" to ");
  if (!headed) {
    pdf.fieldPair(
      ["When", event.at],
      ["Action", event.action.replace(/_/g, " ")],
    );
  }
  pdf.fieldPair(
    ["Name", event.actor],
    ["Role", event.role ? readable(event.role) : "Not recorded"],
  );
  if (change) pdf.field("Status change", readable(change));
  if (event.comment) pdf.field("Comment", event.comment);
  if (event.signature) pdf.field("Signature", "Electronically signed");
  if (showReference) pdf.field("Record", event.id);
}

function readable(value: string): string {
  return value.replace(/[_-]+/g, " ");
}

function attachmentLine(file: PermitReport["attachments"][number]): string {
  const size = `${Math.max(1, Math.round(file.fileSize / 1024))} KB`;
  return [
    file.fileName,
    file.contentType,
    size,
    file.uploadedBy,
    file.uploadedAt,
  ]
    .filter(Boolean)
    .join(" · ");
}
