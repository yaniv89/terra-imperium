// Units keep the age they were built in; gold upgrades them on home soil (unitUpgrades.js).
import { describe, it, expect, vi } from 'vitest';
import { getTiles } from '../data/geo/tiles';
import { peoplesWorld, rivalOf, cap } from './testWorld';
import { withAgesResearched } from './research';
import { ageOf } from './nationState';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { productionCost, unitWaitsForTech } from './world/cities';
import { speedTrainMult } from '../data/ages';
import { rushGold } from './spending';
import { resolveBattle, computeHitMultiplier } from './battle';
import { createRng } from '../utils/rng';
import { getRosterCombatMultiplier, unitAgeWeight } from '../data/unitClasses';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
import { upgradeGold, upgradeQuote, unitAgeOf, stampUnitAges, aiUpgradeUnits, UPGRADE_MIN_SHARE, AI_UPGRADE_RESERVE } from './unitUpgrades';

vi.setConfig({ testTimeout: 180000 });

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const base = peoplesWorld({ seed: 5 });
const me = base.playerNationId;
const home = (s, id = me) => s.regions[cap(id)];
const unit = (id, owner, tile, regionId, over = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 700, maxStrength: 1000, morale: 80, movesLeft: 1, xp: 12, rank: 'recruit', promotions: ['drill'], commanderId: null, ...over });
// The player at the Classical age with an old Stone-age Warband in the capital and 1,000 gold.
const classical = (over = {}) => {
  const c = home(base);
  const s = withAgesResearched(quiet(base), me, 'classical');
  return { ...s, resources: { ...s.resources, gold: 1000 }, units: { ...s.units, old_1: unit('old_1', me, c.tile, c.id, { ageId: 'stone', ...over }) } };
};

describe('the upgrade price (Civ-like: the production difference at the rush price)', () => {
  it('is the cost difference, floored at a share of the new unit, in rush gold', () => {
    const cost = (c, a, to) => productionCost({ kind: 'unit', classId: c }, { ageId: a, trainMult: speedTrainMult('normal', to) });
    const diff = cost('infantry', 'classical', 'classical') - cost('infantry', 'bronze', 'classical');
    expect(upgradeGold('infantry', 'bronze', 'classical', 'normal')).toBe(rushGold(Math.max(diff, Math.ceil(cost('infantry', 'classical', 'classical') * UPGRADE_MIN_SHARE))));
    expect(upgradeGold('infantry', 'bronze', 'classical', 'normal')).toBe(160); // Spearmen to Swordsmen
    expect(upgradeGold('cavalry', 'classical', 'kingdoms', 'normal')).toBe(240); // Heavy Cavalry to Knights
    expect(upgradeGold('infantry', 'stone', 'bronze', 'normal')).toBeGreaterThan(0); // same cost curve: the floor
    expect(upgradeGold('infantry', 'bronze', 'classical', 'marathon')).toBeGreaterThan(160);
  });
});

describe('a unit keeps its age', () => {
  it('after its owner moves on, and reads its own age', () => {
    const s = classical();
    expect(ageOf(s, me)).toBe('classical');
    expect(unitAgeOf(s, s.units.old_1)).toBe('stone');
    expect(unitAgeWeight(s.units.old_1, 'classical')).toBeCloseTo(getRosterCombatMultiplier('stone', 'classical'), 9);
    expect(unitAgeWeight({ ...s.units.old_1, ageId: 'classical' }, 'classical')).toBe(1);
  });
  it('a major unit without an age gets its owner\'s age, once', () => {
    const s = classical({ ageId: undefined });
    const stamped = stampUnitAges(s);
    expect(stamped.units.old_1.ageId).toBe('classical');
    expect(stampUnitAges(stamped)).toBe(stamped);
  });
  it('an old save loads with its units at their owner\'s current age', () => {
    const s = classical({ ageId: undefined });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: s });
    expect(loaded.state.units.old_1.ageId).toBe('classical');
  });
  it('a recruited unit carries the age it was built in', () => {
    const s = classical();
    const after = gameReducer({ ...s, resources: { ...s.resources, gold: 99999, hr: 99999, copper: 999, iron: 999 } }, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(me), classId: 'infantry' } });
    const made = Object.values(after.units).find((u) => !s.units[u.id]);
    expect(made?.ageId).toBe('classical');
  });
});

