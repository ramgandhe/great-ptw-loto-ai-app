import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { agencies, competencies, contractors, employees } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  AssignRoleDto,
  CreateCompetencyDto,
  CreateWorkforceDto,
  UpdateCompetencyDto,
  UpdateWorkforceDto,
} from './dto/workforce.dto';

@Injectable()
export class WorkforceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  listEmployees(user: AuthenticatedUser) {
    return this.listActive(employees, user);
  }

  createEmployee(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    return this.createRecord(employees, 'employee', user, dto);
  }

  updateEmployee(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(employees, 'employee', id, user, dto);
  }

  archiveEmployee(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(employees, 'employee', id, user);
  }

  listContractors(user: AuthenticatedUser) {
    return this.listActive(contractors, user);
  }

  createContractor(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    return this.createRecord(contractors, 'contractor', user, dto);
  }

  updateContractor(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(contractors, 'contractor', id, user, dto);
  }

  archiveContractor(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(contractors, 'contractor', id, user);
  }

  listAgencies(user: AuthenticatedUser) {
    return this.listActive(agencies, user);
  }

  createAgency(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    return this.createRecord(agencies, 'agency', user, { name: dto.name });
  }

  updateAgency(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(agencies, 'agency', id, user, dto);
  }

  archiveAgency(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(agencies, 'agency', id, user);
  }

  listCompetencies(user: AuthenticatedUser) {
    return this.listActive(competencies, user);
  }

  createCompetency(dto: CreateCompetencyDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    return this.db
      .insert(competencies)
      .values({
        tenantId,
        name: dto.name.trim(),
        workforceUserId: dto.workforceUserId ?? null,
        certificationName: dto.certificationName,
        expiryDate: dto.expiryDate,
        description: dto.description,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()
      .then(async ([row]) => {
        await this.audit('competency.created', 'competency', row.id, user, tenantId);
        return row;
      });
  }

  updateCompetency(id: string, dto: UpdateCompetencyDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    return this.db
      .update(competencies)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.workforceUserId !== undefined ? { workforceUserId: dto.workforceUserId ?? null } : {}),
        ...(dto.certificationName !== undefined ? { certificationName: dto.certificationName } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate: dto.expiryDate } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(competencies.id, id), eq(competencies.tenantId, tenantId), ne(competencies.status, 'archived')))
      .returning()
      .then(async ([row]) => {
        if (!row) {
          throw new NotFoundException('Competency not found');
        }
        await this.audit('competency.updated', 'competency', id, user, tenantId);
        return row;
      });
  }

  archiveCompetency(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(competencies, 'competency', id, user);
  }

  async listDirectory(user: AuthenticatedUser) {
    const [employeeRows, contractorRows] = await Promise.all([
      this.listEmployees(user),
      this.listContractors(user),
    ]);
    return [
      ...employeeRows.map((row) => ({ ...row, role: 'employee' as const })),
      ...contractorRows.map((row) => ({ ...row, role: 'contractor' as const })),
    ];
  }

  async assignRole(userId: string, dto: AssignRoleDto, actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    await this.audit('workforce.role.assigned', 'user', userId, actor, tenantId, {
      role: dto.role,
    });
    return { userId, role: dto.role };
  }

  private async listActive(
    table: typeof employees | typeof contractors | typeof agencies | typeof competencies,
    user: AuthenticatedUser,
  ) {
    const tenantId = requireTenant(user);
    return this.db
      .select()
      .from(table)
      .where(and(eq(table.tenantId, tenantId), ne(table.status, 'archived')));
  }

  private async createRecord(
    table: typeof employees | typeof contractors | typeof agencies,
    entityType: string,
    user: AuthenticatedUser,
    dto: CreateWorkforceDto | { name: string },
  ) {
    const tenantId = requireTenant(user);
    const values =
      'email' in dto
        ? {
            name: dto.name.trim(),
            email: dto.email,
            phone: dto.phone,
            departmentId: dto.departmentId ?? null,
            agencyId: dto.agencyId ?? null,
          }
        : { name: dto.name.trim() };

    try {
      const [row] = await this.db
        .insert(table)
        .values({ tenantId, ...values, createdBy: user.id, updatedBy: user.id })
        .returning();
      await this.audit(`${entityType}.created`, entityType, row.id, user, tenantId);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('Duplicate record within tenant');
      }
      throw error;
    }
  }

  private async updateRecord(
    table: typeof employees | typeof contractors | typeof agencies,
    entityType: string,
    id: string,
    user: AuthenticatedUser,
    dto: UpdateWorkforceDto,
  ) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .update(table)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId ?? null } : {}),
        ...(dto.agencyId !== undefined ? { agencyId: dto.agencyId ?? null } : {}),
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

  private async archiveRecord(
    table: typeof employees | typeof contractors | typeof agencies | typeof competencies,
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
    metadata?: Record<string, unknown>,
  ) {
    await this.auditService.log({
      action,
      entityType,
      entityId,
      userId: user.id,
      tenantId,
      metadata,
    });
  }
}
