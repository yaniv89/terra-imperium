// A city with nothing valid to build never blocks End Turn (playtest issue 9: no soft lock).
import { describe, it, expect, vi } from 'vitest';
import { getNationCapital } from '../data/regions';
import { peoplesWorld } from './testWorld';

vi.mock('./world/cities', async (orig) => ({ ...(await orig()), canQueue: () => ({ ok: false, reason: 'Nothing here.' }) }));
const { turnBlockers, idleCities } = await import('./turnBlockers');

describe('turn blockers without anything to build', () => {
  it('an idle city that can queue nothing is not asked to choose', () => {
    const S = peoplesWorld({ seed: 7 });
    const cap = getNationCapital(S.playerNationId);
    const idle = { ...S, regions: { ...S.regions, [cap]: { ...S.regions[cap], production: { current: null, queue: [], progress: 0 } } } };
    expect(idleCities(idle).map((c) => c.id)).not.toContain(cap);
    expect(turnBlockers(idle).some((b) => b.kind === 'city' && b.target.regionId === cap)).toBe(false);
  });
});
