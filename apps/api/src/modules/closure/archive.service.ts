import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitArchive, permits } from '../../database/schema';
import { PermitService } from '../permit/permit.service';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureService } from './closure.service';
import { ArchiveSearchDto } from './dto/archive-search.dto';
import { VerificationService } from './verification.service';

@Injectable()
export class ArchiveService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly verificationService: VerificationService,
    private readonly closureService: ClosureService,
    private readonly closureCacheService: ClosureCacheService,
  ) {}

  async search(user: AuthenticatedUser, query: ArchiveSearchDto) {
    const tenantId = this.requireTenant(user);

    const cached = await this.closureCacheService.getSearchResults<
      Awaited<ReturnType<ArchiveService['loadSearchResults']>>
    >(tenantId, query);

    if (cached) {
      return cached;
    }

    const results = await this.loadSearchResults(tenantId, query);
    await this.closureCacheService.setSearchResults(tenantId, query, results);
    return results;
  }

  async findOne(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);

    const cached = await this.closureCacheService.getArchiveDetail<
      Awaited<ReturnType<ArchiveService['loadArchiveDetail']>>
    >(tenantId, permitId);

    if (cached) {
      return cached;
    }

    const detail = await this.loadArchiveDetail(permitId, user);
    await this.closureCacheService.setArchiveDetail(tenantId, permitId, detail);
    return detail;
  }

  private async loadSearchResults(tenantId: string, query: ArchiveSearchDto) {
    const conditions = [eq(permitArchive.tenantId, tenantId)];

    if (query.q) {
      const pattern = `%${query.q}%`;
      conditions.push(or(ilike(permitArchive.title, pattern), ilike(permitArchive.reference, pattern))!);
    }

    if (query.from) {
      conditions.push(gte(permitArchive.closedAt, new Date(query.from)));
    }

    if (query.to) {
      conditions.push(lte(permitArchive.closedAt, new Date(query.to)));
    }

    const rows = await this.db
      .select({
        archive: permitArchive,
        permit: permits,
      })
      .from(permitArchive)
      .innerJoin(permits, eq(permitArchive.permitId, permits.id))
      .where(and(...conditions))
      .orderBy(desc(permitArchive.closedAt));

    return rows.map((row) => ({
      permit: row.permit,
      closedAt: row.archive.closedAt.toISOString(),
      closedBy: row.archive.closedBy,
    }));
  }

  private async loadArchiveDetail(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);

    const [archive] = await this.db
      .select()
      .from(permitArchive)
      .where(and(eq(permitArchive.permitId, permitId), eq(permitArchive.tenantId, tenantId)));

    if (!archive) {
      throw new NotFoundException('Archived permit not found');
    }

    const detail = await this.permitService.findOne(permitId, user);
    const verification = await this.verificationService.findByPermit(permitId);
    const closure = await this.closureService.findByPermit(permitId);

    return {
      ...detail,
      verification,
      closure,
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
