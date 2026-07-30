import { Test } from '@nestjs/testing';
import { HybridRetriever } from '../app/src/components/hybrid-retriever';
import { Reranker } from '../app/src/components/reranker';

describe('retrieval', () => {
  it('returns ranked hybrid results for a permit query', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HybridRetriever, Reranker],
    }).compile();

    const retriever = moduleRef.get(HybridRetriever);
    const reranker = moduleRef.get(Reranker);
    const chunks = await retriever.retrieve('permit lifecycle states');
    const ranked = reranker.rerank('permit lifecycle', chunks);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  });
});
