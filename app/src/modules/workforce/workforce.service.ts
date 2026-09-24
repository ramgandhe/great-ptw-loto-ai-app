import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, ne } from 'drizzle-orm';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { agencies, competencies, contractors, employees } from '../../database/schema';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuditService } from '../logging/audit.service';
import {
  CreateCompetencyDto,
  CreateWorkforceDto,
  UpdateCompetencyDto,
  UpdateWorkforceDto,
} from './dto/workforce.dto';
import { TenantUsersService } from './tenant-users.service';

@Injectable()
export class WorkforceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly tenantUsersService: TenantUsersService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  listEmployees(user: AuthenticatedUser) {
    return this.listActive(employees, user);
  }

  createEmployee(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    return this.createPerson(employees, 'employee', user, dto, {
      departmentId: dto.departmentId ?? null,
    });
  }

  updateEmployee(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(employees, 'employee', id, user, dto);
  }

  archiveEmployee(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(employees, 'employee', id, user);
  }

  deactivateEmployee(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(employees, 'employee', id, user, 'disabled');
  }

  reactivateEmployee(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(employees, 'employee', id, user, 'active');
  }

  deleteEmployee(id: string, user: AuthenticatedUser) {
    return this.deletePerson(employees, 'employee', id, user);
  }

  listContractors(user: AuthenticatedUser) {
    return this.listActive(contractors, user);
  }

  createContractor(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    return this.createPerson(contractors, 'contractor', user, dto, {
      agencyId: dto.agencyId ?? null,
    });
  }

  updateContractor(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(contractors, 'contractor', id, user, dto);
  }

  archiveContractor(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(contractors, 'contractor', id, user);
  }

  deactivateContractor(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(contractors, 'contractor', id, user, 'disabled');
  }

  reactivateContractor(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(contractors, 'contractor', id, user, 'active');
  }

  deleteContractor(id: string, user: AuthenticatedUser) {
    return this.deletePerson(contractors, 'contractor', id, user);
  }

  listAgencies(user: AuthenticatedUser) {
    return this.listActive(agencies, user);
  }

  async createAgency(dto: CreateWorkforceDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    this.requireEmail(dto.email);
    const login = await this.tenantUsersService.ensureWorkforceLogin(
      { name: dto.name, email: dto.email },
      user,
    );
    try {
      const [row] = await this.db
        .insert(agencies)
        .values({
          tenantId,
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone,
          gstin: dto.gstin,
          address: dto.address,
          keycloakUserId: login.keycloakUserId,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.audit('agency.created', 'agency', row.id, user, tenantId);
      await this.sendWorkforceAddedMail(dto.email, dto.name, login.temporaryPassword);
      return { ...row, loginCreated: login.created, temporaryPassword: login.temporaryPassword };
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('Duplicate record within tenant');
      }
      throw error;
    }
  }

  updateAgency(id: string, dto: UpdateWorkforceDto, user: AuthenticatedUser) {
    return this.updateRecord(agencies, 'agency', id, user, dto);
  }

  archiveAgency(id: string, user: AuthenticatedUser) {
    return this.archiveRecord(agencies, 'agency', id, user);
  }

  deactivateAgency(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(agencies, 'agency', id, user, 'disabled');
  }

  reactivateAgency(id: string, user: AuthenticatedUser) {
    return this.setPersonLoginStatus(agencies, 'agency', id, user, 'active');
  }

  deleteAgency(id: string, user: AuthenticatedUser) {
    return this.deletePerson(agencies, 'agency', id, user);
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

  private requireEmail(email: string | undefined): asserts email is string {
    if (!email?.trim()) {
      throw new BadRequestException('Email is required');
    }
  }

  private async createPerson(
    table: typeof employees | typeof contractors,
    entityType: 'employee' | 'contractor',
    user: AuthenticatedUser,
    dto: CreateWorkforceDto,
    extra: Record<string, string | null>,
  ) {
    const tenantId = requireTenant(user);
    this.requireEmail(dto.email);
    const login = await this.tenantUsersService.ensureWorkforceLogin(
      { name: dto.name, email: dto.email },
      user,
    );
    try {
      const [row] = await this.db
        .insert(table)
        .values({
          tenantId,
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone,
          keycloakUserId: login.keycloakUserId,
          createdBy: user.id,
          updatedBy: user.id,
          ...extra,
        })
        .returning();
      await this.audit(`${entityType}.created`, entityType, row.id, user, tenantId);
      await this.sendWorkforceAddedMail(dto.email, dto.name, login.temporaryPassword);
      return { ...row, loginCreated: login.created, temporaryPassword: login.temporaryPassword };
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('Duplicate record within tenant');
      }
      throw error;
    }
  }

  private async sendWorkforceAddedMail(
    email: string,
    name: string,
    temporaryPassword: string | null,
  ) {
    const signInUrl = (
      this.configService.get<string>('appPublicUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '') + '/login';
    const passwordLine = temporaryPassword
      ? `\n\nA platform login was created for you.\nTemporary password: ${temporaryPassword}\nYou will be asked to change it on first sign-in.`
      : '\n\nUse your existing platform password to sign in.';
    await this.mailService.send({
      to: email.trim().toLowerCase(),
      subject: 'You were added to an organisation workforce',
      text: `Hello ${name.trim()},\n\nYou have been added to an organisation workforce team on the Permit-to-Work platform.\n\nSign in: ${signInUrl}${passwordLine}`,
    });
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

  private async setPersonLoginStatus(
    table: typeof employees | typeof contractors | typeof agencies,
    entityType: string,
    id: string,
    user: AuthenticatedUser,
    status: 'active' | 'disabled',
  ) {
    const tenantId = requireTenant(user);
    const [existing] = await this.db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId), ne(table.status, 'archived')));
    if (!existing) {
      throw new NotFoundException('Record not found');
    }

    if (existing.keycloakUserId) {
      if (status === 'disabled') {
        await this.tenantUsersService.deactivate(existing.keycloakUserId, user);
      } else {
        await this.tenantUsersService.reactivate(existing.keycloakUserId, user);
      }
    }

    const [row] = await this.db
      .update(table)
      .set({ status, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(table.id, id))
      .returning();
    await this.audit(`${entityType}.${status === 'disabled' ? 'deactivated' : 'reactivated'}`, entityType, id, user, tenantId);
    return row;
  }

  private async deletePerson(
    table: typeof employees | typeof contractors | typeof agencies,
    entityType: string,
    id: string,
    user: AuthenticatedUser,
  ) {
    const tenantId = requireTenant(user);
    const [existing] = await this.db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId)));
    if (!existing) {
      throw new NotFoundException('Record not found');
    }
    if (existing.keycloakUserId) {
      try {
        await this.tenantUsersService.remove(existing.keycloakUserId, user);
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }
    return this.archiveRecord(table, entityType, id, user);
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
