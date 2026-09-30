import { ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { permitLototoInstances } from '../../database/schema';

export function isLototoFrozen(instances: Array<{ frozenAt: Date | string | null }>): boolean {
  return instances.some((instance) => instance.frozenAt != null);
}

export function assertLototoWritable(instances: Array<{ frozenAt: Date | string | null }>): void {
  if (isLototoFrozen(instances)) {
    throw new ConflictException(
      'LOTOTO on this permit is frozen after approval and cannot be changed',
    );
  }
}

export async function freezePermitLototo(
  db: Pick<Database, 'update'>,
  permitId: string,
  userId: string,
  frozenAt = new Date(),
): Promise<void> {
  await db
    .update(permitLototoInstances)
    .set({ frozenAt, updatedBy: userId })
    .where(eq(permitLototoInstances.permitId, permitId));
}
