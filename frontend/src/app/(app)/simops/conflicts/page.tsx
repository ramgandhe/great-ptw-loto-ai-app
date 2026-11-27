import { redirect } from "next/navigation";

/** Folded into the SIMOPS page as a view. */
export default async function ActiveConflictsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  params.set("view", "active");
  if (resolved) {
    for (const [k, v] of Object.entries(resolved)) {
      if (k === "view") continue;
      if (Array.isArray(v)) {
        for (const item of v) params.append(k, item);
      } else if (typeof v === "string") {
        params.set(k, v);
      }
    }
  }
  redirect(`/simops?${params.toString()}`);
}
