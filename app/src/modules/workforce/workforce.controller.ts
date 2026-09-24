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
import { PERMIT_CREATE_ROLES, PERMIT_EXECUTOR_CANDIDATE_ROLES, PERMIT_READ_ROLES } from '../permit/permit.constants';
import { WORKFORCE_READ_ROLES, WORKFORCE_WRITE_ROLES } from './workforce.constants';
import {
  AssignRoleDto,
  CreateCompetencyDto,
  CreateTenantUserDto,
  CreateWorkforceDto,
  UpdateCompetencyDto,
  UpdateTenantUserDto,
  UpdateWorkforceDto,
} from './dto/workforce.dto';
import { TenantUsersService } from './tenant-users.service';
import { WorkforceService } from './workforce.service';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.listEmployees(user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateWorkforceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.createEmployee(dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkforceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workforceService.updateEmployee(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deactivateEmployee(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.reactivateEmployee(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deleteEmployee(id, user);
  }
}

@Controller('contractors')
export class ContractorController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.listContractors(user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateWorkforceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.createContractor(dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkforceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workforceService.updateContractor(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deactivateContractor(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.reactivateContractor(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deleteContractor(id, user);
  }
}

@Controller('agencies')
export class AgencyController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.listAgencies(user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateWorkforceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.createAgency(dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkforceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workforceService.updateAgency(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deactivateAgency(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.reactivateAgency(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.deleteAgency(id, user);
  }
}

@Controller('competencies')
export class CompetencyController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.listCompetencies(user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateCompetencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.createCompetency(dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompetencyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workforceService.updateCompetency(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.archiveCompetency(id, user);
  }
}

@Controller('workforce')
export class WorkforceDirectoryController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.listDirectory(user);
  }
}

@Controller('tenant-users')
export class TenantUsersController {
  constructor(private readonly tenantUsersService: TenantUsersService) {}

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.list(user);
  }

  @Roles(...PERMIT_READ_ROLES)
  @Get('names')
  listNames(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.listNames(user);
  }

  @Roles(...PERMIT_EXECUTOR_CANDIDATE_ROLES)
  @Get('executors')
  listExecutors(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.listExecutors(user);
  }

  @Roles(...PERMIT_CREATE_ROLES)
  @Get('viewers')
  listViewers(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.listViewers(user);
  }

  @Roles(...PERMIT_EXECUTOR_CANDIDATE_ROLES)
  @Get('safety-officers')
  listSafetyOfficers(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.listSafetyOfficers(user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateTenantUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.create(dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenantUsersService.updateRole(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Patch(':id')
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenantUsersService.updateProfile(id, dto, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.deactivate(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.reactivate(id, user);
  }

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantUsersService.remove(id, user);
  }
}
