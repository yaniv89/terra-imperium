// src/components/battle/battleReportEvents.js
// Open a battle report sheet from anywhere (the Military tab's list, a map marker later), without
// threading callbacks through the tree. BattleReportsHost.jsx listens.
export const OPEN_BATTLE_REPORT = 'ti:open-battle-report';
export const openBattleReport = (id) => window.dispatchEvent(new CustomEvent(OPEN_BATTLE_REPORT, { detail: id }));

/**
 * The report to open when no replay plays (BattleReportsHost): a Command the screen had to settle on
 * Auto (DEF-01), a Command switched to Auto part-way (civ-veteran 106, warmonger 294), or the player's
 * own battle on Auto this turn (an attack on a city's walls: newcomer rerun step 253). Every battle the
 * player is in ends on a result or a report; "instant battles" skips only the plain Auto ones.
 */
export const reportToTell = (news, turnNumber, instant = false) => news.find((r) => r.autoBecause || r.switchedAtSec != null)
  || (!instant ? news.find((r) => r.playerSide && !r.commanded && r.turn === turnNumber) : null) || null;
