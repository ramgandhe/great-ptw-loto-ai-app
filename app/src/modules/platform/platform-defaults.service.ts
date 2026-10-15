import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { throwInUse } from '../../common/http/in-use';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  defaultEnergySources,
  defaultLocationTypes,
  defaultPermitTypes,
  defaultPpeCategories,
  defaultPpeItems,
} from '../../database/schema';
import {
  DefaultEnergySourceDto,
  DefaultLocationTypeDto,
  DefaultPermitTypeDto,
  DefaultPpeCategoryDto,
  DefaultPpeItemDto,
} from './dto/platform-defaults.dto';

function energyCode(name: string): string {
  const ascii = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const slug = ascii.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64);
  return slug || 'source';
}

function blank(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class PlatformDefaultsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  listLocationTypes() {
    return this.db.select().from(defaultLocationTypes).orderBy(asc(defaultLocationTypes.name));
  }

  async createLocationType(dto: DefaultLocationTypeDto, user: AuthenticatedUser) {
    const name = dto.name.trim();
    this.assertLocationName(name);
    await this.assertNameFree(defaultLocationTypes, name);
    const actor = optionalUuid(user.id) ?? null;
    const [row] = await this.db
      .insert(defaultLocationTypes)
      .values({ name, description: blank(dto.description), createdBy: actor, updatedBy: actor })
      .returning();
    return row;
  }

  async updateLocationType(id: string, dto: DefaultLocationTypeDto, user: AuthenticatedUser) {
    await this.getLocationType(id);
    const name = dto.name.trim();
    this.assertLocationName(name);
    await this.assertNameFree(defaultLocationTypes, name, id);
    const [row] = await this.db
      .update(defaultLocationTypes)
      .set({
        name,
        description: blank(dto.description),
        updatedBy: optionalUuid(user.id) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(defaultLocationTypes.id, id))
      .returning();
    return row;
  }

  async deleteLocationType(id: string) {
    await this.getLocationType(id);
    await this.db.delete(defaultLocationTypes).where(eq(defaultLocationTypes.id, id));
    return { id, deleted: true };
  }

  listPpeCategories() {
    return this.db
      .select()
      .from(defaultPpeCategories)
      .orderBy(asc(defaultPpeCategories.isFallback), asc(defaultPpeCategories.name));
  }

  async createPpeCategory(dto: DefaultPpeCategoryDto, user: AuthenticatedUser) {
    const name = dto.name.trim();
    await this.assertNameFree(defaultPpeCategories, name);
    const actor = optionalUuid(user.id) ?? null;
    const [row] = await this.db
      .insert(defaultPpeCategories)
      .values({ name, createdBy: actor, updatedBy: actor })
      .returning();
    return row;
  }

  async updatePpeCategory(id: string, dto: DefaultPpeCategoryDto, user: AuthenticatedUser) {
    await this.getPpeCategory(id);
    const name = dto.name.trim();
    await this.assertNameFree(defaultPpeCategories, name, id);
    const [row] = await this.db
      .update(defaultPpeCategories)
      .set({ name, updatedBy: optionalUuid(user.id) ?? null, updatedAt: new Date() })
      .where(eq(defaultPpeCategories.id, id))
      .returning();
    return row;
  }

  async deletePpeCategory(id: string, force: boolean) {
    const category = await this.getPpeCategory(id);
    if (category.isFallback) {
      throw new BadRequestException('Others is the default PPE category and cannot be removed');
    }
    const items = await this.db
      .select({ code: defaultPpeItems.code, name: defaultPpeItems.name })
      .from(defaultPpeItems)
      .where(eq(defaultPpeItems.categoryId, id))
      .limit(8);
    if (items.length > 0 && !force) {
      throwInUse(items.map((item) => `${item.code} ${item.name} uses this category`));
    }
    if (items.length > 0) {
      const fallback = await this.requirePpeFallback();
      await this.db
        .update(defaultPpeItems)
        .set({ categoryId: fallback.id, updatedAt: new Date() })
        .where(eq(defaultPpeItems.categoryId, id));
    }
    await this.db.delete(defaultPpeCategories).where(eq(defaultPpeCategories.id, id));
    return { id, deleted: true };
  }

  listPpeItems() {
    return this.db
      .select({
        id: defaultPpeItems.id,
        code: defaultPpeItems.code,
        name: defaultPpeItems.name,
        categoryId: defaultPpeItems.categoryId,
        categoryName: defaultPpeCategories.name,
        description: defaultPpeItems.description,
      })
      .from(defaultPpeItems)
      .innerJoin(defaultPpeCategories, eq(defaultPpeItems.categoryId, defaultPpeCategories.id))
      .orderBy(asc(defaultPpeItems.code));
  }

  async createPpeItem(dto: DefaultPpeItemDto, user: AuthenticatedUser) {
    await this.getPpeCategory(dto.categoryId);
    const code = dto.code.trim();
    await this.assertCodeFree(defaultPpeItems, code);
    const actor = optionalUuid(user.id) ?? null;
    const [row] = await this.db
      .insert(defaultPpeItems)
      .values({
        code,
        name: dto.name.trim(),
        categoryId: dto.categoryId,
        description: blank(dto.description),
        createdBy: actor,
        updatedBy: actor,
      })
      .returning();
    return this.ppeItemView(row.id);
  }

  async updatePpeItem(id: string, dto: DefaultPpeItemDto, user: AuthenticatedUser) {
    await this.getPpeItem(id);
    await this.getPpeCategory(dto.categoryId);
    const code = dto.code.trim();
    await this.assertCodeFree(defaultPpeItems, code, id);
    await this.db
      .update(defaultPpeItems)
      .set({
        code,
        name: dto.name.trim(),
        categoryId: dto.categoryId,
        description: blank(dto.description),
        updatedBy: optionalUuid(user.id) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(defaultPpeItems.id, id));
    return this.ppeItemView(id);
  }

  async deletePpeItem(id: string) {
    await this.getPpeItem(id);
    await this.db.delete(defaultPpeItems).where(eq(defaultPpeItems.id, id));
    return { id, deleted: true };
  }

  listEnergySources() {
    return this.db
      .select({
        id: defaultEnergySources.id,
        name: defaultEnergySources.name,
        isFallback: defaultEnergySources.isFallback,
      })
      .from(defaultEnergySources)
      .orderBy(asc(defaultEnergySources.isFallback), asc(defaultEnergySources.name));
  }

  async createEnergySource(dto: DefaultEnergySourceDto, user: AuthenticatedUser) {
    const name = dto.name.trim();
    const code = energyCode(name);
    await this.assertEnergyNameFree(name);
    await this.assertEnergyCodeFree(code);
    const actor = optionalUuid(user.id) ?? null;
    const [row] = await this.db
      .insert(defaultEnergySources)
      .values({ name, code, createdBy: actor, updatedBy: actor })
      .returning();
    return { id: row.id, name: row.name, isFallback: row.isFallback };
  }

  async updateEnergySource(id: string, dto: DefaultEnergySourceDto, user: AuthenticatedUser) {
    await this.getEnergySource(id);
    const name = dto.name.trim();
    await this.assertEnergyNameFree(name, id);
    const [row] = await this.db
      .update(defaultEnergySources)
      .set({ name, updatedBy: optionalUuid(user.id) ?? null, updatedAt: new Date() })
      .where(eq(defaultEnergySources.id, id))
      .returning();
    return { id: row.id, name: row.name, isFallback: row.isFallback };
  }

  async deleteEnergySource(id: string) {
    const row = await this.getEnergySource(id);
    if (row.isFallback) {
      throw new BadRequestException('Other is the default energy source and cannot be removed');
    }
    await this.db.delete(defaultEnergySources).where(eq(defaultEnergySources.id, id));
    return { id, deleted: true };
  }

  listPermitTypes() {
    return this.db.select().from(defaultPermitTypes).orderBy(asc(defaultPermitTypes.name));
  }

  async createPermitType(dto: DefaultPermitTypeDto, user: AuthenticatedUser) {
    const code = dto.code.trim();
    await this.assertCodeFree(defaultPermitTypes, code);
    const actor = optionalUuid(user.id) ?? null;
    const [row] = await this.db
      .insert(defaultPermitTypes)
      .values({
        code,
        name: dto.name.trim(),
        description: blank(dto.description),
        color: dto.color.toUpperCase(),
        createdBy: actor,
        updatedBy: actor,
      })
      .returning();
    return row;
  }

  async updatePermitType(id: string, dto: DefaultPermitTypeDto, user: AuthenticatedUser) {
    await this.getPermitType(id);
    const code = dto.code.trim();
    await this.assertCodeFree(defaultPermitTypes, code, id);
    const [row] = await this.db
      .update(defaultPermitTypes)
      .set({
        code,
        name: dto.name.trim(),
        description: blank(dto.description),
        color: dto.color.toUpperCase(),
        updatedBy: optionalUuid(user.id) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(defaultPermitTypes.id, id))
      .returning();
    return row;
  }

  async deletePermitType(id: string) {
    await this.getPermitType(id);
    await this.db.delete(defaultPermitTypes).where(eq(defaultPermitTypes.id, id));
    return { id, deleted: true };
  }

  private assertLocationName(name: string) {
    if (name.toLowerCase() === 'site') {
      throw new BadRequestException('Site is not a location type');
    }
  }

  private async getLocationType(id: string) {
    const [row] = await this.db.select().from(defaultLocationTypes).where(eq(defaultLocationTypes.id, id));
    if (!row) throw new NotFoundException('Location type not found');
    return row;
  }

  private async getPpeCategory(id: string) {
    const [row] = await this.db.select().from(defaultPpeCategories).where(eq(defaultPpeCategories.id, id));
    if (!row) throw new NotFoundException('PPE category not found');
    return row;
  }

  private async requirePpeFallback() {
    const [row] = await this.db.select().from(defaultPpeCategories).where(eq(defaultPpeCategories.isFallback, true));
    if (!row) throw new BadRequestException('Default PPE category is not configured');
    return row;
  }

  private async getPpeItem(id: string) {
    const [row] = await this.db.select({ id: defaultPpeItems.id }).from(defaultPpeItems).where(eq(defaultPpeItems.id, id));
    if (!row) throw new NotFoundException('PPE item not found');
    return row;
  }

  private async ppeItemView(id: string) {
    const [row] = await this.db
      .select({
        id: defaultPpeItems.id,
        code: defaultPpeItems.code,
        name: defaultPpeItems.name,
        categoryId: defaultPpeItems.categoryId,
        categoryName: defaultPpeCategories.name,
        description: defaultPpeItems.description,
      })
      .from(defaultPpeItems)
      .innerJoin(defaultPpeCategories, eq(defaultPpeItems.categoryId, defaultPpeCategories.id))
      .where(eq(defaultPpeItems.id, id));
    if (!row) throw new NotFoundException('PPE item not found');
    return row;
  }

  private async getEnergySource(id: string) {
    const [row] = await this.db.select().from(defaultEnergySources).where(eq(defaultEnergySources.id, id));
    if (!row) throw new NotFoundException('Energy source not found');
    return row;
  }

  private async assertEnergyNameFree(name: string, exceptId?: string) {
    const [existing] = await this.db
      .select({ id: defaultEnergySources.id })
      .from(defaultEnergySources)
      .where(sql`lower(${defaultEnergySources.name}) = ${name.toLowerCase()}`);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('That name is already on the list');
    }
  }

  private async assertEnergyCodeFree(code: string) {
    const [existing] = await this.db
      .select({ id: defaultEnergySources.id })
      .from(defaultEnergySources)
      .where(sql`lower(${defaultEnergySources.code}) = ${code}`);
    if (existing) {
      throw new ConflictException('That energy source is already on the list');
    }
  }

  private async getPermitType(id: string) {
    const [row] = await this.db.select().from(defaultPermitTypes).where(eq(defaultPermitTypes.id, id));
    if (!row) throw new NotFoundException('Permit type not found');
    return row;
  }

  private async assertNameFree(
    table: typeof defaultLocationTypes | typeof defaultPpeCategories,
    name: string,
    exceptId?: string,
  ) {
    const [existing] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(sql`lower(${table.name}) = ${name.toLowerCase()}`);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('That name is already on the list');
    }
  }

  private async assertCodeFree(
    table: typeof defaultPpeItems | typeof defaultPermitTypes,
    code: string,
    exceptId?: string,
  ) {
    const [existing] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(sql`lower(${table.code}) = ${code.toLowerCase()}`);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('That code is already on the list');
    }
  }
}
