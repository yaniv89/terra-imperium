import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { nextPrompts, endTurnWarnings, UNREST_PROMPT } from './nextPrompt';

describe('next prompt', () => {
  it('lists what wants a decision, in order, and nothing when all is settled', () => {
    const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const cap = getNationCapital('fr');
    const base = { ...S, research: { ...S.research, current: 'science_cuneiform_records', auto: false } };
    const p0 = nextPrompts(base);
    expect(p0.some((p) => p.kind === 'army')).toBe(false); // garrisons rest in their cities
    const emptyQueue = p0.find((p) => p.kind === 'city');
    expect(!!emptyQueue).toBe(!S.regions[cap].production?.current);
    const idle = { ...base, research: { ...base.research, current: null, auto: false } };
    expect(nextPrompts(idle)[0]).toMatchObject({ kind: 'research', tab: 'tech' });
    const auto = { ...idle, research: { ...idle.research, auto: true } };
    expect(nextPrompts(auto).some((p) => p.kind === 'research')).toBe(false);
    const peace = { ...base, pendingPeaceOffer: { terms: [] } };
    expect(nextPrompts(peace)[0].kind).toBe('peace');
    const restless = { ...base, regions: { ...base.regions, [cap]: { ...base.regions[cap], unrest: UNREST_PROMPT, production: { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 } } } };
    expect(nextPrompts(restless).find((p) => p.kind === 'unrest')).toMatchObject({ regionId: cap });
    const army = Object.values(S.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const field = { ...restless, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 1 } } };
    expect(nextPrompts(field).find((p) => p.kind === 'army')).toBeTruthy();
    const settled = { ...restless, regions: { ...restless.regions, [cap]: { ...restless.regions[cap], unrest: 0 } } };
    expect(nextPrompts({ ...settled, regions: Object.fromEntries(Object.entries(settled.regions).map(([id, c]) => [id, c.owner === 'fr' ? { ...c, production: { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 } } : c])) })).toEqual([]);
  });
  it('the "warn me" setting counts the prompts that still wait, the guide aside; off, it counts nothing', () => {
    const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const idle = { ...S, research: { ...S.research, current: null, auto: false } };
    expect(endTurnWarnings(idle)).toBe(0);
    const warn = { ...idle, battleSettings: { ...idle.battleSettings, warnEndTurn: true } };
    expect(endTurnWarnings(warn)).toBe(nextPrompts(warn).length);
    expect(endTurnWarnings(warn)).toBeGreaterThan(0);
    const guided = { ...warn, tutorial: { startTurn: 1, done: {}, ended: false }, playerNationId: 'fr' };
    expect(endTurnWarnings(guided)).toBe(nextPrompts(guided).filter((p) => p.kind !== 'guide').length);
  });
});
