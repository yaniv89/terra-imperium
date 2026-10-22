// Robot armies (eight ages U67, robots.js): no manpower, +40% production, no morale, no occupation.
import { describe, it, expect } from 'vitest';
import { peoplesWorld, neighbourWorld, rivalOf, cap } from './testWorld';
import { withAgesResearched, withTechsResearched } from './research';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { productionCost, canQueue } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { isRobotUnlocked, unitAgeWeight, ROBOT_TECH, ROBOT_POWER } from '../data/unitClasses';
import { AGES } from '../data/ages';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { applyLoyalty, loyaltyTarget, LOYALTY_ON_CONQUEST, LOYALTY_OCCUPATION_PER_UNIT } from './loyalty';
import { conquerRegion } from './conquest';
import { ROBOT_PRODUCTION_MULT, ROBOT_OCCUPATION_LOYALTY } from './robots';
import { buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';

const base = peoplesWorld({ seed: 5 });
const me = base.playerNationId;
const future = (robots = true) => {
  const s = withAgesResearched(base, me, 'future');
  const t = robots ? withTechsResearched(s, me, [ROBOT_TECH]) : s;
  return { ...t, resources: { ...t.resources, gold: 5000, hr: 500, rareMetals: 50 } };
};

describe('robot variants', () => {
  it('open with Autonomous Warfare, in the Future only', () => {
    expect(isRobotUnlocked('future', 'infantry', [ROBOT_TECH])).toBe(true);
    expect(isRobotUnlocked('future', 'infantry', [])).toBe(false);
    expect(isRobotUnlocked('information', 'infantry', [ROBOT_TECH])).toBe(false);
    expect(unitAgeWeight({ robot: true, ageId: 'future' }, 'future')).toBeCloseTo(ROBOT_POWER.attack / AGES.future.power.attack, 9);
  });

  it('a robot recruit costs no manpower and takes no men from the province; without the tech it is refused', () => {
    const s = future();
    const regionId = cap(me);
    const next = gameReducer(s, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId, classId: 'infantry', robot: true } });
    const made = Object.values(next.units).find((u) => !s.units[u.id]);
    expect(made?.robot).toBe(true);
    expect(next.resources.hr).toBe(s.resources.hr);
    expect(next.resources.gold).toBeLessThan(s.resources.gold);
    expect(next.regions[regionId]).toBe(s.regions[regionId]);
    const human = gameReducer(s, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId, classId: 'infantry' } });
    expect(human.resources.hr).toBeLessThan(s.resources.hr);
    const noTech = future(false);
    expect(gameReducer(noTech, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId, classId: 'infantry', robot: true } })).toBe(noTech);
  });

  it('a robot costs 40% more production and needs the tech to be queued', () => {
    const human = productionCost({ kind: 'unit', classId: 'infantry' }, { ageId: 'future' });
    expect(productionCost({ kind: 'unit', classId: 'infantry', robot: true }, { ageId: 'future' })).toBe(Math.round(human * ROBOT_PRODUCTION_MULT));
    const city = base.regions[cap(me)];
    const world = { tileState: base.world.tileState || {} };
    expect(canQueue(city, getTiles(), world, { kind: 'unit', classId: 'infantry', robot: true }, { ageId: 'future', researched: [] }).ok).toBe(false);
    expect(canQueue(city, getTiles(), world, { kind: 'unit', classId: 'infantry', robot: true }, { ageId: 'future', researched: [ROBOT_TECH] }).ok).toBe(true);
  });
});

describe('robots never lose heart', () => {
  const mk = (p, robot) => ['infantry', 'infantry', 'ranged'].map((classId, i) => ({ id: `${p}${i}`, classId, ageId: 'future', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...(robot ? { robot: true } : {}) }));
  it('in auto-resolve: their morale stays full', () => {
    const r = resolveBattle({ attackerUnits: mk('a', true), defenderUnits: mk('d', false), rng: createRng(3), attackerAgeId: 'future', defenderAgeId: 'future', terrain: 'plains' });
    expect(r.attackerUnits.length).toBe(3);
    r.attackerUnits.forEach((u) => { expect(u.morale).toBe(100); expect(u.routed).toBe(false); });
    expect(r.defenderUnits.some((u) => u.morale < 100)).toBe(true);
  });
  it('in the tactical sim: no robot squad routs', () => {
    const setup = buildSetupFromArmies({ regionId: 'robot-test', terrain: 'plains', seed: 9, attackerUnits: mk('a', true), defenderUnits: mk('d', false), attackerAgeId: 'future', defenderAgeId: 'future' });
    const res = runHeadless(setup, { maxTicks: 3000 });
    const robots = res.world.squads.filter((q) => q.original?.robot);
    expect(robots.length).toBe(3);
    robots.forEach((q) => { expect(q.routed).toBe(false); expect(q.morale).toBe(100); });
  });
});

describe('robots cannot hold a city alone', () => {
  const S = neighbourWorld({ seed: 3, fog: false, capitals: true });
  const FR = S.playerNationId; const BE_CITY = S.nations[rivalOf(S, 0)].capitalRegionId;
  const unit = (id, tile, extra = {}) => ({ id, ownerId: FR, regionId: BE_CITY, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, embarkedOn: null, promotions: [], ...extra });
  it('a conquest held by robots only loses loyalty each turn; a human unit holds it', () => {
    const r = conquerRegion({ regions: S.regions, nations: S.nations, turnNumber: S.turnNumber }, BE_CITY, FR, null);
    const tile = r.regions[BE_CITY].tile;
    const run = (units) => {
      const regions = { ...r.regions }; const nations = { ...r.nations };
      for (let turn = S.turnNumber + 1; turn <= S.turnNumber + 3; turn++) applyLoyalty({ ...S, regions, nations }, regions, units, nations, turn);
      return regions[BE_CITY].loyalty;
    };
    expect(run({ a: unit('a', tile, { robot: true }), b: unit('b', tile, { robot: true }) })).toBe(LOYALTY_ON_CONQUEST - 3 * ROBOT_OCCUPATION_LOYALTY);
    const mixed = { a: unit('a', tile, { robot: true }), b: unit('b', tile) };
    expect(loyaltyTarget({ ...S, regions: r.regions, nations: r.nations, units: mixed }, r.regions[BE_CITY]).garrison).toBe(LOYALTY_OCCUPATION_PER_UNIT);
    expect(run(mixed)).not.toBe(LOYALTY_ON_CONQUEST - 3 * ROBOT_OCCUPATION_LOYALTY);
  });
});
