import { Test } from '@nestjs/testing';
import { AppModule } from '../app/src/app.module';
import { ContextDb } from '../app/src/database/database.module';
import { PermissionService } from '../app/src/modules/access/permission.service';
import { ConsentService } from '../app/src/modules/privacy/consent.service';
import { PersonalDataService } from '../app/src/modules/privacy/personal-data.service';

describe('Application module', () => {
  it('resolves every provider without starting the server', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    try {
      for (const token of [ContextDb, PermissionService, ConsentService, PersonalDataService]) {
        expect(moduleRef.get(token, { strict: false })).toBeInstanceOf(token);
      }
    } finally {
      await moduleRef.close();
    }
  });
});
