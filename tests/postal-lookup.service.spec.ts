import { PostalLookupService } from '../app/src/modules/platform/postal-lookup.service';

describe('PostalLookupService', () => {
  let service: PostalLookupService;

  beforeEach(() => {
    service = new PostalLookupService();
  });

  describe('lookup', () => {
    it('returns State, Country, and Area for a valid Indian 6-digit PIN code', async () => {
      const result = await service.lookup('560001');
      expect(result).not.toBeNull();
      expect(result).toEqual({
        pin: '560001',
        state: 'Karnataka',
        country: 'India',
        area: 'Bengaluru G.P.O.',
      });
    });

    it('handles PIN code with spaces or hyphens', async () => {
      const result = await service.lookup('400 001');
      expect(result).not.toBeNull();
      expect(result?.state).toBe('Maharashtra');
      expect(result?.country).toBe('India');
      expect(result?.area).toBe('Mumbai G.P.O.');
    });

    it('returns null for unknown PIN codes', async () => {
      const result = await service.lookup('999999');
      expect(result).toBeNull();
    });

    it('returns null for invalid/empty PIN format', async () => {
      expect(await service.lookup('')).toBeNull();
      expect(await service.lookup('   ')).toBeNull();
      expect(await service.lookup('INVALID')).toBeNull();
    });

    it('falls back gracefully to prefix map if external lookup returns non-JSON or fails', async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'text/html' },
          json: async () => { throw new Error('Invalid JSON'); },
        } as never);

        // 560003 has prefix 56 -> Karnataka, India
        const result = await service.lookup('560003');
        expect(result).not.toBeNull();
        expect(result?.state).toBe('Karnataka');
        expect(result?.country).toBe('India');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
