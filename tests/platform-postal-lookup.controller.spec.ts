import { NotFoundException } from '@nestjs/common';
import { PlatformPostalLookupController } from '../app/src/modules/platform/platform-tenants.controller';
import { PostalLookupService } from '../app/src/modules/platform/postal-lookup.service';

describe('PlatformPostalLookupController', () => {
  let controller: PlatformPostalLookupController;
  let service: PostalLookupService;

  beforeEach(() => {
    service = new PostalLookupService();
    controller = new PlatformPostalLookupController(service);
  });

  it('returns geography details for a known PIN', async () => {
    const result = await controller.lookup('560001');
    expect(result).toEqual({
      pin: '560001',
      state: 'Karnataka',
      country: 'India',
      area: 'Bengaluru G.P.O.',
    });
  });

  it('throws NotFoundException when PIN is not found', async () => {
    await expect(controller.lookup('999999')).rejects.toThrow(NotFoundException);
  });

  it('has PLATFORM_ADMIN_ROLES applied', () => {
    const roles = Reflect.getMetadata('roles', PlatformPostalLookupController.prototype.lookup);
    expect(roles).toEqual(['platform-admin']);
  });
});
