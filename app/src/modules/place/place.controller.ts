import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { ForceQuery } from '../../common/decorators/force-query.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ORGANISATION_READ_ROLES, ORGANISATION_WRITE_ROLES } from '../organisation/organisation.constants';
import {
  AddSiteMemberDto,
  CreateAssetDto,
  CreateNamedTypeDto,
  CreateSiteDto,
  CreateWorkLocationDto,
  PutApproversDto,
  UpdateAssetDto,
  UpdateNamedTypeDto,
  UpdateSiteDto,
  UpdateWorkLocationDto,
} from './dto/place.dto';
import { PlaceService } from './place.service';

@Controller('sites')
export class SiteController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('archived') archived?: string) {
    return this.placeService.listSites(user, archived === 'true');
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.getSite(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateSiteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.createSite(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.updateSite(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.archiveSite(id, user);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.listMembers(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post(':id/members')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSiteMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.addMember(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId') userId: string,
    @Query('confirm') confirm: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.removeMember(id, userId, user, confirm === 'true' || confirm === '1');
  }
}

@Controller('location-types')
export class LocationTypeController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('archived') archived?: string) {
    return this.placeService.listLocationTypes(user, archived === 'true');
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateNamedTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.createLocationType(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNamedTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.updateLocationType(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ForceQuery() force: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.deleteLocationType(id, user, force);
  }
}

@Controller('work-locations')
export class WorkLocationController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('siteId') siteId?: string,
    @Query('archived') archived?: string,
  ) {
    if (!siteId) throw new BadRequestException('siteId is required');
    return this.placeService.listWorkLocations(user, siteId, archived === 'true');
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id/approvers/resolved')
  resolved(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.getWorkLocation(id, user).then((row) => row.approvers);
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.getWorkLocation(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateWorkLocationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.createWorkLocation(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.updateWorkLocation(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.archiveWorkLocation(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Put(':id/approvers')
  putApprovers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PutApproversDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.putApprovers(id, dto, user);
  }
}

@Controller('asset-types')
export class AssetTypeController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('archived') archived?: string) {
    return this.placeService.listAssetTypes(user, archived === 'true');
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateNamedTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.createAssetType(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNamedTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.updateAssetType(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ForceQuery() force: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.deleteAssetType(id, user, force);
  }
}

@Controller('assets')
export class AssetController {
  constructor(private readonly placeService: PlaceService) {}

  @Roles(...ORGANISATION_READ_ROLES)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('siteId') siteId?: string,
    @Query('workLocationId') workLocationId?: string,
    @Query('exact') exact?: string,
    @Query('archived') archived?: string,
  ) {
    return this.placeService.listAssets(user, {
      siteId,
      workLocationId,
      exact: exact === 'true',
      archived: archived === 'true',
    });
  }

  @Roles(...ORGANISATION_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.getAsset(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.createAsset(dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.placeService.updateAsset(id, dto, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.placeService.archiveAsset(id, user);
  }

  @Roles(...ORGANISATION_WRITE_ROLES)
  @Post(':id/delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm: string | undefined,
    @Query('deleteLototo') deleteLototo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const yes = (value?: string) => value === 'true' || value === '1';
    return this.placeService.deleteAsset(id, user, yes(confirm), yes(deleteLototo));
  }
}
