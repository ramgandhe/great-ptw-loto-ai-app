import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DASHBOARD_REPORT_ROLES } from './dashboards.constants';
import { ListReportsQueryDto, ReportRequestDto } from './dto/dashboard.dto';
import { ReportingService } from './reporting.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Roles(...DASHBOARD_REPORT_ROLES)
  @Get()
  list(@Query() query: ListReportsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportingService.list(user, query);
  }

  @Roles(...DASHBOARD_REPORT_ROLES)
  @Post('generate')
  generate(@Body() dto: ReportRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportingService.generate(dto, user);
  }
}
