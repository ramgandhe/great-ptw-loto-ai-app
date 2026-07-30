import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalWorkflows,
  departments,
  locations,
  notificationPreferences,
  organisations,
  permitTemplates,
  plants,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateOrgEntityDto, UpdateOrgEntityDto } from './dto/org-entity.dto';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';

type OrgStatusTable =
  | typeof plants
  | typeof departments
  | typeof locations
  | typeof approvalWorkflows
  | typeof permitTemplates;

@Injectable()
export class OrganisationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async listOrganisations(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    return this.db.select().from(organisations).where(eq(organisations.tenantId, tenantId));
  }

  async getOrganisation(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .select()
      .from(organisations)
      .where(and(eq(organisations.id, id), eq(organisations.tenantId, tenantId)));
    if (!row) {
      throw new NotFoundException('Organisation not found');
    }
    return row;
  }

  async createOrganisation(dto: CreateOrganisationDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const existing = await this.listOrganisations(user);
    if (existing.length > 0) {
      throw new ConflictException('Organisation already registered for tenant');
    }

    const [row] = await this.db
      .insert(organisations)
      .values({
        tenantId,
        name: dto.name.trim(),
        legalName: dto.legalName?.trim(),
        registrationNumber: dto.registrationNumber?.trim(),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.audit('organisation.created', 'organisation', row.id, user, tenantId);
    return row;
  }

  async updateOrganisation(id: string, dto: UpdateOrganisationDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(organisations)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName.trim() } : {}),
        ...(dto.registrationNumber !== undefined
          ? { registrationNumber: dto.registrationNumber.trim() }
          : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(organisations.id, id), eq(organisations.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new NotFoundException('Organisation not found');
    }
    await this.audit('organisation.updated', 'organisation', id, user, tenantId);
    return row;
  }

  async archiveOrganisation(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(organisations)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(organisations.id, id), eq(organisations.tenantId, tenantId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Organisation not found');
    }
    await this.audit('organisation.archived', 'organisation', id, user, tenantId);
    return row;
  }

  listPlants(user: AuthenticatedUser) {
    return this.listActive(plants, user);
  }

  getPlant(id: string, user: AuthenticatedUser) {
    return this.getActive(plants, id, user);
  }

  createPlant(dto: CreateOrgEntityDto, user: AuthenticatedUser) {
    return this.createEntity(plants, 'plant', user, {
      name: dto.name.trim(),
      code: dto.code?.trim(),
      description: dto.description,
    });
  }

  updatePlant(id: string, dto: UpdateOrgEntityDto, user: AuthenticatedUser) {
    return this.updateEntity(plants, 'plant', id, user, dto);
  }

  archivePlant(id: string, user: AuthenticatedUser) {
    return this.archiveEntity(plants, 'plant', id, user);
  }

  listDepartments(user: AuthenticatedUser) {
    return this.listActive(departments, user);
  }

  getDepartment(id: string, user: AuthenticatedUser) {
    return this.getActive(departments, id, user);
  }

  createDepartment(dto: CreateOrgEntityDto, user: AuthenticatedUser) {
    return this.createEntity(departments, 'department', user, {
      name: dto.name.trim(),
      code: dto.code?.trim(),
      description: dto.description,
      plantId: dto.plantId ?? null,
    });
  }

  updateDepartment(id: string, dto: UpdateOrgEntityDto, user: AuthenticatedUser) {
    return this.updateEntity(departments, 'department', id, user, dto);
  }

  archiveDepartment(id: string, user: AuthenticatedUser) {
    return this.archiveEntity(departments, 'department', id, user);
  }

  listLocations(user: AuthenticatedUser) {
    return this.listActive(locations, user);
  }

  getLocation(id: string, user: AuthenticatedUser) {
    return this.getActive(locations, id, user);
  }

  createLocation(dto: CreateOrgEntityDto, user: AuthenticatedUser) {
    return this.createEntity(locations, 'location', user, {
      name: dto.name.trim(),
      code: dto.code?.trim(),
      description: dto.description,
      departmentId: dto.departmentId ?? null,
    });
  }

  updateLocation(id: string, dto: UpdateOrgEntityDto, user: AuthenticatedUser) {
    return this.updateEntity(locations, 'location', id, user, dto);
  }

  archiveLocation(id: string, user: AuthenticatedUser) {
    return this.archiveEntity(locations, 'location', id, user);
  }

  listWorkflows(user: AuthenticatedUser) {
    return this.listActive(approvalWorkflows, user);
  }

  getWorkflow(id: string, user: AuthenticatedUser) {
    return this.getActive(approvalWorkflows, id, user);
  }

  createWorkflow(dto: CreateOrgEntityDto, user: AuthenticatedUser) {
    return this.createEntity(approvalWorkflows, 'approval_workflow', user, {
      name: dto.name.trim(),
      code: dto.code?.trim(),
      description: dto.description,
    });
  }

  updateWorkflow(id: string, dto: UpdateOrgEntityDto, user: AuthenticatedUser) {
    return this.updateEntity(approvalWorkflows, 'approval_workflow', id, user, dto);
  }

  archiveWorkflow(id: string, user: AuthenticatedUser) {
    return this.archiveEntity(approvalWorkflows, 'approval_workflow', id, user);
  }

  listTemplates(user: AuthenticatedUser) {
    return this.listActive(permitTemplates, user);
  }

  getTemplate(id: string, user: AuthenticatedUser) {
    return this.getActive(permitTemplates, id, user);
  }

  createTemplate(dto: CreateOrgEntityDto, user: AuthenticatedUser) {
    return this.createEntity(permitTemplates, 'permit_template', user, {
      name: dto.name.trim(),
      code: dto.code?.trim(),
      description: dto.description,
      status: 'draft',
    });
  }

  updateTemplate(id: string, dto: UpdateOrgEntityDto, user: AuthenticatedUser) {
    return this.updateEntity(permitTemplates, 'permit_template', id, user, dto);
  }

  archiveTemplate(id: string, user: AuthenticatedUser) {
    return this.archiveEntity(permitTemplates, 'permit_template', id, user);
  }

  listNotificationPreferences(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    return this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.tenantId, tenantId),
          ne(notificationPreferences.status, 'archived'),
        ),
      );
  }

  async getNotificationPreference(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.id, id),
          eq(notificationPreferences.tenantId, tenantId),
          ne(notificationPreferences.status, 'archived'),
        ),
      );
    if (!row) {
      throw new NotFoundException('Notification preference not found');
    }
    return row;
  }

  async createNotificationPreference(
    dto: { name: string; channel?: string; eventType?: string; enabled?: boolean },
    user: AuthenticatedUser,
  ) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .insert(notificationPreferences)
      .values({
        tenantId,
        name: dto.name.trim(),
        channel: dto.channel,
        eventType: dto.eventType,
        enabled: dto.enabled ?? true,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();
    await this.audit('notification_preference.created', 'notification_preference', row.id, user, tenantId);
    return row;
  }

  async updateNotificationPreference(
    id: string,
    dto: { name?: string; channel?: string; eventType?: string; enabled?: boolean },
    user: AuthenticatedUser,
  ) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(notificationPreferences)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.eventType !== undefined ? { eventType: dto.eventType } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(notificationPreferences.id, id), eq(notificationPreferences.tenantId, tenantId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Notification preference not found');
    }
    await this.audit('notification_preference.updated', 'notification_preference', id, user, tenantId);
    return row;
  }

  async archiveNotificationPreference(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(notificationPreferences)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(notificationPreferences.id, id), eq(notificationPreferences.tenantId, tenantId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Notification preference not found');
    }
    await this.audit('notification_preference.archived', 'notification_preference', id, user, tenantId);
    return row;
  }

  private async listActive(table: OrgStatusTable, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    return this.db
      .select()
      .from(table)
      .where(and(eq(table.tenantId, tenantId), ne(table.status, 'archived')));
  }

  private async getActive(table: OrgStatusTable, id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId), ne(table.status, 'archived')));
    if (!row) {
      throw new NotFoundException('Record not found');
    }
    return row;
  }

  private async createEntity(
    table: OrgStatusTable,
    entityType: string,
    user: AuthenticatedUser,
    values: Record<string, unknown>,
  ) {
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .insert(table)
        .values({ tenantId, ...values, createdBy: user.id, updatedBy: user.id } as never)
        .returning();
      await this.audit(`${entityType}.created`, entityType, String(row.id), user, tenantId);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('Duplicate code within tenant');
      }
      throw error;
    }
  }

  private async updateEntity(
    table: OrgStatusTable,
    entityType: string,
    id: string,
    user: AuthenticatedUser,
    dto: UpdateOrgEntityDto,
  ) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(table)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.plantId !== undefined ? { plantId: dto.plantId ?? null } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId ?? null } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId), ne(table.status, 'archived')))
      .returning();
    if (!row) {
      throw new NotFoundException('Record not found');
    }
    await this.audit(`${entityType}.updated`, entityType, id, user, tenantId);
    return row;
  }

  private async archiveEntity(
    table: OrgStatusTable,
    entityType: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(table)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Record not found');
    }
    await this.audit(`${entityType}.archived`, entityType, id, user, tenantId);
    return row;
  }

  private async audit(
    action: string,
    entityType: string,
    entityId: string,
    user: AuthenticatedUser,
    tenantId: string,
  ) {
    await this.auditService.log({
      action,
      entityType,
      entityId,
      userId: user.id,
      tenantId,
    });
  }
}
