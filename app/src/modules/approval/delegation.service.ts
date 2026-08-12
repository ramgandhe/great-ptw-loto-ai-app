import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { approvalDelegations } from '../../database/schema';

@Injectable()
export class DelegationService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async findActiveDelegation(
    tenantId: string,
    delegateId: string,
    requiredRole: string,
    at: Date = new Date(),
  ) {
    const [row] = await this.db
      .select()
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.tenantId, tenantId),
          eq(approvalDelegations.delegateId, delegateId),
          eq(approvalDelegations.role, requiredRole),
          lte(approvalDelegations.validFrom, at),
          gte(approvalDelegations.validTo, at),
        ),
      )
      .limit(1);

    return row ?? null;
  }
}
