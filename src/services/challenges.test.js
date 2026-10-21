import { describe, it, expect } from 'vitest';
import { fetchLeaderboard, submitChallenge } from './challenges';

describe('challenge service', () => {
  it('offline: no client means not connected, never a throw', async () => {
    expect(await fetchLeaderboard(null, '2026-W43')).toEqual({ connected: false, rows: [] });
    expect(await submitChallenge(null, { id: 'u' }, {})).toEqual({ ok: false, reason: 'offline' });
    expect(await submitChallenge({}, null, {})).toEqual({ ok: false, reason: 'signin' });
  });
  it('a failing server reads as not connected', async () => {
    const boom = { from: () => { throw new Error('net'); } };
    expect((await fetchLeaderboard(boom, 'w')).connected).toBe(false);
  });
  it('reads the leaderboard rows', async () => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [{ display_name: 'a', score: 5 }], error: null }) };
    expect(await fetchLeaderboard({ from: () => q }, 'w')).toEqual({ connected: true, rows: [{ display_name: 'a', score: 5 }] });
  });
});
