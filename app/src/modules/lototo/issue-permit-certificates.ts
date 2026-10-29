import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { Database } from '../../database/database.module';
import { generateCertificateReference } from '../../database/certificate-reference';
import {
  isolationCertificatePermits,
  isolationCertificatePoints,
  isolationCertificates,
  lototoProcedureLockoutPoints,
  lototoProcedures,
  permitLototoInstances,
} from '../../database/schema';

type Writer = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export async function copyProcedurePoints(
  tx: Pick<Database, 'select' | 'insert'>,
  tenantId: string,
  certificateId: string,
  versionId: string,
  userId: string,
) {
  const sourcePoints = await tx
    .select()
    .from(lototoProcedureLockoutPoints)
    .where(eq(lototoProcedureLockoutPoints.versionId, versionId))
    .orderBy(asc(lototoProcedureLockoutPoints.sortOrder));
  if (sourcePoints.length === 0) {
    throw new BadRequestException('The published procedure has no isolation points');
  }
  const unproved = sourcePoints.find((point) => !point.proof);
  if (unproved) {
    throw new BadRequestException(`Point ${unproved.pointCode} has no proof on the published procedure`);
  }
  await tx.insert(isolationCertificatePoints).values(
    sourcePoints.map((point) => ({
      tenantId,
      certificateId,
      sourcePointId: point.id,
      sortOrder: point.sortOrder,
      removeOrder: point.removeOrder,
      pointCode: point.pointCode,
      energyType: point.energyType,
      energyOtherText: point.energyOtherText,
      magnitude: point.magnitude,
      locationText: point.locationText,
      method: point.method,
      normalPosition: point.normalPosition,
      isolatedPosition: point.isolatedPosition,
      action: point.action,
      restoreAction: point.restoreAction,
      device: point.device,
      proof: point.proof as string,
      drawingReference: point.drawingReference,
      createdBy: optionalUuid(userId),
      updatedBy: optionalUuid(userId),
    })),
  );
}

export async function issueCertificatesForApprovedPermit(
  tx: Writer,
  permit: { id: string; tenantId: string; workLocationId: string | null; siteId: string | null },
  userId: string,
): Promise<void> {
  const instances = await tx
    .select()
    .from(permitLototoInstances)
    .where(eq(permitLototoInstances.permitId, permit.id));
  if (instances.length === 0) {
    return;
  }

  for (const instance of instances) {
    let certificateId = instance.certificateId;
    if (!certificateId) {
      if (!permit.workLocationId) {
        throw new BadRequestException('A work location is required before isolation can be created');
      }
      const [procedure] = await tx
        .select()
        .from(lototoProcedures)
        .where(
          and(eq(lototoProcedures.id, instance.procedureId), eq(lototoProcedures.tenantId, permit.tenantId)),
        );
      if (!procedure?.publishedVersionId || procedure.status !== 'published') {
        throw new ConflictException('Publish the procedure before the permit can be approved');
      }
      const certificateNumber = await generateCertificateReference(tx, permit.tenantId);
      const [certificate] = await tx
        .insert(isolationCertificates)
        .values({
          tenantId: permit.tenantId,
          certificateNumber,
          title: procedure.title,
          discipline: 'combined',
          status: 'draft',
          procedureId: procedure.id,
          procedureVersionId: instance.procedureVersionId,
          siteId: permit.siteId,
          workLocationId: permit.workLocationId,
          assetId: procedure.assetId,
          isolationAuthorityId: optionalUuid(userId),
          createdBy: optionalUuid(userId),
          updatedBy: optionalUuid(userId),
        })
        .returning();
      await copyProcedurePoints(tx, permit.tenantId, certificate.id, instance.procedureVersionId, userId);
      certificateId = certificate.id;
      await tx
        .update(permitLototoInstances)
        .set({ certificateId, updatedBy: optionalUuid(userId) })
        .where(eq(permitLototoInstances.id, instance.id));
    } else {
      const [existing] = await tx
        .select()
        .from(isolationCertificates)
        .where(
          and(eq(isolationCertificates.id, certificateId), eq(isolationCertificates.tenantId, permit.tenantId)),
        );
      if (!existing) {
        throw new NotFoundException('Selected isolation was not found');
      }
      if (existing.status === 'closed') {
        throw new ConflictException(`${existing.certificateNumber} is closed`);
      }
      if (existing.procedureId && existing.procedureId !== instance.procedureId) {
        throw new ConflictException(`${existing.certificateNumber} is for a different procedure`);
      }
    }

    const [link] = await tx
      .select({
        id: isolationCertificatePermits.id,
        attachmentStatus: isolationCertificatePermits.attachmentStatus,
      })
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          eq(isolationCertificatePermits.permitId, permit.id),
        ),
      );
    if (link && link.attachmentStatus !== 'detached') {
      continue;
    }
    if (link) {
      await tx
        .update(isolationCertificatePermits)
        .set({
          attachmentStatus: 'attached',
          attachedAt: new Date(),
          attachedBy: optionalUuid(userId),
          detachedAt: null,
          detachedBy: null,
          updatedBy: optionalUuid(userId),
        })
        .where(eq(isolationCertificatePermits.id, link.id));
      continue;
    }
    await tx.insert(isolationCertificatePermits).values({
      tenantId: permit.tenantId,
      certificateId,
      permitId: permit.id,
      attachmentStatus: 'attached',
      attachedBy: optionalUuid(userId),
      createdBy: optionalUuid(userId),
      updatedBy: optionalUuid(userId),
    });
  }
}

const DRAFT_CERTIFICATE = new Set(['draft']);

/** A rejected or deleted permit closes a draft certificate that has no locks and no other permit. */
export async function cancelDraftCertificatesForPermit(
  tx: Writer,
  permitId: string,
  userId: string,
): Promise<void> {
  const links = await tx
    .select({
      certificateId: isolationCertificates.id,
      status: isolationCertificates.status,
    })
    .from(isolationCertificatePermits)
    .innerJoin(isolationCertificates, eq(isolationCertificatePermits.certificateId, isolationCertificates.id))
    .where(
      and(eq(isolationCertificatePermits.permitId, permitId), ne(isolationCertificatePermits.attachmentStatus, 'detached')),
    );

  for (const link of links) {
    if (!DRAFT_CERTIFICATE.has(link.status)) continue;
    const others = await tx
      .select({ id: isolationCertificatePermits.id })
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, link.certificateId),
          ne(isolationCertificatePermits.permitId, permitId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
        ),
      );
    if (others.length > 0) continue;
    const applied = await tx
      .select({ id: isolationCertificatePoints.id })
      .from(isolationCertificatePoints)
      .where(
        and(
          eq(isolationCertificatePoints.certificateId, link.certificateId),
          isNotNull(isolationCertificatePoints.appliedAt),
        ),
      );
    if (applied.length > 0) continue;
    await tx
      .update(isolationCertificates)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedBy: optionalUuid(userId),
      })
      .where(eq(isolationCertificates.id, link.certificateId));
  }
}
