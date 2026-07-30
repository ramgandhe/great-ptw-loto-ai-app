import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MASTER_DATA_READ_ROLES, MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { CreatePermitTypeDto } from './dto/create-permit-type.dto';
import { PermitTypeService } from './permit-type.service';

@Controller('permit-types')
export class PermitTypeController {
  constructor(private readonly permitTypeService: PermitTypeService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreatePermitTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permitTypeService.create(dto, user);
  }

  @Roles(...MASTER_DATA_READ_ROLES)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.permitTypeService.findAll(user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.permitTypeService.remove(id, user);
  }
}
