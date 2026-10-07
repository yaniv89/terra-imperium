// March to attack (marchAttack.js): Attack on a city the army does not border is a march order with
// an attack intent; arrival offers the assault; an army that borders the city attacks at once.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNeighborIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { isIndependentNation } from '../data/independents';
import { atGates } from './testWorld';
import { attackReach, orderMarchAttack, planMarchAttack, readyAttacks } from './marchAttack';
import { unitTile } from './armies';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }, resources: { ...s.resources, gold: 5000 } });
// Akkad in a peoples world: Kish with one army; Mari and Hagmatana, independents 6 to 7 rings away.
const BASE = quiet(createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } }));
const KISH = BASE.nations.akkad.capitalRegionId;
const MARI = getNeighborIds(KISH).find((id) => BASE.regions[id].name === 'Mari');
const army = (s) => Object.values(s.units).filter((u) => u.ownerId === 'akkad' && u.domain === 'land');
const play = (st, until, max = 12) => {
  let x = st;
  for (let t = 0; t < max && !until(x); t++) {
    if (x.pendingPeaceOffer) x = gameReducer(x, { type: ActionTypes.REJECT_PENDING_PEACE });
    x = resolveTurn(x);
    if (x.activeProceduralEvent) x = { ...x, activeProceduralEvent: null };
  }
  return x;
};

describe('march to attack a city the army does not border', () => {
  it('the fixture: Mari is an independent city far from Kish (the invade card would refuse it)', () => {
    expect(MARI).toBeTruthy();
    expect(isIndependentNation(BASE.nations[BASE.regions[MARI].owner])).toBe(true);
    expect(attackReach(BASE, KISH, MARI)).toBe('far');
  });

  it('Attack becomes a march order with the route to the city and the attack intent', () => {
    const plan = planMarchAttack(BASE, KISH, MARI);
    expect(plan.ok).toBe(true);
    expect(plan.turns).toBeGreaterThan(1);
    expect(plan.path[plan.path.length - 1]).toBe(BASE.regions[MARI].tile);
    expect(plan.canAttack).toBe(true);
    const s = gameReducer(BASE, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: KISH, toRegionId: MARI, attack: true } });
    const units = army(s);
    expect(units.length).toBeGreaterThan(0);
    units.forEach((u) => {
      expect(u.routeAttack).toBe(MARI);
      expect(u.route[u.route.length - 1]).toBe(BASE.regions[MARI].tile);
      expect(u.route).toEqual(plan.steps);
    });
    expect(s.logs[s.logs.length - 1].message).toMatch(/on Mari to attack it: about \d+ turns/);
  });

  it('on arrival the army besieges the city and the assault is offered, then fought through the usual card', () => {
    const ordered = gameReducer(BASE, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: KISH, toRegionId: MARI, attack: true } });
    expect(readyAttacks(ordered)).toEqual([]);
    const arrived = play(ordered, (x) => readyAttacks(x).length > 0);
    const ready = readyAttacks(arrived);
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ kind: 'city', fromRegionId: KISH, targetRegionId: MARI });
    // Beside the city's centre, on its ring: a siege.
    const tiles = getTiles();
    army(arrived).forEach((u) => expect(tiles.neighbors[arrived.regions[MARI].tile]).toContain(unitTile(arrived, u)));
    const besieged = play(arrived, (x) => !!x.regions[MARI].siege, 1);
    expect(besieged.regions[MARI].siege).toBeTruthy();
    // The assault: the normal battle choice (Command here), the same pending battle as any assault.
    const s = gameReducer(arrived, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: ready[0].fromRegionId, targetRegionId: MARI } });
    expect(s.pendingBattle).toMatchObject({ kind: 'invasion', targetRegionId: MARI, attackerUnitIds: ready[0].unitIds });
    expect(readyAttacks(s)).toEqual([]); // nothing more is offered while a battle is open
  });

  it('calling the assault off drops the intent: the army stays where it stands', () => {
    const arrived = play(gameReducer(BASE, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: KISH, toRegionId: MARI, attack: true } }), (x) => readyAttacks(x).length > 0);
    const ids = readyAttacks(arrived)[0].unitIds;
    const off = gameReducer(arrived, { type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: ids } });
    expect(readyAttacks(off)).toEqual([]);
    ids.forEach((id) => { expect(off.units[id].routeAttack ?? null).toBe(null); expect(off.units[id].tile).toBe(arrived.units[id].tile); });
  });

  it('an army that already borders the city keeps the immediate attack card', () => {
    const s = atGates(BASE, KISH, MARI);
    expect(attackReach(s, KISH, MARI)).toBe('adjacent');
    const refused = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: KISH, toRegionId: MARI, attack: true } });
    expect(army(refused).every((u) => !u.route?.length && !u.routeAttack)).toBe(true);
    expect(refused.logs[refused.logs.length - 1].message).toMatch(/already borders this city/);
    expect(orderMarchAttack(s, KISH, MARI).reason).toBe('adjacent');
  });

  it('war rules hold: a major people at peace cannot be marched on to attack', () => {
    const major = Object.values(BASE.regions).find((c) => c.owner !== 'akkad' && !isIndependentNation(BASE.nations[c.owner]) && !BASE.nations[c.owner]?.isEliminated);
    expect(orderMarchAttack(BASE, KISH, major.id).reason).toBe('no_war');
    const s = gameReducer(BASE, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: KISH, toRegionId: major.id, attack: true } });
    expect(army(s).every((u) => !u.route?.length && !u.routeAttack)).toBe(true);
    expect(s.logs[s.logs.length - 1].message).toMatch(/Declare war/);
    // Own cities are never a target.
    expect(attackReach(BASE, KISH, KISH)).toBe(null);
  });
});
