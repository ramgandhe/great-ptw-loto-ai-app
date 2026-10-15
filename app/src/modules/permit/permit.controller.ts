import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreatePermitDto } from './dto/create-permit.dto';
import { ReassignPermitPeopleDto } from './dto/reassign-permit-people.dto';
import { RenewPermitDto } from './dto/renew-permit.dto';
import { SubmitPermitDto } from './dto/save-draft.dto';
import { PermitDraftHandoffDto, PermitDraftReturnDto } from './dto/permit-draft-handoff.dto';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_DELETE_ROLES,
  PERMIT_READ_ROLES,
  PERMIT_SUBMIT_ROLES,
  PERMIT_WRITE_ROLES,
} from './permit.constants';
import { PermitService } from './permit.service';

@Controller('permits')
export class PermitController {
  constructor(private readonly permitService: PermitService) {}

  @Roles(...PERMIT_CREATE_ROLES)
  @Post()
  create(@Body() dto: CreatePermitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permitService.create(dto, user);
  }

  @Roles(...PERMIT_READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('siteId') siteId?: string,
    @Query('workLocationId') workLocationId?: string,
  ) {
    return this.permitService.findAll(user, status, siteId, workLocationId);
  }

  @Roles(...PERMIT_READ_ROLES)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.findOne(id, user);
  }

  @Roles(...PERMIT_DELETE_ROLES)
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.removeDraft(id, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/reassign-people')
  reassignPeople(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignPermitPeopleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.reassignPeople(id, dto, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/renew')
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.renewFromExpired(id, dto, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/handoff')
  handoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PermitDraftHandoffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.handoffDraft(id, dto, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/return-draft')
  returnDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PermitDraftReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.returnDraft(id, dto, user);
  }

  @Roles(...PERMIT_SUBMIT_ROLES)
  @Post(':id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.submit(id, dto, user);
  }
}
