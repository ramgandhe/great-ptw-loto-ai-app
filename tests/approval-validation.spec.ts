import { validate } from 'class-validator';
import { RejectPermitDto } from '../app/src/modules/approval/dto/reject-permit.dto';
import { DeferPermitDto } from '../app/src/modules/approval/dto/defer-permit.dto';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';

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
    dto.reasonCode = 'insufficient_controls';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires structured reason code (FR-PTW-024)', async () => {
    const dto = new RejectPermitDto();
    dto.comment = 'Missing docs';

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'reasonCode')).toBe(true);
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

  it('denies platform-admin override (FR-ROL-003)', () => {
    expect(service.userHasApproverRole(['platform-admin'], 'org-admin')).toBe(false);
  });

  it('denies unauthorised role', () => {
    expect(service.userHasApproverRole(['viewer'], 'supervisor')).toBe(false);
  });
});
