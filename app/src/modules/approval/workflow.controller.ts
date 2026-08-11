import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { approvalWorkflowTemplates, workflowSteps } from '../../database/schema';
import { ForbiddenException } from '@nestjs/common';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';

/** FR-PTW-013 — admin workflow template management (minimal). */
@Controller('workflows')
export class WorkflowController {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  @Roles('org-admin')
  @Get('templates')
  async listTemplates(@CurrentUser() user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select()
      .from(approvalWorkflowTemplates)
      .where(
        and(
          eq(approvalWorkflowTemplates.tenantId, tenantId),
          eq(approvalWorkflowTemplates.isActive, true),
        ),
      )
      .orderBy(asc(approvalWorkflowTemplates.name));
  }

  @Roles('org-admin')
  @Post('templates')
  async createTemplate(
    @Body() dto: CreateWorkflowTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const [row] = await this.db
      .insert(approvalWorkflowTemplates)
      .values({
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        permitTypeId: dto.permitTypeId ?? null,
        resubmitMode: dto.resubmitMode ?? 'restart_from_stage_1',
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();
    return row;
  }

  @Roles('org-admin', 'supervisor', 'viewer', 'platform-admin')
  @Get('steps')
  async listSteps(
    @CurrentUser() user: AuthenticatedUser,
    @Query('permitTypeId') permitTypeId?: string,
  ) {
    const tenantId = this.requireTenant(user);
    if (permitTypeId) {
      return this.db
        .select()
        .from(workflowSteps)
        .where(
          and(
            eq(workflowSteps.tenantId, tenantId),
            eq(workflowSteps.permitTypeId, permitTypeId),
            eq(workflowSteps.isActive, true),
          ),
        )
        .orderBy(asc(workflowSteps.stepSequence));
    }

    return this.db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.tenantId, tenantId),
          isNull(workflowSteps.permitTypeId),
          eq(workflowSteps.isActive, true),
        ),
      )
      .orderBy(asc(workflowSteps.stepSequence));
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
