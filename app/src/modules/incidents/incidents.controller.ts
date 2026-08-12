import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  CreateIncidentDto,
  HodDecisionDto,
  UpdateIncidentDto,
  UploadIncidentEvidenceDto,
} from './dto/incident.dto';
import {
  INCIDENT_HOD_DECISION_ROLES,
  INCIDENT_READ_ROLES,
  INCIDENT_REPORT_ROLES,
  MAX_INCIDENT_EVIDENCE_SIZE_BYTES,
} from './incidents.constants';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Roles(...INCIDENT_REPORT_ROLES)
  @Post()
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.create(dto, user);
  }

  @Roles(...INCIDENT_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.list(user);
  }

  @Roles(...INCIDENT_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.findOne(id, user);
  }

  @Roles(...INCIDENT_REPORT_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.update(id, dto, user);
  }

  @Roles(...INCIDENT_REPORT_ROLES)
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.submit(id, user);
  }

  @Roles(...INCIDENT_HOD_DECISION_ROLES)
  @Post(':id/hod-decision')
  recordHodDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HodDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.recordHodDecision(id, dto, user);
  }

  @Roles(...INCIDENT_REPORT_ROLES)
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_INCIDENT_EVIDENCE_SIZE_BYTES },
    }),
  )
  uploadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
    @Body() dto: UploadIncidentEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.uploadEvidence(id, file, dto, user);
  }

  @Roles(...INCIDENT_READ_ROLES)
  @Get(':id/evidence')
  listEvidence(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.listEvidence(id, user);
  }
}
