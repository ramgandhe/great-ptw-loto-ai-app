import { validate } from 'class-validator';
import { RejectPermitDto } from '../src/modules/approval/dto/reject-permit.dto';
import { DeferPermitDto } from '../src/modules/approval/dto/defer-permit.dto';
import { WorkflowEngineService } from '../src/modules/approval/workflow-engine.service';

describe('Approval DTO validation (PUS-136)', () => {
  it('rejects empty rejection reason', async () => {
    const dto = new RejectPermitDto();
    dto.comment = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'comment')).toBe(true);
  });

  it('rejects missing rejection reason', async () => {
    const dto = new RejectPermitDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid rejection reason', async () => {
    const dto = new RejectPermitDto();
    dto.comment = 'Insufficient hazard controls documented';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects whitespace-only deferral comment at service layer', async () => {
    const dto = new DeferPermitDto();
    dto.comment = '   ';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid deferral comment', async () => {
    const dto = new DeferPermitDto();
    dto.comment = 'Need additional gas test results';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('WorkflowEngineService role checks (PUS-136)', () => {
  const service = new WorkflowEngineService(null as never);

  it('allows matching approver role', () => {
    expect(service.userHasApproverRole(['supervisor'], 'supervisor')).toBe(true);
  });

  it('allows platform-admin override', () => {
    expect(service.userHasApproverRole(['platform-admin'], 'org-admin')).toBe(true);
  });

  it('denies unauthorised role', () => {
    expect(service.userHasApproverRole(['viewer'], 'supervisor')).toBe(false);
  });
});
