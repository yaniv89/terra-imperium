import { describe, it, expect } from 'vitest';
import { peoplesWorld, rivalOf } from './testWorld';
import { congressMembers, processWorldCongress, tallyVote, voteWeight, congressMods } from './worldCongress';
import { CONGRESS_TECH, CONGRESS_GOLD_TECH } from '../data/worldCongress';
import { opinionReasons } from './opinion';
import { tradeRoutesValue } from './tradeValue';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { resolveTurn } from './resolveTurn';

const BASE = peoplesWorld({ seed: 11 });
const A = rivalOf(BASE, 0);
const B = rivalOf(BASE, 1);
const C = rivalOf(BASE, 2);

// AI nations `ids` (and the player when `player`) know Global Institutions.
const withTech = (state, ids, player = false) => {
  const nations = { ...state.nations };
  ids.forEach((id) => { nations[id] = { ...nations[id], tech: { ...(nations[id].tech || {}), researched: [...(nations[id].tech?.researched || []), CONGRESS_TECH] } }; });
  const techTree = player ? { ...state.techTree, [CONGRESS_TECH]: { ...(state.techTree?.[CONGRESS_TECH] || {}), researched: true } } : state.techTree;
  return { ...state, nations, techTree };
};

describe('World Congress (eight-ages plan U54)', () => {
  it('a nation without Global Institutions does not sit or vote', () => {
    const s = withTech(BASE, [A, B]);
    expect(congressMembers(s)).toEqual([A, B].sort());
    expect(congressMembers(BASE)).toEqual([]);
    expect(processWorldCongress(BASE).worldCongress).toBeNull();
    const formed = { ...s, worldCongress: processWorldCongress(s).worldCongress };
    expect(gameReducer(formed, { type: ActionTypes.WORLD_CONGRESS_VOTE, payload: { vote: 'yes' } })).toBe(formed);
    const member = withTech(formed, [], true);
    expect(gameReducer(member, { type: ActionTypes.WORLD_CONGRESS_VOTE, payload: { vote: 'yes' } }).worldCongress.playerVote).toBe('yes');
  });

  it('forms, then votes once a span, the same way every time', () => {
    const s = withTech(BASE, [A, B, C]);
    const first = processWorldCongress(s);
    expect(first.worldCongress.hostId).toBe([A, B, C].sort()[0]);
    expect(first.logs.length).toBe(2);
    const due = { ...s, worldCongress: first.worldCongress, turnNumber: first.worldCongress.nextVoteTurn };
    const r1 = processWorldCongress(due);
    const r2 = processWorldCongress(due);
    expect(r1.worldCongress).toEqual(r2.worldCongress);
    expect(r1.worldCongress.record).toHaveLength(1);
    expect(r1.worldCongress.votes).toBe(1);
    expect(r1.worldCongress.nextVoteTurn).toBeGreaterThan(due.turnNumber);
    // A passed trade standard is a modifier on every member.
    expect(r1.worldCongress.record[0]).toMatchObject({ id: 'tradeStandard', passed: true });
    [A, B, C].forEach((id) => expect(r1.nations[id].modifiers.some((m) => m.sourceType === 'congress')).toBe(true));
    // The rotation moves on: sanctions have no target here (everyone thinks well enough of everyone), so an arms limit.
    expect(r1.worldCongress.proposal.id).toBe('armsLimit');
    const r3 = processWorldCongress({ ...due, worldCongress: r1.worldCongress, turnNumber: r1.worldCongress.nextVoteTurn });
    expect(r3.worldCongress.proposal.id).toBe('tradeStandard');
    // Not yet due: nothing changes.
    expect(processWorldCongress({ ...due, worldCongress: r1.worldCongress }).nations).toBe(due.nations);
  });

  it('weighs a vote by trade agreements and alliances, and passes on more yes than no', () => {
    const s = withTech(BASE, [A, B]);
    const pacts = { ...s, nations: { ...s.nations, [A]: { ...s.nations[A], hasTradeAgreement: true, hasMilitaryPact: true } } };
    expect(voteWeight(pacts, A)).toBe(3);
    expect(voteWeight(pacts, B)).toBe(1);
    // Sanctions on B: B votes no (weight 1); A says yes only if it thinks badly of B.
    const t = tallyVote(pacts, [A, B], { id: 'sanctions', targetId: B }, A);
    expect(t.no).toBeGreaterThanOrEqual(1);
    expect(t.passed).toBe(t.yes > t.no);
  });

  it('sanctions cut the player\'s trade with the signers and the target resents them', () => {
    const s = { ...BASE, turnNumber: 10, nations: { ...BASE.nations, [A]: { ...BASE.nations[A], hasTradeAgreement: true } } };
    const before = tradeRoutesValue(s).some((r) => r.partnerId === A);
    const sanctioned = { ...s, worldCongress: { sanctions: [{ targetId: s.playerNationId, signers: [A], untilTurn: 40 }] } };
    expect(tradeRoutesValue(sanctioned).some((r) => r.partnerId === A)).toBe(false);
    expect(opinionReasons(sanctioned, s.playerNationId, A).some((r) => r.id === 'sanctionedUs')).toBe(true);
    expect(opinionReasons({ ...sanctioned, turnNumber: 40 }, s.playerNationId, A).some((r) => r.id === 'sanctionedUs')).toBe(false);
    expect(before).toBe(true);
  });

  it('resolveTurn seats the Congress once a member exists', () => {
    expect(resolveTurn(BASE).worldCongress).toBeUndefined();
    expect(resolveTurn(withTech(BASE, [A, B])).worldCongress?.hostId).toBe([A, B].sort()[0]);
  });

  it('a resolution pays its gold only to a member that knows Global Institutions (events-8: early Congress, pacing as before)', () => {
    const s = withTech(BASE, [A, B]);
    const mods = { 'national.hrMult': -0.1, 'national.goldMult': 0.03 };
    expect(congressMods(s, A, mods)).toEqual({ 'national.hrMult': -0.1 });
    const known = { ...s, nations: { ...s.nations, [A]: { ...s.nations[A], tech: { ...s.nations[A].tech, researched: [...s.nations[A].tech.researched, CONGRESS_GOLD_TECH] } } } };
    expect(congressMods(known, A, mods)).toEqual(mods);
  });
});
