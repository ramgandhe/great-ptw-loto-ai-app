import { Global, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { Database, DbContext, Tx, forEachTenant, runInContext } from './context';
import { assertRuntimeDatabaseRole } from './runtime-guard';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const DATABASE_POOL = 'DATABASE_POOL';

/** The only way feature code reaches the database: every call is a context transaction (NFR-SEC-008). */
@Injectable()
export class ContextDb {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  run<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return runInContext(this.db, ctx, fn);
  }

  /** Cross-tenant job sweeps (NFR-SEC-008). */
  forEachTenant(fn: (tx: Tx, tenantId: string) => Promise<void>): Promise<void> {
    return forEachTenant(this.db, fn);
  }

  /** Health check only: a round trip that reads no table. */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool =>
        new Pool({
          connectionString: configService.get<string>('database.url'),
          max: configService.get<number>('database.poolMax') ?? 20,
          idleTimeoutMillis: configService.get<number>('database.poolIdleTimeoutMs') ?? 30000,
          connectionTimeoutMillis: configService.get<number>('database.poolConnectionTimeoutMs') ?? 5000,
        }),
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    ContextDb,
  ],
  // Neither the raw connection nor the pool is exported: feature code cannot query outside a context.
  exports: [ContextDb],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await assertRuntimeDatabaseRole(this.pool);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
