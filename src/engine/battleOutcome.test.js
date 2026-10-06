// src/engine/battleOutcome.test.js
// The one battle outcome service (battleOutcome.js): idempotence, and one test per row of
// plans/MASTER-PLAN.md 6.7 (the "Prisoners" item is dropped: units lost are gone).
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState, sanitizeTacticalResult } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNeighborIds, getTouchingIds, getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities } from './testWorld';
import { applyBattleOutcome, makeBattleOutcome, isBattleApplied, APPLIED_MEMORY, BATTLE_MARK_TURNS, XP_WIN, dispositionOf } from './battleOutcome';
import { battleInputs, cityMilitia, wallsHpRatio, batteredReduction, reinforcementSources, alliesOf, STARVED_MORALE_LOSS, STARVED_SUPPLY, PLAGUE_MORALE_LOSS, SUPPLY_MORALE_LOSS } from './battleInputs';
import { resolveAutoBattle, autoDispositions } from './autoBattle';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs } from './invasion';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult, FORT_REDUCTION } from './fieldBattle';
import { applyDefenseWithdrawal, WITHDRAW_MORALE_LOSS, createDefenseRecord } from './defense';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { tileContextOf } from '../battle/setup/tileContext';
import { siegeMaxHp } from './sieges';
import { SIEGE_CAPTURE_CONTROL_THRESHOLD } from './siege';
import { CONQUEST_CONTROL, CONQUEST_MIN_UNREST } from './conquest';
import { LOYALTY_ON_CONQUEST } from './loyalty';
import { nationFacts } from './boosts';
import { estimateInvasionOdds } from './battleOdds';
import { cityManifestOf } from './cityManifest';
import { battleNameOf } from './battleName';
import { applyArmyDesertion } from './armyDesertion';
import { canSeeRegionDetails } from './intel';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { createRng } from '../utils/rng';
import { assertGameState } from './stateAudit';
import { syncWorldRegistry } from './world/registry';

const tiles = getTiles();

// France attacks a neighbouring city (tacticalBattle.test.js's world).
const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr') || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr');
  const near = addCity(first.state, 'fr', { near: target });
  const AGG = near.state.regions[target].owner;
  const grown = addCities(near.state, AGG, 3);
  return { state: grown.state, FR: first.cityId, T: target, FR_NEAR: near.cityId, AGG };
})();
const { FR, T, AGG } = WORLD;
const GATE = getTouchingIds(FR).includes(T) ? null : tiles.neighbors[WORLD.state.regions[T].tile].find((n) => tiles.land[n] === 1);
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000, extra = {}) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1,
  ...(regionId === FR && GATE != null ? { tile: GATE } : {}), ...extra
});
const war = (s) => ({ ...s, nations: { ...s.nations, fr: { ...s.nations.fr, isAtWar: true }, [AGG]: { ...s.nations[AGG], isAtWar: true } }, resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 }, wars: [...s.wars, { id: 'war_t', aggressor: 'fr', enemy: AGG, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }] });
// The registry (neighbours, touching lands) follows the last synced world: each fixture syncs its own.
const armies = (extra = {}) => {
  const s = war(syncWorldRegistry(WORLD.state));
  return { ...s, units: { a1: unit('a1', FR, 'fr'), a2: unit('a2', FR, 'fr', 'cavalry'), a3: unit('a3', FR, 'fr', 'ranged'), d1: unit('d1', T, AGG), d2: unit('d2', T, AGG, 'ranged', 800), ...extra } };
};
const scoreOf = (s) => s.wars.find((w) => w.id === 'war_t').battleScore;
// An invasion outcome by hand: `att`/`def` map ids to strength after the battle.
const invasion = (s, outcome, att, def, meta = {}) => makeBattleOutcome({
  id: meta.id || 'op1', kind: 'invasion', mode: meta.mode || 'auto', warId: 'war_t', attackerNationId: 'fr', defenderNationId: AGG,
  fromRegionId: FR, regionId: T, tile: s.regions[T].tile, isDefended: true, ...meta
}, {
  outcome,
  attackerUnits: Object.entries(att).map(([id, strength]) => ({ ...s.units[id], strength, routed: false })),
  defenderUnits: Object.entries(def).map(([id, strength]) => ({ ...s.units[id], strength, routed: strength > 0 && meta.routed })),
  report: { deployedAttackerIds: Object.keys(att), deployedDefenderIds: Object.keys(def), ...(meta.tactical ? { tactical: meta.tactical } : {}) }
});

