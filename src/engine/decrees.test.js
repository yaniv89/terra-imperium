// src/engine/decrees.test.js
import { describe, it, expect } from 'vitest';
import { decreesOf, decreeCap, decreeCostOf, grantDecree, spendDecree, canSpendDecree, trickleTurns, tickDecrees, decreeReason } from './decrees';
import { DECREE_ACTS, DECREE_DEEDS, DECREE_TRICKLE_REF_TURNS, DECREE_WAR_WON_SCORE, DECREE_TRICKLE_BELOW } from '../data/decrees';
import { ACTION_COSTS } from '../data/actionCosts';
import { GAME_SPEEDS, speedCostMult, AGE_ORDER } from '../data/ages';
import { HISTORICAL_EVENTS } from '../data/events';
import { applyPeace } from './peace';
import { awardEraLegacy, eraGoalProgress } from './eraGoals';
import { resolveTurn } from './resolveTurn';
import { getNationCapital } from '../data/regions';
import { addCities, neighbourWorld, rivalOf, peoplesWorld } from './testWorld';
import { RULER_START } from '../data/rulers';
import { PLAYSTYLES, goalsForAge } from '../data/eraGoals';

const ruled = (decrees = 0, extra = {}) => ({ id: 'x', legitimacy: 50, ruler: { ...RULER_START, decrees, ...extra } });
const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });

describe('decree bank', () => {
  it('caps at 3, plus 1 at Majesty 4 and at Majesty 8, and never goes past it', () => {
    expect(decreeCap(ruled())).toBe(3);
    expect(decreeCap(ruled(0, { maj: 4 }))).toBe(4);
    expect(decreeCap(ruled(0, { maj: 8 }))).toBe(5);
    let n = ruled();
    for (let i = 0; i < 10; i++) n = grantDecree(n, 'wonder', i, 'p');
    expect(decreesOf(n)).toBe(3);
    expect(grantDecree(n, 'warWon', 11)).toBe(n);
  });

  it('a grant names its deed; a nation without a ruler is unchanged', () => {
    const n = grantDecree(ruled(), 'warWon', 7, 'rome');
    expect(n.ruler.decreeLog[0]).toEqual({ turn: 7, deed: 'warWon', detail: 'rome', n: 1 });
    expect(decreeReason(n.ruler.decreeLog[0])).toBe(`+1 ${DECREE_DEEDS.warWon}: rome`);
    const none = { id: 'i', ruler: null };
    expect(grantDecree(none, 'warWon', 1)).toBe(none);
    expect(tickDecrees({ nations: {} }, 'i', none, 1)).toBe(none);
  });

  it('every act of state in the list spends its decrees, names itself, and is refused on a short bank', () => {
    const dynamic = ['changeLaw', 'increaseStability', 'annexVassal', 'reshapeRuler'];
    expect(Object.keys(DECREE_ACTS).length).toBe(14);
    Object.entries(DECREE_ACTS).forEach(([act, spec]) => {
      expect(ACTION_COSTS[act] || dynamic.includes(act)).toBeTruthy();
      expect(decreeCostOf(act)).toBe(spec.decrees);
      const full = ruled(3);
      const spent = spendDecree(full, act, 5);
      expect(decreesOf(spent)).toBe(3 - spec.decrees);
      expect(spent.ruler.decreeLog[0]).toEqual({ turn: 5, act, n: -spec.decrees });
      expect(decreeReason(spent.ruler.decreeLog[0])).toBe(`-${spec.decrees} ${spec.label}`);
      const short = ruled(spec.decrees - 1);
      expect(canSpendDecree(short, act)).toBe(false);
      expect(spendDecree(short, act, 5)).toBe(short);
    });
    expect(DECREE_ACTS.changeGovernmentType.decrees).toBe(2);
    const empty = ruled(0);
    expect(spendDecree(empty, 'changeLaw', 1)).toBe(empty);
    expect(spendDecree(ruled(3), 'notAnAct', 1).ruler.decrees).toBe(3);
  });
});

