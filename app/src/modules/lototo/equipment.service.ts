import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { equipmentEnergySources } from '../../database/schema';
import { EnergySourceDto } from './dto/add-isolation-point.dto';

@Injectable()
export class EquipmentService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async resolveEnergySourceId(
    planId: string,
    machineryId: string,
    userId: string,
    equipmentEnergySourceId?: string,
    energySource?: EnergySourceDto,
  ): Promise<string | undefined> {
    if (equipmentEnergySourceId) {
      const [existing] = await this.db
        .select()
        .from(equipmentEnergySources)
        .where(
          and(
            eq(equipmentEnergySources.id, equipmentEnergySourceId),
            eq(equipmentEnergySources.planId, planId),
          ),
        );

      if (!existing) {
        throw new ConflictException('Equipment energy source not found on this plan');
      }

      return existing.id;
    }

    if (!energySource) {
      return undefined;
    }

    const [existing] = await this.db
      .select()
      .from(equipmentEnergySources)
      .where(
        and(
          eq(equipmentEnergySources.planId, planId),
          eq(equipmentEnergySources.machineryId, machineryId),
          eq(equipmentEnergySources.energySourceType, energySource.energySourceType),
        ),
      );

    if (existing) {
      const [updated] = await this.db
        .update(equipmentEnergySources)
        .set({
          description: energySource.description,
          lockMethod: energySource.lockMethod,
          tagType: energySource.tagType,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(equipmentEnergySources.id, existing.id))
        .returning();

      return updated.id;
    }

    const [created] = await this.db
      .insert(equipmentEnergySources)
      .values({
        planId,
        machineryId,
        energySourceType: energySource.energySourceType,
        description: energySource.description,
        lockMethod: energySource.lockMethod,
        tagType: energySource.tagType,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return created.id;
  }
}
