import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePpeDto } from '../src/modules/master-data/dto/create-ppe.dto';
import { CreateChecklistDto } from '../src/modules/master-data/dto/create-checklist.dto';

describe('Master data DTO validation (PUS-70)', () => {
  it('rejects invalid PPE category', async () => {
    const dto = new CreatePpeDto();
    dto.code = 'HELM-01';
    dto.name = 'Safety Helmet';
    dto.category = 'invalid-category' as never;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects checklist without items', async () => {
    const dto = new CreateChecklistDto();
    dto.code = 'CHK-01';
    dto.name = 'Pre-work';
    dto.items = [];

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid checklist with mandatory items', async () => {
    const dto = plainToInstance(CreateChecklistDto, {
      code: 'CHK-01',
      name: 'Pre-work',
      items: [{ description: 'Verify isolation', isMandatory: true }],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
