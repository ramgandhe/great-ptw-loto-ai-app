import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ConsentService } from './consent.service';
import { KeyService } from './key.service';
import { PersonalDataService } from './personal-data.service';
import { TenantKeyService } from './tenant-key.service';

// NFR-SEC-003. Dependency injection: KeyService and TenantKeyService are not exported, so no other module can be
// given them. It does not stop a plain import: a lint rule (no-restricted-imports, app/eslint.config.mjs) refuses
// imports of field-crypto, key.service and tenant-key.service from outside src/modules/privacy.
@Module({
  imports: [AccessModule],
  providers: [KeyService, TenantKeyService, ConsentService, PersonalDataService],
  exports: [ConsentService, PersonalDataService],
})
export class PrivacyModule {}
