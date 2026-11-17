import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  DAY_SECURE_COUNTERSIGN_ROLES,
  DAY_SECURE_WRITE_ROLES,
  HANDOVER_ACCEPT_ROLES,
} from '../revalidation/revalidation.constants';
import { MDP_HANDOVER_ROLES, MDP_READ_ROLES, MDP_WRITE_ROLES } from './daily-progress.constants';
import { DailyProgressService } from './daily-progress.service';
import { DaySecureService } from './day-secure.service';
import { MdpEvidenceService } from './mdp-evidence.service';
import { MorningBriefingService } from './morning-briefing.service';
import {
  CreateShiftHandoverDto,
  DecideShiftHandoverDto,
  RecordDailyProgressDto,
} from './dto/daily-progress.dto';
import { CountersignDaySecureDto, CreateDaySecureDto } from './dto/day-secure.dto';
import { UploadMdpEvidenceDto } from './dto/mdp-evidence.dto';
import { RecordToolboxTalkDto, ReplaceDailyCrewDto } from './dto/morning-briefing.dto';

const MAX_MDP_EVIDENCE_BYTES = 10 * 1024 * 1024;

@Controller('permits/:id')
export class DailyProgressController {
  constructor(
    private readonly dailyProgressService: DailyProgressService,
    private readonly daySecureService: DaySecureService,
    private readonly mdpEvidenceService: MdpEvidenceService,
    private readonly morningBriefingService: MorningBriefingService,
  ) {}

  @Roles(...MDP_WRITE_ROLES)
  @Post('daily-progress')
  recordProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDailyProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.recordDailyProgress(id, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('daily-progress')
  listProgress(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listDailyProgress(id, user);
  }

  @Roles(...MDP_HANDOVER_ROLES)
  @Post('handover')
  createHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShiftHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.createHandover(id, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('handover')
  listHandovers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listHandovers(id, user);
  }

  @Roles(...HANDOVER_ACCEPT_ROLES)
  @Post('handovers/:handoverId/accept')
  acceptHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('handoverId', ParseUUIDPipe) handoverId: string,
    @Body() dto: DecideShiftHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.acceptHandover(id, handoverId, dto, user);
  }

  @Roles(...HANDOVER_ACCEPT_ROLES)
  @Post('handovers/:handoverId/reject')
  rejectHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('handoverId', ParseUUIDPipe) handoverId: string,
    @Body() dto: DecideShiftHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.rejectHandover(id, handoverId, dto, user);
  }

  @Roles(...MDP_HANDOVER_ROLES)
  @Post('handovers/:handoverId/cancel')
  cancelHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('handoverId', ParseUUIDPipe) handoverId: string,
    @Body() dto: DecideShiftHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.cancelHandover(id, handoverId, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('daily-history')
  listHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listActivityHistory(id, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('toolbox-talk')
  getToolboxTalk(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('operationalDate') operationalDate: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.morningBriefingService.getToolboxTalk(id, operationalDate, user);
  }

  @Roles(...MDP_WRITE_ROLES)
  @Post('toolbox-talk')
  recordToolboxTalk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordToolboxTalkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.morningBriefingService.recordToolboxTalk(id, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('daily-crew')
  listDailyCrew(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('operationalDate') operationalDate: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.morningBriefingService.listDailyCrew(id, operationalDate, user);
  }

  @Roles(...MDP_WRITE_ROLES)
  @Post('daily-crew')
  replaceDailyCrew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceDailyCrewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.morningBriefingService.replaceDailyCrew(id, dto, user);
  }

  @Roles(...DAY_SECURE_WRITE_ROLES)
  @Post('day-secures')
  createDaySecure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDaySecureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.daySecureService.createDaySecure(id, dto, user);
  }

  /** Must be registered before :secureId routes. */
  @Roles(...MDP_READ_ROLES)
  @Get('day-secures/checklist-template')
  getDaySecureChecklistTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.daySecureService.getChecklistTemplate(id, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('day-cycle')
  getDayCycle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.daySecureService.getDayCycle(id, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('day-secures')
  listDaySecures(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.daySecureService.listDaySecures(id, user);
  }

  @Roles(...DAY_SECURE_COUNTERSIGN_ROLES)
  @Post('day-secures/:secureId/countersign')
  countersignDaySecure(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('secureId', ParseUUIDPipe) secureId: string,
    @Body() dto: CountersignDaySecureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.daySecureService.countersignDaySecure(id, secureId, dto, user);
  }

  /** FR-MDP-007 / Slice I3–I4: upload MinIO evidence for progress, secure, or reopen. */
  @Roles(...MDP_WRITE_ROLES)
  @Post('mdp-evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_MDP_EVIDENCE_BYTES },
    }),
  )
  uploadMdpEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
    @Body() dto: UploadMdpEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mdpEvidenceService.upload(id, file, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('mdp-evidence')
  listMdpEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('kind') kind: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mdpEvidenceService.list(id, user, kind);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('mdp-evidence/:evidenceId/download-url')
  mdpEvidenceDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mdpEvidenceService.getDownloadUrl(id, evidenceId, user);
  }
}
