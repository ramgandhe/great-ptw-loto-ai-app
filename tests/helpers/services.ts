import { PermissionService } from '../../app/src/modules/access/permission.service';

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services() {
  const permissions = new PermissionService();
  return { permissions };
}
