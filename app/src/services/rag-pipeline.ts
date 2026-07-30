import { Injectable } from '@nestjs/common';
import { HybridRetriever } from '../components/hybrid-retriever';
import { Reranker } from '../components/reranker';
import { ConversationService } from './conversation';
import { QueryRewriter } from './query-rewriter';
import { QueryRouter } from './query-router';
import { SemanticCache } from './semantic-cache';
import { InputGuard } from '../security/input-guard';
import { ContentFilter } from '../security/content-filter';
import { OutputFilter } from '../security/output-filter';
import { DocumentGrader } from '../agents/document-grader';
import { AdaptiveRouter } from '../agents/adaptive-router';
import { AiQueryRequest, AiQueryResponse } from '../modules/ai/ai.types';
import { PromptRegistry } from '../prompts/registry';
import { Tracer } from '../observability/tracer';
import { CostTracker } from '../observability/cost-tracker';

/** Core RAG pipeline: guard → rewrite → route → retrieve → grade → answer. */
@Injectable()
export class RagPipeline {
  constructor(
    private readonly inputGuard: InputGuard,
    private readonly contentFilter: ContentFilter,
    private readonly outputFilter: OutputFilter,
    private readonly queryRewriter: QueryRewriter,
    private readonly queryRouter: QueryRouter,
    private readonly adaptiveRouter: AdaptiveRouter,
    private readonly semanticCache: SemanticCache,
    private readonly hybridRetriever: HybridRetriever,
    private readonly reranker: Reranker,
    private readonly documentGrader: DocumentGrader,
    private readonly conversation: ConversationService,
    private readonly prompts: PromptRegistry,
    private readonly tracer: Tracer,
    private readonly costTracker: CostTracker,
  ) {}

  async run(request: AiQueryRequest): Promise<AiQueryResponse> {
    const span = this.tracer.start('rag_pipeline');
    const conversationId = this.conversation.ensureId(request.conversationId);

    try {
      this.inputGuard.validate(request.query);
      const filteredQuery = this.contentFilter.filter(request.query);
      const rewritten = this.queryRewriter.rewrite(filteredQuery);

      const cached = this.semanticCache.get(rewritten);
      if (cached) {
        this.conversation.append(conversationId, 'user', request.query);
        this.conversation.append(conversationId, 'assistant', cached.answer);
        span.end({ cached: true });
        return {
          answer: cached.answer,
          conversationId,
          route: cached.route,
          sources: cached.sources,
          cached: true,
        };
      }

      const baseRoute = this.queryRouter.route(rewritten);
      const route = this.adaptiveRouter.select(rewritten, baseRoute);
      const retrieved = await this.hybridRetriever.retrieve(rewritten);
      const ranked = this.reranker.rerank(rewritten, retrieved);
      const graded = this.documentGrader.grade(rewritten, ranked);
      const systemPrompt = this.prompts.get('rag.answer');

      const answerBody =
        graded.length === 0
          ? 'No relevant PTW knowledge was found for that question. Try asking about permit lifecycle, LOTO, or SIMOPS.'
          : `${systemPrompt}\n\nBased on PTW knowledge (${route}):\n${graded
              .map((c) => `- ${c.title}: ${c.content}`)
              .join('\n')}`;

      const answer = this.outputFilter.filter(answerBody);
      const sources = graded.map((c) => ({
        id: c.id,
        title: c.title,
        score: c.score,
      }));

      this.semanticCache.set(rewritten, { answer, sources, route });
      this.conversation.append(conversationId, 'user', request.query);
      this.conversation.append(conversationId, 'assistant', answer);
      this.costTracker.record('rag_pipeline', 0);

      span.end({ cached: false, route, sources: sources.length });
      return { answer, conversationId, route, sources, cached: false };
    } catch (error) {
      span.fail(error);
      throw error;
    }
  }
}
