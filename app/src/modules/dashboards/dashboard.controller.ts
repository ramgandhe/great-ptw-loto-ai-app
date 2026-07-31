import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DashboardService } from './dashboard.service';
import { DASHBOARD_READ_ROLES } from './dashboards.constants';
import { DashboardFilterDto, KPIFilterDto } from './dto/dashboard.dto';
import { KpiService } from './kpi.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly kpiService: KpiService,
  ) {}

  @Roles(...DASHBOARD_READ_ROLES)
  @Get()
  getDashboard(@Query() query: DashboardFilterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getDashboard(user, query.kind);
  }

  @Roles(...DASHBOARD_READ_ROLES)
  @Get('kpis')
  getKpis(@Query() query: KPIFilterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kpiService.getKpis(user, query);
  }
}
