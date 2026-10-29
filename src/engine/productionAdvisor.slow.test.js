import { describe, it, expect, vi } from 'vitest';
import { advisorPicks } from './productionAdvisor';
import { buildQuote, isLongBuild } from './cityEconomy';
import { ageOf } from './nationState';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { peoplesWorld } from './testWorld';

// The AI scoring wants a wonder: far past the long-build line in a new capital.
const WONDER = { kind: 'wonder', projectId: Object.keys(GREAT_PROJECTS)[0] };
vi.mock('./aiProduction', async (orig) => ({ ...(await orig()), chooseProduction: () => WONDER }));

describe('production advisor: long builds', () => {
  it('a pick past the long-build line gives way to a quick one', () => {
    let S = peoplesWorld({ seed: 7 });
    const me = S.playerNationId;
    S = { ...S, regions: Object.fromEntries(Object.entries(S.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { current: null, queue: [], progress: 0 } } : c])) };
    const [p] = advisorPicks(S);
    const age = ageOf(S, me);
    expect(isLongBuild(S, age, buildQuote(S, p.cityId, WONDER).turns)).toBe(true);
    expect(p.item.kind).not.toBe('wonder');
    expect(isLongBuild(S, age, buildQuote(S, p.cityId, p.item).turns)).toBe(false);
  });
});
