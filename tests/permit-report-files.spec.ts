import { canEmbedPermitReportImage, mdpEvidenceReportName, permitReportFileOwned } from '../app/src/modules/permit/permit-report-files';

const tenant = '11111111-1111-4111-8111-111111111111';
const permit = '22222222-2222-4222-8222-222222222222';

describe('permit report files', () => {
  it('reads an image only from this permit', () => {
    expect(permitReportFileOwned(tenant, permit, `${tenant}/${permit}/photo.jpg`)).toBe(true);
    expect(permitReportFileOwned(tenant, permit, `${tenant}/${permit}/evidence/photo.jpg`)).toBe(true);
    expect(permitReportFileOwned(tenant, permit, `${tenant}/33333333-3333-4333-8333-333333333333/photo.jpg`)).toBe(false);
    expect(permitReportFileOwned('44444444-4444-4444-8444-444444444444', permit, `${tenant}/${permit}/photo.jpg`)).toBe(false);
    expect(permitReportFileOwned(tenant, permit, `${tenant}/${permit}/../secret.jpg`)).toBe(false);
    expect(permitReportFileOwned(tenant, permit, `/${tenant}/${permit}/photo.jpg`)).toBe(false);
    expect(permitReportFileOwned(tenant, permit, '')).toBe(false);
    const dayPhoto = `mdp/daily-progress/${tenant}/${permit}/daily_progress/roof.jpg`;
    expect(permitReportFileOwned(tenant, permit, dayPhoto)).toBe(false);
    expect(permitReportFileOwned(tenant, permit, dayPhoto, ['mdp/daily-progress'])).toBe(true);
    expect(permitReportFileOwned(tenant, permit, `mdp/daily-progress/${tenant}/33333333-3333-4333-8333-333333333333/roof.jpg`, ['mdp/daily-progress'])).toBe(false);
    expect(permitReportFileOwned(tenant, permit, `mdp/daily-progress/${tenant}/${permit}/../secret.jpg`, ['mdp/daily-progress'])).toBe(false);
    expect(permitReportFileOwned(tenant, permit, dayPhoto, ['../other'])).toBe(false);
  });

  it('labels multi-day evidence with its day', () => {
    expect(mdpEvidenceReportName({ kind: 'daily_progress', operationalDate: '2026-11-17', fileName: 'roof.jpg' })).toBe(
      'Daily progress · 2026-11-17 · roof.jpg',
    );
    expect(mdpEvidenceReportName({ kind: 'day_secure', operationalDate: null, fileName: 'gate.png' })).toBe('Day secure · gate.png');
    expect(mdpEvidenceReportName({ kind: 'reopen', operationalDate: '2026-11-18', fileName: 'clear.webp' })).toBe(
      'Reopen · 2026-11-18 · clear.webp',
    );
  });

  it('embeds png, jpeg and webp under the size cap', () => {
    expect(canEmbedPermitReportImage({ contentType: 'image/jpeg', fileSize: 2048 })).toBe(true);
    expect(canEmbedPermitReportImage({ contentType: 'image/png; charset=binary', fileSize: 100 })).toBe(true);
    expect(canEmbedPermitReportImage({ contentType: 'image/webp', fileSize: 100 })).toBe(true);
    expect(canEmbedPermitReportImage({ contentType: 'image/gif', fileSize: 100 })).toBe(false);
    expect(canEmbedPermitReportImage({ contentType: 'application/pdf', fileSize: 100 })).toBe(false);
    expect(canEmbedPermitReportImage({ contentType: 'image/jpeg', fileSize: 0 })).toBe(false);
    expect(canEmbedPermitReportImage({ contentType: 'image/jpeg', fileSize: 8 * 1024 * 1024 + 1 })).toBe(false);
  });
});
