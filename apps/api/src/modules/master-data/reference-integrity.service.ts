import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class ReferenceIntegrityService {
  async assertPermitTypeNotReferenced(_tenantId: string, _permitTypeId: string): Promise<void> {
    // Permit schema not yet on main; reference checks activate with SP-02.01.
  }

  async assertHazardCategoryNotReferenced(_hazardCategoryId: string): Promise<void> {
    // Permit schema not yet on main; reference checks activate with SP-02.01.
  }

  async assertPpeNotReferenced(_ppeCatalogueId: string): Promise<void> {
    // Permit schema not yet on main; reference checks activate with SP-02.01.
  }

  async assertWorkstationNotReferenced(_tenantId: string, _workstationId: string): Promise<void> {
    // Permit schema not yet on main; reference checks activate with SP-02.01.
  }

  async assertMachineryNotReferenced(_tenantId: string, _machineryId: string): Promise<void> {
    // Permit schema not yet on main; reference checks activate with SP-02.01.
  }

  requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
