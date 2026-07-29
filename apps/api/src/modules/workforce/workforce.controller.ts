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
import { WORKFORCE_READ_ROLES, WORKFORCE_WRITE_ROLES } from './workforce.constants';
import {
  AssignRoleDto,
  CreateCompetencyDto,
  CreateWorkforceDto,
  UpdateCompetencyDto,
  UpdateWorkforceDto,
} from './dto/workforce.dto';
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
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.archiveEmployee(id, user);
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
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.archiveContractor(id, user);
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
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workforceService.archiveAgency(id, user);
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

@Controller('users')
export class UserRoleController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Roles(...WORKFORCE_WRITE_ROLES)
  @Post(':id/roles')
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workforceService.assignRole(id, dto, user);
  }
}
