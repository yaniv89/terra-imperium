// src/battle/sim/cityStructures.js
// The real city on the battlefield (plans/MASTER-PLAN.md phase B; the world plan sections 8 to 10):
// every structure of the city manifest (src/data/townLayout.js) placed by
// src/battle/setup/cityBattle.js carries its `manifestId` and the tiles it blocks (`footprint`).
//   passive   houses, the town model's landmarks, the palace and wonders: HP and a footprint,
//             nothing else. They are never picked automatically (no AI or attack-move wastes time
//             on a shed; world plan 8: "victory does not require demolishing the city"); a
//             player's explicit attack order or a bombardment can bring them down.
//   walls     segments of the ring block the ground; the gate is open ground. A wall that falls
//             is a breach.
// When a structure with a footprint falls its tiles turn to RUBBLE (passable, slow), once, at the
// tick it falls, and the flow fields are rebuilt: paths change through the breach or the ruin.
// What the city lost is reported by manifest id (cityDamageReport) and carried to the map by
// src/engine/cityManifest.js under the 50% rule.
import { TILE } from '../setup/mapgen';
import { invalidatePaths } from './pathing';

// A structure below this share of its HP counts as damaged on the map (world plan 10: intact above 70%).
export const DAMAGED_BELOW = 0.7;

/** A city structure has fallen: its ground turns to rubble and the paths are rebuilt. */
export const collapseFootprint = (w, s) => {
  if (!s.footprint?.length) return;
  const { tiles } = w.map;
  let changed = false;
  s.footprint.forEach((i) => { if (tiles[i] === TILE.BUILDING) { tiles[i] = TILE.RUBBLE; changed = true; } });
  if (!changed) return;
  invalidatePaths(w);
  w.events.push({ t: w.tick, type: 'collapsed', structure: s.id });
};

/** The city's losses in this battle, by manifest id: { destroyed, damaged } (ruins from an earlier
 * battle are not lost again). */
export const cityDamageReport = (w) => {
  const destroyed = []; const damaged = [];
  w.structures.forEach((s) => {
    if (!s.manifestId || s.ruinedAtStart) return;
    if (!s.alive) destroyed.push(s.manifestId);
    else if (s.hp < s.maxHp * DAMAGED_BELOW) damaged.push(s.manifestId);
  });
  return { destroyed, damaged };
};
