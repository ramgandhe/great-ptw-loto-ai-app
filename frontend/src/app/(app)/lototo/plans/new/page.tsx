import { redirect } from "next/navigation";

export default async function NewLototoPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ machineryId?: string }>;
}) {
  const { machineryId } = await searchParams;
  redirect(`/lototo/procedures/new${machineryId ? `?machineryId=${encodeURIComponent(machineryId)}` : ""}`);
}
