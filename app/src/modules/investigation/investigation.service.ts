import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  correctiveActions,
  incidents,
  investigationHistory,
  investigations,
  preventiveActions,
  rootCauses,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { InvestigationCacheService } from './investigation-cache.service';
import { InvestigationLogService } from './investigation-log.service';
import {
  AssignInvestigationDto,
  CorrectiveActionDto,
  PreventiveActionDto,
  RootCauseAnalysisDto,
  UpdateCorrectiveActionDto,
} from './dto/investigation.dto';

@Injectable()
export class InvestigationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: InvestigationCacheService,
    private readonly logService: InvestigationLogService,
  ) {}

  async assign(incidentId: string, dto: AssignInvestigationDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(incidentId, tenantId);

    if (incident.status !== 'open' && incident.status !== 'investigating') {
      throw new ConflictException('Investigation can only be assigned for open incidents');
    }

    const existing = await this.db
      .select({ id: investigations.id })
      .from(investigations)
      .where(
        and(eq(investigations.tenantId, tenantId), eq(investigations.incidentId, incidentId)),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Investigation already assigned for this incident');
    }

    const [row] = await this.db
      .insert(investigations)
      .values({
        tenantId,
        incidentId,
        investigatorId: dto.investigatorId,
        assignedBy: actorId,
        dueDate: dto.dueDate ? dto.dueDate.slice(0, 10) : null,
        priority: dto.priority ?? 'medium',
        status: 'assigned',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(incidents)
      .set({ status: 'investigating', updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    await this.appendHistory(tenantId, row.id, incidentId, actorId, 'assigned', {
      investigatorId: dto.investigatorId,
    });

    await this.auditService.log({
      action: 'investigation.assigned',
      entityType: 'investigation',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId },
    });

    this.logService.logEvent({
      action: 'investigation.assigned',
      incidentId,
      investigationId: row.id,
      tenantId,
      userId: actorId,
    });

    await this.cacheService.invalidate(tenantId, incidentId);
    return this.getInvestigation(incidentId, user);
  }

  async recordRootCause(incidentId: string, dto: RootCauseAnalysisDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const investigation = await this.requireInvestigationForIncident(incidentId, tenantId);

    if (investigation.status === 'completed') {
      throw new ConflictException('Cannot modify a completed investigation');
    }

    const [cause] = await this.db
      .insert(rootCauses)
      .values({
        tenantId,
        investigationId: investigation.id,
        methodology: dto.methodology ?? '5_why',
        description: dto.description,
        recordedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(investigations)
      .set({
        status: 'in_progress',
        findings: dto.findings ?? investigation.findings,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigation.id));

    await this.appendHistory(
      tenantId,
      investigation.id,
      incidentId,
      actorId,
      'root_cause_recorded',
      { rootCauseId: cause.id },
    );

    await this.auditService.log({
      action: 'investigation.root-cause.recorded',
      entityType: 'root_cause',
      entityId: cause.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId, investigationId: investigation.id },
    });

    this.logService.logEvent({
      action: 'investigation.root-cause.recorded',
      incidentId,
      investigationId: investigation.id,
      tenantId,
      userId: actorId,
    });

    await this.cacheService.invalidate(tenantId, incidentId);
    return cause;
  }

  async createCorrectiveAction(
    incidentId: string,
    dto: CorrectiveActionDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const investigation = await this.requireInvestigationForIncident(incidentId, tenantId);

    if (investigation.status === 'completed') {
      throw new ConflictException('Cannot modify a completed investigation');
    }

    const [action] = await this.db
      .insert(correctiveActions)
      .values({
        tenantId,
        investigationId: investigation.id,
        title: dto.title,
        description: dto.description ?? '',
        ownerId: dto.ownerId,
        dueDate: dto.dueDate.slice(0, 10),
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(
      tenantId,
      investigation.id,
      incidentId,
      actorId,
      'corrective_action_created',
      { correctiveActionId: action.id },
    );

    await this.auditService.log({
      action: 'investigation.corrective-action.created',
      entityType: 'corrective_action',
      entityId: action.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId },
    });

    await this.cacheService.invalidate(tenantId, incidentId);
    return action;
  }

  async createPreventiveAction(
    incidentId: string,
    dto: PreventiveActionDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const investigation = await this.requireInvestigationForIncident(incidentId, tenantId);

    if (investigation.status === 'completed') {
      throw new ConflictException('Cannot modify a completed investigation');
    }

    const [action] = await this.db
      .insert(preventiveActions)
      .values({
        tenantId,
        investigationId: investigation.id,
        title: dto.title,
        description: dto.description ?? '',
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? dto.dueDate.slice(0, 10) : null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(
      tenantId,
      investigation.id,
      incidentId,
      actorId,
      'preventive_action_created',
      { preventiveActionId: action.id },
    );

    await this.auditService.log({
      action: 'investigation.preventive-action.created',
      entityType: 'preventive_action',
      entityId: action.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId },
    });

    await this.cacheService.invalidate(tenantId, incidentId);
    return action;
  }

  async updateCorrectiveAction(
    actionId: string,
    dto: UpdateCorrectiveActionDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    const [action] = await this.db
      .select()
      .from(correctiveActions)
      .where(and(eq(correctiveActions.id, actionId), eq(correctiveActions.tenantId, tenantId)))
      .limit(1);

    if (!action) {
      throw new NotFoundException('Corrective action not found');
    }

    const [investigation] = await this.db
      .select()
      .from(investigations)
      .where(eq(investigations.id, action.investigationId))
      .limit(1);

    if (!investigation || investigation.status === 'completed') {
      throw new ConflictException('Cannot modify actions on a completed investigation');
    }

    const completing = dto.status === 'completed';
    const now = new Date();
    const [updated] = await this.db
      .update(correctiveActions)
      .set({
        status: dto.status ?? action.status,
        description: dto.description ?? action.description,
        dueDate: dto.dueDate ? dto.dueDate.slice(0, 10) : action.dueDate,
        completedAt: completing ? now : action.completedAt,
        completedBy: completing ? actorId : action.completedBy,
        updatedBy: actorId,
        updatedAt: now,
      })
      .where(eq(correctiveActions.id, actionId))
      .returning();

    await this.appendHistory(
      tenantId,
      investigation.id,
      investigation.incidentId,
      actorId,
      'corrective_action_updated',
      { correctiveActionId: actionId, status: updated.status },
    );

    await this.cacheService.invalidate(tenantId, investigation.incidentId);
    return updated;
  }

  async getInvestigation(incidentId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.cacheService.getDetail<
      Awaited<ReturnType<InvestigationService['loadInvestigation']>>
    >(tenantId, incidentId);
    if (cached) {
      return cached;
    }
    const detail = await this.loadInvestigation(incidentId, tenantId);
    await this.cacheService.setDetail(tenantId, incidentId, detail);
    return detail;
  }

  private async loadInvestigation(incidentId: string, tenantId: string) {
    await this.requireIncident(incidentId, tenantId);
    const investigation = await this.requireInvestigationForIncident(incidentId, tenantId);

    const [causes, corrective, preventive, history] = await Promise.all([
      this.db
        .select()
        .from(rootCauses)
        .where(eq(rootCauses.investigationId, investigation.id)),
      this.db
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.investigationId, investigation.id)),
      this.db
        .select()
        .from(preventiveActions)
        .where(eq(preventiveActions.investigationId, investigation.id)),
      this.db
        .select()
        .from(investigationHistory)
        .where(eq(investigationHistory.investigationId, investigation.id))
        .orderBy(desc(investigationHistory.createdAt)),
    ]);

    return {
      investigation,
      rootCauses: causes,
      correctiveActions: corrective,
      preventiveActions: preventive,
      history,
    };
  }

  private async appendHistory(
    tenantId: string,
    investigationId: string,
    incidentId: string,
    actorId: string,
    eventType: string,
    payload?: Record<string, unknown>,
  ) {
    await this.db.insert(investigationHistory).values({
      tenantId,
      investigationId,
      incidentId,
      eventType,
      actorId,
      payload: payload ?? null,
      createdBy: actorId,
    });
  }

  private async requireIncident(id: string, tenantId: string) {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .limit(1);
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  private async requireInvestigationForIncident(incidentId: string, tenantId: string) {
    const [investigation] = await this.db
      .select()
      .from(investigations)
      .where(
        and(eq(investigations.tenantId, tenantId), eq(investigations.incidentId, incidentId)),
      )
      .limit(1);
    if (!investigation) {
      throw new NotFoundException('Investigation not found for this incident');
    }
    return investigation;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
