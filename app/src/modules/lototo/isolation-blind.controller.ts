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
import {
  CreateBlindDto,
  RecordBlindInstallDto,
  RecordBlindRemovalDto,
} from './dto/isolation-blind.dto';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';
import { IsolationBlindService } from './isolation-blind.service';

@Controller('lototo')
export class IsolationBlindController {
  constructor(private readonly blindService: IsolationBlindService) {}

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/blinds')
  createBlind(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBlindDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blindService.createBlind(id, dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('certificates/:id/blinds')
  getBlinds(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blindService.getBlindsForCertificate(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('blinds/:blindId/install')
  recordInstallation(
    @Param('blindId', ParseUUIDPipe) blindId: string,
    @Body() dto: RecordBlindInstallDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blindService.recordInstallation(blindId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'safety-officer')
  @Post('blinds/:blindId/remove')
  recordRemoval(
    @Param('blindId', ParseUUIDPipe) blindId: string,
    @Body() dto: RecordBlindRemovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blindService.recordRemoval(blindId, dto, user);
  }
}
