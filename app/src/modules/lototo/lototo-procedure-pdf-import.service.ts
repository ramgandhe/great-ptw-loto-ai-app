import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { inspect } from 'util';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assets,
  lototoProcedurePdfImportJobs,
  lototoProcedurePhotos,
  workLocations,
} from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { readLototoPdf } from '../lototo-pdf-extraction/pdf-document-reader';
import { LototoPdfExtractionService } from '../lototo-pdf-extraction/lototo-pdf-extraction.service';
import type { LototoPdfExtractionResult } from '../lototo-pdf-extraction/lototo-pdf-extraction.types';
import { LOTOTO_PROCEDURE_PDF_IMPORT_JOB } from './lototo.constants';
import { LototoProcedureImportService } from './lototo-procedure-import.service';
import { LototoProcedureService } from './lototo-procedure.service';
import { LototoValidationService } from './lototo-validation.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';

const PDF_STATUSES_TERMINAL = ['completed', 'failed', 'cancelled'] as const;

@Injectable()
export class LototoProcedurePdfImportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly extractionService: LototoPdfExtractionService,
    private readonly importService: LototoProcedureImportService,
    private readonly procedureService: LototoProcedureService,
    private readonly validationService: LototoValidationService,
  ) {}

  async start(file: UploadedFilePayload | undefined, user: AuthenticatedUser) {
    this.assertPdf(file);
    this.assertConfigured();
    const tenantId = this.validationService.requireTenant(user);
    const jobId = randomUUID();
    const storageKey = `${tenantId}/lototo/pdf-import/${jobId}/${file.originalname || 'procedure.pdf'}`;
    await this.storageService.putObject(storageKey, file.buffer, 'application/pdf', file.size);
    const ttlHours = this.configService.get<number>('lototo.pdfImport.ttlHours') ?? 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.db.insert(lototoProcedurePdfImportJobs).values({
      id: jobId,
      tenantId,
      status: 'queued',
      fileName: file.originalname || 'procedure.pdf',
      storageBucket: this.storageService.getBucket(),
      storageKey,
      actor: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        tenantId: user.tenantId,
      },
      expiresAt,
      createdBy: optionalUuid(user.id),
      updatedBy: optionalUuid(user.id),
    });
    await this.queueService.getQueue().add(LOTOTO_PROCEDURE_PDF_IMPORT_JOB, { jobId });
    return { jobId };
  }

  async getStatus(jobId: string, user: AuthenticatedUser) {
    const job = await this.requireJob(jobId, this.validationService.requireTenant(user));
    return this.toStatus(job);
  }

  async confirmOverride(jobId: string, user: AuthenticatedUser) {
    const job = await this.requireJob(jobId, this.validationService.requireTenant(user));
    if (job.status !== 'awaiting_override') {
      throw new BadRequestException('This import is not waiting for an override confirmation');
    }
    await this.db
      .update(lototoProcedurePdfImportJobs)
      .set({ confirmOverride: true, status: 'queued', updatedAt: new Date(), updatedBy: optionalUuid(user.id) })
      .where(eq(lototoProcedurePdfImportJobs.id, job.id));
    await this.queueService.getQueue().add(LOTOTO_PROCEDURE_PDF_IMPORT_JOB, { jobId: job.id });
    return { jobId: job.id };
  }

  async cancel(jobId: string, user: AuthenticatedUser) {
    const job = await this.requireJob(jobId, this.validationService.requireTenant(user));
    if ((PDF_STATUSES_TERMINAL as readonly string[]).includes(job.status)) {
      return this.toStatus(job);
    }
    await this.deleteStoredPdf(job.storageKey);
    const [updated] = await this.db
      .update(lototoProcedurePdfImportJobs)
      .set({ status: 'cancelled', updatedAt: new Date(), updatedBy: optionalUuid(user.id) })
      .where(eq(lototoProcedurePdfImportJobs.id, job.id))
      .returning();
    return this.toStatus(updated);
  }

  async process(jobId: string) {
    const [job] = await this.db
      .select()
      .from(lototoProcedurePdfImportJobs)
      .where(eq(lototoProcedurePdfImportJobs.id, jobId));
    if (!job || (PDF_STATUSES_TERMINAL as readonly string[]).includes(job.status)) return;
    if (job.status === 'awaiting_override' && !job.confirmOverride) return;

    const user = job.actor as unknown as AuthenticatedUser;
    try {
      let extraction = job.extractionResult as LototoPdfExtractionResult | null;
      if (!extraction) {
        await this.setStatus(job.id, 'extracting');
        const pdf = await this.storageService.getObject(job.storageKey);
        const bundle = await this.extractionService.extract(pdf, await this.tenantHints(job.tenantId), async (stage) => {
          await this.setStatus(job.id, stage);
        });
        extraction = bundle.result;
        await this.db
          .update(lototoProcedurePdfImportJobs)
          .set({
            extractionResult: extraction as unknown as Record<string, unknown>,
            warnings: extraction.warnings,
            updatedAt: new Date(),
          })
          .where(eq(lototoProcedurePdfImportJobs.id, job.id));
      }

      await this.setStatus(job.id, 'creating_draft');
      const committed = await this.importService.importParsed(
        {
          dto: extraction.dto,
          procedureCode: extraction.procedureCode,
          assetCode: extraction.assetCode,
          workLocationCode: extraction.workLocationCode,
        },
        job.confirmOverride,
        user,
        { softMasterData: true },
      );
      await this.attachImages(job.storageKey, extraction, committed.procedure.id, user);
      await this.deleteStoredPdf(job.storageKey);
      const warnings = [...(extraction.warnings ?? []), ...committed.warnings];
      await this.db
        .update(lototoProcedurePdfImportJobs)
        .set({
          status: 'completed',
          procedureId: committed.procedure.id,
          warnings,
          updatedAt: new Date(),
        })
        .where(eq(lototoProcedurePdfImportJobs.id, job.id));
    } catch (error) {
      if (this.isOverrideRequired(error)) {
        const response = (error as ConflictException).getResponse() as { details?: unknown };
        await this.db
          .update(lototoProcedurePdfImportJobs)
          .set({
            status: 'awaiting_override',
            warnings: [response.details],
            updatedAt: new Date(),
          })
          .where(eq(lototoProcedurePdfImportJobs.id, job.id));
        return;
      }
      if (error instanceof ServiceUnavailableException) throw error;
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : `PDF import failed: ${inspect(error, { depth: 3 })}`;
      await this.db
        .update(lototoProcedurePdfImportJobs)
        .set({
          status: 'failed',
          errors: [{ message }],
          updatedAt: new Date(),
        })
        .where(eq(lototoProcedurePdfImportJobs.id, job.id));
    }
  }

  async cleanupExpired() {
    const rows = await this.db
      .select()
      .from(lototoProcedurePdfImportJobs)
      .where(
        and(
          lt(lototoProcedurePdfImportJobs.expiresAt, new Date()),
          inArray(lototoProcedurePdfImportJobs.status, ['queued', 'extracting', 'interpreting', 'awaiting_override', 'creating_draft', 'failed']),
        ),
      );
    for (const row of rows) {
      await this.deleteStoredPdf(row.storageKey);
      await this.db
        .update(lototoProcedurePdfImportJobs)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(lototoProcedurePdfImportJobs.id, row.id));
    }
    return rows.length;
  }

  private async attachImages(
    storageKey: string,
    extraction: LototoPdfExtractionResult,
    procedureId: string,
    user: AuthenticatedUser,
  ) {
    if (!extraction.images.length) return;
    const pdf = await this.storageService.getObject(storageKey);
    const { images } = await readLototoPdf(pdf);
    let procedure = await this.procedureService.get(procedureId, user);
    for (const ref of extraction.images) {
      const image = images.find((item) => item.index === ref.index);
      if (!image) continue;
      const file: UploadedFilePayload = {
        originalname: image.fileName,
        mimetype: image.contentType,
        size: image.bytes.length,
        buffer: image.bytes,
      };
      const draft = procedure.draftVersion;
      const point = ref.pointCode
        ? draft?.lockoutPoints.find((item) => item.pointCode === ref.pointCode)
        : undefined;
      if (point?.id) {
        procedure = await this.procedureService.uploadPointPhoto(procedureId, point.id, file, user);
        continue;
      }
      if (!draft?.id) continue;
      const key = `${user.tenantId}/lototo/${procedureId}/unassigned/${randomUUID()}-${image.fileName}`;
      await this.storageService.putObject(key, image.bytes, image.contentType, image.bytes.length);
      await this.db.insert(lototoProcedurePhotos).values({
        versionId: draft.id,
        fileName: image.fileName,
        contentType: image.contentType,
        storageBucket: this.storageService.getBucket(),
        storageKey: key,
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      });
    }
  }

  private async tenantHints(tenantId: string) {
    const [assetRows, locationRows] = await Promise.all([
      this.db
        .select({ code: assets.tag, name: assets.name })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), eq(assets.status, 'active')))
        .limit(200),
      this.db
        .select({ code: workLocations.code, name: workLocations.name })
        .from(workLocations)
        .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.status, 'active')))
        .limit(200),
    ]);
    return { assets: assetRows, workLocations: locationRows };
  }

  private assertPdf(file: UploadedFilePayload | undefined): asserts file is UploadedFilePayload {
    const maxBytes = this.configService.get<number>('lototo.pdfImport.maxBytes') ?? 20 * 1024 * 1024;
    if (!file?.buffer?.length) {
      throw new BadRequestException('A .pdf file is required');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${maxBytes} bytes`);
    }
    const name = (file.originalname || '').toLowerCase();
    const type = (file.mimetype || '').toLowerCase();
    if (!name.endsWith('.pdf') && type !== 'application/pdf') {
      throw new BadRequestException('Only .pdf files are accepted');
    }
  }

  private assertConfigured() {
    const apiKey = this.configService.get<string>('lototo.pdfImport.llmApiKey') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException('LOTOTO PDF import is not configured (missing API key)');
    }
  }

  private async requireJob(jobId: string, tenantId: string) {
    const [job] = await this.db
      .select()
      .from(lototoProcedurePdfImportJobs)
      .where(and(eq(lototoProcedurePdfImportJobs.id, jobId), eq(lototoProcedurePdfImportJobs.tenantId, tenantId)));
    if (!job) throw new NotFoundException('PDF import job not found');
    return job;
  }

  private async setStatus(jobId: string, status: string) {
    await this.db
      .update(lototoProcedurePdfImportJobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(lototoProcedurePdfImportJobs.id, jobId));
  }

  private async deleteStoredPdf(storageKey: string) {
    try {
      await this.storageService.deleteObject(storageKey);
    } catch {
      // The temp PDF may already be gone.
    }
  }

  private isOverrideRequired(error: unknown) {
    if (!(error instanceof ConflictException)) return false;
    const body = error.getResponse();
    return typeof body === 'object' && body !== null && (body as { error?: string }).error === 'PROCEDURE_IMPORT_OVERRIDE_REQUIRED';
  }

  private toStatus(job: typeof lototoProcedurePdfImportJobs.$inferSelect) {
    return {
      jobId: job.id,
      status: job.status,
      fileName: job.fileName,
      procedureId: job.procedureId,
      warnings: job.warnings,
      errors: job.errors,
    };
  }
}
