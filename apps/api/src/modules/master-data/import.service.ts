import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { importJobResults, importJobs } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AuditService } from '../logging/audit.service';
import { UploadedFilePayload } from './uploaded-file.interface';
import { BulkImportDto } from './dto/bulk-import.dto';
import { MASTER_DATA_IMPORT_JOB } from './master-data.constants';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

export interface MasterDataImportPayload {
  importJobId: string;
  tenantId: string;
  actorId: string;
  partialImport: boolean;
}

export interface MasterDataImportFile {
  permitTypes?: Array<{
    code: string;
    name: string;
    description?: string;
  }>;
  ppe?: Array<{
    code: string;
    name: string;
    category: string;
    description?: string;
  }>;
  workstations?: Array<{
    code: string;
    name: string;
    description?: string;
  }>;
  machinery?: Array<{
    code: string;
    name: string;
    workstationCode: string;
    description?: string;
  }>;
  hazards?: Array<{
    code: string;
    name: string;
    severity?: string;
    description?: string;
  }>;
  checklists?: Array<{
    code: string;
    name: string;
    description?: string;
    items: Array<{ description: string; isMandatory?: boolean }>;
  }>;
}

@Injectable()
export class ImportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async upload(
    file: UploadedFilePayload,
    dto: BulkImportDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.mimetype !== 'application/json') {
      throw new BadRequestException('Import file must be JSON');
    }

    let parsed: MasterDataImportFile;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8')) as MasterDataImportFile;
    } catch {
      throw new BadRequestException('Invalid JSON import file');
    }

    const totalRows = this.countRows(parsed);
    if (totalRows === 0) {
      throw new BadRequestException('Import file contains no records');
    }

    const bucket = this.storageService.getBucket();
    const storageKey = `${tenantId}/imports/${randomUUID()}-${file.originalname}`;

    await this.storageService.putObject(
      storageKey,
      file.buffer,
      file.mimetype,
      file.size,
    );

    const [job] = await this.db
      .insert(importJobs)
      .values({
        tenantId,
        status: 'pending',
        fileName: file.originalname,
        storageBucket: bucket,
        storageKey,
        partialImport: dto.partialImport ?? false,
        totalRows,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.queueService.getQueue().add(MASTER_DATA_IMPORT_JOB, {
      importJobId: job.id,
      tenantId,
      actorId: user.id,
      partialImport: dto.partialImport ?? false,
    } satisfies MasterDataImportPayload);

    await this.auditService.log({
      action: 'master-data.import.queued',
      entityType: 'import_job',
      entityId: job.id,
      userId: user.id,
      tenantId,
      metadata: { totalRows, partialImport: dto.partialImport ?? false },
    });

    this.logService.logEvent({
      action: 'master-data.import.queued',
      tenantId,
      userId: user.id,
      entityType: 'import_job',
      entityId: job.id,
      metadata: { totalRows },
    });

    return job;
  }

  async getStatus(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    const [job] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.tenantId, tenantId)));

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const results = await this.db
      .select()
      .from(importJobResults)
      .where(eq(importJobResults.importJobId, id));

    return { job, results };
  }

  private countRows(data: MasterDataImportFile): number {
    return (
      (data.permitTypes?.length ?? 0) +
      (data.ppe?.length ?? 0) +
      (data.workstations?.length ?? 0) +
      (data.machinery?.length ?? 0) +
      (data.hazards?.length ?? 0) +
      (data.checklists?.length ?? 0)
    );
  }
}
