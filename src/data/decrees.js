// src/data/decrees.js
// The ruler's decrees (differentiation plan KD8, KTD4, Appendix A): a small bank of earned orders
// spent on the major acts of state. Decrees come from deeds; a passive trickle is only a floor that
// runs while the bank is empty. The engine is src/engine/decrees.js. U8 tunes these numbers.

// Bank cap 3, plus 1 at Majesty 4 and plus 1 at Majesty 8.
export const DECREE_CAP_BASE = 3;
export const DECREE_CAP_MAJESTY_STEPS = [4, 8];

// The trickle: one decree every this many reference turns (speedTurns), only while the bank is empty.
export const DECREE_TRICKLE_REF_TURNS = 10;
// Administration shortens the floor (KTD5): this many reference turns less per point above the
// start value, never below DECREE_TRICKLE_MIN_REF_TURNS.
export const DECREE_TRICKLE_ADM_START = 3;
export const DECREE_TRICKLE_REF_TURNS_PER_ADM = 0.5;
export const DECREE_TRICKLE_MIN_REF_TURNS = 6;
// Low legitimacy slows the floor (KTD5 replaces RULER-PLAN's "-1 to the best pool").
export const DECREE_LOW_LEGITIMACY = 50;
export const DECREE_LOW_LEGITIMACY_MULT = 1.5;

// War won: a peace that closes a war with the winner's war score at least this.
export const DECREE_WAR_WON_SCORE = 25;

// Recent grants and spends kept on the ruler for the UI's reason lines.
export const DECREE_LOG_SIZE = 10;

// Deeds that grant one decree each (U12 adds ambitions).
export const DECREE_DEEDS = {
  warWon: 'War won',
  eraGoal: 'Era goal met',
  wonder: 'Wonder completed',
  trickle: 'Quiet years at court'
};

// The acts of state that spend decrees (Appendix A). Ids match ACTION_COSTS where one exists;
// changeLaw, increaseStability, annexVassal and reshapeRuler are dynamic costs.
// U7 wires them into the costs; until then the old pools still pay for every act.
export const DECREE_ACTS = {
  declareWarJustified: { decrees: 1, label: 'Declare a justified war' },
  demand: { decrees: 1, label: 'Make a demand' },
  fabricateClaim: { decrees: 1, label: 'Fabricate a claim' },
  militaryAlliance: { decrees: 1, label: 'Form a military alliance' },
  proposeMarriage: { decrees: 1, label: 'Propose a royal marriage' },
  vassalize: { decrees: 1, label: 'Make a vassal' },
  annexVassal: { decrees: 1, label: 'Annex a vassal' },
  changeGovernmentType: { decrees: 2, label: 'Change the government' },
  enactGovernmentReform: { decrees: 1, label: 'Enact a government reform' },
  moveCapital: { decrees: 1, label: 'Move the capital' },
  shiftIdentity: { decrees: 1, label: 'Shift the national identity' },
  changeLaw: { decrees: 1, label: 'Change a law' },
  increaseStability: { decrees: 1, label: 'Raise stability' },
  reshapeRuler: { decrees: 1, label: 'Reshape the ruler' }
};
