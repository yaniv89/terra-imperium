// src/data/opinion.js
// The opinion table (plans/civ-map-rework.md, C6.3): why one nation thinks what it thinks of
// another, as data. Each reason has a label and the value it carries; opinion runs -100 to +100.
// The engine (src/engine/opinion.js) computes the live reasons from the map and the nation
// records; the grudge of past acts is the existing `hostility` scalar, so insults, gifts, wars
// and broken truces keep their decay there (0.6 opinion per point).
export const OPINION_MIN = -100;
export const OPINION_MAX = 100;
export const OPINION_BASELINE = 8;           // a stranger's standing (keeps the AI war roll where it was)
export const GRUDGE_PER_HOSTILITY = 0.6;     // opinion lost per point of hostility
// Border lengths count tiles of BORDER_TILE_KM (one tile at frequency 75): the engine turns a
// shared border of n tiles into n x spacing / BORDER_TILE_KM, so a border of the same km rubs the
// same on any grid.
export const BORDER_TILE_KM = 102;
export const BORDER_FREE_TILES = 5;          // shared border tiles before they rub
export const BORDER_PER_TILE = -1;
export const BORDER_MAX = -20;
export const SETTLED_NEAR_KM = 612;          // km (6 rings at frequency 75), as rings in the engine
export const SETTLED_NEAR = -15;             // decays 1 a turn after the founding
export const HOLDS_MY_CULTURE = -10;         // per city of my people you hold
export const CLAIM_ON_MY_CITY = -10;
export const TRADE_ROUTE = 5;
export const TRADE_MAX = 15;
export const ALLIANCE = 25;
export const OPEN_BORDERS = 10;
export const DEFENSIVE_PACT = 15;
export const ROYAL_MARRIAGE = 15;
export const SAME_IDENTITY_AXIS = 5;
export const BROKEN_TRUCE = -20;             // the hostility floor a broken truce leaves
export const AE_FREE = 20;
export const AE_PER_POINT = -1;
export const RIVAL = -30;
export const VASSAL_OF_YOU = -10;            // a vassal resents its overlord a little
export const WAR_ROLL_OPINION_CEILING = 20;  // no AI war roll at this opinion or above
export const WAR_ROLL_OPINION_SPAN = 60;     // full roll at ceiling - span
export const CASUS_BELLI_OPINION = -40;      // this low, a war on them needs no claim
export const RAIDED_US = -15;                // an independent raided or sacked us; fades 1 a turn (raids.js)
export const PAYS_US_TRIBUTE = 10;           // an independent's view of a nation paying it tribute
