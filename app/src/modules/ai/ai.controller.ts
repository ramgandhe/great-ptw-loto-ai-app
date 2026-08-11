import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { RagPipeline } from '../../services/rag-pipeline';
import { SemanticCache } from '../../services/semantic-cache';
import { InputGuard } from '../../security/input-guard';
import { HybridRetriever } from '../../components/hybrid-retriever';
import { AiQueryDto } from './dto/ai-query.dto';
import { AiHealthStatus } from './ai.types';
import { AI_QUERY_ROLES } from './ai.constants';

@Controller('ai')
export class AiController {
  constructor(
    private readonly ragPipeline: RagPipeline,
    private readonly semanticCache: SemanticCache,
    private readonly inputGuard: InputGuard,
    private readonly hybridRetriever: HybridRetriever,
  ) {}

  @Public()
  @Get('health')
  health(): AiHealthStatus {
    return {
      status: 'ok',
      retriever: Boolean(this.hybridRetriever),
      cache: this.semanticCache.healthy(),
      guards: this.inputGuard.healthy(),
    };
  }

  @Roles(...AI_QUERY_ROLES)
  @Post('query')
  async query(@Body() body: AiQueryDto) {
    return this.ragPipeline.run(body);
  }
}
