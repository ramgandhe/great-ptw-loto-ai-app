import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { CreateGasTestingDto } from './dto/create-gas-testing.dto';
import { UpdateGasTestingDto } from './dto/update-gas-testing.dto';
import { GasTestingService } from './gas-testing.service';

@Controller('gas-testing')
export class GasTestingController {
  constructor(private readonly gasTestingService: GasTestingService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateGasTestingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.gasTestingService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('workstationId') workstationId?: string) {
    return this.gasTestingService.findAll(user, workstationId);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGasTestingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gasTestingService.update(id, dto, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.gasTestingService.remove(id, user);
  }
}
