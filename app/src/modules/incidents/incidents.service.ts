import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  incidentEquipment,
  incidentEvidence,
  incidentPermits,
  incidents,
  machineryCatalogue,
  permits,
} from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentLogService } from './incident-log.service';
import {
  ALLOWED_INCIDENT_EVIDENCE_CONTENT_TYPES,
  MAX_INCIDENT_EVIDENCE_SIZE_BYTES,
} from './incidents.constants';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  UploadIncidentEvidenceDto,
} from './dto/incident.dto';

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: IncidentCacheService,
    private readonly logService: IncidentLogService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async create(dto: CreateIncidentDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const submit = dto.submit === true;
    const severityPath =
      dto.severityPath ??
      (dto.incidentType === 'incident' ? 'accident' : 'near_miss');

    if (dto.permitIds?.length) {
      await this.assertPermitsBelongToTenant(dto.permitIds, tenantId);
    }
    if (dto.machineryIds?.length) {
      await this.assertMachineryBelongToTenant(dto.machineryIds, tenantId);
    }

    const reference = this.generateReference();
    const now = new Date();

    const [row] = await this.db
      .insert(incidents)
      .values({
        tenantId,
        reference,
        incidentType: dto.incidentType,
        severityPath,
        status: submit ? 'open' : 'draft',
        title: dto.title,
        description: dto.description,
        locationDescription: dto.locationDescription ?? '',
        occurredAt: new Date(dto.occurredAt),
        priority: dto.priority ?? 'medium',
        reportedBy: actorId,
        submittedBy: submit ? actorId : null,
        submittedAt: submit ? now : null,
        plantId: dto.plantId ?? null,
        locationId: dto.locationId ?? null,
        workstationId: dto.workstationId ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.linkAssociations(row.id, tenantId, actorId, dto.permitIds, dto.machineryIds);

    await this.auditService.log({
      action: submit ? 'incident.submitted' : 'incident.created',
      entityType: 'incident',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { reference, incidentType: dto.incidentType, severityPath },
    });

    this.logService.logEvent({
      action: submit ? 'incident.submitted' : 'incident.created',
      incidentId: row.id,
      tenantId,
      userId: actorId,
      metadata: { reference, incidentType: dto.incidentType },
    });

    if (submit) {
      await this.dispatchIncidentReported(row, actorId, dto.permitIds);
    }

    await this.cacheService.invalidateIncident(tenantId, row.id);
    return this.loadDetail(row.id, tenantId);
  }

  async list(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.cacheService.getList<
      Awaited<ReturnType<IncidentsService['loadList']>>
    >(tenantId);
    if (cached) {
      return cached;
    }
    const rows = await this.loadList(tenantId);
    await this.cacheService.setList(tenantId, rows);
    return rows;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.cacheService.getDetail<
      Awaited<ReturnType<IncidentsService['loadDetail']>>
    >(tenantId, id);
    if (cached) {
      return cached;
    }
    const detail = await this.loadDetail(id, tenantId);
    await this.cacheService.setDetail(tenantId, id, detail);
    return detail;
  }

  async update(id: string, dto: UpdateIncidentDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(id, tenantId);

    if (incident.status !== 'draft') {
      throw new ConflictException('Only draft incidents can be updated');
    }

    const [row] = await this.db
      .update(incidents)
      .set({
        title: dto.title ?? incident.title,
        description: dto.description ?? incident.description,
        locationDescription: dto.locationDescription ?? incident.locationDescription,
        priority: dto.priority ?? incident.priority,
        plantId: dto.plantId === undefined ? incident.plantId : dto.plantId,
        locationId: dto.locationId === undefined ? incident.locationId : dto.locationId,
        workstationId:
          dto.workstationId === undefined ? incident.workstationId : dto.workstationId,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .returning();

    await this.auditService.log({
      action: 'incident.updated',
      entityType: 'incident',
      entityId: id,
      userId: actorId,
      tenantId,
    });

    await this.cacheService.invalidateIncident(tenantId, id);
    return row;
  }

  async submit(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(id, tenantId);

    if (incident.status !== 'draft') {
      throw new ConflictException('Only draft incidents can be submitted');
    }

    if (!incident.title?.trim() || !incident.description?.trim()) {
      throw new BadRequestException('Incident title and description are required to submit');
    }

    const now = new Date();
    const [row] = await this.db
      .update(incidents)
      .set({
        status: 'open',
        submittedBy: actorId,
        submittedAt: now,
        updatedBy: actorId,
        updatedAt: now,
      })
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .returning();

    await this.auditService.log({
      action: 'incident.submitted',
      entityType: 'incident',
      entityId: id,
      userId: actorId,
      tenantId,
      metadata: { reference: row.reference },
    });

    this.logService.logEvent({
      action: 'incident.submitted',
      incidentId: id,
      tenantId,
      userId: actorId,
      metadata: { reference: row.reference },
    });

    const linked = await this.db
      .select({ permitId: incidentPermits.permitId })
      .from(incidentPermits)
      .where(and(eq(incidentPermits.tenantId, tenantId), eq(incidentPermits.incidentId, id)));

    await this.dispatchIncidentReported(
      row,
      actorId,
      linked.map((item) => item.permitId),
    );

    await this.cacheService.invalidateIncident(tenantId, id);
    return this.loadDetail(id, tenantId);
  }

  private async dispatchIncidentReported(
    incident: typeof incidents.$inferSelect,
    actorId: string,
    permitIds?: string[],
  ) {
    const recipients = new Set<string>();
    if (incident.reportedBy) {
      recipients.add(incident.reportedBy);
    }
    if (permitIds?.length) {
      const linkedPermits = await this.db
        .select({
          submittedBy: permits.submittedBy,
          createdBy: permits.createdBy,
        })
        .from(permits)
        .where(and(eq(permits.tenantId, incident.tenantId), inArray(permits.id, permitIds)));
      for (const permit of linkedPermits) {
        if (permit.submittedBy) recipients.add(permit.submittedBy);
        if (permit.createdBy) recipients.add(permit.createdBy);
      }
    }

    await this.notificationDispatch.dispatch({
      tenantId: incident.tenantId,
      actorId,
      requirementId: 'FR-NOT-006',
      title: 'Incident reported',
      body: `${incident.reference}: ${incident.title}`,
      recipientUserIds: [...recipients],
      entityType: 'incident',
      entityId: incident.id,
      dedupeKey: `fr-not-006:${incident.id}`,
      sourceModule: 'incident',
      category: 'escalation',
      priority: 'high',
    });
  }

  async uploadEvidence(
    id: string,
    file: UploadedFilePayload | undefined,
    dto: UploadIncidentEvidenceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const incident = await this.requireIncident(id, tenantId);

    if (incident.status === 'closed') {
      throw new ConflictException('Evidence cannot be uploaded to a closed incident');
    }

    this.validateFile(file);
    const prefix =
      this.configService.get<string>('incident.evidencePrefix') ?? 'incidents/evidence';
    const bucket = this.storageService.getBucket();
    const storageKey = `${prefix}/${tenantId}/${id}/${randomUUID()}-${file!.originalname}`;

    try {
      await this.storageService.putObject(storageKey, file!.buffer, file!.mimetype, file!.size);
    } catch {
      throw new BadGatewayException('Evidence storage is temporarily unavailable');
    }

    const [evidence] = await this.db
      .insert(incidentEvidence)
      .values({
        tenantId,
        incidentId: id,
        fileName: file!.originalname,
        contentType: file!.mimetype,
        fileSize: file!.size,
        storageBucket: bucket,
        storageKey,
        comment: dto.comment ?? null,
        uploadedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.auditService.log({
      action: 'incident.evidence.uploaded',
      entityType: 'incident_evidence',
      entityId: evidence.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId: id, storageKey },
    });

    this.logService.logEvent({
      action: 'incident.evidence.uploaded',
      incidentId: id,
      tenantId,
      userId: actorId,
      metadata: { evidenceId: evidence.id },
    });

    await this.cacheService.invalidateIncident(tenantId, id);
    return evidence;
  }

  async listEvidence(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requireIncident(id, tenantId);
    return this.db
      .select()
      .from(incidentEvidence)
      .where(and(eq(incidentEvidence.tenantId, tenantId), eq(incidentEvidence.incidentId, id)))
      .orderBy(desc(incidentEvidence.createdAt));
  }

  private async loadList(tenantId: string) {
    return this.db
      .select()
      .from(incidents)
      .where(eq(incidents.tenantId, tenantId))
      .orderBy(desc(incidents.occurredAt));
  }

  private async loadDetail(id: string, tenantId: string) {
    const incident = await this.requireIncident(id, tenantId);
    const [evidence, equipment, linkedPermits] = await Promise.all([
      this.db
        .select()
        .from(incidentEvidence)
        .where(
          and(eq(incidentEvidence.tenantId, tenantId), eq(incidentEvidence.incidentId, id)),
        ),
      this.db
        .select()
        .from(incidentEquipment)
        .where(
          and(eq(incidentEquipment.tenantId, tenantId), eq(incidentEquipment.incidentId, id)),
        ),
      this.db
        .select()
        .from(incidentPermits)
        .where(and(eq(incidentPermits.tenantId, tenantId), eq(incidentPermits.incidentId, id))),
    ]);

    return { incident, evidence, equipment, permits: linkedPermits };
  }

  private async linkAssociations(
    incidentId: string,
    tenantId: string,
    actorId: string,
    permitIds?: string[],
    machineryIds?: string[],
  ) {
    if (permitIds?.length) {
      await this.db.insert(incidentPermits).values(
        permitIds.map((permitId) => ({
          tenantId,
          incidentId,
          permitId,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }
    if (machineryIds?.length) {
      await this.db.insert(incidentEquipment).values(
        machineryIds.map((machineryId) => ({
          tenantId,
          incidentId,
          machineryId,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }
  }

  private async assertPermitsBelongToTenant(permitIds: string[], tenantId: string) {
    const rows = await this.db
      .select({ id: permits.id })
      .from(permits)
      .where(and(eq(permits.tenantId, tenantId), inArray(permits.id, permitIds)));
    if (rows.length !== permitIds.length) {
      throw new BadRequestException('One or more permit references are invalid for this tenant');
    }
  }

  private async assertMachineryBelongToTenant(machineryIds: string[], tenantId: string) {
    const rows = await this.db
      .select({ id: machineryCatalogue.id })
      .from(machineryCatalogue)
      .where(
        and(eq(machineryCatalogue.tenantId, tenantId), inArray(machineryCatalogue.id, machineryIds)),
      );
    if (rows.length !== machineryIds.length) {
      throw new BadRequestException(
        'One or more equipment references are invalid for this tenant',
      );
    }
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

  private validateFile(file: UploadedFilePayload | undefined): asserts file is UploadedFilePayload {
    if (!file) {
      throw new BadRequestException('Evidence file is required');
    }
    if (file.size <= 0 || file.size > MAX_INCIDENT_EVIDENCE_SIZE_BYTES) {
      throw new BadRequestException('Evidence file size is invalid');
    }
    if (
      !ALLOWED_INCIDENT_EVIDENCE_CONTENT_TYPES.includes(
        file.mimetype as (typeof ALLOWED_INCIDENT_EVIDENCE_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Evidence content type is not allowed');
    }
  }

  private generateReference(): string {
    const year = new Date().getUTCFullYear();
    return `INC-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
