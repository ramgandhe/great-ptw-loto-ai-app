import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ApplyCertificatePointDto,
  CreateIsolationCertificateDto,
  RecordPointProofDto,
  TransitionIsolationCertificateDto,
  UpdateIsolationCertificateDto,
} from './dto/isolation-certificate.dto';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';
import { IsolationCertificateService } from './isolation-certificate.service';

@Controller('lototo/certificates')
export class IsolationCertificateController {
  constructor(private readonly certificateService: IsolationCertificateService) {}

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post()
  create(@Body() dto: CreateIsolationCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.certificateService.create(dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('discipline') discipline?: string,
    @Query('workLocationId') workLocationId?: string,
    @Query('assetId') assetId?: string,
    @Query('isLongTerm') isLongTerm?: string,
  ) {
    return this.certificateService.findAll(user, {
      status,
      discipline,
      workLocationId,
      assetId,
      isLongTerm: isLongTerm !== undefined ? isLongTerm === 'true' : undefined,
    });
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificateService.findOne(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIsolationCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.update(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'safety-officer')
  @Patch(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionIsolationCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.transition(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post(':id/points/:pointId/apply')
  applyPoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @Body() dto: ApplyCertificatePointDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.applyPoint(id, pointId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'safety-officer')
  @Post(':id/points/:pointId/proofs')
  recordProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @Body() dto: RecordPointProofDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.recordProof(id, pointId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post(':id/points/:pointId/restore')
  restorePoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.restorePoint(id, pointId, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get(':id/permits')
  getAttachedPermits(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.getAttachedPermits(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post(':id/permits/:permitId')
  attachPermit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.attachPermit(id, permitId, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Delete(':id/permits/:permitId')
  detachPermit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificateService.detachPermit(id, permitId, user);
  }
}
