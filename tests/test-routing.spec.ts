import { Test } from '@nestjs/testing';
import { QueryRouter } from '../app/src/services/query-router';
import { AdaptiveRouter } from '../app/src/agents/adaptive-router';

describe('routing', () => {
  it('routes LOTO and permit queries distinctly', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [QueryRouter, AdaptiveRouter],
    }).compile();
    const router = moduleRef.get(QueryRouter);
    const adaptive = moduleRef.get(AdaptiveRouter);

    expect(router.route('Explain LOTO isolation')).toBe('loto');
    expect(router.route('permit approval steps')).toBe('permit');
    expect(adaptive.select('simops conflict', 'general')).toBe('policy');
  });
});
