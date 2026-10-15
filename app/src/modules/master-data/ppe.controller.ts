import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ForceQuery } from '../../common/decorators/force-query.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { CreatePpeDto, PpeCategoryNameDto } from './dto/create-ppe.dto';
import { PpeService } from './ppe.service';

@Controller('ppe')
export class PpeController {
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
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ForceQuery() force: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ppeService.remove(id, user, force);
  }
}

@Controller('ppe-categories')
export class PpeCategoryController {
  constructor(private readonly ppeService: PpeService) {}

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ppeService.listCategories(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() body: PpeCategoryNameDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ppeService.createCategory(body.name, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PpeCategoryNameDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ppeService.updateCategory(id, body.name, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ForceQuery() force: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ppeService.deleteCategory(id, user, force);
  }
}
