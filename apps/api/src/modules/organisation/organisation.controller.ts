import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ORGANISATION_READ_ROLES, ORGANISATION_WRITE_ROLES } from './organisation.constants';
import { CreateOrgEntityDto, UpdateOrgEntityDto } from './dto/org-entity.dto';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';
import { OrganisationService } from './organisation.service';

@Controller('organisations')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listOrganisations(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getOrganisation(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrganisationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createOrganisation(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateOrganisation(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveOrganisation(id, user);
  }
}

@Controller('plants')
export class PlantController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listPlants(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getPlant(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrgEntityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createPlant(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updatePlant(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archivePlant(id, user);
  }
}

@Controller('departments')
export class DepartmentController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listDepartments(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getDepartment(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrgEntityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createDepartment(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateDepartment(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveDepartment(id, user);
  }
}

@Controller('locations')
export class LocationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listLocations(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getLocation(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrgEntityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createLocation(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateLocation(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveLocation(id, user);
  }
}

@Controller('approval-workflows')
export class ApprovalWorkflowController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listWorkflows(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getWorkflow(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrgEntityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createWorkflow(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateWorkflow(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveWorkflow(id, user);
  }
}

@Controller('permit-templates')
export class PermitTemplateController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listTemplates(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getTemplate(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateOrgEntityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.createTemplate(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateTemplate(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveTemplate(id, user);
  }
}

@Controller('notification-preferences')
export class NotificationPreferenceController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.listNotificationPreferences(user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.getNotificationPreference(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(
    @Body() dto: { name: string; channel?: string; eventType?: string; enabled?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.createNotificationPreference(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; channel?: string; eventType?: string; enabled?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationService.updateNotificationPreference(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.archiveNotificationPreference(id, user);
  }
}
