"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { certificateStatusLabel, type IsolationCertificate, type IsolationCertificatePoint } from "@/lib/lototo/certificates";
import { ENERGY_SOURCE_OPTIONS } from "@/lib/lototo/form-options";
import { ISOLATION_METHODS, PROOF_LABELS } from "@/lib/lototo/point-fields";

function energyLabel(point: IsolationCertificatePoint) {
  if (point.energyType === "other" && point.energyOtherText) return point.energyOtherText;
  return ENERGY_SOURCE_OPTIONS.find((item) => item.value === point.energyType)?.label ?? point.energyType;
}

function methodLabel(value: string | null) {
  return ISOLATION_METHODS.find((item) => item.value === value)?.label ?? value ?? "";
}

function printKind(kind: "sheet" | "tags") {
  document.documentElement.dataset.print = kind;
  window.print();
  window.setTimeout(() => {
    delete document.documentElement.dataset.print;
  }, 500);
}

export function IsolationPrintButtons({ points }: { points: IsolationCertificatePoint[] }) {
  const tagged = points.some((point) => point.lockNumber || point.tagNumber);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => printKind("sheet")}>
        <Printer aria-hidden />
        Print sheet
      </Button>
      <Button type="button" variant="outline" disabled={!tagged} onClick={() => printKind("tags")}>
        <Printer aria-hidden />
        Print danger tags
      </Button>
    </>
  );
}

export function IsolationPrint({
  certificate,
  points,
  place,
}: {
  certificate: IsolationCertificate;
  points: IsolationCertificatePoint[];
  place: string;
}) {
  const tagged = points.filter((point) => point.lockNumber || point.tagNumber);
  return (
    <>
      <article className="isolation-sheet hidden print:block">
        <h1 className="font-heading text-2xl font-semibold">{certificate.title}</h1>
        <p className="mt-1 text-sm">
          {certificate.certificateNumber}
          {place ? ` · ${place}` : ""} · {certificateStatusLabel(certificate.status)}
        </p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Point", "Energy", "Method", "Lock", "Tag", "Proof"].map((heading) => (
                <th key={heading} className="border border-border px-2 py-1 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => {
              const passed = point.proofs.some((proof) => proof.result === "pass");
              return (
                <tr key={point.id}>
                  <td className="border border-border px-2 py-1">{point.pointCode}</td>
                  <td className="border border-border px-2 py-1">{energyLabel(point)}{point.magnitude ? ` · ${point.magnitude}` : ""}</td>
                  <td className="border border-border px-2 py-1">{methodLabel(point.method)}</td>
                  <td className="border border-border px-2 py-1">{point.lockNumber || ""}</td>
                  <td className="border border-border px-2 py-1">{point.tagNumber || ""}</td>
                  <td className="border border-border px-2 py-1">
                    {PROOF_LABELS[point.proof] ?? point.proof}
                    {passed ? " · passed" : ""}
                    {point.restoredAt ? " · restored" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
      <div className="danger-tags hidden print:grid print:grid-cols-2 print:gap-4">
        {tagged.map((point) => (
          <article key={point.id} className="break-inside-avoid border-2 border-foreground p-4">
            <p className="text-sm font-semibold tracking-wide">DANGER</p>
            <h2 className="mt-1 font-heading text-xl font-semibold">Do not operate</h2>
            <p className="mt-3 text-sm">{point.pointCode}{point.device ? ` · ${point.device}` : ""}</p>
            <p className="text-sm">{energyLabel(point)}{point.magnitude ? ` · ${point.magnitude}` : ""}</p>
            <p className="mt-2 text-sm">Lock {point.lockNumber || "—"}</p>
            <p className="text-sm">Tag {point.tagNumber || "—"}</p>
            <p className="mt-3 text-sm">{certificate.certificateNumber}</p>
            <p className="mt-2 text-xs break-all">
              Signed-in link: /lototo/certificates/{certificate.id}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
