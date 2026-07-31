import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { BILLING_ADMIN_ROLES, BILLING_READ_ROLES } from './billing.constants';
import { BillingService, UsageTrackingService } from './billing.service';
import { ListInvoicesQueryDto, UsageRecordDto } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageTracking: UsageTrackingService,
  ) {}

  @Roles(...BILLING_READ_ROLES)
  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billingService.listInvoices(user, query);
  }

  @Roles(...BILLING_READ_ROLES)
  @Get('usage')
  listUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.usageTracking.list(user);
  }

  @Roles(...BILLING_ADMIN_ROLES)
  @Post('usage')
  recordUsage(@Body() dto: UsageRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usageTracking.upsert(dto, user);
  }
}
