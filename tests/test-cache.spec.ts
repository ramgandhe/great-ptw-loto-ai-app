import { Test } from '@nestjs/testing';
import { SemanticCache } from '../app/src/services/semantic-cache';

describe('cache', () => {
  it('stores and returns semantic cache hits', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SemanticCache],
    }).compile();
    const cache = moduleRef.get(SemanticCache);

    expect(cache.get('What is LOTO?')).toBeNull();
    cache.set('What is LOTO?', {
      answer: 'Lock Out Tag Out',
      route: 'loto',
      sources: [],
    });
    expect(cache.get('what is loto?')?.answer).toBe('Lock Out Tag Out');
  });
});
