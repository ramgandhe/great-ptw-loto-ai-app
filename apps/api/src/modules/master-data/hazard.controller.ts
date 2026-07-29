import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { HazardService } from './hazard.service';

@Controller('hazards')
export class HazardController {
  constructor(private readonly hazardService: HazardService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateHazardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hazardService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.hazardService.findAll(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hazardService.remove(id, user);
  }
}
