import { validate } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { SuspendPermitDto } from '../app/src/modules/execution/dto/suspend-permit.dto';
import { ProgressUpdateDto } from '../app/src/modules/execution/dto/progress-update.dto';
import {
  EXECUTION_READ_ROLES,
  EXECUTION_WRITE_ROLES,
} from '../app/src/modules/execution/execution.constants';

describe('Execution DTO validation (PUS-141)', () => {
  it('rejects empty suspend reason', async () => {
    const dto = new SuspendPermitDto();
    dto.reason = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('rejects missing suspend reason', async () => {
    const dto = new SuspendPermitDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid suspend reason', async () => {
    const dto = new SuspendPermitDto();
    dto.reason = 'Gas test failed';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty progress summary', async () => {
    const dto = new ProgressUpdateDto();
    dto.summary = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'summary')).toBe(true);
  });

  it('accepts valid progress update', async () => {
    const dto = new ProgressUpdateDto();
    dto.summary = 'Welding 50% complete';
    dto.metadata = { percentComplete: 50 };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('Execution role enforcement (PUS-141)', () => {
  const getAllAndOverride = jest.fn();
  const reflector = {
    getAllAndOverride,
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const buildContext = (user?: { roles: string[] }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows authorised execution write roles', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_WRITE_ROLES]);

    const result = guard.canActivate(buildContext({ roles: ['operator'] }));
    expect(result).toBe(true);
  });

  it('allows viewer for execution read endpoints', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_READ_ROLES]);

    const result = guard.canActivate(buildContext({ roles: ['viewer'] }));
    expect(result).toBe(true);
  });

  it('denies viewer for execution write endpoints', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_WRITE_ROLES]);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies unauthenticated requests', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_WRITE_ROLES]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