// Two free adjacent land tiles near Delhi for field battles (fieldBattle.test.js).
const FIELD = (() => {
  const s0 = createInitialState({ playerNationId: 'in', rngSeed: 3 });
  const S = { ...s0, units: {}, resources: { ...s0.resources, mil: 100, gold: 1000 } };
  const IN = getNationCapital('in');
  const seen = new Set([S.regions[IN].tile]); let f = [S.regions[IN].tile];
  for (let d = 0; d < 8; d++) {
    const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n.sort((a, b) => a - b);
    for (const t of f) { if (tiles.land[t] !== 1 || S.world.tileOwner[t]) continue; const o = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && !S.world.tileOwner[x] && x !== t); if (o != null) return { S, IN, PK: getNationCapital('pk'), ours: t, theirs: o }; }
  }
  throw new Error('no free pair');
})();
const fieldState = (extra = []) => {
  const { IN, PK, ours, theirs } = FIELD;
  const S = syncWorldRegistry(FIELD.S);
  const u = (id, regionId, x = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...x });
  const units = Object.fromEntries([u('a', IN, { tile: ours }), u('b', IN, { tile: ours, classId: 'cavalry' }), u('e', PK, { ownerId: 'pk', tile: theirs }), ...extra.map((x) => u(x.id, x.regionId || IN, x))].map((x) => [x.id, x]));
  return { ...S, units, wars: [...S.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: S.year, battleScore: 0 }], nations: { ...S.nations, in: { ...S.nations.in, isAtWar: true }, pk: { ...S.nations.pk, isAtWar: true } } };
};

describe('the outcome service', () => {
  it('applies an outcome exactly once, and Command and Auto of one operation share its id', () => {
    const s = armies();
    const o = invasion(s, 'defender', { a1: 600, a2: 700, a3: 900 }, { d1: 800, d2: 700 });
    const once = applyBattleOutcome(s, o);
    expect(isBattleApplied(once, 'op1')).toBe(true);
    expect(applyBattleOutcome(once, o)).toBe(once);
    // The same operation fought the other way (Command) can no longer land either.
    expect(applyBattleOutcome(once, { ...o, mode: 'command' })).toBe(once);
    // The memory is bounded.
    let t = once;
    for (let i = 0; i < APPLIED_MEMORY + 5; i++) t = { ...t, appliedBattleIds: [...(t.appliedBattleIds || []), `x${i}`].slice(-APPLIED_MEMORY) };
    expect(t.appliedBattleIds.length).toBe(APPLIED_MEMORY);
    assertGameState(once);
  });

  it('a battle whose war ended before it was applied has no consequences', () => {
    const s = armies();
    const ended = { ...s, wars: s.wars.map((w) => (w.id === 'war_t' ? { ...w, active: false } : w)) };
    const after = applyBattleOutcome(ended, invasion(ended, 'attacker', { a1: 900 }, { d1: 0, d2: 0 }));
    expect(after.units).toBe(ended.units);
    expect(after.regions[T].owner).toBe(AGG);
  });
});

