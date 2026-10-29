// src/components/battle/autoCamera.js
// The camera's own moves (battle-art-8, camera grade): until the player moves the camera by hand it
// goes to the first clash of the battle; after that it keeps the selected squads in view, easing
// only once they walk out of the screen's middle (a squad just tapped never moves the view, I188).
// An explicit follow (F, I199) still wins; a hand on the camera holds every auto move for HAND_HOLD_MS.

export const HAND_HOLD_MS = 3000;
export const KEEP_IN = 0.3; // the selection may drift this share of the screen from its middle
const CLASH_RECENT = 20; // ticks: squads hit this recently are the clash

/**
 * Where the camera should ease to this frame, in tiles ({ x, z }), or null to stay.
 * cur: the view (squads with x, y Q8, alive, onField, fled, side, lastHitTick, visible), tick.
 * state: { clash: 'wait' | 'going' | 'done', handAt } (mutated: the clash is gone to once).
 * toScreen(x, z) -> { x, y } css px; width, height: the screen.
 */
export const autoCameraGoal = ({ cur, selected, playerSide, state, now, toScreen, width, height }) => {
  if (!cur) return null;
  if (state.handAt && now - state.handAt < HAND_HOLD_MS) return null;
  const mean = (list) => ({ x: list.reduce((s, q) => s + q.x, 0) / list.length / 256, z: list.reduce((s, q) => s + q.y, 0) / list.length / 256 });
  const live = (q) => q?.alive && q.onField && !q.fled;
  if (state.clash !== 'done' && !state.handAt) {
    const hit = cur.squads.filter((q) => live(q) && q.lastHitTick >= 0 && cur.tick - q.lastHitTick < CLASH_RECENT && (q.side === playerSide || q.visible !== false));
    if (hit.length) { state.clash = 'going'; state.clashAt = mean(hit); }
    if (state.clash === 'going') return state.clashAt;
  }
  const sel = [...(selected || [])].map((i) => cur.squads[i]).filter(live);
  if (!sel.length) return null;
  const g = mean(sel); const p = toScreen(g.x, g.z);
  if (!p) return null;
  return Math.abs(p.x - width / 2) > width * KEEP_IN || Math.abs(p.y - height / 2) > height * KEEP_IN ? g : null;
};
