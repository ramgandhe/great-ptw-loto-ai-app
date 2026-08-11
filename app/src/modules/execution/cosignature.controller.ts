import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EXECUTION_READ_ROLES } from './execution.constants';
import { CosignatureService } from './cosignature.service';
import { CreateCosignatureDto } from './dto/create-cosignature.dto';

@Controller('permits')
export class CosignatureController {
  constructor(private readonly cosignatureService: CosignatureService) {}

  @Roles('supervisor')
  @Post(':id/cosignatures')
  cosign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCosignatureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cosignatureService.cosign(id, dto, user);
  }

  @Roles(...EXECUTION_READ_ROLES)
  @Get(':id/cosignatures')
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cosignatureService.listForPermit(id, user);
  }
}
