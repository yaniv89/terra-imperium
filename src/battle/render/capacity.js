// src/battle/render/capacity.js
// How many instances the battlefield's instanced meshes need, from the battle's setup (phase C,
// plans/MASTER-PLAN.md 6.2): one squad marker, banner and strength bar per squad that can ever take
// the field (front line, reserves, reinforcements), and one soldier figure per drawn soldier of
// each age and class. Fixed small pools (64 squads, 640 figures per layer) silently stopped
// drawing past the 64th squad, which a 300-a-side battle passes at once.
import { getUnitBattleStats } from '../data/battleStats';

export const MIN_SQUAD_SLOTS = 64;
export const MIN_SOLDIER_SLOTS = 640;

// Every unit of a side that can appear: its army plus its reinforcements.
const unitsOf = (side) => [...(side.units || []), ...(side.reinforcements || []).flatMap((r) => r.units || [])];

export const squadSlots = (setup) => Math.max(MIN_SQUAD_SLOTS, (setup.sides || []).reduce((n, s) => n + unitsOf(s).length, 0));

export const soldierSlots = (setup, ageId, classId) => {
  let n = 0;
  (setup.sides || []).forEach((s) => {
    if (s.ageId !== ageId) return;
    unitsOf(s).forEach((u) => { if (u.classId === classId) n += getUnitBattleStats(u, ageId).soldiers; });
  });
  return Math.max(MIN_SOLDIER_SLOTS, n);
};
