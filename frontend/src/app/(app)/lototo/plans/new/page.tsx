import { redirect } from "next/navigation";

/** New plans are created in place on the LOTOTO page; links from machinery and permits still land there. */
export default async function NewLototoPlanPage({ searchParams }: { searchParams: Promise<{ machineryId?: string }> }) {
  const { machineryId } = await searchParams;
  redirect(`/lototo?new=1${machineryId ? `&machineryId=${encodeURIComponent(machineryId)}` : ""}`);
}
