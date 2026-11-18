const EMBEDDABLE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const PERMIT_REPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const PERMIT_REPORT_IMAGE_MAX_COUNT = 24;

const MDP_KIND_LABELS: Record<string, string> = {
  daily_progress: 'Daily progress',
  day_secure: 'Day secure',
  reopen: 'Reopen',
};

/** A stored file may be read only when its key is this permit's, with no path escape. */
export function permitReportFileOwned(
  tenantId: string,
  permitId: string,
  storageKey: string,
  extraPrefixes: readonly string[] = [],
): boolean {
  if (!tenantId || !permitId || !storageKey) return false;
  if (storageKey.includes('..') || storageKey.includes('\\') || storageKey.startsWith('/')) return false;
  const roots = ['', ...extraPrefixes].map((prefix) => permitRoot(prefix, tenantId, permitId));
  return roots.some((root) => root !== null && storageKey.startsWith(root));
}

export function mdpEvidenceReportName(file: { kind: string; operationalDate: string | null; fileName: string }): string {
  const kind = MDP_KIND_LABELS[file.kind] ?? file.kind.replace(/_/g, ' ');
  return [kind, file.operationalDate, file.fileName].filter(Boolean).join(' · ');
}

function permitRoot(prefix: string, tenantId: string, permitId: string): string | null {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes('//')) return null;
  return trimmed ? `${trimmed}/${tenantId}/${permitId}/` : `${tenantId}/${permitId}/`;
}

export function canEmbedPermitReportImage(file: { contentType: string; fileSize: number }): boolean {
  const type = file.contentType.split(';')[0].trim().toLowerCase();
  return EMBEDDABLE_IMAGE_TYPES.has(type) && file.fileSize > 0 && file.fileSize <= PERMIT_REPORT_IMAGE_MAX_BYTES;
}
