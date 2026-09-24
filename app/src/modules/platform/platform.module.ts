import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import {
  PlatformTenantInvitesController,
  PlatformTenantsController,
} from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';

@Module({
  imports: [KeycloakAdminModule],
  controllers: [PlatformTenantsController, PlatformTenantInvitesController],
  providers: [PlatformTenantsService],
})
export class PlatformModule {}
