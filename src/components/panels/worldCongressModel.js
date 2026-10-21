// src/components/panels/worldCongressModel.js
// What the World Congress sheet shows (eight-ages plan U60, engine: src/engine/worldCongress.js):
// the host, the members, the next vote and its proposal, how the vote stands now with the
// player's choice (the same tally the vote will run), the player's weight, the sanctions in force
// and the last votes. Null while no Congress has met. Pure.
import { congressMembers, tallyVote, voteWeight } from '../../engine/worldCongress';
import { CONGRESS_TECH } from '../../data/worldCongress';

export const RECORD_SHOWN = 5;

export const worldCongressModel = (state) => {
  const wc = state.worldCongress;
  if (!wc) return null;
  const me = state.playerNationId;
  const turn = state.turnNumber || 0;
  const members = congressMembers(state);
  const member = members.includes(me);
  const proposal = wc.proposal || null;
  const forecast = proposal ? tallyVote(state, members, proposal, wc.hostId, member ? wc.playerVote : null) : null;
  return {
    hostId: wc.hostId,
    members,
    member,
    joinTech: CONGRESS_TECH,
    weight: member ? voteWeight(state, me) : 0,
    voteTurn: wc.nextVoteTurn,
    turnsLeft: Math.max(0, wc.nextVoteTurn - turn),
    proposal,
    myVote: member ? wc.playerVote : null,
    forecast: forecast && { yes: forecast.yes, no: forecast.no, passes: forecast.passed },
    sanctions: (wc.sanctions || []).filter((s) => s.untilTurn > turn).map((s) => ({ targetId: s.targetId, signers: s.signers.length, untilTurn: s.untilTurn, onMe: s.targetId === me, mine: s.signers.includes(me) })),
    record: [...(wc.record || [])].reverse().slice(0, RECORD_SHOWN)
  };
};
