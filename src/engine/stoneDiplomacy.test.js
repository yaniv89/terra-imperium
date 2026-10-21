// Stone diplomacy (eight-ages plan U32): contact, raids instead of conquest, the Border Stele, age gates.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { peoplesWorld, rivalOf } from './testWorld';
import { stonePhaseOf, canAnnex } from './stonePhase';
import { buildWarGoal, declareWar } from './diplomacy';
import { getTermCost } from './peace';
import { hasStele, setStele } from './accords';
import { opinionReasons } from './opinion';
import { withAgesResearched } from './research';
import { metNations } from './fog';

const W = peoplesWorld({ seed: 5 });
const ME = W.playerNationId;
const rich = (s) => ({ ...s, resources: { ...s.resources, gold: 10000 } });
const met = (s, a, b) => ({ ...s, fog: { ...s.fog, met: { ...s.fog.met, [a]: { ...(s.fog.met?.[a] || {}), [b]: s.turnNumber || 0 }, [b]: { ...(s.fog.met?.[b] || {}), [a]: s.turnNumber || 0 } } } });
const cities = (s, id) => withAgesResearched(s, id, 'bronze'); // past the village phase

describe('Stone diplomacy', () => {
  it('a Stone start is in the village phase: raids, no conquest', () => {
    const other = rivalOf(W);
    expect(stonePhaseOf(W, ME)).toBe('village');
    expect(canAnnex(W, ME)).toBe(false);
    expect(buildWarGoal(W, other, ME, 'capture_region').type).toBe('destroy_military');
    const war = { aggressor: ME, enemy: other, goal: { type: 'destroy_military' } };
    expect(getTermCost(W, war, ME, { type: 'cede', regionId: W.nations[other].capitalRegionId })).toBe(Infinity);
    expect(canAnnex(cities(W, ME), ME)).toBe(true);
  });

  it('an unmet people cannot be offered a stele; trade agreements wait for the Bronze Age', () => {
    const other = rivalOf(W);
    const s = rich(cities(W, ME));
    const unmet = { ...s, fog: { ...s.fog, met: { ...s.fog.met, [ME]: {}, [other]: {} } } };
    expect(gameReducer(unmet, { type: ActionTypes.PROPOSE_STELE, payload: { nationId: other } }).nations[ME].steles).toBeUndefined();
    const stone = met(rich(W), ME, other);
    const traded = gameReducer(stone, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: other } });
    expect(traded.resources.gold).toBe(stone.resources.gold);
    expect(traded.logs[traded.logs.length - 1].message).toMatch(/age/);
  });

  it('a village people cannot raise a stele; past it, a willing neighbour raises one', () => {
    const other = rivalOf(W);
    const village = met(rich(W), ME, other);
    expect(hasStele(gameReducer(village, { type: ActionTypes.PROPOSE_STELE, payload: { nationId: other } }), ME, other)).toBe(false);
    const s = met(rich(cities(W, ME)), ME, other);
    const raised = gameReducer(s, { type: ActionTypes.PROPOSE_STELE, payload: { nationId: other } });
    expect(hasStele(raised, ME, other)).toBe(true);
    expect(hasStele(raised, other, ME)).toBe(true);
    expect(raised.nations[ME].steles[other]).toBeGreaterThan(s.turnNumber || 0);
  });

  it('breaking a stele costs opinion with everyone', () => {
    const [a, b, c] = [rivalOf(W, 0), rivalOf(W, 1), rivalOf(W, 2)];
    const s = { ...W, nations: setStele(W.nations, a, b, (W.turnNumber || 0) + 50) };
    const before = opinionReasons(s, c, a).find((r) => r.id === 'brokeStele');
    const broken = declareWar(s, b, { aggressor: a });
    expect(before).toBeUndefined();
    expect(hasStele(broken, a, b)).toBe(false);
    expect(opinionReasons(broken, c, a).find((r) => r.id === 'brokeStele').value).toBeLessThan(0);
    expect(opinionReasons(broken, ME, a).find((r) => r.id === 'brokeStele').value).toBeLessThan(0);
  });

  it('a people met lately is warmer, for a while', () => {
    const other = metNations(W, ME)[0] || rivalOf(W);
    const s = met(W, ME, other);
    expect(opinionReasons(s, other, ME).find((r) => r.id === 'metRecently').value).toBeGreaterThan(0);
    expect(opinionReasons({ ...s, turnNumber: (s.turnNumber || 0) + 50 }, other, ME).find((r) => r.id === 'metRecently')).toBeUndefined();
  });
});
