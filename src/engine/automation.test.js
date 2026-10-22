// The automation meter (eight ages U70, automation.js).
import { describe, it, expect } from 'vitest';
import {
  automationTarget, nextAutomation, automationYields, isRioting, uprisingStarts, startUprising,
  AUTOMATION_PER_ROBOT, AUTOMATION_INDUSTRY, AUTOMATION_STEP, AUTOMATED_INDUSTRY_TECH, AUTOMATION_MAX, AUTOMATION_UPRISING_AT, AUTOMATION_RIOT_UNREST
} from './automation';
import { rulerCityCtx } from './lawRules';
import { peoplesWorld, cap } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { auditGameState } from './stateAudit';

describe('the automation meter', () => {
  it('rises with robots and Automated Industry, capped, one step a turn', () => {
    expect(automationTarget(0, [])).toBe(0);
    expect(automationTarget(3, [])).toBe(3 * AUTOMATION_PER_ROBOT);
    expect(automationTarget(3, [AUTOMATED_INDUSTRY_TECH])).toBe(3 * AUTOMATION_PER_ROBOT + AUTOMATION_INDUSTRY);
    expect(automationTarget(1000, [])).toBe(AUTOMATION_MAX);
    expect(nextAutomation(0, 30)).toBe(AUTOMATION_STEP);
    expect(nextAutomation(28, 30)).toBe(30);
    expect(nextAutomation(30, 0)).toBe(30 - AUTOMATION_STEP);
  });

  it('gives production and science to every city', () => {
    expect(automationYields({ automation: 100 })).toEqual({ productionMult: 0.25, scienceMult: 0.2 });
    expect(rulerCityCtx({ automation: 40 })).toMatchObject({ productionMult: 0.1, scienceMult: 0.08 });
    expect(rulerCityCtx({})).toEqual({});
  });

  it('riots and uprisings need low stability; the uprising roll is deterministic and rare', () => {
    expect(isRioting({ automation: 50, stability: 0 })).toBe(false);
    expect(isRioting({ automation: 50, stability: -1 })).toBe(true);
    const calm = { automation: 100, stability: 0 };
    const low = { automation: AUTOMATION_UPRISING_AT, stability: -3 };
    let calmHits = 0; let lowHits = 0;
    for (let t = 1; t <= 1000; t++) { if (uprisingStarts(calm, 'x', t, false)) calmHits++; if (uprisingStarts(low, 'x', t, false)) lowHits++; }
    expect(calmHits).toBe(0);
    expect(lowHits).toBeGreaterThan(10);
    expect(lowHits).toBeLessThan(100);
    expect(uprisingStarts(low, 'x', 7, false)).toBe(uprisingStarts(low, 'x', 7, false));
    expect([...Array(1000).keys()].some((t) => uprisingStarts(low, 'x', t, true))).toBe(false); // cool-down
  });
});

describe('the Machine Uprising', () => {
  const base = peoplesWorld({ seed: 5 });
  const me = base.playerNationId;
  const city = base.regions[cap(me)];
  const robot = (id) => ({ id, ownerId: me, regionId: city.id, homeRegionId: city.id, tile: city.tile, domain: 'land', classId: 'infantry', robot: true, ageId: 'future', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
  it('turns a third of the robots at home into insurgents', () => {
    const regions = { ...base.regions }; const units = { r1: robot('r1'), r2: robot('r2'), r3: robot('r3') };
    const war = startUprising(regions, units, me, 9);
    expect(war).toMatchObject({ active: true, machines: true });
    expect(Object.values(units).filter((u) => u.ownerId === REBEL_OWNER_ID && u.isInsurgent)).toHaveLength(1);
    expect(regions[city.id].occupiedBy).toBe('insurgents');
    expect(startUprising({ ...base.regions }, {}, me, 9)).toBeNull();
  });

  it('a turn moves the meter and riots raise unrest, through resolveTurn', () => {
    const quiet = { ...base, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const s = { ...quiet, units: { ...quiet.units, r1: robot('r1') }, nations: { ...quiet.nations, [me]: { ...quiet.nations[me], automation: 50, stability: -1 } } };
    const next = resolveTurn(s);
    expect(next.nations[me].automation).toBe(50 - AUTOMATION_STEP); // one robot, no Automated Industry: target 4
    expect(next.nations[me].automationRiots).toBe(true);
    expect(next.regions[city.id].unrest).toBeGreaterThanOrEqual(Math.min(100, (s.regions[city.id].unrest || 0) + AUTOMATION_RIOT_UNREST) - 10);
    expect(auditGameState(next).filter((i) => i.path?.includes('automation'))).toEqual([]);
  });
});
