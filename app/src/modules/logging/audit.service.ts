import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { auditLogs } from '../../database/schema';

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  async log(entry: AuditLogEntry): Promise<void> {
    this.logger.log(
      `AUDIT action=${entry.action} entity=${entry.entityType} id=${entry.entityId ?? 'n/a'}`,
    );

    if (!this.configService.get<boolean>('features.auditLogging')) {
      return;
    }

    try {
      await this.db.insert(auditLogs).values({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        userId: entry.userId ?? null,
        tenantId: entry.tenantId ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (error) {
      this.logger.warn('Failed to persist audit log entry');
      this.logger.debug(error);
    }
  }
}
