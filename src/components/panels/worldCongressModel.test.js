import { describe, it, expect } from 'vitest';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';
import { processWorldCongress } from '../../engine/worldCongress';
import { CONGRESS_TECH } from '../../data/worldCongress';
import { worldCongressModel } from './worldCongressModel';

const BASE = peoplesWorld({ seed: 11 });
const A = rivalOf(BASE, 0);
const B = rivalOf(BASE, 1);
const seated = (player) => {
  const nations = { ...BASE.nations };
  [A, B].forEach((id) => { nations[id] = { ...nations[id], tech: { ...nations[id].tech, researched: [...(nations[id].tech?.researched || []), CONGRESS_TECH] } }; });
  const techTree = player ? { ...BASE.techTree, [CONGRESS_TECH]: { ...BASE.techTree[CONGRESS_TECH], researched: true } } : BASE.techTree;
  const s = { ...BASE, nations, techTree };
  return { ...s, worldCongress: processWorldCongress(s).worldCongress };
};

describe('worldCongressModel (U60)', () => {
  it('is null before the Congress meets', () => {
    expect(worldCongressModel(BASE)).toBeNull();
  });
  it('a member sees the proposal, the turns left, its weight and the forecast with its vote', () => {
    const s = seated(true);
    const m = worldCongressModel({ ...s, worldCongress: { ...s.worldCongress, playerVote: 'no' } });
    expect(m.member).toBe(true);
    expect(m.proposal.id).toBe('tradeStandard');
    expect(m.turnsLeft).toBe(s.worldCongress.nextVoteTurn - (s.turnNumber || 0));
    expect(m.weight).toBeGreaterThanOrEqual(1);
    expect(m.myVote).toBe('no');
    expect(m.forecast.no).toBeGreaterThanOrEqual(m.weight);
  });
  it('a nation outside is told which tech seats it, and its vote never counts', () => {
    const s = seated(false);
    const m = worldCongressModel({ ...s, worldCongress: { ...s.worldCongress, playerVote: 'no', record: [{ turn: 1, id: 'armsLimit', passed: false, yes: 1, no: 2 }] } });
    expect(m.member).toBe(false);
    expect(m.joinTech).toBe(CONGRESS_TECH);
    expect(m.myVote).toBeNull();
    expect(m.forecast.no).toBe(worldCongressModel(s).forecast.no);
    expect(m.record).toHaveLength(1);
  });
});
