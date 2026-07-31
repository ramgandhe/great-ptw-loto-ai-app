import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MDP_HANDOVER_ROLES, MDP_READ_ROLES, MDP_WRITE_ROLES } from './daily-progress.constants';
import { DailyProgressService } from './daily-progress.service';
import { CreateShiftHandoverDto, RecordDailyProgressDto } from './dto/daily-progress.dto';

@Controller('permits/:id')
export class DailyProgressController {
  constructor(private readonly dailyProgressService: DailyProgressService) {}

  @Roles(...MDP_WRITE_ROLES)
  @Post('daily-progress')
  recordProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordDailyProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.recordDailyProgress(id, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('daily-progress')
  listProgress(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listDailyProgress(id, user);
  }

  @Roles(...MDP_HANDOVER_ROLES)
  @Post('handover')
  createHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShiftHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dailyProgressService.createHandover(id, dto, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('handover')
  listHandovers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listHandovers(id, user);
  }

  @Roles(...MDP_READ_ROLES)
  @Get('daily-history')
  listHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dailyProgressService.listActivityHistory(id, user);
  }
}
