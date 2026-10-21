// src/data/rulers.js
// The one ruler a major keeps for the whole game (plans/RULER-PLAN.md section 3, differentiation
// plan U5): six attributes stored flat on nation.ruler. Every major starts with the same numbers;
// the three pool attributes start at the old average roll, the three new ones at 0.
export const RULER_START = Object.freeze({ adm: 3, dip: 3, mil: 3, cmd: 0, lrn: 0, maj: 0 });

// Caps follow the nation's own research age (differentiation plan KTD1): 4 in the first age up to
// 8 in the last, spread by index over however many ages AGE_ORDER holds.
export const ATTRIBUTE_CAP_FIRST = 4;
export const ATTRIBUTE_CAP_LAST = 8;
export const attributeCapAt = (ageIndex, ageCount) => (ageCount <= 1 ? ATTRIBUTE_CAP_LAST
  : ATTRIBUTE_CAP_FIRST + Math.round(((ATTRIBUTE_CAP_LAST - ATTRIBUTE_CAP_FIRST) * Math.max(0, ageIndex)) / (ageCount - 1)));

// Raising an attribute to `value` costs 1 attribute point up to 5, 2 points for 6, 7 and 8.
export const attributeCost = (value) => (value <= 5 ? 1 : 2);

// Renown (RULER-PLAN 4.1, differentiation plan U11): a lifetime total earned by deeds. Amounts are
// counts of deeds, so they are the same on every game speed; the time trickle is per reference turn
// (R34: speedTurns), so it is speed-neutral too.
export const RENOWN = {
  timePerRefTurn: 2,      // while the capital is held
  cityFounded: 15,        // an outpost grown into a city (not the first village)
  cityTaken: 25,          // from a major; its capital +capitalTaken
  capitalTaken: 50,
  cityTakenIndep: 15,     // from an independent, or a city that joined by choice
  battleWon: 5,           // +battleOutnumbered when the winner started with fewer men
  battleOutnumbered: 5,
  warWon: 40,             // peace with war score DECREE_WAR_WON_SCORE+ for the winner
  defenceSurvived: 15,    // the defender of a war that ends in a white peace
  techBase: 4,            // a tech: techBase + techPerAge x the tech's age index
  techPerAge: 4,
  wonderTier: 30,
  eraGoal: 40,            // each goal met when an age ends
  ambition: 30,           // each ambition fulfilled (ambitions.js)
  eraLegacy: 60,          // and 1 virtue point (at most ERA_LEGACY_VIRTUE_MAX a game)
  stability: 20           // stability at its maximum for STABILITY_RENOWN_REF_TURNS
};
export const RENOWN_DEED_LABELS = {
  time: 'Years on the throne', cityFounded: 'City founded', cityTaken: 'City taken', cityJoined: 'City joined us',
  battleWon: 'Battle won', warWon: 'War won', defenceSurvived: 'War survived', tech: 'Discovery', wonder: 'Wonder built',
  eraGoal: 'Era goal met', ambition: 'Ambition fulfilled', eraLegacy: 'Era legacy', stability: 'Years of order', event: 'Event'
};
// The time trickle is paid in one lump every TIME_RENOWN_REF_TURNS reference turns: a nation record
// that changed every turn would empty every per-nation cache (modifier sheets, rules) each turn.
export const TIME_RENOWN_REF_TURNS = 10;
export const STABILITY_RENOWN_REF_TURNS = 10;  // reference turns at the top of stability
export const STABILITY_RENOWN_GAP_REF_TURNS = 25; // at most once in this many reference turns
export const ERA_LEGACY_VIRTUE_MAX = 5;
export const RENOWN_DEEDS_KEPT = 12;

// Anti-snowball (RULER-PLAN 4.5): conquest and battle renown x SIZE_DAMP_CITIES / max(that, cities
// owned); battle renown at most BATTLE_RENOWN_TURN_CAP a turn; a ruler below the median level of the
// living majors earns CATCHUP_MULT ("Rising star").
export const SIZE_DAMP_CITIES = 12;
export const BATTLE_RENOWN_TURN_CAP = 20;
export const CATCHUP_MULT = 1.25;

// Levels 1 to MAX_RULER_LEVEL: level L to L + 1 takes 50 + 10 x L renown, so reaching level L takes
// 5 x (L - 1) x (L + 10) in total (level 5: 300, 10: 900, 20: 2,850, 30: 5,800).
export const MAX_RULER_LEVEL = 30;
export const renownForLevel = (level) => 5 * (level - 1) * (level + 10);
/** The ruler level a lifetime renown reaches (1 to MAX_RULER_LEVEL). */
export const rulerLevel = (renown = 0) => {
  let level = 1;
  while (level < MAX_RULER_LEVEL && renownForLevel(level + 1) <= renown) level++;
  return level;
};
