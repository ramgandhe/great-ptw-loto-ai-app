/** Parent map: location id → parent id, or null at the top of a site. */

export function createsCycle(
  locationId: string,
  newParentId: string | null,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  if (!newParentId) {
    return false;
  }
  if (newParentId === locationId) {
    return true;
  }
  const seen = new Set<string>();
  let current: string | null = newParentId;
  while (current) {
    if (current === locationId || seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}

export function descendantIds(
  rootId: string,
  parentOf: ReadonlyMap<string, string | null>,
): string[] {
  const children = new Map<string, string[]>();
  for (const [id, parentId] of parentOf) {
    if (!parentId) continue;
    const list = children.get(parentId) ?? [];
    list.push(id);
    children.set(parentId, list);
  }
  const out: string[] = [];
  const stack = [...(children.get(rootId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export interface ResolvedApprovers {
  userIds: string[];
  /** Ancestor that owns the list. Null when this location has its own approvers. */
  inheritedFrom: string | null;
}

/** First location from `startId` upward that has its own approver list. */
export function resolveApprovers(
  startId: string,
  parentOf: ReadonlyMap<string, string | null>,
  approversOf: ReadonlyMap<string, readonly string[]>,
): ResolvedApprovers {
  const seen = new Set<string>();
  let current: string | null = startId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const own = approversOf.get(current) ?? [];
    if (own.length > 0) {
      return {
        userIds: [...own],
        inheritedFrom: current === startId ? null : current,
      };
    }
    current = parentOf.get(current) ?? null;
  }
  return { userIds: [], inheritedFrom: null };
}

/**
 * An approver with no assignment sees every location.
 * An assigned approver sees locations that resolve to them, and locations
 * with nobody assigned (any approver may take those).
 */
export function approverLocationScope(
  userId: string,
  parentOf: ReadonlyMap<string, string | null>,
  approversOf: ReadonlyMap<string, readonly string[]>,
): { allLocations: boolean; locationIds: string[] } {
  let assigned = false;
  for (const ids of approversOf.values()) {
    if (ids.includes(userId)) {
      assigned = true;
      break;
    }
  }
  if (!assigned) {
    return { allLocations: true, locationIds: [] };
  }
  const locationIds: string[] = [];
  for (const id of parentOf.keys()) {
    const resolved = resolveApprovers(id, parentOf, approversOf);
    if (resolved.userIds.length === 0 || resolved.userIds.includes(userId)) {
      locationIds.push(id);
    }
  }
  return { allLocations: false, locationIds };
}

export function placePath(
  locationId: string,
  siteName: string,
  nameOf: ReadonlyMap<string, string>,
  parentOf: ReadonlyMap<string, string | null>,
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: string | null = locationId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const name = nameOf.get(current);
    if (name) names.push(name);
    current = parentOf.get(current) ?? null;
  }
  return [siteName, ...names.reverse()].join(' › ');
}
