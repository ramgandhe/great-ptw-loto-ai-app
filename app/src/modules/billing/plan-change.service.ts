import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PlanChangeDto } from './dto/billing.dto';
import { SubscriptionService } from './subscription.service';

/** Thin facade for plan change history / mutations (FR-BIL-001). */
@Injectable()
export class PlanChangeService {
  constructor(private readonly subscriptions: SubscriptionService) {}

  changePlan(dto: PlanChangeDto, user: AuthenticatedUser) {
    return this.subscriptions.changePlan(dto, user);
  }

  listHistory(user: AuthenticatedUser) {
    return this.subscriptions.listPlanChanges(user);
  }
}
