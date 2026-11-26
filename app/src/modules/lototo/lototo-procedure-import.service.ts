import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assets,
  lototoProcedureVersions,
  lototoProcedures,
  workLocations,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { CreateLototoProcedureDto } from './dto/lototo-procedure.dto';
import {
  LOTOTO_IMPORT_MAX_BYTES,
  parseLototoProcedureWorkbook,
} from './lototo-procedure-excel.parser';
import type { LototoImportOverrideWarning, ParsedLototoProcedureImport } from './lototo-procedure-import.types';
import { LototoProcedureService } from './lototo-procedure.service';
import { LototoValidationService } from './lototo-validation.service';

@Injectable()
export class LototoProcedureImportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly procedureService: LototoProcedureService,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
  ) {}

  async import(
    file: UploadedFilePayload | undefined,
    confirmOverride: boolean,
    user: AuthenticatedUser,
  ) {
    this.assertFile(file);
    const { parsed, errors } = await parseLototoProcedureWorkbook(file.buffer);
    if (!parsed || errors.length > 0) {
      throw new BadRequestException({
        message: 'LOTOTO procedure Excel validation failed',
        error: 'VALIDATION_ERROR',
        details: { errors },
      });
    }

    const committed = await this.importParsed(parsed, confirmOverride, user);
    return committed.procedure;
  }

  async importParsed(
    parsed: ParsedLototoProcedureImport,
    confirmOverride: boolean,
    user: AuthenticatedUser,
    options?: { softMasterData?: boolean },
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const resolved = await this.resolveMasterData(tenantId, parsed);
    if (resolved.errors.length > 0 && !options?.softMasterData) {
      throw new BadRequestException({
        message: 'LOTOTO procedure Excel validation failed',
        error: 'VALIDATION_ERROR',
        details: { errors: resolved.errors },
      });
    }
    const unlinked = Boolean(options?.softMasterData && !resolved.assetId && !resolved.workLocationId);
    const warnings = options?.softMasterData ? resolved.errors.map(pdfLinkWarning) : [];
    if (unlinked && warnings.length === 0) {
      warnings.push({
        sheet: 'Header',
        field: 'Asset',
        code: 'NOT_FOUND',
        message: 'No asset or work location was read from the PDF. Select a work location or an asset on this draft.',
      });
    }
    const dto: CreateLototoProcedureDto = {
      ...parsed.dto,
      assetId: resolved.assetId,
      workLocationId: resolved.workLocationId,
    };

    const [existing] = await this.db
      .select()
      .from(lototoProcedures)
      .where(and(eq(lototoProcedures.tenantId, tenantId), eq(lototoProcedures.code, dto.code)));

    if (existing) {
      if (existing.status === 'inactive') {
        throw new ConflictException({
          message: 'Reactivate the procedure before importing over this code',
          error: 'PROCEDURE_INACTIVE',
          details: { procedureId: existing.id, code: existing.code, status: existing.status },
        });
      }

      if (!confirmOverride) {
        const draft = await this.findDraft(existing.id);
        const warning: LototoImportOverrideWarning = {
          confirmOverrideRequired: true,
          procedureId: existing.id,
          code: existing.code,
          status: existing.status,
          title: existing.title,
          hasDraft: Boolean(draft),
        };
        throw new ConflictException({
          message:
            'Procedure code already exists. Confirm override to replace the current draft from Excel.',
          error: 'PROCEDURE_IMPORT_OVERRIDE_REQUIRED',
          details: warning,
        });
      }

      const result = await this.replaceExisting(existing.id, dto, user, unlinked);
      await this.auditService.log({
        action: 'lototo.procedure.import_overridden',
        entityType: 'lototo_procedure',
        entityId: existing.id,
        userId: optionalUuid(user.id),
        tenantId,
        metadata: { code: dto.code },
      });
      return { procedure: result, warnings };
    }

    const created = await this.procedureService.create(dto, user, unlinked ? { allowUnlinked: true } : undefined);
    await this.auditService.log({
      action: 'lototo.procedure.imported',
      entityType: 'lototo_procedure',
      entityId: created.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { code: dto.code },
    });
    return { procedure: created, warnings };
  }

  private assertFile(file: UploadedFilePayload | undefined): asserts file is UploadedFilePayload {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'An .xlsx file is required',
        error: 'FILE_REQUIRED',
        details: { errors: [{ sheet: 'File', field: 'file', message: 'An .xlsx file is required', code: 'REQUIRED' }] },
      });
    }
    if (file.size > LOTOTO_IMPORT_MAX_BYTES) {
      throw new BadRequestException({
        message: `File exceeds maximum size of ${LOTOTO_IMPORT_MAX_BYTES} bytes`,
        error: 'FILE_TOO_LARGE',
        details: {
          errors: [
            {
              sheet: 'File',
              field: 'file',
              message: `File exceeds maximum size of ${LOTOTO_IMPORT_MAX_BYTES} bytes`,
              code: 'LIMIT',
            },
          ],
        },
      });
    }
    const name = (file.originalname || '').toLowerCase();
    const type = (file.mimetype || '').toLowerCase();
    const okType =
      name.endsWith('.xlsx') ||
      type.includes('spreadsheetml') ||
      type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!okType) {
      throw new BadRequestException({
        message: 'Only .xlsx files are accepted',
        error: 'INVALID_FILE_TYPE',
        details: {
          errors: [{ sheet: 'File', field: 'file', message: 'Only .xlsx files are accepted', code: 'INVALID_FILE' }],
        },
      });
    }
  }

  private async findDraft(procedureId: string) {
    const [row] = await this.db
      .select()
      .from(lototoProcedureVersions)
      .where(eq(lototoProcedureVersions.procedureId, procedureId))
      .orderBy(desc(lototoProcedureVersions.versionNumber));
    if (!row || row.publishedAt) {
      return null;
    }
    return row;
  }

  private async replaceExisting(
    procedureId: string,
    dto: CreateLototoProcedureDto,
    user: AuthenticatedUser,
    clearLinks = false,
  ) {
    const detail = await this.procedureService.get(procedureId, user);
    if (!detail.draftVersion) {
      await this.procedureService.createRevision(procedureId, user);
    }
    return this.procedureService.update(
      procedureId,
      {
        code: dto.code,
        title: dto.title,
        reviewDueOn: dto.reviewDueOn ?? null,
        assetId: dto.assetId,
        workLocationId: dto.workLocationId,
        facility: dto.facility ?? '',
        locationText: dto.locationText ?? '',
        purpose: dto.purpose ?? '',
        scope: dto.scope ?? '',
        authorization: dto.authorization ?? '',
        enforcement: dto.enforcement ?? '',
        description: dto.description ?? '',
        note: dto.note ?? '',
        lockoutPoints: dto.lockoutPoints ?? [],
        sequenceSteps: dto.sequenceSteps ?? [],
        authorizedRoles: [],
      },
      user,
      clearLinks ? { allowUnlinked: true } : undefined,
    );
  }

  private async resolveMasterData(
    tenantId: string,
    parsed: {
      assetCode?: string;
      workLocationCode?: string;
    },
  ) {
    const errors: Array<{ sheet: string; field: string; message: string; code: string }> = [];
    let assetId: string | undefined;
    let workLocationId: string | undefined;

    if (parsed.assetCode) {
      const rows = await this.db
        .select({ id: assets.id, tag: assets.tag })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), eq(assets.tag, parsed.assetCode), eq(assets.status, 'active')));
      if (rows.length === 0) {
        errors.push({
          sheet: 'Header',
          field: 'Asset',
          message: `Asset code ${parsed.assetCode} not found for this tenant`,
          code: 'NOT_FOUND',
        });
      } else if (rows.length > 1) {
        errors.push({
          sheet: 'Header',
          field: 'Asset',
          message: `Asset code ${parsed.assetCode} is ambiguous across sites`,
          code: 'AMBIGUOUS',
        });
      } else {
        assetId = rows[0].id;
      }
    }

    if (parsed.workLocationCode) {
      const rows = await this.db
        .select({ id: workLocations.id })
        .from(workLocations)
        .where(
          and(
            eq(workLocations.tenantId, tenantId),
            eq(workLocations.code, parsed.workLocationCode),
            eq(workLocations.status, 'active'),
          ),
        );
      if (rows.length === 0) {
        errors.push({
          sheet: 'Header',
          field: 'WorkLocation',
          message: `Work location code ${parsed.workLocationCode} not found for this tenant`,
          code: 'NOT_FOUND',
        });
      } else if (rows.length > 1) {
        errors.push({
          sheet: 'Header',
          field: 'WorkLocation',
          message: `Work location code ${parsed.workLocationCode} is ambiguous across sites`,
          code: 'AMBIGUOUS',
        });
      } else {
        workLocationId = rows[0].id;
      }
    }

    return { assetId, workLocationId, errors };
  }
}

function pdfLinkWarning(error: { sheet: string; field: string; message: string; code: string }) {
  const named = error.message.match(/^(Asset|Work location) code (.+) (not found for this tenant|is ambiguous across sites)$/);
  if (!named) return error;
  const kind = named[1];
  const code = named[2];
  const missing = named[3] === 'not found for this tenant';
  const message = missing
    ? `${kind} "${code}" is not in this organisation. Select the ${kind === 'Asset' ? 'asset' : 'work location'} on this draft.`
    : `${kind} "${code}" matches more than one site. Select the correct ${kind === 'Asset' ? 'asset' : 'work location'} on this draft.`;
  return { ...error, message };
}
