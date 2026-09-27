import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { accessRequests } from '../../database/schema';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

@Injectable()
export class PlatformAccessRequestsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async create(dto: CreateAccessRequestDto) {
    const [row] = await this.db
      .insert(accessRequests)
      .values({
        fullName: dto.fullName.trim(),
        workEmail: dto.workEmail.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        companyName: dto.companyName.trim(),
        jobTitle: dto.jobTitle?.trim() || null,
        siteCount: dto.siteCount ?? null,
        message: dto.message?.trim() || null,
        consentedAt: new Date(),
      })
      .returning({ id: accessRequests.id });
    return { id: row.id, status: 'received' as const };
  }

  list() {
    return this.db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt));
  }
}
