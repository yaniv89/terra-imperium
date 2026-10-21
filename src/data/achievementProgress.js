// src/data/achievementProgress.js
// Measurable progress for the achievements that count something (playtest audit I150). An
// achievement without an entry here is a yes/no one (the panel shows "Not yet" / "Earned"). Each
// function returns { value, target } from the same fields the achievement's own check reads.
import { GREAT_PROJECTS, getGreatProjectOwner } from './greatProjects';
import { rulerLevel } from './rulers';
import { LIVING_LEGEND_LEVEL } from './achievements';

export const ACHIEVEMENT_PROGRESS = {
  iron_grip: (s) => ({ value: s.nations[s.playerNationId]?.stability3Streak || 0, target: 20, unit: 'turns at +3' }),
  phoenix: (s) => ({ value: s.nations[s.playerNationId]?.hasBeenBankrupt ? Math.min(s.resources.gold || 0, 5000) : 0, target: 5000, unit: 'gold after bankruptcy' }),
  builder_of_wonders: (s) => ({
    value: Math.min(3, Object.keys(GREAT_PROJECTS).filter((id) => (s.greatProjects?.[id]?.tier || 0) >= 3 && getGreatProjectOwner(s, id) === s.playerNationId).length),
    target: 3,
    unit: 'tier 3 projects'
  }),
  dynasty: (s) => ({ value: rulerLevel(s.nations[s.playerNationId]?.ruler?.renown), target: LIVING_LEGEND_LEVEL, unit: 'ruler level' }),
  master_diplomat: (s) => {
    const truces = s.nations[s.playerNationId]?.truces || {};
    const n = Object.values(s.nations).filter((x) => !x.isPlayer && (x.hasTradeAgreement || (x.hasPeaceTreaty && truces[x.id] !== undefined))).length;
    return { value: n, target: 3, unit: 'nations at peace or trading' };
  },
  tech_titan: (s) => ({ value: Object.values(s.techTree || {}).filter((t) => t.researched).length, target: 12, unit: 'techs' }),
  three_front_war: (s) => ({ value: (s.wars || []).filter((w) => w.active && (w.aggressor === s.playerNationId || w.enemy === s.playerNationId)).length, target: 3, unit: 'wars at once' })
};

/** { value, target, unit } (value capped at target) for a measurable achievement, else null. */
export const achievementProgress = (state, id) => {
  const fn = ACHIEVEMENT_PROGRESS[id];
  if (!fn) return null;
  const p = fn(state);
  return { ...p, value: Math.min(p.value, p.target) };
};
