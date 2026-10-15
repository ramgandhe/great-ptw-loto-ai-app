import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Authenticated, Public, Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ForceQuery } from '../../common/decorators/force-query.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Throttle } from '@nestjs/throttler';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { CreateTenantDto, IndustryNameDto, UpdateTenantDto } from './dto/create-tenant.dto';
import { PLATFORM_ADMIN_ROLES } from './platform.constants';
import { PlatformAccessRequestsService } from './platform-access-requests.service';
import { PlatformTenantsService } from './platform-tenants.service';

@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Get()
  list() {
    return this.platformTenantsService.listTenants();
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.createTenant(dto, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformTenantsService.updateTenant(id, dto, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Post(':id/disable')
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.disableTenant(id, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Post(':id/enable')
  enable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.enableTenant(id, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.deleteTenant(id, user);
  }
}

@Controller('platform/industries')
export class PlatformIndustriesController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Get()
  list() {
    return this.platformTenantsService.listIndustries();
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Post()
  create(@Body() dto: IndustryNameDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.createIndustry(dto, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IndustryNameDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformTenantsService.updateIndustry(id, dto, user);
  }

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ForceQuery() force: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformTenantsService.deleteIndustry(id, user, force);
  }
}

@Controller('platform/tenant-invites')
export class PlatformTenantInvitesController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Authenticated()
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platformTenantsService.acceptInvite(token, user);
  }

  @Public()
  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.platformTenantsService.getInviteByToken(token);
  }
}

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: PlatformAccessRequestsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateAccessRequestDto) {
    return this.accessRequestsService.create(dto);
  }
}

@Controller('platform/access-requests')
export class PlatformAccessRequestsController {
  constructor(private readonly accessRequestsService: PlatformAccessRequestsService) {}

  @Roles(...PLATFORM_ADMIN_ROLES)
  @Get()
  list() {
    return this.accessRequestsService.list();
  }
}
