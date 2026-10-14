// src/battle/input/squadPick.js
// Which squad a tap is on (playtest audit CB20: I218 "soldiers too tiny to select on a phone", X30
// crews at people's scale). Soldiers stay at true human scale; the tap area grows instead:
// - the hit circle is centred on the block as drawn (it runs back from the squad's point, so a tap
//   on its rear ranks used to miss) and is at least as wide as the drawn block;
// - it never shrinks below SQUAD_PICK_PX on screen (a 44 px finger target at any zoom);
// - enemies get ENEMY_PICK_MULT more reach (an attack tap in a melee must not miss the foe).
// Combat hitboxes are untouched: this is input only. Pure, so it is tested without a renderer.

const Q = 256;
/** Smallest pick radius on screen, css px (a 44 px target across). */
export const SQUAD_PICK_PX = 22;
/** Smallest pick radius on the ground, tiles (near zoom). */
export const SQUAD_PICK_TILES = 1.1;
export const ENEMY_PICK_MULT = 1.45;

/**
 * The circle a squad is picked by, in tiles: { cx, cz, r } from its drawn block (`memo`: the
 * renderer's soldierMemo row, { x, z, fx, fz, n, cols, rowGap, spacing, ring }) or its point.
 */
export const squadPickCircle = (s, memo, minR) => {
  if (!memo) return { cx: s.x / Q, cz: s.y / Q, r: minR };
  const rows = Math.max(1, Math.ceil((memo.n || 1) / Math.max(1, memo.cols || 1)));
  const half = ((rows - 1) * (memo.rowGap ?? memo.spacing ?? 0)) / 2;
  const width = ((Math.min(memo.n || 1, memo.cols || 1) - 1) * (memo.spacing || 0)) / 2;
  const blockR = Math.hypot(half, width) + 0.4;
  return { cx: memo.x - memo.fx * half, cz: memo.z - memo.fz * half, r: Math.max(minR, blockR, memo.ring || 0) };
};

/**
 * The squad under ground point `g` ({ x, z } tiles), or null: { kind: 'squad', idx, side }.
 * `memoOf(idx)` gives the drawn block (or undefined), `wpp` world tiles per css pixel.
 * Distances are compared relative to each circle (d / r), so a big block and a small one nearby
 * are judged fairly; with `enemyFirst` a visible foe in reach wins over an own squad.
 */
export const pickSquadAt = (g, view, { memoOf = () => undefined, wpp = 0, radiusTiles = SQUAD_PICK_TILES, enemyFirst = false, ignoreOwn = false } = {}) => {
  if (!g) return null;
  const minR = Math.max(radiusTiles, SQUAD_PICK_PX * wpp);
  let own = null; let ownS = 1;
  let foe = null; let foeS = 1;
  (view?.squads || []).forEach((s) => {
    if (!s.alive || !s.onField || s.fled || s.inside >= 0) return;
    const mine = s.side === view.playerSide;
    if (mine && ignoreOwn) return;
    if (!mine && s.visible === false) return;
    const c = squadPickCircle(s, memoOf(s.idx), minR);
    const r = mine ? c.r : c.r * ENEMY_PICK_MULT;
    const score = ((c.cx - g.x) ** 2 + (c.cz - g.z) ** 2) / (r * r);
    if (score >= 1) return;
    if (mine) { if (score < ownS) { ownS = score; own = { kind: 'squad', idx: s.idx, side: s.side }; } } else if (score < foeS) { foeS = score; foe = { kind: 'squad', idx: s.idx, side: s.side }; }
  });
  if (foe && (enemyFirst || !own || foeS < ownS)) return foe;
  return own;
};
