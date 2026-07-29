import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  hazardCategories,
  importJobResults,
  importJobs,
  machineryCatalogue,
  permitTypes,
  ppeCatalogue,
  safetyChecklistItems,
  safetyChecklists,
  workstationCatalogue,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import type { MasterDataImportFile, MasterDataImportPayload } from './import.service';
import { MASTER_DATA_IMPORT_JOB } from './master-data.constants';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';

@Injectable()
export class ImportJobsService implements OnModuleInit {
  private readonly logger = new Logger(ImportJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly cacheService: MasterDataCacheService,
    private readonly logService: MasterDataLogService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerHandler(MASTER_DATA_IMPORT_JOB, async (job) => {
      await this.processImport(job as Job<MasterDataImportPayload>);
    });
  }

  async processImport(job: Job<MasterDataImportPayload>): Promise<void> {
    const { importJobId, tenantId, actorId, partialImport } = job.data;

    const [importJob] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, importJobId), eq(importJobs.tenantId, tenantId)));

    if (!importJob) {
      throw new Error(`Import job ${importJobId} not found`);
    }

    await this.db
      .update(importJobs)
      .set({ status: 'processing', updatedBy: actorId })
      .where(eq(importJobs.id, importJobId));

    const buffer = await this.storageService.getClient().getObject(
      importJob.storageBucket,
      importJob.storageKey,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of buffer) {
      chunks.push(Buffer.from(chunk));
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as MasterDataImportFile;

    let successCount = 0;
    let failureCount = 0;
    let rowNumber = 0;

    const workstationCodeMap = new Map<string, string>();

    const recordResult = async (
      entityType: string,
      status: 'success' | 'failure',
      message?: string,
      entityId?: string,
    ) => {
      rowNumber += 1;
      if (status === 'success') {
        successCount += 1;
      } else {
        failureCount += 1;
      }
      await this.db.insert(importJobResults).values({
        importJobId,
        rowNumber,
        entityType,
        status,
        message: message ?? null,
        entityId: entityId ?? null,
      });
    };

    for (const row of parsed.workstations ?? []) {
      try {
        const [created] = await this.db
          .insert(workstationCatalogue)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            description: row.description,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        workstationCodeMap.set(row.code, created.id);
        await recordResult('workstation', 'success', undefined, created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('workstation', 'failure', message);
      }
    }

    for (const row of parsed.permitTypes ?? []) {
      try {
        const [created] = await this.db
          .insert(permitTypes)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            description: row.description,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        await recordResult('permit_type', 'success', undefined, created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('permit_type', 'failure', message);
      }
    }

    for (const row of parsed.ppe ?? []) {
      try {
        const [created] = await this.db
          .insert(ppeCatalogue)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            category: row.category,
            description: row.description,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        await recordResult('ppe', 'success', undefined, created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('ppe', 'failure', message);
      }
    }

    for (const row of parsed.hazards ?? []) {
      try {
        const [created] = await this.db
          .insert(hazardCategories)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            severity: row.severity ?? 'medium',
            description: row.description,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        await recordResult('hazard', 'success', undefined, created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('hazard', 'failure', message);
      }
    }

    for (const row of parsed.machinery ?? []) {
      try {
        const workstationId = workstationCodeMap.get(row.workstationCode);
        if (!workstationId) {
          throw new Error(`Workstation code '${row.workstationCode}' not found`);
        }
        const [created] = await this.db
          .insert(machineryCatalogue)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            description: row.description,
            workstationId,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        await recordResult('machinery', 'success', undefined, created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('machinery', 'failure', message);
      }
    }

    for (const row of parsed.checklists ?? []) {
      try {
        if (!row.items?.length) {
          throw new Error('Checklist must contain at least one item');
        }
        const [checklist] = await this.db
          .insert(safetyChecklists)
          .values({
            tenantId,
            code: row.code.trim(),
            name: row.name.trim(),
            description: row.description,
            status: 'draft',
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();

        await this.db.insert(safetyChecklistItems).values(
          row.items.map((item, index) => ({
            checklistId: checklist.id,
            sequence: index + 1,
            description: item.description.trim(),
            isMandatory: item.isMandatory ?? false,
            createdBy: actorId,
          })),
        );

        await recordResult('checklist', 'success', undefined, checklist.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed';
        if (!partialImport) {
          throw error;
        }
        await recordResult('checklist', 'failure', message);
      }
    }

    const finalStatus = failureCount > 0 && successCount === 0 ? 'failed' : 'completed';

    await this.db
      .update(importJobs)
      .set({
        status: finalStatus,
        successCount,
        failureCount,
        updatedBy: actorId,
      })
      .where(eq(importJobs.id, importJobId));

    await this.cacheService.invalidate(tenantId);

    this.logService.logEvent({
      action: 'master-data.import.completed',
      tenantId,
      userId: actorId,
      entityType: 'import_job',
      entityId: importJobId,
      metadata: { successCount, failureCount },
    });

    this.logger.log(
      `Import ${importJobId} completed: ${successCount} success, ${failureCount} failures`,
    );
  }
}
