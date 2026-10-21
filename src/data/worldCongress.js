// src/data/worldCongress.js
// The World Congress (eight-ages plan U54) as data: who may sit, how often it votes and what it
// votes on. The engine is src/engine/worldCongress.js. The climate target resolution waits for the
// climate meter (U52); the Planetary Council (U71) extends this list.

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

// `mods`: the timed nation modifier every member gets while the resolution holds.
export const RESOLUTIONS = {
  tradeStandard: { id: 'tradeStandard', name: 'A Trade Standard', description: 'Common rules for goods and data: +5% gold for every member.', mods: { 'national.goldMult': 0.05 } },
  armsLimit: { id: 'armsLimit', name: 'An Arms Limit', description: 'Every member caps its forces: -10% manpower, +3% gold.', mods: { 'national.hrMult': -0.1, 'national.goldMult': 0.03 } },
  sanctions: { id: 'sanctions', name: 'Sanctions', description: 'The signers cut trade with the target: no trade route between them, and the target loses gold.' }
};

// Trade between two AI nations is not modelled (tradeValue.js prices the player's routes only), so
// a sanctioned AI nation pays this instead; a sanctioned player loses its routes to the signers.
export const SANCTIONS_AI_GOLD_MULT = -0.1;

/** True while `targetId` is under sanctions that `signerId` signed. */
export const isSanctionedBy = (state, targetId, signerId) => (state.worldCongress?.sanctions || [])
  .some((s) => s.targetId === targetId && s.signers.includes(signerId) && s.untilTurn > (state.turnNumber || 0));

/** True while sanctions stand between the two (either way): their trade route pays nothing. */
export const sanctionsBetween = (state, a, b) => isSanctionedBy(state, a, b) || isSanctionedBy(state, b, a);
