import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  correctiveActions,
  incidentArchive,
  incidentClosures,
  incidentEvidence,
  incidentVerifications,
  incidents,
  investigationHistory,
  investigations,
  preventiveActions,
  rootCauses,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { IncidentCacheService } from '../incidents/incident-cache.service';
import { InvestigationCacheService } from '../investigation/investigation-cache.service';
import { IncidentClosureCacheService } from './incident-closure-cache.service';
import { IncidentClosureLogService } from './incident-closure-log.service';
import {
  CloseIncidentDto,
  IncidentArchiveSearchDto,
  VerifyIncidentDto,
} from './dto/incident-closure.dto';

@Injectable()
export class IncidentClosureService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly closureCache: IncidentClosureCacheService,
    private readonly incidentCache: IncidentCacheService,
    private readonly investigationCache: InvestigationCacheService,
    private readonly logService: IncidentClosureLogService,
  ) {}

  async verify(incidentId: string, dto: VerifyIncidentDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(incidentId, tenantId);

    if (incident.status !== 'investigating' && incident.status !== 'pending_verification') {
      throw new ConflictException('Incident is not ready for verification');
    }

    const investigation = await this.requireInvestigation(incidentId, tenantId);
    const causes = await this.db
      .select({ id: rootCauses.id })
      .from(rootCauses)
      .where(eq(rootCauses.investigationId, investigation.id))
      .limit(1);

    if (causes.length === 0) {
      throw new ConflictException('Root cause analysis is required before verification');
    }

    const outstanding = await this.db
      .select({ id: correctiveActions.id })
      .from(correctiveActions)
      .where(
        and(
          eq(correctiveActions.investigationId, investigation.id),
          ne(correctiveActions.status, 'completed'),
          ne(correctiveActions.status, 'cancelled'),
        ),
      )
      .limit(1);

    if (outstanding.length > 0) {
      throw new ConflictException('All corrective actions must be completed before verification');
    }

    if (!dto.correctiveActionsConfirmed || !dto.preventiveActionsReviewed) {
      throw new BadRequestException(
        'Corrective actions must be confirmed and preventive actions reviewed',
      );
    }

    const existing = await this.db
      .select({ id: incidentVerifications.id })
      .from(incidentVerifications)
      .where(eq(incidentVerifications.incidentId, incidentId))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('Incident already verified');
    }

    const [verification] = await this.db
      .insert(incidentVerifications)
      .values({
        tenantId,
        incidentId,
        investigationId: investigation.id,
        verifiedBy: actorId,
        comments: dto.comments ?? '',
        correctiveActionsConfirmed: true,
        preventiveActionsReviewed: true,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(investigations)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: actorId,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(investigations.id, investigation.id));

    await this.db
      .update(incidents)
      .set({ status: 'verified', updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    await this.auditService.log({
      action: 'incident.verified',
      entityType: 'incident_verification',
      entityId: verification.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId },
    });

    this.logService.logEvent({
      action: 'incident.verified',
      incidentId,
      tenantId,
      userId: actorId,
    });

    await this.invalidateCaches(tenantId, incidentId);
    return verification;
  }

  async close(incidentId: string, dto: CloseIncidentDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(incidentId, tenantId);

    if (incident.status !== 'verified') {
      throw new ConflictException('Incident must be verified before closure');
    }

    const [verification] = await this.db
      .select()
      .from(incidentVerifications)
      .where(
        and(
          eq(incidentVerifications.incidentId, incidentId),
          eq(incidentVerifications.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!verification) {
      throw new ConflictException('Verification record is required before closure');
    }

    const outstanding = await this.db
      .select({ id: correctiveActions.id })
      .from(correctiveActions)
      .where(
        and(
          eq(correctiveActions.investigationId, verification.investigationId),
          ne(correctiveActions.status, 'completed'),
          ne(correctiveActions.status, 'cancelled'),
        ),
      )
      .limit(1);

    if (outstanding.length > 0) {
      throw new ConflictException('Cannot close incident with outstanding corrective actions');
    }

    const closedAt = new Date();
    const [closure] = await this.db
      .insert(incidentClosures)
      .values({
        tenantId,
        incidentId,
        verificationId: verification.id,
        closedBy: actorId,
        closedAt,
        comments: dto.comments ?? '',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(incidents)
      .set({ status: 'closed', updatedBy: actorId, updatedAt: closedAt })
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    const snapshot = await this.buildSnapshot(incidentId, tenantId);
    await this.db.insert(incidentArchive).values({
      tenantId,
      incidentId,
      reference: incident.reference,
      incidentType: incident.incidentType,
      title: incident.title,
      closedAt,
      archivedBy: actorId,
      snapshot,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.log({
      action: 'incident.closed',
      entityType: 'incident_closure',
      entityId: closure.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId },
    });

    this.logService.logEvent({
      action: 'incident.closed',
      incidentId,
      tenantId,
      userId: actorId,
      metadata: { reference: incident.reference },
    });

    await this.invalidateCaches(tenantId, incidentId);
    return { closure, archived: true };
  }

  async listArchive(user: AuthenticatedUser, query: IncidentArchiveSearchDto = {}) {
    const tenantId = this.requireTenant(user);
    if (!query.reference && !query.incidentType) {
      const cached = await this.closureCache.getArchiveList<
        Awaited<ReturnType<IncidentClosureService['loadArchiveList']>>
      >(tenantId);
      if (cached) {
        return cached;
      }
    }

    const rows = await this.loadArchiveList(tenantId, query);
    if (!query.reference && !query.incidentType) {
      await this.closureCache.setArchiveList(tenantId, rows);
    }
    return rows;
  }

  async getArchive(incidentId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.closureCache.getArchiveDetail<
      typeof incidentArchive.$inferSelect
    >(tenantId, incidentId);
    if (cached) {
      return cached;
    }

    const [row] = await this.db
      .select()
      .from(incidentArchive)
      .where(
        and(eq(incidentArchive.tenantId, tenantId), eq(incidentArchive.incidentId, incidentId)),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Archived incident not found');
    }

    await this.closureCache.setArchiveDetail(tenantId, incidentId, row);
    return row;
  }

  async getHistory(incidentId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requireIncident(incidentId, tenantId);

    const [investigation] = await this.db
      .select()
      .from(investigations)
      .where(
        and(eq(investigations.tenantId, tenantId), eq(investigations.incidentId, incidentId)),
      )
      .limit(1);

    const history = investigation
      ? await this.db
          .select()
          .from(investigationHistory)
          .where(eq(investigationHistory.investigationId, investigation.id))
          .orderBy(desc(investigationHistory.createdAt))
      : [];

    const [verification] = await this.db
      .select()
      .from(incidentVerifications)
      .where(eq(incidentVerifications.incidentId, incidentId))
      .limit(1);

    const [closure] = await this.db
      .select()
      .from(incidentClosures)
      .where(eq(incidentClosures.incidentId, incidentId))
      .limit(1);

    return { history, verification: verification ?? null, closure: closure ?? null };
  }

  private async loadArchiveList(tenantId: string, query: IncidentArchiveSearchDto) {
    const conditions = [eq(incidentArchive.tenantId, tenantId)];
    if (query.reference) {
      conditions.push(eq(incidentArchive.reference, query.reference));
    }
    if (query.incidentType) {
      conditions.push(eq(incidentArchive.incidentType, query.incidentType));
    }

    return this.db
      .select()
      .from(incidentArchive)
      .where(and(...conditions))
      .orderBy(desc(incidentArchive.closedAt));
  }

  private async buildSnapshot(incidentId: string, tenantId: string) {
    const incident = await this.requireIncident(incidentId, tenantId);
    const [investigation] = await this.db
      .select()
      .from(investigations)
      .where(eq(investigations.incidentId, incidentId))
      .limit(1);

    const [evidence, causes, corrective, preventive, verification] = await Promise.all([
      this.db.select().from(incidentEvidence).where(eq(incidentEvidence.incidentId, incidentId)),
      investigation
        ? this.db.select().from(rootCauses).where(eq(rootCauses.investigationId, investigation.id))
        : Promise.resolve([]),
      investigation
        ? this.db
            .select()
            .from(correctiveActions)
            .where(eq(correctiveActions.investigationId, investigation.id))
        : Promise.resolve([]),
      investigation
        ? this.db
            .select()
            .from(preventiveActions)
            .where(eq(preventiveActions.investigationId, investigation.id))
        : Promise.resolve([]),
      this.db
        .select()
        .from(incidentVerifications)
        .where(eq(incidentVerifications.incidentId, incidentId)),
    ]);

    return {
      incident,
      investigation: investigation ?? null,
      evidence,
      rootCauses: causes,
      correctiveActions: corrective,
      preventiveActions: preventive,
      verification: verification[0] ?? null,
    };
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

  private async requireInvestigation(incidentId: string, tenantId: string) {
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

  private async invalidateCaches(tenantId: string, incidentId: string) {
    await Promise.all([
      this.incidentCache.invalidateIncident(tenantId, incidentId),
      this.investigationCache.invalidate(tenantId, incidentId),
      this.closureCache.invalidateArchive(tenantId, incidentId),
    ]);
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
