import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, max } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  lototoProcedureAuthorizedRoles,
  lototoProcedureLockoutPoints,
  lototoProcedurePhotos,
  lototoProcedureSequenceSteps,
  lototoProcedureVersions,
  lototoProcedures,
  permitLototoInstances,
} from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../permit/permit.constants';
import {
  CreateLototoProcedureDto,
  LototoProcedureContentDto,
  UpdateLototoProcedureDto,
} from './dto/lototo-procedure.dto';
import { LototoValidationService } from './lototo-validation.service';

@Injectable()
export class LototoProcedureService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateLototoProcedureDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    await this.validationService.assertMachineryExists(tenantId, dto.machineryId);
    if (dto.workstationId) {
      await this.validationService.assertWorkstationExists(tenantId, dto.workstationId);
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [procedure] = await tx
          .insert(lototoProcedures)
          .values({
            tenantId,
            machineryId: dto.machineryId,
            workstationId: dto.workstationId,
            code: dto.code.trim(),
            title: dto.title.trim(),
            status: 'draft',
            createdBy: optionalUuid(user.id),
            updatedBy: optionalUuid(user.id),
          })
          .returning();

        const [version] = await tx
          .insert(lototoProcedureVersions)
          .values({
            procedureId: procedure.id,
            versionNumber: 1,
            facility: dto.facility,
            locationText: dto.locationText,
            purpose: dto.purpose,
            scope: dto.scope,
            authorization: dto.authorization,
            enforcement: dto.enforcement,
            description: dto.description,
            note: dto.note,
            createdBy: optionalUuid(user.id),
            updatedBy: optionalUuid(user.id),
          })
          .returning();

        await this.replaceVersionContent(tx, version.id, dto, user.id);

        await this.auditService.log({
          action: 'lototo.procedure.created',
          entityType: 'lototo_procedure',
          entityId: procedure.id,
          userId: optionalUuid(user.id),
          tenantId,
          metadata: { machineryId: dto.machineryId, code: procedure.code },
        });

        return this.assemble(tx, procedure.id, tenantId);
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('LOTOTO procedure code already exists for this tenant');
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, machineryId?: string, publishedOnly?: boolean) {
    const tenantId = this.validationService.requireTenant(user);
    const conditions = [eq(lototoProcedures.tenantId, tenantId)];
    if (machineryId) {
      conditions.push(eq(lototoProcedures.machineryId, machineryId));
    }
    if (publishedOnly) {
      conditions.push(eq(lototoProcedures.status, 'published'));
    }

    return this.db
      .select()
      .from(lototoProcedures)
      .where(and(...conditions))
      .orderBy(asc(lototoProcedures.code));
  }

  async get(id: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    return this.assemble(this.db, id, tenantId);
  }

  async getVersion(versionId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const [row] = await this.db
      .select({ version: lototoProcedureVersions, procedure: lototoProcedures })
      .from(lototoProcedureVersions)
      .innerJoin(lototoProcedures, eq(lototoProcedureVersions.procedureId, lototoProcedures.id))
      .where(
        and(eq(lototoProcedureVersions.id, versionId), eq(lototoProcedures.tenantId, tenantId)),
      );
    if (!row) {
      throw new NotFoundException('LOTOTO procedure version not found');
    }
    const content = await this.loadVersionContent(this.db, versionId);
    return { ...row.version, ...content, procedure: row.procedure };
  }

  async update(id: string, dto: UpdateLototoProcedureDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const procedure = await this.requireProcedure(id, tenantId);
    if (dto.machineryId) {
      await this.validationService.assertMachineryExists(tenantId, dto.machineryId);
    }
    if (dto.workstationId) {
      await this.validationService.assertWorkstationExists(tenantId, dto.workstationId);
    }

    const draft = await this.latestUnpublishedVersion(procedure.id);
    if (this.hasContent(dto) && !draft) {
      throw new ConflictException('Create a new revision before changing a published procedure');
    }

    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .update(lototoProcedures)
          .set({
            machineryId: dto.machineryId ?? procedure.machineryId,
            workstationId: dto.workstationId ?? procedure.workstationId,
            code: dto.code?.trim() ?? procedure.code,
            title: dto.title?.trim() ?? procedure.title,
            updatedBy: optionalUuid(user.id),
            updatedAt: new Date(),
          })
          .where(eq(lototoProcedures.id, procedure.id));

        if (draft && this.hasContent(dto)) {
          await tx
            .update(lototoProcedureVersions)
            .set({
              facility: dto.facility ?? draft.facility,
              locationText: dto.locationText ?? draft.locationText,
              purpose: dto.purpose ?? draft.purpose,
              scope: dto.scope ?? draft.scope,
              authorization: dto.authorization ?? draft.authorization,
              enforcement: dto.enforcement ?? draft.enforcement,
              description: dto.description ?? draft.description,
              note: dto.note ?? draft.note,
              updatedBy: optionalUuid(user.id),
              updatedAt: new Date(),
            })
            .where(eq(lototoProcedureVersions.id, draft.id));
          await this.replaceVersionContent(tx, draft.id, dto, user.id);
        }

        await this.auditService.log({
          action: 'lototo.procedure.updated',
          entityType: 'lototo_procedure',
          entityId: procedure.id,
          userId: optionalUuid(user.id),
          tenantId,
        });

        return this.assemble(tx, procedure.id, tenantId);
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('LOTOTO procedure code already exists for this tenant');
      }
      throw error;
    }
  }

  async publish(id: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const procedure = await this.requireProcedure(id, tenantId);
    const draft = await this.latestUnpublishedVersion(procedure.id);
    if (!draft) {
      throw new ConflictException('No unpublished version to publish');
    }

    await this.db
      .update(lototoProcedureVersions)
      .set({
        publishedAt: new Date(),
        updatedBy: optionalUuid(user.id),
        updatedAt: new Date(),
      })
      .where(eq(lototoProcedureVersions.id, draft.id));

    await this.db
      .update(lototoProcedures)
      .set({
        status: 'published',
        publishedVersionId: draft.id,
        updatedBy: optionalUuid(user.id),
        updatedAt: new Date(),
      })
      .where(eq(lototoProcedures.id, procedure.id));

    await this.auditService.log({
      action: 'lototo.procedure.published',
      entityType: 'lototo_procedure',
      entityId: procedure.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { versionId: draft.id, versionNumber: draft.versionNumber },
    });

    return this.assemble(this.db, procedure.id, tenantId);
  }

  async createRevision(id: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const procedure = await this.requireProcedure(id, tenantId);
    if (!procedure.publishedVersionId) {
      throw new ConflictException('Publish the procedure before creating a revision');
    }
    const existingDraft = await this.latestUnpublishedVersion(procedure.id);
    if (existingDraft) {
      throw new ConflictException('An unpublished revision already exists');
    }

    const published = await this.getVersion(procedure.publishedVersionId, user);
    const [maxRow] = await this.db
      .select({ n: max(lototoProcedureVersions.versionNumber) })
      .from(lototoProcedureVersions)
      .where(eq(lototoProcedureVersions.procedureId, procedure.id));
    const nextNumber = (maxRow?.n ?? 0) + 1;

    await this.db.transaction(async (tx) => {
      const [version] = await tx
        .insert(lototoProcedureVersions)
        .values({
          procedureId: procedure.id,
          versionNumber: nextNumber,
          facility: published.facility,
          locationText: published.locationText,
          purpose: published.purpose,
          scope: published.scope,
          authorization: published.authorization,
          enforcement: published.enforcement,
          description: published.description,
          note: published.note,
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        })
        .returning();

      await this.replaceVersionContent(
        tx,
        version.id,
        {
          lockoutPoints: published.lockoutPoints.map((point) => ({
            sortOrder: point.sortOrder,
            pointCode: point.pointCode,
            energyType: point.energyType,
            magnitude: point.magnitude ?? undefined,
            locationText: point.locationText ?? undefined,
            action: point.action ?? undefined,
            device: point.device ?? undefined,
            verificationMethod: point.verificationMethod ?? undefined,
          })),
          sequenceSteps: published.sequenceSteps.map((step) => ({
            phase: step.phase as 'apply' | 'remove',
            sequenceOrder: step.sequenceOrder,
            title: step.title,
            description: step.description ?? undefined,
          })),
          authorizedRoles: published.authorizedRoles,
        },
        user.id,
      );

      const publishedPhotos = await tx
        .select({
          pointCode: lototoProcedureLockoutPoints.pointCode,
          photo: lototoProcedurePhotos,
        })
        .from(lototoProcedurePhotos)
        .innerJoin(
          lototoProcedureLockoutPoints,
          eq(lototoProcedurePhotos.lockoutPointId, lototoProcedureLockoutPoints.id),
        )
        .where(eq(lototoProcedureLockoutPoints.versionId, published.id));
      const newPoints = await tx
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, version.id));
      const byCode = new Map(newPoints.map((point) => [point.pointCode, point.id]));
      for (const row of publishedPhotos) {
        const lockoutPointId = byCode.get(row.pointCode);
        if (!lockoutPointId) {
          continue;
        }
        await tx.insert(lototoProcedurePhotos).values({
          versionId: version.id,
          lockoutPointId,
          fileName: row.photo.fileName,
          contentType: row.photo.contentType,
          storageBucket: row.photo.storageBucket,
          storageKey: row.photo.storageKey,
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        });
      }
    });

    await this.auditService.log({
      action: 'lototo.procedure.revised',
      entityType: 'lototo_procedure',
      entityId: procedure.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { versionNumber: nextNumber },
    });

    return this.assemble(this.db, procedure.id, tenantId);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const procedure = await this.requireProcedure(id, tenantId);
    const [attached] = await this.db
      .select({ id: permitLototoInstances.id })
      .from(permitLototoInstances)
      .where(eq(permitLototoInstances.procedureId, procedure.id));
    if (attached) {
      throw new ConflictException('Cannot delete a LOTOTO procedure that is used on a permit');
    }

    await this.db.delete(lototoProcedures).where(eq(lototoProcedures.id, procedure.id));
    await this.auditService.log({
      action: 'lototo.procedure.deleted',
      entityType: 'lototo_procedure',
      entityId: procedure.id,
      userId: optionalUuid(user.id),
      tenantId,
    });

    return { id: procedure.id, deleted: true };
  }

  async uploadPointPhoto(procedureId: string, pointId: string, file: UploadedFilePayload, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes`);
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Isolation point photos must be JPEG, PNG, or WebP');
    }

    const procedure = await this.requireProcedure(procedureId, tenantId);
    const draft = await this.latestUnpublishedVersion(procedure.id);
    if (!draft) {
      throw new ConflictException('Create a new revision before adding photos to a published procedure');
    }
    const [point] = await this.db
      .select()
      .from(lototoProcedureLockoutPoints)
      .where(
        and(eq(lototoProcedureLockoutPoints.id, pointId), eq(lototoProcedureLockoutPoints.versionId, draft.id)),
      );
    if (!point) {
      throw new NotFoundException('Isolation point not found on the draft procedure');
    }

    const existing = await this.db
      .select()
      .from(lototoProcedurePhotos)
      .where(eq(lototoProcedurePhotos.lockoutPointId, point.id));
    for (const photo of existing) {
      try {
        await this.storageService.deleteObject(photo.storageKey);
      } catch {
        // continue
      }
      await this.db.delete(lototoProcedurePhotos).where(eq(lototoProcedurePhotos.id, photo.id));
    }

    const storageKey = `${tenantId}/lototo/${procedure.id}/${point.id}/${randomUUID()}-${file.originalname}`;
    await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);
    await this.db.insert(lototoProcedurePhotos).values({
      versionId: draft.id,
      lockoutPointId: point.id,
      fileName: file.originalname,
      contentType: file.mimetype,
      storageBucket: this.storageService.getBucket(),
      storageKey,
      createdBy: optionalUuid(user.id),
      updatedBy: optionalUuid(user.id),
    });
    return this.assemble(this.db, procedure.id, tenantId);
  }

  async removePointPhoto(procedureId: string, pointId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const procedure = await this.requireProcedure(procedureId, tenantId);
    const draft = await this.latestUnpublishedVersion(procedure.id);
    if (!draft) {
      throw new ConflictException('Create a new revision before changing photos on a published procedure');
    }
    const photos = await this.db
      .select()
      .from(lototoProcedurePhotos)
      .innerJoin(
        lototoProcedureLockoutPoints,
        eq(lototoProcedurePhotos.lockoutPointId, lototoProcedureLockoutPoints.id),
      )
      .where(
        and(
          eq(lototoProcedureLockoutPoints.id, pointId),
          eq(lototoProcedureLockoutPoints.versionId, draft.id),
        ),
      );
    for (const row of photos) {
      try {
        await this.storageService.deleteObject(row.lototo_procedure_photos.storageKey);
      } catch {
        // continue
      }
      await this.db.delete(lototoProcedurePhotos).where(eq(lototoProcedurePhotos.id, row.lototo_procedure_photos.id));
    }
    return this.assemble(this.db, procedure.id, tenantId);
  }

  private async requireProcedure(id: string, tenantId: string) {
    const [procedure] = await this.db
      .select()
      .from(lototoProcedures)
      .where(and(eq(lototoProcedures.id, id), eq(lototoProcedures.tenantId, tenantId)));
    if (!procedure) {
      throw new NotFoundException('LOTOTO procedure not found');
    }
    return procedure;
  }

  private async latestUnpublishedVersion(procedureId: string) {
    const [row] = await this.db
      .select()
      .from(lototoProcedureVersions)
      .where(eq(lototoProcedureVersions.procedureId, procedureId))
      .orderBy(desc(lototoProcedureVersions.versionNumber));
    if (!row || row.publishedAt) {
      return null;
    }
    return row;
  }

  private hasContent(dto: LototoProcedureContentDto) {
    return (
      dto.facility !== undefined ||
      dto.locationText !== undefined ||
      dto.purpose !== undefined ||
      dto.scope !== undefined ||
      dto.authorization !== undefined ||
      dto.enforcement !== undefined ||
      dto.description !== undefined ||
      dto.note !== undefined ||
      dto.lockoutPoints !== undefined ||
      dto.sequenceSteps !== undefined ||
      dto.authorizedRoles !== undefined
    );
  }

  private async replaceVersionContent(
    tx: Pick<Database, 'insert' | 'delete' | 'select' | 'update'>,
    versionId: string,
    dto: LototoProcedureContentDto,
    userId: string,
  ) {
    if (dto.lockoutPoints) {
      const existingPoints = await tx
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, versionId));
      const existingPhotos = await tx
        .select()
        .from(lototoProcedurePhotos)
        .where(eq(lototoProcedurePhotos.versionId, versionId));
      const photosByCode = new Map(
        existingPhotos.map((photo) => {
          const point = existingPoints.find((row) => row.id === photo.lockoutPointId);
          return [point?.pointCode ?? photo.id, photo];
        }),
      );

      await tx
        .delete(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, versionId));
      if (dto.lockoutPoints.length > 0) {
        await tx.insert(lototoProcedureLockoutPoints).values(
          dto.lockoutPoints.map((point) => ({
            versionId,
            sortOrder: point.sortOrder,
            pointCode: point.pointCode,
            energyType: point.energyType,
            magnitude: point.magnitude,
            locationText: point.locationText,
            action: point.action,
            device: point.device,
            verificationMethod: point.verificationMethod,
            createdBy: optionalUuid(userId),
            updatedBy: optionalUuid(userId),
          })),
        );
      }
      const newPoints = await tx
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, versionId));
      for (const point of newPoints) {
        const photo = photosByCode.get(point.pointCode);
        if (!photo) {
          continue;
        }
        await tx
          .update(lototoProcedurePhotos)
          .set({ lockoutPointId: point.id, updatedBy: optionalUuid(userId) })
          .where(eq(lototoProcedurePhotos.id, photo.id));
      }
    }

    if (dto.sequenceSteps) {
      await tx
        .delete(lototoProcedureSequenceSteps)
        .where(eq(lototoProcedureSequenceSteps.versionId, versionId));
      if (dto.sequenceSteps.length > 0) {
        await tx.insert(lototoProcedureSequenceSteps).values(
          dto.sequenceSteps.map((step) => ({
            versionId,
            phase: step.phase,
            sequenceOrder: step.sequenceOrder,
            title: step.title,
            description: step.description,
            createdBy: optionalUuid(userId),
            updatedBy: optionalUuid(userId),
          })),
        );
      }
    }

    if (dto.authorizedRoles) {
      await tx
        .delete(lototoProcedureAuthorizedRoles)
        .where(eq(lototoProcedureAuthorizedRoles.versionId, versionId));
      if (dto.authorizedRoles.length > 0) {
        await tx.insert(lototoProcedureAuthorizedRoles).values(
          dto.authorizedRoles.map((role) => ({
            versionId,
            role,
            createdBy: optionalUuid(userId),
            updatedBy: optionalUuid(userId),
          })),
        );
      }
    }
  }

  private async loadVersionContent(db: Pick<Database, 'select'>, versionId: string) {
    const [lockoutPoints, sequenceSteps, roles, photos] = await Promise.all([
      db
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, versionId))
        .orderBy(asc(lototoProcedureLockoutPoints.sortOrder)),
      db
        .select()
        .from(lototoProcedureSequenceSteps)
        .where(eq(lototoProcedureSequenceSteps.versionId, versionId))
        .orderBy(asc(lototoProcedureSequenceSteps.phase), asc(lototoProcedureSequenceSteps.sequenceOrder)),
      db
        .select()
        .from(lototoProcedureAuthorizedRoles)
        .where(eq(lototoProcedureAuthorizedRoles.versionId, versionId)),
      db.select().from(lototoProcedurePhotos).where(eq(lototoProcedurePhotos.versionId, versionId)),
    ]);
    const points = await Promise.all(
      lockoutPoints.map(async (point) => {
        const photo = photos.find((row) => row.lockoutPointId === point.id);
        return {
          ...point,
          photo: photo
            ? {
                id: photo.id,
                fileName: photo.fileName,
                url: await this.storageService.presignedGetObject(photo.storageKey, 3600),
              }
            : null,
        };
      }),
    );
    return {
      lockoutPoints: points,
      sequenceSteps,
      authorizedRoles: roles.map((row) => row.role),
    };
  }

  private async assemble(
    db: Pick<Database, 'select'>,
    procedureId: string,
    tenantId: string,
  ) {
    const [procedure] = await db
      .select()
      .from(lototoProcedures)
      .where(and(eq(lototoProcedures.id, procedureId), eq(lototoProcedures.tenantId, tenantId)));
    if (!procedure) {
      throw new NotFoundException('LOTOTO procedure not found');
    }
    const versions = await db
      .select()
      .from(lototoProcedureVersions)
      .where(eq(lototoProcedureVersions.procedureId, procedureId))
      .orderBy(desc(lototoProcedureVersions.versionNumber));

    const published =
      procedure.publishedVersionId
        ? versions.find((row) => row.id === procedure.publishedVersionId)
        : undefined;
    const draft = versions.find((row) => !row.publishedAt);
    const publishedContent = published
      ? await this.loadVersionContent(db, published.id)
      : { lockoutPoints: [], sequenceSteps: [], authorizedRoles: [] };
    const draftContent = draft
      ? await this.loadVersionContent(db, draft.id)
      : { lockoutPoints: [], sequenceSteps: [], authorizedRoles: [] };

    return {
      ...procedure,
      versions: versions.map((row) => ({
        id: row.id,
        versionNumber: row.versionNumber,
        publishedAt: row.publishedAt,
      })),
      publishedVersion: published ? { ...published, ...publishedContent } : null,
      draftVersion: draft ? { ...draft, ...draftContent } : null,
    };
  }
}
