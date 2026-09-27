import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccessRequestDto } from '../app/src/modules/platform/dto/create-access-request.dto';
import { PlatformAccessRequestsService } from '../app/src/modules/platform/platform-access-requests.service';

const validPayload = {
  fullName: '  Asha Rao ',
  workEmail: ' Asha.Rao@Plant.TEST ',
  companyName: ' Acme Steel ',
  siteCount: '2-5',
  consent: true,
};

describe('PlatformAccessRequestsService', () => {
  it('stores a normalised request with a consent timestamp', async () => {
    const values = jest.fn().mockReturnValue({
      returning: async () => [{ id: 'req-1' }],
    });
    const db = { insert: () => ({ values }) };
    const service = new PlatformAccessRequestsService(db as never);

    const result = await service.create(validPayload as CreateAccessRequestDto);

    expect(result).toEqual({ id: 'req-1', status: 'received' });
    const row = values.mock.calls[0][0];
    expect(row).toMatchObject({
      fullName: 'Asha Rao',
      workEmail: 'asha.rao@plant.test',
      companyName: 'Acme Steel',
      phone: null,
      jobTitle: null,
      siteCount: '2-5',
      message: null,
    });
    expect(row.consentedAt).toBeInstanceOf(Date);
  });
});

describe('CreateAccessRequestDto', () => {
  const cleanPayload = {
    fullName: 'Asha Rao',
    workEmail: 'asha.rao@plant.test',
    companyName: 'Acme Steel',
    siteCount: '2-5',
    consent: true,
  };

  async function errorsFor(payload: Record<string, unknown>) {
    const errors = await validate(plainToInstance(CreateAccessRequestDto, payload));
    return errors.map((e) => e.property);
  }

  it('accepts a complete request', async () => {
    expect(await errorsFor(cleanPayload)).toEqual([]);
  });

  it('rejects a request without consent', async () => {
    expect(await errorsFor({ ...cleanPayload, consent: false })).toContain('consent');
  });

  it('rejects an unknown site-count bucket and a bad email', async () => {
    const errors = await errorsFor({ ...cleanPayload, siteCount: '500', workEmail: 'nope' });
    expect(errors).toEqual(expect.arrayContaining(['siteCount', 'workEmail']));
  });
});
