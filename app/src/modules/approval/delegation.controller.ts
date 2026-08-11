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
import { APPROVAL_ACTION_ROLES } from './approval.constants';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { DelegationService } from './delegation.service';

@Controller('approvals/delegations')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Roles(...APPROVAL_ACTION_ROLES)
  @Post()
  create(@Body() dto: CreateDelegationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.delegationService.create(dto, user);
  }

  @Roles(...APPROVAL_ACTION_ROLES)
  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.delegationService.listMine(user);
  }

  @Roles(...APPROVAL_ACTION_ROLES)
  @Post(':id/revoke')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.delegationService.revoke(id, user);
  }
}
