import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import {
  AccessRequestsController,
  PlatformAccessRequestsController,
  PlatformTenantInvitesController,
  PlatformTenantsController,
} from './platform-tenants.controller';
import { PlatformAccessRequestsService } from './platform-access-requests.service';
import { PlatformTenantsService } from './platform-tenants.service';

@Module({
  imports: [KeycloakAdminModule],
  controllers: [
    PlatformTenantsController,
    PlatformTenantInvitesController,
    AccessRequestsController,
    PlatformAccessRequestsController,
  ],
  providers: [PlatformTenantsService, PlatformAccessRequestsService],
})
export class PlatformModule {}
