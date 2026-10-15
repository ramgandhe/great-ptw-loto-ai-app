import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ForceQuery } from '../../common/decorators/force-query.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DefaultEnergySourceDto,
  DefaultLocationTypeDto,
  DefaultPermitTypeDto,
  DefaultPpeCategoryDto,
  DefaultPpeItemDto,
} from './dto/platform-defaults.dto';
import { PLATFORM_ADMIN_ROLES } from './platform.constants';
import { PlatformDefaultsService } from './platform-defaults.service';

@Controller('platform/defaults')
@Roles(...PLATFORM_ADMIN_ROLES)
export class PlatformDefaultsController {
  constructor(private readonly defaults: PlatformDefaultsService) {}

  @Get('location-types')
  listLocationTypes() {
    return this.defaults.listLocationTypes();
  }

  @Post('location-types')
  createLocationType(@Body() dto: DefaultLocationTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.defaults.createLocationType(dto, user);
  }

  @Patch('location-types/:id')
  updateLocationType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultLocationTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.defaults.updateLocationType(id, dto, user);
  }

  @Delete('location-types/:id')
  deleteLocationType(@Param('id', ParseUUIDPipe) id: string) {
    return this.defaults.deleteLocationType(id);
  }

  @Get('ppe-categories')
  listPpeCategories() {
    return this.defaults.listPpeCategories();
  }

  @Post('ppe-categories')
  createPpeCategory(@Body() dto: DefaultPpeCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.defaults.createPpeCategory(dto, user);
  }

  @Patch('ppe-categories/:id')
  updatePpeCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultPpeCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.defaults.updatePpeCategory(id, dto, user);
  }

  @Delete('ppe-categories/:id')
  deletePpeCategory(@Param('id', ParseUUIDPipe) id: string, @ForceQuery() force: boolean) {
    return this.defaults.deletePpeCategory(id, force);
  }

  @Get('ppe-items')
  listPpeItems() {
    return this.defaults.listPpeItems();
  }

  @Post('ppe-items')
  createPpeItem(@Body() dto: DefaultPpeItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.defaults.createPpeItem(dto, user);
  }

  @Patch('ppe-items/:id')
  updatePpeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultPpeItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.defaults.updatePpeItem(id, dto, user);
  }

  @Delete('ppe-items/:id')
  deletePpeItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.defaults.deletePpeItem(id);
  }

  @Get('energy-sources')
  listEnergySources() {
    return this.defaults.listEnergySources();
  }

  @Post('energy-sources')
  createEnergySource(@Body() dto: DefaultEnergySourceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.defaults.createEnergySource(dto, user);
  }

  @Patch('energy-sources/:id')
  updateEnergySource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultEnergySourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.defaults.updateEnergySource(id, dto, user);
  }

  @Delete('energy-sources/:id')
  deleteEnergySource(@Param('id', ParseUUIDPipe) id: string) {
    return this.defaults.deleteEnergySource(id);
  }

  @Get('permit-types')
  listPermitTypes() {
    return this.defaults.listPermitTypes();
  }

  @Post('permit-types')
  createPermitType(@Body() dto: DefaultPermitTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.defaults.createPermitType(dto, user);
  }

  @Patch('permit-types/:id')
  updatePermitType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefaultPermitTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.defaults.updatePermitType(id, dto, user);
  }

  @Delete('permit-types/:id')
  deletePermitType(@Param('id', ParseUUIDPipe) id: string) {
    return this.defaults.deletePermitType(id);
  }
}
