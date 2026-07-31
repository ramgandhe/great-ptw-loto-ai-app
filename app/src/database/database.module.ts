import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const DATABASE_POOL = 'DATABASE_POOL';

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        return new Pool({
          connectionString: configService.get<string>('database.url'),
          max: configService.get<number>('database.poolMax') ?? 20,
          idleTimeoutMillis: configService.get<number>('database.poolIdleTimeoutMs') ?? 30000,
          connectionTimeoutMillis:
            configService.get<number>('database.poolConnectionTimeoutMs') ?? 5000,
        });
      },
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE_CONNECTION, DATABASE_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
