import { describe, it, expect } from 'vitest';
import { getNationCapital } from '../../data/regions';
import { nextPrompts, endTurnWarnings, softHints, SOFT_KINDS, UNREST_PROMPT, WAR_NOTICE_TURNS } from './nextPromptModel';
import { chipLabel } from './promptActions';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);
const BE = rivalOf(WORLD, 1);
const ES = rivalOf(WORLD, 2);

describe('next prompt', () => {
  it('lists what wants a decision, in order, and nothing when all is settled', () => {
    const S = peoplesWorld({ seed: 7 });
    const cap = getNationCapital(FR);
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
    const army = Object.values(S.units).find((u) => u.ownerId === FR && u.domain === 'land');
    const field = { ...restless, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 1 } } };
    expect(nextPrompts(field).find((p) => p.kind === 'army')).toBeTruthy();
    expect(nextPrompts(base).find((p) => p.kind === 'ruler')).toMatchObject({ tab: 'ruler' }); // the start's virtue point
    const spent = { ...restless, nations: { ...restless.nations, [FR]: { ...restless.nations[FR], ruler: { ...restless.nations[FR].ruler, bonusVirtuePoints: -1 } } } };
    const settled = { ...spent, regions: { ...spent.regions, [cap]: { ...spent.regions[cap], unrest: 0 } } };
    expect(nextPrompts({ ...settled, regions: Object.fromEntries(Object.entries(settled.regions).map(([id, c]) => [id, c.owner === FR ? { ...c, production: { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 } } : c])) })).toEqual([]);
  });
  it('the "warn me" setting counts only the soft hints (units that can move), never the End Turn blockers; off, it counts nothing', () => {
    const S = peoplesWorld({ seed: 7 });
    const cap = getNationCapital(FR);
    const army = Object.values(S.units).find((u) => u.ownerId === FR && u.domain === 'land');
    const idle = { ...S, research: { ...S.research, current: null, auto: false }, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 1 } } };
    expect(endTurnWarnings(idle)).toBe(0);
    const warn = { ...idle, battleSettings: { ...idle.battleSettings, warnEndTurn: true } };
    expect(endTurnWarnings(warn)).toBe(softHints(warn).length);
    expect(softHints(warn).every((p) => SOFT_KINDS.has(p.kind))).toBe(true);
    expect(softHints(warn).some((p) => p.kind === 'army')).toBe(true);
    expect(nextPrompts(warn).some((p) => p.kind === 'research')).toBe(true);
    expect(softHints(warn).some((p) => p.kind === 'research')).toBe(false);
    const guided = { ...warn, tutorial: { startTurn: 1, done: {}, ended: false }, playerNationId: FR };
    expect(endTurnWarnings(guided)).toBe(softHints(guided).length);
  });
  it('reminders that never block: ruler points, an empty governor seat, a full decree bank (playtest 22 Oct)', () => {
    const S = peoplesWorld({ seed: 7 });
    const cap = getNationCapital(FR);
    const nation = S.nations[FR];
    const none = { ...nation, ruler: { ...nation.ruler, bonusVirtuePoints: -1, decrees: 0 }, governorCandidates: [] };
    const kinds = (n) => nextPrompts({ ...S, nations: { ...S.nations, [FR]: n } }).map((p) => p.kind);
    expect(kinds(none)).not.toContain('ruler');
    expect(kinds(none)).not.toContain('governor');
    expect(kinds(none)).not.toContain('decrees');
    expect(kinds({ ...none, ruler: { ...none.ruler, renown: 10000 } })).toContain('ruler'); // levels bring attribute points
    const candidate = { id: 'gov_x', name: 'Ur-Nammu', skill: 2 };
    const seat = nextPrompts({ ...S, nations: { ...S.nations, [FR]: { ...none, governorCandidates: [candidate] } } }).find((p) => p.kind === 'governor');
    expect(seat).toMatchObject({ tab: 'domestic', section: 'court', count: 1 });
    expect(chipLabel(S, seat)).toBe('Appoint a governor');
    expect(kinds({ ...none, governorCandidates: [candidate], governors: { [cap]: { ...candidate, ready: 1 } } })).not.toContain('governor');
    expect(kinds({ ...none, ruler: { ...none.ruler, decrees: 99 } })).toContain('decrees');
    expect(['ruler', 'governor', 'decrees'].every((k) => SOFT_KINDS.has(k))).toBe(true);
  });
  it('a war declared on the player stays as a notice for a few turns and opens Peoples (I117)', () => {
    const S = peoplesWorld({ seed: 7 });
    const war = (aggressor, enemy, startTurn) => ({ id: `w_${aggressor}`, aggressor, enemy, active: true, startTurn });
    const attacked = { ...S, turnNumber: 10, wars: [war(DE, FR, 9), war(FR, BE, 9), war(ES, FR, 2)] };
    const notices = nextPrompts(attacked).filter((p) => p.kind === 'war');
    expect(notices).toHaveLength(1); // not the war the player declared, not an old one
    expect(notices[0]).toMatchObject({ tab: 'diplomacy', nationId: DE });
    expect(notices[0].label).toBe(`${S.nations[DE].name} declared war on you`);
    expect(chipLabel(attacked, notices[0])).toMatch(/declared war/);
    expect(softHints(attacked).some((p) => p.kind === 'war')).toBe(false); // never an End Turn warning
    expect(nextPrompts({ ...attacked, turnNumber: 9 + WAR_NOTICE_TURNS }).some((p) => p.kind === 'war')).toBe(false);
  });
});