describe('strength reads the unit\'s age', () => {
  it('an older unit hits softer and is hit harder inside a side of a later age', () => {
    const ctx = { phase: 'shock', baseMultiplier: 1, sourceAgeId: 'classical', targetAgeId: 'classical' };
    const a = { id: 'a', classId: 'infantry', strength: 1000, promotions: [] };
    const old = { ...a, ageId: 'stone' };
    expect(computeHitMultiplier(old, a, ctx) / computeHitMultiplier(a, a, ctx)).toBeCloseTo(getRosterCombatMultiplier('stone', 'classical'), 9);
    expect(computeHitMultiplier(a, old, ctx) / computeHitMultiplier(a, a, ctx)).toBeCloseTo(1 / getRosterCombatMultiplier('stone', 'classical'), 9);
  });
  it('a mixed army fights with each unit at its own age; a one-age army is unchanged', () => {
    const fight = (ageId) => resolveBattle({
      attackerUnits: [{ id: 'a1', classId: 'infantry', strength: 1000, morale: 100, promotions: [], ...(ageId ? { ageId } : {}) }],
      defenderUnits: [{ id: 'd1', classId: 'infantry', strength: 1000, morale: 100, promotions: [] }],
      terrain: 'plains', isAttackingFortification: false, rng: createRng(7), attackerAgeId: 'classical', defenderAgeId: 'classical'
    });
    const unaged = fight(null); const same = fight('classical'); const old = fight('bronze');
    expect(same.defenderUnits[0].strength).toBe(unaged.defenderUnits[0].strength);
    expect(old.defenderUnits[0].strength).toBeGreaterThan(same.defenderUnits[0].strength);
  });
});

describe('UPGRADE_UNIT', () => {
  it('upgrades on its own tile for the quoted gold, keeping men, experience and promotions', () => {
    const s = classical();
    const q = upgradeQuote(s, 'old_1');
    expect(q).toMatchObject({ ok: true, older: true, fromAge: 'stone', toAge: 'classical', gold: upgradeGold('infantry', 'stone', 'classical', s.gameSpeed) });
    const after = gameReducer(s, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: ['old_1'] } });
    expect(after.units.old_1).toMatchObject({ ageId: 'classical', strength: 700, maxStrength: 1000, morale: 80, xp: 12, promotions: ['drill'] });
    expect(after.resources.gold).toBe(1000 - q.gold);
    expect(upgradeQuote(after, 'old_1').older).toBe(false);
  });
  it('charges a repeated id once and ignores a payload that is not a list', () => {
    const s = classical();
    const q = upgradeQuote(s, 'old_1');
    const after = gameReducer(s, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: ['old_1', 'old_1'] } });
    expect(after.resources.gold).toBe(1000 - q.gold);
    expect(() => gameReducer(s, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: 'old_1' } })).not.toThrow();
  });
  it('is refused off its own land', () => {
    const tiles = getTiles();
    let wild = -1;
    for (let t = 0; t < tiles.land.length && wild < 0; t++) if (tiles.land[t] === 1 && base.world.tileOwner[t] == null) wild = t;
    const s = classical({ tile: wild });
    expect(upgradeQuote(s, 'old_1')).toMatchObject({ ok: false, reasonMsg: { key: 'm.why.upgradeOwnLand' } });
    const after = gameReducer(s, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: ['old_1'] } });
    expect(after.units.old_1.ageId).toBe('stone');
    expect(after.resources.gold).toBe(1000);
  });
  it('is refused while the new unit\'s tech is unknown, and without the gold', () => {
    const locked = classical({ classId: 'cavalry', ageId: 'bronze' }); // Heavy Cavalry needs Iron Weapons
    expect(upgradeQuote(locked, 'old_1')).toMatchObject({ ok: false, reasonMsg: { key: 'm.why.upgradeNeedsTech' } });
    const poor = { ...classical(), resources: { ...classical().resources, gold: 10 } };
    expect(upgradeQuote(poor, 'old_1')).toMatchObject({ ok: false, reasonMsg: { key: 'm.why.upgradeGold' } });
    expect(gameReducer(poor, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: ['old_1'] } }).units.old_1.ageId).toBe('stone');
  });
  it('a whole stack upgrades while the gold lasts', () => {
    const s0 = classical();
    const c = home(s0);
    const s = { ...s0, units: { ...s0.units, old_2: unit('old_2', me, c.tile, c.id, { ageId: 'bronze' }) } };
    const after = gameReducer(s, { type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: ['old_1', 'old_2'] } });
    expect([after.units.old_1.ageId, after.units.old_2.ageId]).toEqual(['classical', 'classical']);
    expect(after.resources.gold).toBe(1000 - upgradeQuote(s, 'old_1').gold - upgradeQuote(s, 'old_2').gold);
  });
});

