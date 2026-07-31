import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AssignPersonnelDto } from './dto/assign-personnel.dto';
import { CreateLototoPlanDto } from './dto/create-lototo-plan.dto';
import { LOTOTO_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';
import { LototoService } from './lototo.service';

@Controller('lototo/plans')
export class LototoController {
  constructor(private readonly lototoService: LototoService) {}

  @Roles(...LOTOTO_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateLototoPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lototoService.create(dto, user);
  }

  @Roles(...LOTOTO_READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('permitId') permitId?: string,
  ) {
    return this.lototoService.findAll(user, permitId);
  }

  @Roles(...LOTOTO_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lototoService.findOne(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES)
  @Post(':id/assignments')
  assignPersonnel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPersonnelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lototoService.assignPersonnel(id, dto, user);
  }
}
