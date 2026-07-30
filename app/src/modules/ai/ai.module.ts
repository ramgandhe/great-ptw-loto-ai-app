import { Module } from '@nestjs/common';
import { HybridRetriever } from '../../components/hybrid-retriever';
import { Reranker } from '../../components/reranker';
import { RagPipeline } from '../../services/rag-pipeline';
import { SemanticCache } from '../../services/semantic-cache';
import { ConversationService } from '../../services/conversation';
import { QueryRewriter } from '../../services/query-rewriter';
import { QueryRouter } from '../../services/query-router';
import { InputGuard } from '../../security/input-guard';
import { ContentFilter } from '../../security/content-filter';
import { OutputFilter } from '../../security/output-filter';
import { DocumentGrader } from '../../agents/document-grader';
import { QueryDecomposer } from '../../agents/query-decomposer';
import { AdaptiveRouter } from '../../agents/adaptive-router';
import { VectorSearchTool } from '../../agents/tools/vector-search';
import { WebSearchTool } from '../../agents/tools/web-search';
import { CodeSearchTool } from '../../agents/tools/code-search';
import { PromptRegistry } from '../../prompts/registry';
import { Tracer } from '../../observability/tracer';
import { CostTracker } from '../../observability/cost-tracker';
import { FeedbackCapture } from '../../observability/feedback';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [
    HybridRetriever,
    Reranker,
    RagPipeline,
    SemanticCache,
    ConversationService,
    QueryRewriter,
    QueryRouter,
    InputGuard,
    ContentFilter,
    OutputFilter,
    DocumentGrader,
    QueryDecomposer,
    AdaptiveRouter,
    VectorSearchTool,
    WebSearchTool,
    CodeSearchTool,
    PromptRegistry,
    Tracer,
    CostTracker,
    FeedbackCapture,
  ],
  exports: [RagPipeline, SemanticCache, QueryRouter],
})
export class AiModule {}
