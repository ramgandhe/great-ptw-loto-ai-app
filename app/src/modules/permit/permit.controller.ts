import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreatePermitDto } from './dto/create-permit.dto';
import { PERMIT_READ_ROLES, PERMIT_WRITE_ROLES } from './permit.constants';
import { PermitService } from './permit.service';

@Controller('permits')
export class PermitController {
  constructor(private readonly permitService: PermitService) {}

  @Roles(...PERMIT_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreatePermitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permitService.create(dto, user);
  }

  @Roles(...PERMIT_READ_ROLES)
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.permitService.findAll(user, status);
  }

  @Roles(...PERMIT_READ_ROLES)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.findOne(id, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permitService.submit(id, user);
  }
}