describe('master plan 6.7, row by row', () => {
  it('1 war score: one entry per battle', () => {
    const s = armies();
    const after = applyBattleOutcome(s, invasion(s, 'defender', { a1: 600, a2: 700, a3: 900 }, { d1: 800, d2: 700 }));
    expect(scoreOf(after)).toBeLessThan(scoreOf(s)); // the defender won: the aggressor's score falls
    const again = applyBattleOutcome(after, invasion(after, 'defender', { a1: 500 }, { d1: 700 }, { id: 'op1' }));
    expect(scoreOf(again)).toBe(scoreOf(after));
  });

  it('2 conquest: control 25, unrest 50, loyalty, the conquest marker, AE and the capital move, once', () => {
    const s = armies();
    const wasCapital = s.nations[AGG].capitalRegionId === T;
    const after = applyBattleOutcome(s, invasion(s, 'attacker', { a1: 900, a2: 800, a3: 900 }, { d1: 0, d2: 0 }));
    const city = after.regions[T];
    expect(city.owner).toBe('fr');
    expect(city.control).toBe(CONQUEST_CONTROL);
    expect(city.unrest).toBeGreaterThanOrEqual(CONQUEST_MIN_UNREST);
    expect(city.loyalty).toBe(LOYALTY_ON_CONQUEST);
    expect(city.conquest).toMatchObject({ warId: 'war_t', from: AGG });
    expect(Object.values(after.nations).some((n) => (n.ae?.fr || 0) > 0)).toBe(true);
    if (wasCapital) expect(after.nations[AGG].capitalRegionId).not.toBe(T);
    expect(after.units.a1.regionId).toBe(T);
    expect(after.units.d1).toBeUndefined();
    assertGameState(after);
  });

  it('3 siege control and the melee rule: archers and aircraft never take a city', () => {
    const s = armies();
    const low = { ...s, regions: { ...s.regions, [T]: { ...s.regions[T], control: 20 } } };
    const ranged = applyBattleOutcome(low, invasion(low, 'attacker', { a1: 0, a2: 0, a3: 900 }, { d1: 500, d2: 400 }));
    expect(ranged.regions[T].owner).toBe(AGG);
    expect(ranged.regions[T].control).toBe(SIEGE_CAPTURE_CONTROL_THRESHOLD);
    const melee = applyBattleOutcome(low, invasion(low, 'attacker', { a1: 800, a2: 0, a3: 900 }, { d1: 500, d2: 400 }, { id: 'op2' }));
    expect(melee.regions[T].owner).toBe('fr');
    // The city's militia stand in the garrison: an attack that broke the units but not the militia grinds on.
    const mil = cityMilitia(s, T);
    expect(mil.length).toBeGreaterThan(0);
    const militiaHolds = applyBattleOutcome(s, makeBattleOutcome({ id: 'op3', kind: 'invasion', warId: 'war_t', attackerNationId: 'fr', defenderNationId: AGG, fromRegionId: FR, regionId: T, isDefended: true, militia: mil }, {
      outcome: 'attacker', attackerUnits: [{ ...s.units.a1, strength: 900 }], defenderUnits: [{ ...s.units.d1, strength: 0 }, { ...mil[0], strength: 100 }], report: {}
    }));
    expect(militiaHolds.regions[T].owner).toBe(AGG);
  });

  it('4 zone of control and local.fortLevel are setup inputs, the same for Command and Auto', () => {
    const s = armies();
    const walled = { ...s, regions: { ...s.regions, [T]: { ...s.regions[T], defenseLevel: 4 } } };
    const v = validateInvasion(walled, FR, T);
    const ctx = getInvasionBattleContext(walled, { targetRegionId: T, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
    expect(ctx.defenderDamageReductionMultiplier).toBeLessThan(1);
    const began = gameReducer(walled, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.modifiers.defenseReduction).toBeCloseTo(ctx.defenderDamageReductionMultiplier, 6);
    expect(getResolveBattleArgs(v, ctx).defenderDamageReductionMultiplier).toBeCloseTo(ctx.defenderDamageReductionMultiplier, 6);
  });

  it('5 generals: the XP multiplier, and one death rule for Auto and Command', () => {
    const s = { ...armies(), hiredCommanders: { g1: { id: 'g1', name: 'Vercingetorix', personality: 'logistician', assignedUnitId: 'a1' }, g2: { id: 'g2', name: 'Brennus', personality: 'aggressive', assignedUnitId: 'a2' } } };
    s.units = { ...s.units, a1: { ...s.units.a1, commanderId: 'g1' }, a2: { ...s.units.a2, commanderId: 'g2' } };
    const won = applyBattleOutcome(s, invasion(s, 'defender', { a1: 500, a3: 900 }, { d1: 800 }));
    expect(won.units.a1.xp).toBe(Math.round(15 * 1.25)); // a loss: XP_LOSE x the logistician's 1.25
    // a2 destroyed: its general falls or escapes by the same hash roll, whichever mode fought.
    const auto = applyBattleOutcome(s, invasion(s, 'defender', { a1: 500, a2: 0 }, { d1: 800 }, { id: 'auto1' }));
    const cmd = applyBattleOutcome(s, invasion(s, 'defender', { a1: 500, a2: 0 }, { d1: 800 }, { id: 'cmd1', mode: 'command' }));
    expect(!!auto.hiredCommanders.g2).toBe(!!cmd.hiredCommanders.g2);
    if (auto.hiredCommanders.g2) expect(auto.hiredCommanders.g2.assignedUnitId).toBeNull();
  });

  it('6 powers are spent once: missiles from the stockpile, a nuclear strike costs as from the map', () => {
    const base = armies();
    const s = { ...base, nations: { ...base.nations, fr: { ...base.nations.fr, missiles: { tactical: 2, nuclear: 1 }, prestige: 50 } } };
    const o = invasion(s, 'defender', { a1: 600 }, { d1: 800 }, { tactical: { powersUsed: [{ missileTactical: 1, nuclearStrike: 1 }, {}] } });
    const after = applyBattleOutcome(s, o);
    expect(after.nations.fr.missiles).toMatchObject({ tactical: 1, nuclear: 0 });
    expect(after.nations.fr.prestige).toBeLessThan(50);
    expect(after.regions[T].nuclearScarred).toBe(true);
    expect(after.nations[AGG].hostility).toBe(100);
    expect(applyBattleOutcome(after, o).nations.fr.missiles.tactical).toBe(1);
  });

  it('7 a fort and a held tile: the same reduction in the field battle setup and the auto-resolve', () => {
    const s0 = fieldState();
    const s = { ...s0, world: { ...s0.world, tileState: { ...s0.world.tileState, [FIELD.theirs]: { improvement: 'fort' } } } };
    const v = validateFieldAttack(s, FIELD.IN, FIELD.theirs);
    const ctx = getFieldBattleContext(s, v);
    expect(ctx.defenderDamageReductionMultiplier).toBe(FORT_REDUCTION);
    expect(getFieldResolveArgs(v, ctx).defenderDamageReductionMultiplier).toBe(FORT_REDUCTION);
    const began = gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FIELD.IN, tile: FIELD.theirs } });
    expect(buildInvasionSetup(began, began.pendingBattle).modifiers.defenseReduction).toBe(FORT_REDUCTION);
  });

  it('8 air turn-back: anti-air turns aircraft back before either mode sees the armies', () => {
    const s = armies();
    // Five aircraft based in the second French city, in range of the target (airPower.js).
    const base = s.regions[WORLD.FR_NEAR].tile;
    const air = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`air${i}`, { ...unit(`air${i}`, WORLD.FR_NEAR, 'fr', 'air'), tile: base }]));
    const aa = { aa1: unit('aa1', T, AGG, 'support'), aa2: unit('aa2', T, AGG, 'support') };
    const t = { ...s, units: { ...s.units, ...air, ...aa } };
    const v = validateInvasion(t, FR, T);
    const flying = v.attackerUnits.filter((u) => u.classId === 'air').map((u) => u.id);
    expect(flying.length).toBe(3); // 2 anti-air x 20% turn back 2 of 5
    const began = gameReducer(t, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    expect(began.pendingBattle.attackerUnitIds.filter((id) => id.startsWith('air'))).toEqual(flying);
  });

  it('9 encirclement: a starved city starts with less morale and food', () => {
    const s = armies();
    const starved = { ...s, regions: { ...s.regions, [T]: { ...s.regions[T], siege: { hp: 100, maxHp: 400, by: 'fr', encircled: true, starving: 2, startedTurn: 1 } } } };
    const fed = battleInputs(s, { attackerUnits: [s.units.a1], defenderUnits: [s.units.d1], cityId: T, fromRegionId: FR });
    const hungry = battleInputs(starved, { attackerUnits: [s.units.a1], defenderUnits: [s.units.d1], cityId: T, fromRegionId: FR });
    expect(hungry.defenderUnits[0].morale).toBe(100 - STARVED_MORALE_LOSS);
    expect(fed.defenderUnits[0].morale).toBe(100);
    expect(hungry.economyInputs.supply[1]).toBe(STARVED_SUPPLY);
    const began = gameReducer(starved, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    const fedSetup = buildInvasionSetup(gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } }), gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } }).pendingBattle);
    expect(setup.economy.stockMult[1]).toBeLessThan(fedSetup.economy.stockMult[1]);
    expect(setup.sides[1].units.find((u) => u.id === 'd1').morale).toBe(100 - STARVED_MORALE_LOSS);
  });

  it('10 a fortress wonder raises the walls: one HP formula for the battlefield and the auto-resolve', () => {
    const s = armies();
    const city = { ...s.regions[T], buildings: { ...(s.regions[T].buildings || {}), categories: { ...(s.regions[T].buildings?.categories || {}), defense: 1 } } };
    const gp = { masada: { regionId: T, tier: 2 } };
    expect(siegeMaxHp(city, gp)).toBeGreaterThan(siegeMaxHp(city, null));
    const sieged = { ...s, greatProjects: gp, regions: { ...s.regions, [T]: { ...city, siege: { hp: 300, by: 'fr', encircled: false, starving: 0, startedTurn: 1 } } } };
    const ratio = wallsHpRatio(sieged, sieged.regions[T]);
    expect(ratio).toBeCloseTo(300 / siegeMaxHp(city, gp), 6);
    expect(tileContextOf(sieged, city.tile, { city: sieged.regions[T] }).hpRatio).toBeCloseTo(ratio, 6);
    // Battered walls keep half their effect at 0 HP, all of it whole.
    expect(batteredReduction(0.8, 1)).toBeCloseTo(0.8, 6);
    expect(batteredReduction(0.8, 0)).toBeCloseTo(0.9, 6);
  });

  it('11 plague: a plague city\'s troops start weakened and the survivors carry it home', () => {
    const s = armies();
    const sick = { ...s, regions: { ...s.regions, [T]: { ...s.regions[T], plague: { i: 0.2, r: 0, since: 1 } } } };
    const ins = battleInputs(sick, { attackerUnits: [s.units.a1], defenderUnits: [s.units.d1], cityId: T });
    expect(ins.defenderUnits[0].morale).toBe(100 - PLAGUE_MORALE_LOSS);
    expect(ins.attackerUnits[0].morale).toBe(100);
    const after = applyBattleOutcome(sick, invasion(sick, 'defender', { a1: 700 }, { d1: 800 }));
    expect(after.units.a1.plagueContact).toEqual({ cityId: T, until: s.turnNumber + 2 });
  });

  it('12 supply: a hungry army starts with less morale and a smaller stockpile', () => {
    const s = armies({ a1: unit('a1', FR, 'fr', 'infantry', 1000, { supply: 20 }), a2: unit('a2', FR, 'fr', 'cavalry', 1000, { supply: 20 }), a3: unit('a3', FR, 'fr', 'ranged', 1000, { supply: 20 }) });
    const ins = battleInputs(s, { attackerUnits: [s.units.a1], defenderUnits: [s.units.d1], cityId: T, fromRegionId: FR });
    expect(ins.attackerUnits[0].morale).toBe(100 - Math.round(SUPPLY_MORALE_LOSS * 0.8));
    expect(ins.economyInputs.supply[0]).toBeCloseTo(0.2, 6);
    const began = gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.economy.stockMult[0]).toBeLessThan(1);
  });

  it('13 lastBattleTurn on the survivors and the battle mark on the tile, every kind', () => {
    const s = armies();
    const after = applyBattleOutcome(s, invasion(s, 'defender', { a1: 600 }, { d1: 800 }));
    expect(after.units.a1.lastBattleTurn).toBe(s.turnNumber);
    expect(after.units.d1.lastBattleTurn).toBe(s.turnNumber);
    expect(after.world.tileState[s.regions[T].tile].battle).toMatchObject({ turn: s.turnNumber, until: s.turnNumber + BATTLE_MARK_TURNS });
    const f = fieldState();
    const v = validateFieldAttack(f, FIELD.IN, FIELD.theirs);
    const field = applyFieldResult(f, v, { outcome: 'defender', attackerUnits: v.attackerUnits.map((u) => ({ ...u, strength: 700 })), defenderUnits: v.defenderUnits, report: {} }, { rngSeed: 1 });
    expect(field.world.tileState[FIELD.theirs].battle.until).toBe(f.turnNumber + BATTLE_MARK_TURNS);
    expect(field.units.e.lastBattleTurn).toBe(f.turnNumber);
  });

  it('14 the battle report and the log carry the battle\'s name', () => {
    const s = armies();
    const after = applyBattleOutcome(s, invasion(s, 'defender', { a1: 600 }, { d1: 800 }));
    const name = `Siege of ${s.regions[T].name}`;
    expect(after.battleReports[0].name).toBe(name);
    expect(after.logs.some((l) => l.message.startsWith(`${name}:`))).toBe(true);
    expect(battleNameOf(s, { kind: 'field', tile: FIELD.theirs })).toMatch(/^Battle of /);
    expect(battleNameOf(s, { kind: 'naval', regionId: T })).toBe(`Sea battle off ${s.regions[T].name}`);
    expect(battleNameOf(s, { kind: 'landing', regionId: T })).toBe(`Landing at ${s.regions[T].name}`);
    // An AI battle the player is not in leaves no report.
    const ai = applyBattleOutcome(s, invasion(s, 'defender', { a1: 600 }, { d1: 800 }, { id: 'ai1', viewerId: 'zz' }));
    expect(ai.battleReports || []).toHaveLength((s.battleReports || []).length);
  });

  it('15 each nation\'s battle record feeds the research boosts', () => {
    const s = armies();
    let t = s;
    for (let i = 0; i < 3; i++) t = applyBattleOutcome(t, invasion(t, 'attacker', { a1: 900 }, { d1: 500 }, { id: `w${i}`, isDefended: true }));
    expect(t.nations.fr.battleStats.won).toBe(3);
    expect(t.nations[AGG].battleStats.lost).toBe(3);
    expect(nationFacts(t, 'fr').battlesWon).toBe(3);
  });

  it('16 allies and vassals stand by as reinforcements', () => {
    const s = armies();
    const ally = Object.keys(s.nations).find((id) => id !== 'fr' && id !== AGG && !s.nations[id].isEliminated);
    const centre = s.regions[T].tile;
    const near = tiles.neighbors[centre].find((t) => tiles.land[t] === 1 && t !== GATE);
    const withAlly = {
      ...s,
      nations: { ...s.nations, [ally]: { ...s.nations[ally], vassalOf: 'fr' } },
      wars: [...s.wars, { id: 'war_v', aggressor: ally, enemy: AGG, active: true, battleScore: 0 }],
      units: { ...s.units, v1: { ...unit('v1', s.nations[ally].capitalRegionId, ally), tile: near } }
    };
    expect(alliesOf(withAlly, 'fr', AGG)).toEqual([ally]);
    const sources = reinforcementSources(withAlly, T, 'fr', AGG, [FR]);
    expect(sources.some((src) => src.nationId === ally && src.unitIds.includes('v1'))).toBe(true);
    const began = gameReducer(withAlly, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    expect(began.pendingBattle.attackerReinforcements.some((src) => src.unitIds.includes('v1'))).toBe(true);
  });

  it('17 rebels are fought through the same service', () => {
    const s = armies();
    const own = { ...s, units: { ...s.units, r1: unit('r1', FR, REBEL_OWNER_ID, 'infantry', 300), g1: { ...unit('g1', FR, 'fr'), tile: s.regions[FR].tile } } };
    const after = gameReducer(own, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: FR } });
    expect(after.battleReports[0].kind).toBe('rebellion');
    expect(after.battleReports[0].name).toBeTruthy();
    expect(after.wars).toEqual(own.wars);
    expect(after.units.g1.lastBattleTurn).toBe(s.turnNumber);
  });

  it('18 bankruptcy desertion comes before the setup: the battle reads the deserted strength', () => {
    const s = armies();
    const units = { ...s.units };
    applyArmyDesertion(units, 'fr');
    const poor = { ...s, units };
    const began = gameReducer(poor, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.sides[0].units.find((u) => u.id === 'a1').strength).toBe(units.a1.strength);
    // A reported result can never give the deserters back.
    const safe = sanitizeTacticalResult(began, began.pendingBattle, { outcome: 'defender', attackerUnits: [{ id: 'a1', strength: 1000 }], defenderUnits: [], report: {} });
    expect(safe.attackerUnits.find((u) => u.id === 'a1').strength).toBe(units.a1.strength);
  });

  it('19 the city\'s militia replace the synthetic garrison; withdrawing still costs morale and men', () => {
    const s = armies();
    const mil = cityMilitia(s, T);
    expect(mil.every((u) => u.militia && u.ownerId === AGG && !s.units[u.id])).toBe(true);
    const began = gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    expect(began.pendingBattle.militia.map((u) => u.id)).toEqual(mil.map((u) => u.id));
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.sides[1].units.filter((u) => u.militia).length).toBe(mil.length);
    const auto = resolveAutoBattle(s, getResolveBattleArgs(validateInvasion(s, FR, T), getInvasionBattleContext(s, { targetRegionId: T, targetRegion: s.regions[T], defenderUnits: [s.units.d1, s.units.d2] })), { kind: 'invasion', cityId: T, fromRegionId: FR }, createRng(5));
    expect(auto.defenderUnits.filter((u) => u.militia).length).toBe(mil.length);
    // Militia losses are the city's people; they never enter state.units.
    const after = applyBattleOutcome(s, makeBattleOutcome({ id: 'm1', kind: 'invasion', warId: 'war_t', attackerNationId: 'fr', defenderNationId: AGG, fromRegionId: FR, regionId: T, isDefended: true, militia: mil }, auto));
    expect(Object.keys(after.units).some((id) => id.startsWith('mil_'))).toBe(false);
    // Withdrawal (defense.js) is kept: the player's garrison gives up its city for morale and men.
    const p = createInitialState({ playerNationId: 'fr', rngSeed: 4 });
    const second = addCity(p, 'fr', { near: p.nations.fr.capitalRegionId });
    const def = { ...second.state, units: { g: { ...unit('g', second.cityId, 'fr'), tile: second.state.regions[second.cityId].tile } }, wars: [{ id: 'wd', aggressor: AGG, enemy: 'fr', active: true, battleScore: 0 }] };
    const record = createDefenseRecord(def, { war: def.wars[0], regionId: second.cityId, aggressorShare: 0.5, seed: 9, index: 1 });
    const queued = { ...def, pendingDefenses: [record] };
    const w = applyDefenseWithdrawal(queued, record.id);
    if (w.ok && w.state.units.g) expect(w.state.units.g.morale).toBe(100 - WITHDRAW_MORALE_LOSS);
  });

  it('20 the city\'s damage by manifest id under the 50% rule, never plain razing', () => {
    const s = armies();
    const manifest = cityManifestOf(s, T);
    const houses = manifest.structures.filter((x) => x.kind === 'house').map((x) => x.id);
    const o = invasion(s, 'defender', { a1: 500 }, { d1: 800 }, { tactical: { cityDamage: { destroyed: houses, damaged: [] } } });
    const after = applyBattleOutcome(s, o);
    const ruined = Object.keys(after.regions[T].cityDamage?.ruined || {});
    expect(ruined.length).toBeGreaterThan(0);
    expect(ruined.length).toBeLessThanOrEqual(Math.floor(houses.length / 2));
    expect(after.regions[T].size).toBeGreaterThanOrEqual(Math.ceil((s.regions[T].size || 1) / 2));
  });

  it('21 field and sea battles devastate the land and weary the loser', () => {
    const f = fieldState();
    const v = validateFieldAttack(f, FIELD.IN, FIELD.theirs);
    const after = applyFieldResult(f, v, { outcome: 'attacker', attackerUnits: v.attackerUnits.map((u) => ({ ...u, strength: 800 })), defenderUnits: v.defenderUnits.map((u) => ({ ...u, strength: 300, routed: true })), report: {} }, { rngSeed: 1 });
    expect(after.nations.pk.warExhaustion || 0).toBeGreaterThan(f.nations.pk.warExhaustion || 0);
    const anchor = after.battleReports[0].targetRegionId;
    expect(after.regions[anchor].devastation || 0).toBeGreaterThan(f.regions[anchor]?.devastation || 0);
  });

  it('22 the odds come from the same honest auto-resolve, the militia counted; the scouts set the battle fog', () => {
    const s = armies();
    const odds = estimateInvasionOdds(s, FR, T, 40);
    const mil = cityMilitia(s, T).reduce((x, u) => x + u.strength, 0);
    expect(odds.defenderStrength).toBe(1800 + mil);
    const began = gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR, targetRegionId: T } });
    expect(buildInvasionSetup(began, began.pendingBattle).modifiers.intel.attackerSeesDefender).toBe(canSeeRegionDetails(s, T));
  });
});

