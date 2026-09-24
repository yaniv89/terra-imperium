import { describe, it, expect } from 'vitest';
import { resolveSyncState } from './useCloudSync';

// resolveSyncState is the pure decision core of the sync engine (src/hooks/useCloudSync.js) —
// deliberately framework-free so the conflict matrix can be tested exhaustively without a DOM or
// a fake Supabase client. localMeta.syncedRevision/syncedTurnNumber record what this device last
// synced FROM; localMeta.turnNumber is where local play is NOW (it may have moved on since then
// via offline play) — "changed" means turnNumber has diverged from syncedTurnNumber.
describe('resolveSyncState', () => {
  it('useLocal when there is no cloud save yet at all (first sync ever)', () => {
    expect(resolveSyncState(null, null)).toBe('useLocal');
    expect(resolveSyncState({ syncedRevision: 3, syncedTurnNumber: 10, turnNumber: 12 }, null)).toBe('useLocal');
  });

  it('useCloud when this device has no local cache yet (new device, existing account)', () => {
    expect(resolveSyncState(null, { revision: 5, turnNumber: 40 })).toBe('useCloud');
  });

  it('useLocal when only local play has moved on since the last sync (cloud unchanged)', () => {
    const local = { syncedRevision: 3, syncedTurnNumber: 10, turnNumber: 15 };
    const cloud = { revision: 3, turnNumber: 10 };
    expect(resolveSyncState(local, cloud)).toBe('useLocal');
  });

  it('useLocal when neither side changed (a no-op resync)', () => {
    const local = { syncedRevision: 3, syncedTurnNumber: 10, turnNumber: 10 };
    const cloud = { revision: 3, turnNumber: 10 };
    expect(resolveSyncState(local, cloud)).toBe('useLocal');
  });

  it('useCloud when only the cloud moved on since the last sync (another device saved, this one is idle)', () => {
    const local = { syncedRevision: 3, syncedTurnNumber: 10, turnNumber: 10 };
    const cloud = { revision: 4, turnNumber: 14 };
    expect(resolveSyncState(local, cloud)).toBe('useCloud');
  });

  it('ask when BOTH sides diverged from the last common revision', () => {
    const local = { syncedRevision: 3, syncedTurnNumber: 10, turnNumber: 16 };
    const cloud = { revision: 4, turnNumber: 14 };
    expect(resolveSyncState(local, cloud)).toBe('ask');
  });
});
