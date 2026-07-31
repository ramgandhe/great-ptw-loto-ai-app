import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AnalyticsService } from './analytics.service';
import { DASHBOARD_ANALYTICS_ROLES } from './dashboards.constants';
import { AnalyticsQueryDto, AnalyticsTrendsQueryDto } from './dto/dashboard.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(...DASHBOARD_ANALYTICS_ROLES)
  @Get()
  getAnalytics(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getAnalytics(user, query);
  }

  @Roles(...DASHBOARD_ANALYTICS_ROLES)
  @Get('trends')
  getTrends(@Query() query: AnalyticsTrendsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getTrends(user, query);
  }
}
