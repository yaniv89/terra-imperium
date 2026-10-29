// src/engine/aiArmies.test.js
// Lane ai-armies: arming before a declaration, the muster point and garrisons at peace.
import { describe, it, expect } from 'vitest';
import { addCity, neighbourWorld, rivalOf } from './testWorld';
import { getNeighborIds } from '../data/regions';
import { updateWarPlan, dropTarget, armedFor, goSize, ARM_SLACK, WAR_PREP_REF_TURNS } from './warPlans';
import { spreadGarrisons } from './aiOperations';
import { PEACE_GARRISON_MAX } from './warPlans';
import { chooseAIRecruitRegion } from '../utils/aiLogic';
import { speedTurns } from '../data/ages';
import { waitAgeOf } from './ageRefs';

const W0 = neighbourWorld({ seed: 7, fog: false, capitals: true });
const P = W0.playerNationId;
const D = rivalOf(W0, 0);
const unit = (id, regionId, tile, extra = {}) => ({ id, ownerId: D, regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [], xp: 0, ...extra });
const world = () => {
  const berlin = W0.nations[D].capitalRegionId;
  const added = addCity(W0, D, { near: berlin, loose: true });
  const s = added.state;
  s.nations[D] = { ...s.nations[D], economy: { gold: 400, hr: 1000, mil: 100, adm: 100 }, lastNetIncome: 10 };
  return { s: { ...s, units: {}, wars: [] }, berlin, interior: added.cityId, paris: getNeighborIds(berlin).find((id) => s.regions[id]?.owner === P) };
};
const withNation = (s, patch) => ({ ...s, nations: { ...s.nations, [D]: { ...s.nations[D], ...patch } } });

describe('AI armies (lane ai-armies)', () => {
  it('a target its strike found no road to is dropped for another city', () => {
    const { s } = world();
    const wars = [{ id: 'w', aggressor: D, enemy: P, active: true }];
    const plan = updateWarPlan({ ...s, wars }, D, wars, 'bronze');
    const next = updateWarPlan(withNation({ ...s, wars }, { warPlan: dropTarget(plan) }), D, wars, 'bronze');
    expect(next?.cityId).not.toBe(plan.cityId);
    if (next) expect(next.unreachable).toEqual([plan.cityId]);
  });

  it('arms for a decided war: the plan targets it, and it is armed once the muster can strike or the wait is over', () => {
    const { s, berlin } = world();
    const prep = withNation(s, { warPrep: { target: P, since: s.turnNumber } });
    const plan = updateWarPlan(prep, D, [], 'bronze');
    expect(plan.enemy).toBe(P);
    expect(plan.staging).toBe(berlin);
    const tile = s.regions[berlin].tile;
    const muster = (n) => ({ ...withNation(prep, { warPlan: plan }), units: Object.fromEntries(Array.from({ length: n }, (_, i) => [`u${i}`, unit(`u${i}`, berlin, tile)])) });
    expect(armedFor(muster(goSize(plan) - ARM_SLACK), D, P)).toBe(false); // one stays home as the garrison
    expect(armedFor(muster(goSize(plan) + 1 - ARM_SLACK), D, P)).toBe(true); // within ARM_SLACK: no arming
    // With no plan yet, the plan it would make is reckoned (same staging city).
    expect(armedFor({ ...muster(goSize(plan) + 1 - ARM_SLACK), nations: s.nations }, D, P)).toBe(true);
    expect(armedFor({ ...muster(goSize(plan) - ARM_SLACK), nations: s.nations }, D, P)).toBe(false);
    const late = { ...muster(1), turnNumber: s.turnNumber + speedTurns(WAR_PREP_REF_TURNS, s.gameSpeed, waitAgeOf(s, D, P)) };
    expect(armedFor(late, D, P)).toBe(true);
    expect(updateWarPlan(s, D, [], 'bronze')).toBe(null); // no prep, no claim: no plan
    // A prep left over (twice the wait: the nation never got to declare) arms no longer.
    expect(updateWarPlan({ ...prep, turnNumber: s.turnNumber + 2 * speedTurns(WAR_PREP_REF_TURNS, s.gameSpeed, waitAgeOf(s, D, P)) }, D, [], 'bronze')).toBe(null);
  });

  it('recruits join the muster point; at peace never a city already holding PEACE_GARRISON_MAX', () => {
    const { s, berlin, interior } = world();
    const units = Object.fromEntries(Array.from({ length: PEACE_GARRISON_MAX }, (_, i) => [`u${i}`, unit(`u${i}`, berlin, s.regions[berlin].tile)]));
    const peace = { ...s, units };
    expect(chooseAIRecruitRegion(peace, peace.regions, D)).not.toBe(berlin);
    const arming = withNation(peace, { warPlan: { staging: berlin, cityId: 'x', enemy: P } });
    expect(chooseAIRecruitRegion(arming, arming.regions, D)).toBe(berlin);
    expect(interior).toBeTruthy();
  });

  it('at peace a city keeps PEACE_GARRISON_MAX regiments and the rest march to the nearest city under it', () => {
    const { s, berlin, interior } = world();
    const tile = s.regions[berlin].tile;
    const units = Object.fromEntries(Array.from({ length: PEACE_GARRISON_MAX + 3 }, (_, i) => [`u${i}`, unit(`u${i}`, berlin, tile, { strength: 900 + i })]));
    const next = spreadGarrisons({ ...s, units }, D, new Set());
    const left = Object.values(next.units).filter((u) => u.tile === tile && !u.route?.length);
    expect(left.length).toBe(PEACE_GARRISON_MAX);
    expect(left.map((u) => u.id).sort()).toEqual(Array.from({ length: PEACE_GARRISON_MAX }, (_, i) => `u${i}`).sort()); // the weakest stay
    const gone = Object.values(next.units).filter((u) => u.tile !== tile || u.route?.length);
    gone.forEach((u) => expect(u.route?.length ? u.route[u.route.length - 1] : u.tile).toBe(s.regions[interior].tile));
    // A city at or under the cap sends nobody.
    const calm = { ...s, units: Object.fromEntries(Object.entries(units).slice(0, PEACE_GARRISON_MAX)) };
    expect(spreadGarrisons(calm, D, new Set())).toBe(calm);
  });
});
