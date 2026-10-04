// src/engine/warContagion.js
// War contagion as a Hawkes process (plans/math-ideas.md 5.3): "events make more events, then
// calm down". Each new war raises the war chance of the nations near it for a while; the effect
// decays geometrically, so history gets eras of turmoil and eras of peace instead of a constant
// drizzle. The intensity is kept as a state variable, the exponential kernel's own recursion
// (no exp needed, the same on every device):
//
//   heat'_n = HEAT_DECAY x heat_n + sum over wars started this turn of HEAT_ALPHA x k(km)
//   k(km)   = 1 / (1 + (km / HEAT_KM)^2) out to HEAT_REACH_KM, km from n's capital to the nearer
//             belligerent's capital (the belligerents themselves are not excited by their own war)
//   mult_n  = 1 + HEAT_MULT_MAX x heat_n / (1 + heat_n)        (aiLogic.js, the AI war roll)
//
// Stability: one war adds at most HEAT_ALPHA / (1 - HEAT_DECAY) heat-turns to a nation next door,
// and the soft cap bounds the multiplier at 1 + HEAT_MULT_MAX, so with the base roll of about 1% a
// turn the expected wars one war triggers (the branching ratio) stays well below 1: turmoil
// clusters but never runs away. Stored as nation.warHeat (absent when ~0). Cost: O(nations) a
// turn plus O(nations) per new war; independent of the grid, distances in km.
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { tileKm } from './tradeValue';

export const HEAT_ALPHA = 1;
export const HEAT_DECAY = 0.85;      // about a 6-turn memory
export const HEAT_KM = 1000;
export const HEAT_REACH_KM = 3000;
export const HEAT_MULT_MAX = 1;      // the roll at most doubles
export const HEAT_MIN = 0.001;

const round4 = (x) => Math.round(x * 10000) / 10000;

export const heatKernel = (km) => (km > HEAT_REACH_KM ? 0 : 1 / (1 + (km / HEAT_KM) * (km / HEAT_KM)));

/** The multiplier a nation's war heat puts on its war roll: 1 to 1 + HEAT_MULT_MAX. */
export const warContagionMult = (nation) => {
  const h = Math.max(0, nation?.warHeat || 0);
  return 1 + HEAT_MULT_MAX * h / (1 + h);
};

/**
 * One turn of war heat on `nations`: decay, then excitation from the wars that started at `turn`
 * (`view` supplies regions and nations for capitals). Returns the same object when nothing changed.
 */
export const updateWarHeat = (nations, wars, turn, view) => {
  const fresh = (wars || []).filter((w) => w.active !== false && w.startTurn === turn);
  let next = nations;
  const set = (id, h) => {
    const v = h < HEAT_MIN ? 0 : round4(h);
    if ((nations[id].warHeat || 0) === v) return;
    if (next === nations) next = { ...nations };
    next[id] = { ...nations[id], warHeat: v || undefined };
  };
  const heat = new Map();
  Object.entries(nations).forEach(([id, n]) => { if (n?.warHeat) heat.set(id, n.warHeat * HEAT_DECAY); });
  if (fresh.length) {
    const tiles = getTiles();
    const s = { ...view, nations };
    const capTile = new Map();
    const capOf = (id) => {
      if (!capTile.has(id)) capTile.set(id, s.regions?.[getCapital(s, id)]?.tile ?? null);
      return capTile.get(id);
    };
    fresh.forEach((w) => {
      const a = capOf(w.aggressor); const b = capOf(w.enemy);
      if (a == null && b == null) return;
      Object.entries(nations).forEach(([id, n]) => {
        if (!n || n.isEliminated || id === w.aggressor || id === w.enemy) return;
        const t = capOf(id);
        if (t == null) return;
        const km = Math.min(a != null ? tileKm(tiles, t, a) : Infinity, b != null ? tileKm(tiles, t, b) : Infinity);
        const k = heatKernel(km);
        if (k > 0) heat.set(id, (heat.get(id) || 0) + HEAT_ALPHA * k);
      });
    });
  }
  Object.keys(nations).forEach((id) => { if (nations[id]?.warHeat || heat.has(id)) set(id, heat.get(id) || 0); });
  return next;
};
