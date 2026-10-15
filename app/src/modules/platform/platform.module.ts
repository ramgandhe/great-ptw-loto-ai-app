import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import { PlatformDefaultsController } from './platform-defaults.controller';
import { PlatformDefaultsService } from './platform-defaults.service';
import {
  AccessRequestsController,
  PlatformAccessRequestsController,
  PlatformIndustriesController,
  PlatformTenantInvitesController,
  PlatformTenantsController,
} from './platform-tenants.controller';
import { PlatformAccessRequestsService } from './platform-access-requests.service';
import { PlatformTenantsService } from './platform-tenants.service';

@Module({
  imports: [KeycloakAdminModule],
  controllers: [
    PlatformTenantsController,
    PlatformIndustriesController,
    PlatformTenantInvitesController,
    AccessRequestsController,
    PlatformAccessRequestsController,
    PlatformDefaultsController,
  ],
  providers: [PlatformTenantsService, PlatformAccessRequestsService, PlatformDefaultsService],
})
export class PlatformModule {}
