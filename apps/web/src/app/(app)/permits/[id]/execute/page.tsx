import { redirect } from "next/navigation";

export default async function ExecutePermitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/execution/${id}`);
}
