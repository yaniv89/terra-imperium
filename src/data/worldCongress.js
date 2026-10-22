// src/data/worldCongress.js
// The World Congress (eight-ages plan U54) as data: who may sit, how often it votes and what it
// votes on. The engine is src/engine/worldCongress.js. The climate target resolution waits for the
// climate meter (U52). With Planetary Federation the Congress becomes the Planetary Council (U71)
// and votes on the Future resolutions too (COUNCIL_ORDER).

/** Members are the majors that have researched it. */
export const CONGRESS_TECH = 'governance_global_institutions';
/** Reference turns between votes, through speedTurns at the host's age. */
export const CONGRESS_SPAN_REF_TURNS = 10;
/** A passed resolution lasts this many spans. */
export const RESOLUTION_SPANS = 3;
/** Votes kept in the record. */
export const CONGRESS_RECORD_MAX = 20;

/** Proposals come in this order, one a vote (sanctions are skipped when no target exists). */
export const RESOLUTION_ORDER = ['tradeStandard', 'sanctions', 'armsLimit'];
/** The host that knows it makes the Congress the Planetary Council. */
export const COUNCIL_TECH = 'governance_planetary_federation';
export const COUNCIL_ORDER = [...RESOLUTION_ORDER, 'orbitalDemilitarisation', 'aiLimits', 'weaponsBan'];
/** Autonomous Weapons Ban: reference turns a signer builds no robot (speedTurns at the signer's age). */
export const WEAPONS_BAN_REF_TURNS = 25;
/** AI limits: a signer's automation meter stays at or under this (automation.js). */
export const AI_LIMITS_CAP = 40;

// `mods`: the timed nation modifier every member gets while the resolution holds.
export const RESOLUTIONS = {
  tradeStandard: { id: 'tradeStandard', name: 'A Trade Standard', description: 'Common rules for goods and data: +5% gold for every member.', mods: { 'national.goldMult': 0.05 } },
  armsLimit: { id: 'armsLimit', name: 'An Arms Limit', description: 'Every member caps its forces: -10% manpower, +3% gold.', mods: { 'national.hrMult': -0.1, 'national.goldMult': 0.03 } },
  sanctions: { id: 'sanctions', name: 'Sanctions', description: 'The signers cut trade with the target: no trade route between them, and the target loses gold.' },
  // The Planetary Council's (U71): `binds` the signers (worldCongress.binds), each until its own turn.
  orbitalDemilitarisation: { id: 'orbitalDemilitarisation', name: 'Orbital Demilitarisation', description: 'No signer may call an Orbital Strike in battle.', binds: true },
  aiLimits: { id: 'aiLimits', name: 'AI Limits', description: 'Every signer keeps its automation at 40 or under.', binds: true },
  weaponsBan: { id: 'weaponsBan', name: 'Autonomous Weapons Ban', description: 'No signer builds or recruits new robot units for 25 turns.', binds: true }
};

// How an AI member votes (eight-ages plan U57): a score of the opinion it holds (of the host, or
// minus its opinion of a sanctions target) plus its doctrine's lean on the resolution. Yes from
// VOTE_YES_AT, no below VOTE_NO_BELOW, abstain between, so a world of strangers (opinion 8) splits
// by doctrine instead of passing everything (U54 saw 23 to 0).
export const VOTE_YES_AT = 20;
export const VOTE_NO_BELOW = 0;
export const DOCTRINE_VOTE_LEAN = {
  tradeStandard: { merchant: 25, opportunist: 15, isolationist: -30 },
  armsLimit: { cautious: 20, defender: 15, merchant: 15, conqueror: -30, blitz: -30, attrition: -20, zealot: -15 },
  sanctions: { conqueror: 10, zealot: 10, merchant: -15, isolationist: -10 },
  orbitalDemilitarisation: { cautious: 20, defender: 15, merchant: 10, conqueror: -25, blitz: -25 },
  aiLimits: { cautious: 15, isolationist: 10, merchant: -20, opportunist: -10 },
  weaponsBan: { cautious: 20, defender: 15, conqueror: -30, blitz: -30, attrition: -15 }
};

// Trade between two AI nations is not modelled (tradeValue.js prices the player's routes only), so
// a sanctioned AI nation pays this instead; a sanctioned player loses its routes to the signers.
export const SANCTIONS_AI_GOLD_MULT = -0.1;

/** True while `targetId` is under sanctions that `signerId` signed. */
export const isSanctionedBy = (state, targetId, signerId) => (state.worldCongress?.sanctions || [])
  .some((s) => s.targetId === targetId && s.signers.includes(signerId) && s.untilTurn > (state.turnNumber || 0));

/** True while a Planetary Council resolution `id` binds `nationId` (it signed it and it stands). */
export const isBound = (state, id, nationId) => (state?.worldCongress?.binds || [])
  .some((b) => b.id === id && b.nationId === nationId && b.untilTurn > (state.turnNumber || 0));

/** True while sanctions stand between the two (either way): their trade route pays nothing. */
export const sanctionsBetween = (state, a, b) => isSanctionedBy(state, a, b) || isSanctionedBy(state, b, a);
