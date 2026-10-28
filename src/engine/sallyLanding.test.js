// Phase R3 step 6, decision 36: sallies and landings are full base-building battles like city
// assaults (workers, a camp, houses, production, towers), on the master plan's clocks (6.1: a sally
// 15 minutes, a landing as a city assault, 30).
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { peoplesWorld, rivalOf, cap, cloneWorld, majorIds, aiVoyage } from './testWorld';
import { ActionTypes } from '../data/types';
import { getTiles } from '../data/geo/tiles';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { createRng } from '../utils/rng';
import { aiSally, processAINavalOperations } from './aiOperations';
import { syncWorldRegistry } from './world/registry';
import { buildInvasionSetup, buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { ECONOMY_FIELD_TICKS, ECONOMY_SIEGE_TICKS } from '../battle/sim/constants';
import { buildTownManifest } from '../data/townLayout';

const tiles = getTiles();
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

describe('a sally is a full base-building battle', () => {
  it('the AI garrison sallies against the player\'s besiegers: camp and engines, workers, the field clock', () => {
    const s0 = syncWorldRegistry(peoplesWorld({ seed: 3 }));
    const ME = s0.playerNationId; const FOE = rivalOf(s0);
    const IN = cap(ME); const PK = cap(FOE);
    const city = s0.regions[PK];
    const ring = tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1)[0];
    const u = (id, regionId, extra) => ({ id, ownerId: ME, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
    const s = {
      ...s0, units: { a0: u('a0', IN, { tile: ring, strength: 300 }), g1: u('g1', PK, { ownerId: FOE, tile: city.tile }), g2: u('g2', PK, { ownerId: FOE, tile: city.tile }) },
      wars: [...s0.wars, { id: 'w-f', aggressor: ME, enemy: FOE, active: true, startYear: s0.year, battleScore: 0 }],
      nations: { ...s0.nations, [ME]: { ...s0.nations[ME], isAtWar: true }, [FOE]: { ...s0.nations[FOE], isAtWar: true } },
      regions: { ...s0.regions, [PK]: { ...city, siege: { hp: 100, maxHp: 200, by: ME, startedTurn: 1, encircled: false, starving: 0 } } },
      pendingDefenses: []
    };
    const q = aiSally(s, FOE, createRng(5));
    const began = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: q.pendingDefenses[0].id } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.battleType).toBe('sally');
    expect(setup.economy).toBeTruthy();
    expect(setup.economy.nodes.length).toBeGreaterThan(0);
    expect(setup.economy.camp).toBeTruthy();
    expect(setup.limitTicks).toBe(ECONOMY_FIELD_TICKS);
    expect(setup.structures.filter((x) => x.category === 'engine')).toHaveLength(3);
  });

  it('both sides gather and train in a sally', () => {
    const { result } = runHeadless(buildSetupFromArmies({ regionId: 'sally-1', terrain: 'plains', seed: 1, attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], sally: true, city: false, economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] } }));
    const eco = result.report.tactical.economy;
    expect(eco).toBeTruthy();
    expect(Object.values(eco[0].trained || {}).reduce((x, n) => x + n, 0) + Object.values(eco[1].trained || {}).reduce((x, n) => x + n, 0)).toBeGreaterThan(0);
  }, 120000);
});

describe('a landing is a full base-building battle, on the city assault\'s clock', () => {
  it('the AI lands on the player\'s coast: the real town, the camp on the beach, workers, 30 minutes', () => {
    // A rival with a port the player's coast can be reached from by sea.
    const base = peoplesWorld({ player: 'keftiu', seed: 7 }); // an island people with a coast
    const ME = base.playerNationId;
    const reach = (AI) => { const ports = Object.keys(base.regions).filter((r) => base.regions[r].owner === AI && isCoastal(r)); for (const port of ports) { const t = Object.keys(base.regions).find((r) => base.regions[r].owner === ME && isCoastal(r) && isReachableBySea(port, r, 'modern')); if (t) return { port, target: t }; } return null; };
    const AI = majorIds(base).slice(1).find((id) => reach(id));
    expect(AI, 'a rival that can land on the player coast').toBeTruthy();
    const { port, target } = reach(AI);
    const s = cloneWorld(base);
    s.techAgeId = 'modern';
    s.wars = [{ id: 'island', aggressor: AI, enemy: ME, active: true, startYear: s.year, battleScore: 0 }];
    s.nations[AI] = { ...s.nations[AI], isAtWar: true, economy: { gold: 1000, hr: 1000, mil: 100, adm: 100 }, tech: { ageId: 'modern', researched: [] } };
    s.nations[ME] = { ...s.nations[ME], isAtWar: true };
    const land = (id, owner, regionId) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [], xp: 0 });
    s.units = { fleet: { id: 'fleet', ownerId: AI, regionId: port, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, promotions: [] }, army: land('army', AI, port), army2: land('army2', AI, port), guard: land('guard', ME, target) };
    s.pendingDefenses = [];
    const q = aiVoyage(processAINavalOperations, s);
    const began = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: q.pendingDefenses.find((d) => d.kind === 'landing').id } });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.economy).toBeTruthy();
    expect(setup.economy.camp).toBeTruthy();
    if (setup.battleType === 'landing') expect(setup.limitTicks).toBe(ECONOMY_SIEGE_TICKS);
    expect(setup.limitTicks).toBe(ECONOMY_SIEGE_TICKS); // landing or (with a foothold) an assault: the city assault's clock
  });

  it('a landing on a real town trains on both sides', () => {
    const cityManifest = buildTownManifest({ cityId: 'land-1', ageId: 'bronze', tierId: 'medium', style: 'europe', seed: 1, defenseTier: -1 });
    const setup = buildSetupFromArmies({ regionId: 'land-1', terrain: 'plains', seed: 1, attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged']), defenderUnits: mk('d', ['infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], landing: true, city: true, cityManifest, economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] } });
    expect(setup.battleType).toBe('landing');
    expect(setup.limitTicks).toBe(ECONOMY_SIEGE_TICKS);
    expect(setup.city).toBeTruthy();
    const { result } = runHeadless(setup);
    expect(result.report.tactical.economy).toBeTruthy();
  }, 180000);
});
