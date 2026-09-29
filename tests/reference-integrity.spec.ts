import { ConflictException } from '@nestjs/common';
import { ReferenceIntegrityService } from '../app/src/modules/master-data/reference-integrity.service';

/** A query builder stub whose select() resolves to the given rows. */
function dbReturning(rows: unknown[]) {
  const chain = { from: () => chain, where: () => chain, limit: () => Promise.resolve(rows) };
  return { select: () => chain } as never;
}

describe('ReferenceIntegrityService', () => {
  it('refuses to delete a hazard that a permit uses', async () => {
    const service = new ReferenceIntegrityService(dbReturning([{ id: 'permit-hazard' }]));
    await expect(service.assertHazardCategoryNotReferenced('hazard')).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows deleting an unused machine', async () => {
    const service = new ReferenceIntegrityService(dbReturning([]));
    await expect(service.assertMachineryNotReferenced('tenant', 'machine')).resolves.toBeUndefined();
  });
});
