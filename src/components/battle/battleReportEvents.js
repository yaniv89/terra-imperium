// src/components/battle/battleReportEvents.js
// Open a battle report sheet from anywhere (the Military tab's list, a map marker later), without
// threading callbacks through the tree. BattleReportsHost.jsx listens.
export const OPEN_BATTLE_REPORT = 'ti:open-battle-report';
export const openBattleReport = (id) => window.dispatchEvent(new CustomEvent(OPEN_BATTLE_REPORT, { detail: id }));
