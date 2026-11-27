import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import { PlatformDefaultsController } from './platform-defaults.controller';
import { PlatformDefaultsService } from './platform-defaults.service';
import {
  AccessRequestsController,
  PlatformAccessRequestsController,
  PlatformIndustriesController,
  PlatformPostalLookupController,
  PlatformTenantInvitesController,
  PlatformTenantsController,
} from './platform-tenants.controller';
import { PlatformAccessRequestsService } from './platform-access-requests.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { PostalLookupService } from './postal-lookup.service';

@Module({
  imports: [KeycloakAdminModule],
  controllers: [
    PlatformTenantsController,
    PlatformIndustriesController,
    PlatformTenantInvitesController,
    AccessRequestsController,
    PlatformAccessRequestsController,
    PlatformPostalLookupController,
    PlatformDefaultsController,
  ],
  providers: [PlatformTenantsService, PlatformAccessRequestsService, PlatformDefaultsService, PostalLookupService],
})
export class PlatformModule {}
