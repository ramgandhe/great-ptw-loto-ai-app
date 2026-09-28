import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrganisationDto } from '../app/src/modules/organisation/dto/organisation.dto';

async function errorsFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(UpdateOrganisationDto, body));
  return errors.map((error) => error.property);
}

describe('Organisation setup progress', () => {
  it('accepts skipped steps, the last step and a timezone', async () => {
    expect(
      await errorsFor({
        timezone: 'Asia/Kolkata',
        setupProgress: { skipped: ['machinery', 'gas-testing'], lastStep: 'hazards' },
      }),
    ).toEqual([]);
  });

  it('rejects malformed progress', async () => {
    expect(await errorsFor({ setupProgress: { skipped: 'machinery' } })).toEqual(['setupProgress']);
    expect(await errorsFor({ setupProgress: { skipped: [42] } })).toEqual(['setupProgress']);
    expect(await errorsFor({ setupProgress: { lastStep: 'x'.repeat(65) } })).toEqual(['setupProgress']);
  });
});
