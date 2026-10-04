import { connectOwner, pgErrorCode } from './helpers/db';
import { insertLegalEntity, insertOrganisation } from './helpers/fixtures';

describe('Legal entities and plants', () => {
  const owner = connectOwner();

  afterAll(() => owner.end());

  it("refuses a plant that points at another tenant's legal entity", async () => {
    const tenantA = await insertOrganisation(owner);
    const tenantB = await insertOrganisation(owner);
    const entityOfA = await insertLegalEntity(owner, tenantA);
    const code = await pgErrorCode(
      owner.query(
        `insert into plants (tenant_id, legal_entity_id, name, code, time_zone) values ($1, $2, 'Pune', 'PUN', 'Asia/Kolkata')`,
        [tenantB, entityOfA],
      ),
    );
    expect(code).toBe('23503');
  });
});
