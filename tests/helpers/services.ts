import { PermissionService } from '../../app/src/modules/access/permission.service';
import { AuditWriter } from '../../app/src/modules/audit/audit-writer';

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services() {
  const permissions = new PermissionService();
  const audit = new AuditWriter();
  return { permissions, audit };
}
