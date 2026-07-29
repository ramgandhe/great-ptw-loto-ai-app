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
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { ChecklistService } from './checklist.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreatePpeDto } from './dto/create-ppe.dto';
import { PpeService } from './ppe.service';

@Controller('ppe-configurations')
export class PpeConfigurationAliasController {
  constructor(private readonly ppeService: PpeService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreatePpeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ppeService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.ppeService.findAll(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePpeDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ppeService.update(id, dto, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ppeService.remove(id, user);
  }
}

@Controller('safety-checklists')
export class SafetyChecklistAliasController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.listSummaries(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateChecklistDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistService.update(id, dto, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.archive(id, user);
  }
}
