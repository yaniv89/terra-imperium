// src/battle/render/capacity.js
// How many instances the battlefield's instanced meshes need, from the battle's setup (phase C,
// plans/MASTER-PLAN.md 6.2): one squad marker, banner and strength bar per squad that can ever take
// the field (front line, reserves, reinforcements), and one soldier figure per drawn soldier of
// each age and class. Fixed small pools (64 squads, 640 figures per layer) silently stopped
// drawing past the 64th squad, which a 300-a-side battle passes at once.
import { getUnitBattleStats, getBattleStats } from '../data/battleStats';
import { POP_LIMIT, trainableRoles } from '../data/economy';

export const MIN_SQUAD_SLOTS = 64;
export const MIN_SOLDIER_SLOTS = 640;

// Every unit of a side that can appear: its army plus its reinforcements.
const unitsOf = (side) => [...(side.units || []), ...(side.reinforcements || []).flatMap((r) => r.units || [])];

// A battle with an economy (phase R1) can train up to its population limit a side on top.
const ecoSquads = (setup) => (setup.economy ? (setup.sides || []).length * POP_LIMIT : 0);
// A general takes the field as its own cavalry guard squad (phase R3, sim/world.js spawnGenerals):
// one per general commanding a unit of the side.
const generalsOf = (setup, side) => new Set((side.units || []).filter((u) => u.commanderId && setup.generals?.[u.commanderId]).map((u) => u.commanderId)).size;
export const squadSlots = (setup) => Math.max(MIN_SQUAD_SLOTS, (setup.sides || []).reduce((n, s) => n + unitsOf(s).length + generalsOf(setup, s), 0) + ecoSquads(setup));

export const soldierSlots = (setup, ageId, classId) => {
  let n = 0;
  (setup.sides || []).forEach((s) => {
    if (s.ageId !== ageId) return;
    unitsOf(s).forEach((u) => { if (u.classId === classId) n += getUnitBattleStats(u, ageId).soldiers; });
    if (classId === 'cavalry') n += generalsOf(setup, s) * getBattleStats('cavalry', ageId).soldiers;
    // Trained squads and workers (the battle economy): room for a whole population of this class.
    if (setup.economy && trainableRoles(ageId).includes(classId)) n += POP_LIMIT * getBattleStats(classId, ageId).soldiers;
  });
  return Math.max(MIN_SOLDIER_SLOTS, n);
};

// Fewer figures per squad as battles grow (cosmetic only: the sim never sees figures). Up to 80
// squads a side every soldier of a squad is drawn; past that the figures shrink with the square
// root of the size (300 a side: about half, 500 and more: 0.4) and stand further apart, so a
// squad still covers its ground and a 300-a-side field draws about 2,800 figures instead of 5,600.
export const FULL_FIGURES_UP_TO = 80;
export const MIN_FIGURE_SCALE = 0.4;
export const figureScale = (setup) => {
  const perSide = Math.max(0, ...(setup.sides || []).map((s) => unitsOf(s).length));
  return perSide <= FULL_FIGURES_UP_TO ? 1 : Math.max(MIN_FIGURE_SCALE, Math.sqrt(FULL_FIGURES_UP_TO / perSide));
};
// The figures a squad of `soldiers` draws at full strength under `scale` (at least one).
export const scaledSoldiers = (soldiers, scale) => Math.max(1, Math.round(soldiers * scale));
