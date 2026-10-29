import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RecordZveVerificationDto } from './dto/zero-energy-verification.dto';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';
import { ZveVerificationService } from './zve-verification.service';

@Controller('lototo/certificates/:id/verifications')
export class ZveVerificationController {
  constructor(private readonly zveService: ZveVerificationService) {}

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'safety-officer')
  @Post()
  recordVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordZveVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.zveService.recordVerification(id, dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get()
  getVerifications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.zveService.getVerificationsForCertificate(id, user);
  }
}
