export function permitReportFileNameFromDisposition(header: string | null): string {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  const name = match?.[1]?.replace(/[^A-Za-z0-9.-]+/g, "") ?? "";
  return name.endsWith(".pdf") ? name : "permit-report.pdf";
}
