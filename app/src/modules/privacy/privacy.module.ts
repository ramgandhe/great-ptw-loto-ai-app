import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ConsentService } from './consent.service';
import { KeyService } from './key.service';
import { PersonalDataService } from './personal-data.service';
import { TenantKeyService } from './tenant-key.service';

// KeyService and TenantKeyService are not exported: nothing outside this module can decrypt (NFR-SEC-003).
@Module({
  imports: [AccessModule],
  providers: [KeyService, TenantKeyService, ConsentService, PersonalDataService],
  exports: [ConsentService, PersonalDataService],
})
export class PrivacyModule {}
