import { permitKey, prepareReplay, replayQueue, type ReplayItem, type ReplayOutcome } from '../mobile/src/lib/offline/replay';

const item = (id: number, method: string, path: string, payload: object, localRef: string | null = null): ReplayItem => ({
  id,
  method,
  path,
  payload: JSON.stringify(payload),
  localRef,
});

describe('offline replay (S0b)', () => {
  it('sends a queued create as the API takes it and reports the local permit it makes', () => {
    expect(prepareReplay(item(1, 'POST', '/permits', { title: 'Pump' }, 'local-1'), new Map())).toEqual({
      kind: 'send',
      path: '/permits',
      body: JSON.stringify({ title: 'Pump' }),
      createsLocal: 'local-1',
    });
  });

  it('cleans requests queued by older app versions: unknown keys removed, local id taken from the body', () => {
    const legacy = item(1, 'POST', '/permits', { title: 'Pump', localDraftId: 'local-9', action: 'x' });
    expect(prepareReplay(legacy, new Map())).toMatchObject({ kind: 'send', body: JSON.stringify({ title: 'Pump' }), createsLocal: 'local-9' });
    expect(permitKey(legacy)).toBe('local-9');
  });

  it('never guesses a revision: older queued saves and submits without one fail for review', () => {
    expect(prepareReplay(item(1, 'PATCH', '/permits/abc', { title: 'x' }), new Map())).toMatchObject({ kind: 'fail' });
    expect(prepareReplay(item(1, 'POST', '/permits/abc/submit', { action: 'submit' }), new Map())).toMatchObject({ kind: 'fail' });
    expect(prepareReplay(item(1, 'PATCH', '/permits/abc', { expectedRevision: 2 }), new Map())).toMatchObject({ kind: 'send' });
  });

  it('points requests for a permit created offline at its server id, or fails them if it never got one', () => {
    const patch = item(2, 'PATCH', '/permits/local-1', { expectedRevision: 0 });
    expect(prepareReplay(patch, new Map([['local-1', 'srv-1']]))).toMatchObject({ kind: 'send', path: '/permits/srv-1' });
    expect(prepareReplay(patch, new Map())).toMatchObject({ kind: 'fail' });
  });

  it('create, save and submit made offline replay in order against the new server id', async () => {
    const sent: string[] = [];
    const result = await replayQueue(
      [
        item(1, 'POST', '/permits', { title: 'Pump' }, 'local-1'),
        item(2, 'PATCH', '/permits/local-1', { expectedRevision: 0 }),
        item(3, 'POST', '/permits/local-1/submit', { expectedRevision: 1 }),
      ],
      new Map(),
      {
        send: async (path, method) => {
          sent.push(`${method} ${path}`);
          return { outcome: 'done' as ReplayOutcome, serverId: path === '/permits' ? 'srv-1' : undefined };
        },
        done: async () => undefined,
        failed: async () => undefined,
        unreachable: async () => false,
      },
    );
    expect(sent).toEqual(['POST /permits', 'PATCH /permits/srv-1', 'POST /permits/srv-1/submit']);
    expect(result).toEqual({ processed: 3, failed: 0 });
  });

  it('a refused save holds the submit queued after it, while other permits carry on', async () => {
    const failed: [number, string][] = [];
    const sent: string[] = [];
    await replayQueue(
      [
        item(1, 'PATCH', '/permits/a', { expectedRevision: 3 }),
        item(2, 'PATCH', '/permits/b', { expectedRevision: 1 }),
        item(3, 'POST', '/permits/a/submit', { expectedRevision: 4 }),
      ],
      new Map(),
      {
        send: async (path) => {
          sent.push(path);
          return path === '/permits/a' ? { outcome: 'refused' as ReplayOutcome, reason: 'This permit changed since you opened it.' } : { outcome: 'done' as ReplayOutcome };
        },
        done: async () => undefined,
        failed: async (i, reason) => void failed.push([i.id, reason]),
        unreachable: async () => false,
      },
    );
    expect(sent).toEqual(['/permits/a', '/permits/b']);
    expect(failed.map(([id]) => id)).toEqual([1, 3]);
    expect(failed[0][1]).toMatch(/changed since you opened it/);
  });

  it('stops in order when the server is unreachable, leaving the rest pending', async () => {
    const sent: string[] = [];
    await replayQueue(
      [item(1, 'PATCH', '/permits/a', { expectedRevision: 0 }), item(2, 'PATCH', '/permits/b', { expectedRevision: 0 })],
      new Map(),
      {
        send: async (path) => (sent.push(path), { outcome: 'unreachable' as ReplayOutcome }),
        done: async () => undefined,
        failed: async () => undefined,
        unreachable: async () => false,
      },
    );
    expect(sent).toEqual(['/permits/a']);
  });
});
