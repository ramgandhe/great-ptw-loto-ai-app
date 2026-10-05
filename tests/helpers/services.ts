import { ConfigService } from '@nestjs/config';
import { PermissionService } from '../../app/src/modules/access/permission.service';
import { AuditWriter } from '../../app/src/modules/audit/audit-writer';
import { ConsentService } from '../../app/src/modules/privacy/consent.service';
import { KeyService } from '../../app/src/modules/privacy/key.service';
import { TenantKeyService } from '../../app/src/modules/privacy/tenant-key.service';

export const keyServiceConfig: Record<string, string> = {
  'keyService.url': process.env.KEY_SERVICE_URL ?? 'http://localhost:8200',
  'keyService.token': process.env.KEY_SERVICE_TOKEN ?? 'dev-only-token',
  'keyService.keyName': process.env.KEY_SERVICE_KEY_NAME ?? 'ptw-master',
};

export const configFrom = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services(keyConfig: Record<string, string> = keyServiceConfig) {
  const permissions = new PermissionService();
  const audit = new AuditWriter();
  const keys = new KeyService(configFrom(keyConfig));
  const tenantKeys = new TenantKeyService(keys);
  const consent = new ConsentService(permissions, audit);
  return { permissions, audit, keys, tenantKeys, consent };
}