describe('the trickle floor', () => {
  const state = (speed, extra = {}) => ({ gameSpeed: speed, playerNationId: 'p', techAgeId: AGE_ORDER[0], nations: { x: ruled(0, extra) } });

  it('takes the same span of reference turns at Fast, Normal and Marathon (within one turn)', () => {
    Object.keys(GAME_SPEEDS).forEach((speed) => {
      AGE_ORDER.forEach((age) => {
        const s = { ...state(speed), nations: { x: { ...ruled(), tech: { ageId: age } } } };
        expect(Math.abs(trickleTurns(s, 'x') / speedCostMult(speed, age) - DECREE_TRICKLE_REF_TURNS)).toBeLessThanOrEqual(1);
      });
    });
  });

  it('fires once the bank has waited its turns, up to DECREE_TRICKLE_BELOW, and never past it', () => {
    const s = state('normal');
    const turns = trickleTurns(s, 'x');
    let n = s.nations.x;
    for (let t = 1; t < turns; t++) { n = tickDecrees(s, 'x', n, t); expect(decreesOf(n)).toBe(0); }
    n = tickDecrees(s, 'x', n, turns);
    expect(decreesOf(n)).toBe(1);
    expect(n.ruler.decreeLog[0].deed).toBe('trickle');
    for (let t = 0; t < 300; t++) n = tickDecrees(s, 'x', n, turns + t);
    expect(decreesOf(n)).toBe(DECREE_TRICKLE_BELOW);
    const held = ruled(DECREE_TRICKLE_BELOW);
    expect(tickDecrees(s, 'x', held, 1)).toBe(held);
  });

  it('low legitimacy slows it and Administration shortens it', () => {
    const base = trickleTurns(state('normal'), 'x');
    expect(trickleTurns({ ...state('normal'), nations: { x: { ...ruled(), legitimacy: 30 } } }, 'x')).toBeGreaterThan(base);
    expect(trickleTurns(state('normal', { adm: 8 }), 'x')).toBeLessThan(base);
  });
});

describe('deeds grant one decree each', () => {
  const W = neighbourWorld({ seed: 11 });
  const A = W.playerNationId;
  const B = rivalOf(W, 0);
  const war = (score) => ({ id: 'war_1', aggressor: A, enemy: B, active: true, startTurn: W.turnNumber, score, goal: { type: 'capture_region', regionId: getNationCapital(B) } });

  it('a war won by either side, and nothing for a close peace', () => {
    expect(decreesOf(applyPeace(W, war(DECREE_WAR_WON_SCORE), A, []).nations[A])).toBe(decreesOf(W.nations[A]) + 1);
    const lost = applyPeace(W, war(-DECREE_WAR_WON_SCORE - 10), A, []);
    expect(decreesOf(lost.nations[B])).toBe(decreesOf(W.nations[B]) + 1);
    expect(lost.nations[B].ruler.decreeLog[0]).toMatchObject({ deed: 'warWon', detail: A });
    const close = applyPeace(W, war(10), A, []);
    expect(decreesOf(close.nations[A])).toBe(decreesOf(W.nations[A]));
    expect(decreesOf(close.nations[B])).toBe(decreesOf(W.nations[B]));
  });

  it('each era goal met, once per age', () => {
    const S = quiet(peoplesWorld({ seed: 3, age: 'bronze' }));
    const me = S.playerNationId;
    const { state: s4 } = addCities(S, me, goalsForAge('bronze').find((g) => g.id === 'expand').target, { near: getNationCapital(me) });
    const techTree = { ...s4.techTree };
    Object.keys(techTree).filter((id) => !techTree[id].researched).slice(0, 4).forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const ready = { ...s4, techTree };
    const met = eraGoalProgress(ready, 'bronze').met;
    expect(met).toBeGreaterThanOrEqual(1);
    const r = awardEraLegacy(ready, ready.nations[me], 'bronze', 10);
    expect(decreesOf(r.nation)).toBe(Math.min(decreeCap(r.nation), decreesOf(ready.nations[me]) + met));
    expect(r.nation.ruler.decreeLog.filter((e) => e.deed === 'eraGoal').length).toBe(Math.min(met, decreeCap(r.nation)));
    expect(awardEraLegacy(ready, r.nation, 'bronze', 11).nation).toBe(r.nation);
  });

  it('the rulers phase runs the floor in resolveTurn', () => {
    const S = quiet(peoplesWorld({ seed: 3 }));
    const me = S.playerNationId;
    const nation = S.nations[me];
    const wait = trickleTurns(S, me) - 1;
    // no ambition offer and every era goal paid this age, so the only decree is the trickle (ambitions.js and eraGoals.js would pay too)
    const start = { ...S, nations: { ...S.nations, [me]: { ...nation, ambitions: { ageId: S.techAgeId, offers: [], done: [] }, eraGoals: { [S.techAgeId]: { met: Object.keys(PLAYSTYLES) } }, ruler: { ...nation.ruler, decrees: 0, decreeWait: wait } } } };
    const next = resolveTurn(start);
    expect(decreesOf(next.nations[me])).toBe(1);
    expect(next.nations[me].ruler.decreeLog[0].deed).toBe('trickle');
  });
});
