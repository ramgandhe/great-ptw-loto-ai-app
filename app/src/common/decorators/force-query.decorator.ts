import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { parseForceQuery } from '../http/in-use';

export const ForceQuery = createParamDecorator((_data: unknown, ctx: ExecutionContext): boolean => {
  const request = ctx.switchToHttp().getRequest<{ query?: { force?: string } }>();
  return parseForceQuery(request.query?.force);
});
