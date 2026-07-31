import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { BILLING_ADMIN_ROLES, BILLING_READ_ROLES } from './billing.constants';
import { CreateSubscriptionDto, PlanChangeDto } from './dto/billing.dto';
import { PlanChangeService } from './plan-change.service';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly planChanges: PlanChangeService,
  ) {}

  @Roles(...BILLING_READ_ROLES)
  @Get('plans')
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Roles(...BILLING_READ_ROLES)
  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.getCurrent(user);
  }

  @Roles(...BILLING_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.create(dto, user);
  }

  @Roles(...BILLING_ADMIN_ROLES)
  @Post('change-plan')
  changePlan(@Body() dto: PlanChangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.planChanges.changePlan(dto, user);
  }

  @Roles(...BILLING_READ_ROLES)
  @Get('plan-changes')
  listPlanChanges(@CurrentUser() user: AuthenticatedUser) {
    return this.planChanges.listHistory(user);
  }
}
