import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationPoints,
  lototoPlans,
  machineryCatalogue,
  workstationCatalogue,
} from '../../database/schema';
import { LOTOTO_EDITABLE_STATUSES } from './lototo.constants';

@Injectable()
export class LototoValidationService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  async getPlan(planId: string, tenantId: string) {
    const [plan] = await this.db
      .select()
      .from(lototoPlans)
      .where(and(eq(lototoPlans.id, planId), eq(lototoPlans.tenantId, tenantId)));

    if (!plan) {
      throw new NotFoundException('LOTOTO plan not found');
    }

    return plan;
  }

  async getEditablePlan(planId: string, tenantId: string) {
    const plan = await this.getPlan(planId, tenantId);

    if (!LOTOTO_EDITABLE_STATUSES.includes(plan.status as (typeof LOTOTO_EDITABLE_STATUSES)[number])) {
      throw new ConflictException('LOTOTO plan configuration is locked once execution has begun');
    }

    return plan;
  }

  async assertMachineryExists(tenantId: string, machineryId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(machineryCatalogue)
      .where(
        and(eq(machineryCatalogue.id, machineryId), eq(machineryCatalogue.tenantId, tenantId)),
      );

    if (!row) {
      throw new NotFoundException('Machinery not found for this tenant');
    }
  }

  async assertWorkstationExists(tenantId: string, workstationId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(workstationCatalogue)
      .where(
        and(
          eq(workstationCatalogue.id, workstationId),
          eq(workstationCatalogue.tenantId, tenantId),
        ),
      );

    if (!row) {
      throw new NotFoundException('Workstation not found for this tenant');
    }
  }

  async assertIsolationNumberAvailable(
    planId: string,
    isolationNumber: string,
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(isolationPoints)
      .where(
        and(
          eq(isolationPoints.planId, planId),
          eq(isolationPoints.isolationNumber, isolationNumber),
        ),
      );

    if (existing) {
      throw new ConflictException(
        `Isolation number '${isolationNumber}' already exists on this plan`,
      );
    }
  }

  assertSequenceStepsValid(
    steps: { isolationPointId: string; sequenceOrder: number }[],
  ): void {
    const orders = steps.map((step) => step.sequenceOrder);
    const points = steps.map((step) => step.isolationPointId);

    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Isolation sequence order values must be unique');
    }

    if (new Set(points).size !== points.length) {
      throw new BadRequestException('Each isolation point may appear only once in the sequence');
    }
  }
}
