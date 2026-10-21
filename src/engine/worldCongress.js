// src/engine/worldCongress.js
// The World Congress (eight-ages plan U54). Every major that has researched Global Institutions
// sits in it. The host is the first to sit (ties by id); while the host sits, the Congress votes
// every speedTurns(CONGRESS_SPAN_REF_TURNS, speed, host's age) turns on one resolution, proposed a
// span ahead so the player can make up its mind (WORLD_CONGRESS_VOTE). Resolutions rotate through
// RESOLUTION_ORDER (src/data/worldCongress.js), skipping sanctions while no major is thought badly of.
//
// A member's vote weighs 1 + its trade agreements + its alliances and defensive pact. AI members
// vote by opinion: sanctions on a nation they think badly of (below 0; the target votes no), a
// trade standard or an arms limit when they think well enough (0 or more) of the host, never an
// arms limit while at war. A resolution passes when the yes weight beats the no weight.
// A passed trade standard or arms limit is a timed modifier on every member; passed sanctions cut
// the player's trade route to each signer (tradeValue.js), cost an AI target SANCTIONS_AI_GOLD_MULT
// gold and give the target the "sanctioned us" opinion of every signer (opinion.js). Each lasts
// RESOLUTION_SPANS spans. No victory reads the record.
//
// state.worldCongress = { hostId, nextVoteTurn, proposal: { id, targetId? }, playerVote, votes,
//   sanctions: [{ targetId, signers, untilTurn }], record: [{ turn, id, targetId, passed, yes, no }] }
// Absent until the first member sits (old saves need nothing).
import { CONGRESS_TECH, CONGRESS_SPAN_REF_TURNS, RESOLUTION_SPANS, CONGRESS_RECORD_MAX, RESOLUTION_ORDER, RESOLUTIONS, SANCTIONS_AI_GOLD_MULT } from '../data/worldCongress';
import { isIndependentNation } from '../data/independents';
import { speedTurns } from '../data/ages';
import { ageOf, getResearched } from './nationState';
import { opinionOf } from './opinion';
import { addNationModifier } from './modifiers/timed';
import { msg, people } from './messages';

const isMajor = (n) => n && !n.isEliminated && !isIndependentNation(n);

/** The members, sorted by id: living majors that have researched Global Institutions. */
export const congressMembers = (state) => Object.keys(state.nations || {}).sort()
  .filter((id) => isMajor(state.nations[id]) && getResearched(state, id).includes(CONGRESS_TECH));

/** A member's vote weight: 1 + trade agreements + alliances + a defensive pact. */
export const voteWeight = (state, id) => {
  const n = state.nations[id];
  const pact = n.defensivePact ? 1 : 0;
  if (id !== state.playerNationId) return 1 + (n.hasTradeAgreement ? 1 : 0) + (n.hasMilitaryPact ? 1 : 0) + pact;
  const others = Object.values(state.nations).filter(isMajor);
  return 1 + others.filter((o) => o.hasTradeAgreement).length + others.filter((o) => o.hasMilitaryPact).length + pact;
};

/** How an AI member votes on `proposal`: 'yes' or 'no'. */
export const aiVote = (state, voterId, proposal, hostId) => {
  if (proposal.id === 'sanctions') return voterId !== proposal.targetId && opinionOf(state, voterId, proposal.targetId) < 0 ? 'yes' : 'no';
  if (proposal.id === 'armsLimit' && state.nations[voterId].isAtWar) return 'no';
  return voterId === hostId || opinionOf(state, voterId, hostId) >= 0 ? 'yes' : 'no';
};

// Sanctions target the living major the members think worst of, summed (ties by id); none below 0, none.
const sanctionsTarget = (state, members) => {
  let best = null; let bestSum = 0;
  Object.keys(state.nations).sort().forEach((id) => {
    if (!isMajor(state.nations[id])) return;
    const sum = members.reduce((s, m) => s + (m === id ? 0 : opinionOf(state, m, id)), 0);
    if (sum < bestSum) { bestSum = sum; best = id; }
  });
  return best;
};