describe('decisive field battles (master plan 6.9)', () => {
  it('the loser\'s units on the field are destroyed, those that left by an exit step back a tile; the winner gains XP', () => {
    const f = fieldState([{ id: 'e2', regionId: FIELD.PK, ownerId: 'pk', tile: FIELD.theirs }]);
    const v = validateFieldAttack(f, FIELD.IN, FIELD.theirs);
    const after = applyFieldResult(f, v, {
      outcome: 'attacker',
      attackerUnits: v.attackerUnits.map((u) => ({ ...u, strength: 800, disposition: 'field' })),
      defenderUnits: [{ ...f.units.e, strength: 400, disposition: 'field' }, { ...f.units.e2, strength: 300, disposition: 'fled' }],
      report: { deployedAttackerIds: ['a', 'b'], deployedDefenderIds: ['e', 'e2'] }
    }, { rngSeed: 1 });
    expect(after.units.e).toBeUndefined();
    expect(after.units.e2.tile).not.toBe(FIELD.theirs);
    expect(tiles.neighbors[FIELD.theirs]).toContain(after.units.e2.tile);
    expect(after.units.a.xp).toBe(XP_WIN);
    expect(after.units.a.tile).toBe(FIELD.ours);
  });

  it('Auto uses the same rule: routed losers escape or are run down, an unbroken loser withdraws', () => {
    const battle = { outcome: 'attacker', attackerUnits: [{ id: 'a', classId: 'cavalry', strength: 900 }], defenderUnits: [{ id: 'x', strength: 0 }, { id: 'y', strength: 200, routed: true }, { id: 'z', strength: 500, routed: false }] };
    const marked = autoDispositions(battle, createRng(3));
    expect(marked.defenderUnits.map((u) => u.disposition)).toEqual(['dead', marked.defenderUnits[1].disposition, 'fled']);
    expect(['fled', 'field']).toContain(marked.defenderUnits[1].disposition);
    expect(marked.attackerUnits[0].disposition).toBe('field');
    expect(dispositionOf({ strength: 100 }, true)).toBe('fled'); // a result without dispositions: the loser withdrew
    expect(dispositionOf({ strength: 100, disposition: 'field' }, true)).toBe('field');
  });
});
