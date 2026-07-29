import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { CreateWorkstationDto } from './dto/create-workstation.dto';
import { WorkstationService } from './workstation.service';

@Controller('workstations')
export class WorkstationController {
  constructor(private readonly workstationService: WorkstationService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateWorkstationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workstationService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workstationService.findAll(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateWorkstationDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workstationService.update(id, dto, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workstationService.remove(id, user);
  }
}