describe('the AI upgrades at home', () => {
  it('with gold over its reserve, oldest first', () => {
    const rid = rivalOf(base);
    const c = home(base, rid);
    let s = withAgesResearched(base, rid, 'classical');
    s = { ...s, units: { ...s.units, ai_old: unit('ai_old', rid, c.tile, c.id, { ageId: 'stone' }) } };
    const units = { ...s.units };
    const spent = aiUpgradeUnits(s, rid, [s.units.ai_old], units, AI_UPGRADE_RESERVE + 1000);
    expect(spent).toBe(upgradeGold('infantry', 'stone', 'classical', s.gameSpeed));
    expect(units.ai_old.ageId).toBe('classical');
    const poor = { ...s.units };
    expect(aiUpgradeUnits(s, rid, [s.units.ai_old], poor, AI_UPGRADE_RESERVE)).toBe(0);
    expect(poor.ai_old.ageId).toBe('stone');
  });
});

describe('cities build only the current age\'s unit', () => {
  it('an order whose new-age unit needs a tech waits for it', () => {
    expect(unitWaitsForTech({ kind: 'unit', classId: 'cavalry' }, 'classical', [])).toBe(true);
    expect(unitWaitsForTech({ kind: 'unit', classId: 'cavalry' }, 'classical', ['military_iron_weapons'])).toBe(false);
    expect(unitWaitsForTech({ kind: 'unit', classId: 'infantry' }, 'classical', [])).toBe(false);
    expect(unitWaitsForTech({ kind: 'unit', classId: 'cavalry' }, 'classical', [], true)).toBe(false); // independents
  });
  it('a finished unit is of the current age; a locked one stays in the queue', () => {
    const s = classical();
    const id = cap(me);
    const withOrder = (item) => ({ ...s, regions: { ...s.regions, [id]: { ...s.regions[id], production: { current: item, queue: [], progress: 5000 } } } });
    const built = resolveTurn(withOrder({ kind: 'unit', classId: 'infantry' }));
    const made = Object.values(built.units).filter((u) => !s.units[u.id] && u.ownerId === me && u.classId === 'infantry');
    expect(made.length).toBe(1);
    expect(made[0].ageId).toBe('classical');
    const waiting = resolveTurn(withOrder({ kind: 'unit', classId: 'cavalry' }));
    expect(Object.values(waiting.units).some((u) => !s.units[u.id] && u.classId === 'cavalry')).toBe(false);
    expect(waiting.regions[id].production.current).toMatchObject({ kind: 'unit', classId: 'cavalry' });
  });
});