/** The first resolution from RESOLUTION_ORDER[from] on (wrapping) that has a target. */
export const nextProposal = (state, members, from) => {
  for (let k = 0; k < RESOLUTION_ORDER.length; k++) {
    const id = RESOLUTION_ORDER[(from + k) % RESOLUTION_ORDER.length];
    if (id !== 'sanctions') return { id };
    const targetId = sanctionsTarget(state, members);
    if (targetId) return { id, targetId };
  }
  return { id: RESOLUTION_ORDER[0] };
};

/** The vote: { passed, yes, no, signers } (weights; signers are the yes voters, sorted). */
export const tallyVote = (state, members, proposal, hostId, playerVote = null) => {
  let yes = 0; let no = 0; const signers = [];
  members.forEach((id) => {
    const vote = id === state.playerNationId ? playerVote : aiVote(state, id, proposal, hostId);
    const w = voteWeight(state, id);
    if (vote === 'yes') { yes += w; signers.push(id); } else if (vote === 'no') no += w;
  });
  return { passed: yes > no, yes, no, signers };
};

const proposalLog = (state, proposal, turn) => msg(`m.diplo.congressPropose.${proposal.id}`, {
  turn, ...(proposal.targetId ? { nation: people(proposal.targetId, state.nations[proposal.targetId]?.name || proposal.targetId) } : {})
});

/**
 * One turn of the Congress. `state` carries this turn's working nations and the new turn number.
 * Returns { worldCongress, nations, logs }: `nations` is the same object unless a vote passed.
 */
export const processWorldCongress = (state) => {
  const turn = state.turnNumber || 0;
  const members = congressMembers(state);
  const prev = state.worldCongress || null;
  if (!members.length) return { worldCongress: prev, nations: state.nations, logs: [] };
  const logs = [];
  const hostId = prev && members.includes(prev.hostId) ? prev.hostId : members[0];
  const span = speedTurns(CONGRESS_SPAN_REF_TURNS, state.gameSpeed, ageOf(state, hostId));
  const sanctions = (prev?.sanctions || []).filter((s) => s.untilTurn > turn);
  if (!prev) {
    const proposal = nextProposal(state, members, 0);
    logs.push(msg('m.diplo.congressFormed', { nation: people(hostId, state.nations[hostId]?.name || hostId) }), proposalLog(state, proposal, turn + span));
    return { worldCongress: { hostId, nextVoteTurn: turn + span, proposal, playerVote: null, votes: 0, sanctions, record: [] }, nations: state.nations, logs };
  }
  if (turn < prev.nextVoteTurn) return { worldCongress: { ...prev, hostId, sanctions }, nations: state.nations, logs };

  const after = (p) => RESOLUTION_ORDER.indexOf(p?.id) + 1; // the rotation continues after the proposal just voted on
  const proposal = prev.proposal?.id === 'sanctions' && !isMajor(state.nations[prev.proposal.targetId]) ? nextProposal(state, members, after(prev.proposal)) : prev.proposal;
  const result = tallyVote(state, members, proposal, hostId, prev.playerVote);
  const duration = span * RESOLUTION_SPANS;
  let nations = state.nations;
  if (result.passed) {
    nations = { ...nations };
    const add = (id, mods) => { nations[id] = addNationModifier(nations[id], { sourceType: 'congress', sourceId: proposal.id, label: RESOLUTIONS[proposal.id].name, mods, duration, turnNumber: turn }); };
    if (proposal.id === 'sanctions') {
      sanctions.push({ targetId: proposal.targetId, signers: result.signers, untilTurn: turn + duration });
      if (proposal.targetId !== state.playerNationId) add(proposal.targetId, { 'national.goldMult': SANCTIONS_AI_GOLD_MULT });
    } else members.forEach((id) => add(id, RESOLUTIONS[proposal.id].mods));
  }
  logs.push(msg(result.passed ? 'm.diplo.congressPassed' : 'm.diplo.congressFailed', { yes: result.yes, no: result.no }));
  const votes = prev.votes + 1;
  const next = nextProposal({ ...state, nations }, members, after(proposal));
  logs.push(proposalLog(state, next, turn + span));
  const record = [...prev.record, { turn, id: proposal.id, ...(proposal.targetId ? { targetId: proposal.targetId } : {}), passed: result.passed, yes: result.yes, no: result.no }].slice(-CONGRESS_RECORD_MAX);
  return { worldCongress: { hostId, nextVoteTurn: turn + span, proposal: next, playerVote: null, votes, sanctions, record }, nations, logs };
};
