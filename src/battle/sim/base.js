// src/battle/sim/base.js
// A side's base (playtest audit CB18; the user's rulings Q3 and Q4, plans/playtest-audits-conflicts.md
// section 9). In every battle with a base (a battle economy: field battles, assaults, sallies and
// landings; not raids, sacks or sea battles) a side loses only when its base buildings are gone,
// never because its soldiers died while buildings stand (step.js checkEnd).
//
// What the base is:
//   the attacker   its expedition camp, plus the economy and military buildings its workers finished
//   the defender   the keep (its town hall or camp), the city's own economy and military buildings
//                  (the region's built categories, the siege camp and engines of a sally), plus the
//                  economy and military buildings its workers finished
// What it is not: houses, landmarks, palaces and wonders, walls, gates and towers (fortifications),
// loot targets, and unfinished sites. A destroyed building stops counting at once (it stays drawn
// as a wreck: render/economyLayer.js). Taking the keep alone therefore does not win a city.
import { BUILDINGS } from '../data/economy';
import { SIDE_DEFENDER } from './constants';

/** Economy catalog buildings that never count as base: housing and fortifications. */
export const NOT_BASE = new Set(['house', 'tower']);
export const isBaseType = (type) => !!BUILDINGS[type] && !NOT_BASE.has(type);

/** Does this battle have bases (and so the base rule)? */
export const hasBase = (w) => !!w.eco;

/** Is economy building `b` a standing base building (finished, not a house or a tower)? The
 * defender's proxy town hall is the keep: it is counted as the structure, not here. */
export const isBaseEco = (b) => b.alive && b.built && b.proxy == null && isBaseType(b.type);
/** Is battlefield structure `s` (index `i`) a standing base building of the defender? */
export const isBaseStructure = (s, i) => s.alive && !s.loot && !s.passive && (i === 0 ? s.kind === 'keep' : s.kind === 'building');

/**
 * The standing base buildings of `side`: [{ kind: 'eco' | 'structure', index, x, y, hq }].
 * `kind` and `index` are an attack order's target (orders.js).
 */
export const baseBuildings = (w, side) => {
  const out = [];
  if (!hasBase(w)) return out;
  if (side === SIDE_DEFENDER) w.structures.forEach((s, i) => { if (isBaseStructure(s, i)) out.push({ kind: 'structure', index: i, x: s.x, y: s.y, hq: i === 0 }); });
  w.eco.buildings.forEach((b, i) => { if (b.side === side && isBaseEco(b)) out.push({ kind: 'eco', index: i, x: b.x, y: b.y, hq: !!BUILDINGS[b.type].hq }); });
  return out;
};

/** How many base buildings `side` still has standing. */
export const baseCount = (w, side) => {
  if (!hasBase(w)) return 0;
  let n = 0;
  if (side === SIDE_DEFENDER) for (let i = 0; i < w.structures.length; i++) if (isBaseStructure(w.structures[i], i)) n += 1;
  for (let i = 0; i < w.eco.buildings.length; i++) { const b = w.eco.buildings[i]; if (b.side === side && isBaseEco(b)) n += 1; }
  return n;
};

/** Has `side` lost its base (a battle without bases never has)? */
export const baseGone = (w, side) => hasBase(w) && baseCount(w, side) === 0;
