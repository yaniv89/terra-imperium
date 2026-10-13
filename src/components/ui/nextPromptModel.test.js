import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { nextPrompts, endTurnWarnings, softHints, SOFT_KINDS, UNREST_PROMPT, WAR_NOTICE_TURNS } from './nextPromptModel';
import { chipLabel } from './promptActions';

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
  it('the "warn me" setting counts only the soft hints (units that can move), never the End Turn blockers; off, it counts nothing', () => {
    const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const cap = getNationCapital('fr');
    const army = Object.values(S.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const idle = { ...S, research: { ...S.research, current: null, auto: false }, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 1 } } };
    expect(endTurnWarnings(idle)).toBe(0);
    const warn = { ...idle, battleSettings: { ...idle.battleSettings, warnEndTurn: true } };
    expect(endTurnWarnings(warn)).toBe(softHints(warn).length);
    expect(softHints(warn).every((p) => SOFT_KINDS.has(p.kind))).toBe(true);
    expect(softHints(warn).some((p) => p.kind === 'army')).toBe(true);
    expect(nextPrompts(warn).some((p) => p.kind === 'research')).toBe(true);
    expect(softHints(warn).some((p) => p.kind === 'research')).toBe(false);
    const guided = { ...warn, tutorial: { startTurn: 1, done: {}, ended: false }, playerNationId: 'fr' };
    expect(endTurnWarnings(guided)).toBe(softHints(guided).length);
  });
  it('a war declared on the player stays as a notice for a few turns and opens Peoples (I117)', () => {
    const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const war = (aggressor, enemy, startTurn) => ({ id: `w_${aggressor}`, aggressor, enemy, active: true, startTurn });
    const attacked = { ...S, turnNumber: 10, wars: [war('de', 'fr', 9), war('fr', 'be', 9), war('es', 'fr', 2)] };
    const notices = nextPrompts(attacked).filter((p) => p.kind === 'war');
    expect(notices).toHaveLength(1); // not the war the player declared, not an old one
    expect(notices[0]).toMatchObject({ tab: 'diplomacy', nationId: 'de' });
    expect(notices[0].label).toBe(`${S.nations.de.name} declared war on you`);
    expect(chipLabel(attacked, notices[0])).toMatch(/declared war/);
    expect(softHints(attacked).some((p) => p.kind === 'war')).toBe(false); // never an End Turn warning
    expect(nextPrompts({ ...attacked, turnNumber: 9 + WAR_NOTICE_TURNS }).some((p) => p.kind === 'war')).toBe(false);
  });
});
