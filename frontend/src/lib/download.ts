import type { DownloadUrlResult } from "@/lib/closure/api";

export async function openPresignedDownload(
  getUrl: () => Promise<DownloadUrlResult>,
): Promise<void> {
  const { url } = await getUrl();
  window.open(url, "_blank", "noopener,noreferrer");
}
