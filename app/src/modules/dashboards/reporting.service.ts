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
import { AnalyticsService } from './analytics.service';
import { KpiService } from './kpi.service';

@Injectable()
export class ReportingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly logService: DashboardLogService,
    private readonly auditService: AuditService,
    private readonly kpiService: KpiService,
    private readonly analyticsService: AnalyticsService,
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

    const [created] = await this.db
      .insert(reportExports)
      .values({
        tenantId,
        requestedBy: actorId,
        reportType: dto.reportType,
        format: dto.format,
        status: 'pending',
        filters: dto.filters ?? {},
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
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

      await this.storageService.putObject(
        storageKey,
        body,
        contentType,
        body.byteLength,
      );

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

  private async buildExportBody(report: typeof reportExports.$inferSelect): Promise<Buffer> {
    const systemUser: AuthenticatedUser = {
      id: report.requestedBy,
      username: 'system',
      roles: ['org-admin'],
      tenantId: report.tenantId,
    };

    const metrics = await this.resolveReportMetrics(report.reportType, systemUser);
    const payload = {
      reportType: report.reportType,
      format: report.format,
      filters: report.filters,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      generatedAt: new Date().toISOString(),
      metrics,
    };

    if (report.format === 'csv') {
      const lines = ['key,value'];
      for (const [key, value] of Object.entries(metrics)) {
        lines.push(`${key},${typeof value === 'number' ? value : JSON.stringify(value)}`);
      }
      return Buffer.from(lines.join('\n'), 'utf8');
    }

    return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  }

  private async resolveReportMetrics(
    reportType: string,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (reportType === 'operational_kpis') {
      const kpis = (await this.kpiService.getKpis(user, {
        kind: 'management',
        periodLabel: 'current',
      })) as { items: Array<{ key: string; value: Record<string, unknown> }> };
      return Object.fromEntries(
        kpis.items.map((item) => [
          item.key,
          typeof item.value.count === 'number' ? item.value.count : item.value,
        ]),
      );
    }

    const scopeByType: Record<string, 'permits' | 'incidents' | 'simops' | 'lototo' | 'operational'> =
      {
        permit_summary: 'permits',
        incident_summary: 'incidents',
        simops_summary: 'simops',
        lototo_summary: 'lototo',
      };
    const scope = scopeByType[reportType] ?? 'operational';
    const analytics = (await this.analyticsService.getAnalytics(user, { scope })) as {
      source: 'live' | 'snapshot';
      snapshot?: { payload: Record<string, unknown> } | null;
      payload?: Record<string, unknown>;
    };
    if (analytics.source === 'snapshot' && analytics.snapshot) {
      return analytics.snapshot.payload as Record<string, unknown>;
    }
    return (analytics.payload ?? {}) as Record<string, unknown>;
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
