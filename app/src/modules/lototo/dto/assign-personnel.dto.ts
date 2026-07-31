import { IsIn, IsUUID } from 'class-validator';
import { LOTOTO_ASSIGNMENT_ROLES } from '../../../database/schema/lototo';

export class AssignPersonnelDto {
  @IsUUID()
  workforceUserId!: string;

  @IsIn(LOTOTO_ASSIGNMENT_ROLES)
  role!: (typeof LOTOTO_ASSIGNMENT_ROLES)[number];
}
