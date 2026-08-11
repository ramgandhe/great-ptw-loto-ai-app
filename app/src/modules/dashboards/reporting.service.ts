import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { reportExports } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { DashboardLogService } from './dashboard-log.service';
import { DASHBOARD_REPORT_PREFIX } from './dashboards.constants';
import { ListReportsQueryDto, ReportRequestDto } from './dto/dashboard.dto';
import {
  OperationalFilters,
  OperationalMetricsService,
} from './operational-metrics.service';

@Injectable()
export class ReportingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly logService: DashboardLogService,
    private readonly auditService: AuditService,
    private readonly metrics: OperationalMetricsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListReportsQueryDto) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const conditions = [
      eq(reportExports.tenantId, tenantId),
      eq(reportExports.requestedBy, actorId),
    ];
    if (query.status) {
      conditions.push(eq(reportExports.status, query.status));
    }

    return this.db
      .select()
      .from(reportExports)
      .where(and(...conditions))
      .orderBy(desc(reportExports.createdAt));
  }

  async generate(dto: ReportRequestDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    const filters = this.normalizeFilters(dto);
    this.metrics.validatePeriod(filters);

    const [created] = await this.db
      .insert(reportExports)
      .values({
        tenantId,
        requestedBy: actorId,
        reportType: dto.reportType,
        format: dto.format,
        status: 'pending',
        filters: {
          ...(dto.filters ?? {}),
          status: filters.status,
          plantId: filters.plantId,
        },
        periodStart: filters.periodStart ? new Date(filters.periodStart) : null,
        periodEnd: filters.periodEnd ? new Date(filters.periodEnd) : null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    this.logService.logEvent({
      action: 'dashboard.report-requested',
      tenantId,
      userId: actorId,
      reportId: created.id,
      metadata: { reportType: dto.reportType, format: dto.format },
    });
    await this.auditService.log({
      action: 'dashboard.report-requested',
      entityType: 'report_export',
      entityId: created.id,
      userId: actorId,
      tenantId,
      metadata: { reportType: dto.reportType, format: dto.format },
    });

    return this.processReport(created.id);
  }

  async processPendingReports(): Promise<number> {
    const pending = await this.db
      .select({ id: reportExports.id })
      .from(reportExports)
      .where(eq(reportExports.status, 'pending'));

    for (const row of pending) {
      await this.processReport(row.id);
    }
    return pending.length;
  }

  async processReport(reportId: string) {
    const [report] = await this.db
      .select()
      .from(reportExports)
      .where(eq(reportExports.id, reportId))
      .limit(1);

    if (!report) {
      throw new NotFoundException('Report export not found');
    }
    if (report.status === 'ready') {
      return report;
    }

    await this.db
      .update(reportExports)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(reportExports.id, reportId));

    try {
      const body = await this.buildExportBody(report);
      const prefix =
        this.configService.get<string>('dashboard.reportPrefix') ?? DASHBOARD_REPORT_PREFIX;
      const ext = report.format === 'xlsx' ? 'xlsx' : report.format;
      const fileName = `${report.reportType}-${report.id}.${ext}`;
      const storageKey = `${prefix}/${report.tenantId}/${fileName}`;
      const contentType = this.contentTypeFor(report.format);

      await this.storageService.putObject(storageKey, body, contentType, body.byteLength);

      const [updated] = await this.db
        .update(reportExports)
        .set({
          status: 'ready',
          storageBucket: this.storageService.getBucket(),
          storageKey,
          fileName,
          contentType,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          errorMessage: null,
          updatedAt: new Date(),
          updatedBy: report.requestedBy,
        })
        .where(eq(reportExports.id, reportId))
        .returning();

      this.logService.logEvent({
        action: 'dashboard.report-generate',
        tenantId: report.tenantId,
        userId: report.requestedBy,
        reportId,
        metadata: { status: 'ready', storageKey },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Report generation failed';
      const [failed] = await this.db
        .update(reportExports)
        .set({
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(reportExports.id, reportId))
        .returning();

      this.logService.logEvent({
        action: 'dashboard.report-generate',
        tenantId: report.tenantId,
        userId: report.requestedBy,
        reportId,
        metadata: { status: 'failed', error: message },
      });

      return failed;
    }
  }

  private normalizeFilters(dto: ReportRequestDto): OperationalFilters {
    const raw = dto.filters ?? {};
    return {
      status: typeof raw.status === 'string' ? raw.status : undefined,
      plantId: typeof raw.plantId === 'string' ? raw.plantId : undefined,
      periodStart: dto.periodStart ?? null,
      periodEnd: dto.periodEnd ?? null,
    };
  }

  private async buildExportBody(report: typeof reportExports.$inferSelect): Promise<Buffer> {
    const filters: OperationalFilters = {
      status:
        typeof report.filters?.status === 'string' ? (report.filters.status as string) : undefined,
      plantId:
        typeof report.filters?.plantId === 'string'
          ? (report.filters.plantId as string)
          : undefined,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
    };

    let dataset: Record<string, unknown>;
    switch (report.reportType) {
      case 'permit_summary': {
        const counts = await this.metrics.permitCounts(report.tenantId, filters);
        const rows = await this.metrics.listPermits(report.tenantId, filters);
        dataset = { requirementId: 'FR-DAS-003', counts, rows, empty: rows.length === 0 };
        break;
      }
      case 'incident_summary': {
        const counts = await this.metrics.incidentCounts(report.tenantId, filters);
        const rows = await this.metrics.listIncidents(report.tenantId, filters);
        dataset = { requirementId: 'FR-DAS-004', counts, rows, empty: rows.length === 0 };
        break;
      }
      case 'simops_summary': {
        const counts = await this.metrics.simopsCounts(report.tenantId, filters);
        const rows = await this.metrics.listSimops(report.tenantId, filters);
        dataset = { requirementId: 'FR-DAS-005', counts, rows, empty: rows.length === 0 };
        break;
      }
      case 'lototo_summary': {
        const counts = await this.metrics.lototoCounts(report.tenantId, filters);
        const rows = await this.metrics.listLototoExecutions(report.tenantId, filters);
        dataset = { requirementId: 'FR-DAS-006', counts, rows, empty: rows.length === 0 };
        break;
      }
      default: {
        const bundle = await this.metrics.organizationalBundle(report.tenantId, filters);
        dataset = { requirementId: 'FR-DAS-007', ...bundle };
      }
    }

    const payload = {
      reportType: report.reportType,
      format: report.format,
      filters,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      generatedAt: new Date().toISOString(),
      tenantId: report.tenantId,
      dataset,
    };

    if (report.format === 'csv') {
      const counts =
        (dataset.counts as Record<string, number> | undefined) ??
        (dataset.permits as Record<string, number> | undefined) ??
        {};
      const lines = ['key,count'];
      for (const [key, value] of Object.entries(counts)) {
        lines.push(`${key},${value}`);
      }
      if (lines.length === 1) {
        lines.push('empty,0');
      }
      return Buffer.from(lines.join('\n'), 'utf8');
    }

    return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  }

  private contentTypeFor(format: string): string {
    if (format === 'csv') return 'text/csv';
    if (format === 'xlsx') {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    return 'application/pdf';
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
