// src/battle/input/gestures.js
// Pointer-event gesture recognizer for the battlefield (Tactical Battles plan §11). Touch and mouse
// get different, conventional mappings; a gesture is decided by the first ~10 px / 350 ms and can
// never turn into a different one mid-way — so panning can't accidentally open a menu (Company of
// Heroes mobile's main complaint).
//
// Touch:  tap · one-finger drag = pan (on a selected squad too: playtest 40651418969, an army
//         selected with All covered the screen and every drag drew a line) · hold a selected squad
//         = radial, then drag on = formation line (the radial closes) · double-tap then drag = lasso
//         select · long-press on the ground = attack-move · two fingers = pinch-zoom + pan (a second
//         finger on the HUD around the field still pinches: `pinchFrom`)
//         A lasso that closes on itself (a circle) selects what the loop encloses (`opts.polygon`).
//         Select mode (the HUD's Select button, `h.isSelectMode()`): a one-finger drag draws the
//         lasso instead of panning; a completed lasso calls `h.selectModeDone()` (the HUD turns
//         the mode off). Two fingers still pinch and pan.
//         Path mode (the HUD's Path button, `h.isPathMode()`, U38): a one-finger drag draws a path for the
//         selected squads (`h.pathDrag(points)`, then `h.pathEnd(points)` and `h.pathModeDone()`). Two fingers pan.
//         Placing a building (`h.isPlacing()`, B10): one finger drags the ghost (`h.placeDrag`), the
//         lift ends it (`h.placeEnd(p, { moved, onGhost, quick })`: a still tap on the ghost builds).
// Mouse:  left click = select (`h.click`, shift adds; empty ground deselects) · left drag = box
//         select (shift adds) · right click = order (`h.order`) · right drag = formation line while
//         something is selected (`h.hasSelection`), else pan · middle drag = pan · Space or Alt held
//         + left drag = pan (a laptop trackpad has no middle button) · wheel = zoom.
//         The browser's context menu never opens on the battlefield.
export const TAP_MS = 260;
export const LONG_MS = 380;
export const MOVE_PX = 10;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 40; // a second tap farther away is a new gesture: a drag from it pans
export const RADIAL_DRAG_PX = 24; // a finger held on a selected squad that then travels this far draws a line

/** A lasso stroke that loops back to where it began (a circle) selects what it encloses; an open drag keeps the box. */
export const isClosedStroke = (pts) => {
  if (pts.length < 6) return false;
  const xs = pts.map((q) => q.x); const ys = pts.map((q) => q.y);
  const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
  const a = pts[0]; const b = pts[pts.length - 1];
  return Math.min(w, h) >= 30 && Math.hypot(a.x - b.x, a.y - b.y) <= 0.25 * Math.max(w, h);
};

/** Even-odd point-in-polygon test. */
export const insidePolygon = (pt, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]; const b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

// `memory` carries the last tap across recognizers: the screen rebuilds the recognizer whenever its handlers change (a tap changes the selection), which must not forget the first tap of a double-tap.
// `pinchFrom` (optional): the element around `el` (the battle screen); a second finger landing on it, outside `el`, joins a pinch.
export const createGestureRecognizer = (el, h, memory = { lastTapAt: -1000, lastTapPos: null }, { pinchFrom = null } = {}) => {
  const pointers = new Map();
  let mode = 'idle';
  let start = null;
  let last = null;
  let longTimer = null;
  let pinch = null;
  let fromSelectMode = false; // this lasso was drawn in select mode (not a double-tap)
  let trail = []; // the points of a path being drawn (U38)
  let spaceHeld = false; // Space held: a left drag pans (mouse only)

  const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const clearLong = () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } };

  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };

  const down = (e) => {
    el.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    if (hudTouch && !pointers.size && e.pointerType === 'touch') { pointers.set(hudTouch.id, hudTouch.p); el.setPointerCapture?.(hudTouch.id); }
    hudTouch = null;
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      clearLong();
      if (mode === 'formation' || mode === 'lasso' || mode === 'path') h.cancel?.();
      mode = 'pinch'; pinch = pinchState();
      return;
    }
    if (pointers.size > 2) return;
    start = { ...p, t: e.timeStamp, button: e.button, touch: e.pointerType === 'touch', shift: !!e.shiftKey };
    last = p; trail = [p];
    if (!start.touch) {
      mode = e.button === 2 ? 'mouse-right' : e.button === 1 || spaceHeld || e.altKey ? 'mouse-pan' : 'mouse-left';
      return;
    }
    // Placing a building (B10): one finger moves the ghost; a tap on the ghost builds it.
    if (h.isPlacing?.()) {
      mode = 'place';
      start.onGhost = !!h.isOnGhost?.(p);
      if (!start.onGhost) h.placeDrag?.(p);
      return;
    }
    if (h.isPathMode?.()) { mode = 'path-armed'; trail = [p]; return; }
    // With an order armed (Attack) a press is that order's target, never the radial over it
    // (playtest 40550100958: the radial kept opening between Attack and the tap on the walls).
    const onSelected = !h.isArmed?.() && h.isOnSelectedSquad?.(p);
    fromSelectMode = !!h.isSelectMode?.();
    mode = fromSelectMode || (e.timeStamp - memory.lastTapAt < DOUBLE_TAP_MS && memory.lastTapPos && Math.hypot(p.x - memory.lastTapPos.x, p.y - memory.lastTapPos.y) < DOUBLE_TAP_PX) ? 'lasso-armed' : onSelected ? 'press-selected' : 'press';
    longTimer = setTimeout(() => {
      longTimer = null;
      if (mode === 'press-selected') { mode = 'radial'; h.radial?.(start); }
      else if (mode === 'press' && h.hasSelection?.()) { mode = 'done'; h.longPress?.(start); } // nothing selected: the lift is a tap
    }, LONG_MS);
  };

  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pos(e);
    pointers.set(e.pointerId, p);
    if (mode === 'pinch' && pointers.size >= 2) {
      const next = pinchState();
      h.pan?.(next.cx - pinch.cx, next.cy - pinch.cy);
      h.zoom?.(next.d / pinch.d, next.cx, next.cy);
      pinch = next;
      return;
    }
    if (!start) return;
    const moved = Math.hypot(p.x - start.x, p.y - start.y) >= MOVE_PX;
    if (mode === 'place') { if (moved) start.moved = true; if (start.moved) h.placeDrag?.(p); last = p; return; }
    if (!moved && ['press', 'press-selected', 'lasso-armed', 'path-armed', 'mouse-left', 'mouse-right', 'mouse-pan'].includes(mode)) return;
    clearLong();
    if (mode === 'radial') { if (Math.hypot(p.x - start.x, p.y - start.y) < RADIAL_DRAG_PX) return; h.radialCancel?.(); mode = 'formation'; }
    else if (mode === 'press' || mode === 'press-selected' || mode === 'mouse-pan') mode = 'pan';
    else if (mode === 'lasso-armed' || mode === 'mouse-left') mode = 'lasso';
    else if (mode === 'path-armed') mode = 'path';
    else if (mode === 'mouse-right') mode = h.hasSelection?.() ? 'formation' : 'pan';
    if (mode === 'pan') h.pan?.(p.x - last.x, p.y - last.y);
    else if (mode === 'formation') h.formationDrag?.(start, p);
    else if (mode === 'lasso') { trail.push(p); h.lassoDrag?.(start, p, { polygon: isClosedStroke(trail) ? trail : null }); }
    else if (mode === 'path') { if (Math.hypot(p.x - trail[trail.length - 1].x, p.y - trail[trail.length - 1].y) >= MOVE_PX) trail.push(p); h.pathDrag?.(trail); }
    last = p;
  };

  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pos(e);
    pointers.delete(e.pointerId);
    clearLong();
    if (mode === 'pinch') { if (pointers.size === 0) { mode = 'idle'; start = null; } return; }
    if (!start) return;
    const quick = e.timeStamp - start.t < TAP_MS;
    if (mode === 'place') h.placeEnd?.(p, { moved: !!start.moved, onGhost: !!start.onGhost, quick });
    // A still press is a tap until the long press takes it (playtest 40651418969 step 29: a press of
    // 260 to 380 ms used to be neither, and an armed Attack seemed to ignore the tap). A busy frame
    // can starve the long-press timer: a press held past LONG_MS on the ground is still a long press.
    // With nothing selected a long press has nothing to order, so it selects like a tap (playtest
    // 40736779836: slow taps on a squad in deploy did nothing).
    else if (mode === 'press' && e.timeStamp - start.t >= LONG_MS && h.hasSelection?.()) { mode = 'done'; h.longPress?.(start); }
    else if (mode === 'press-selected' && e.timeStamp - start.t >= LONG_MS) { h.radial?.(start); h.radialSelect?.(p); }
    else if (mode === 'press' || mode === 'press-selected' || mode === 'lasso-armed' || mode === 'path-armed') { h.tap?.(p); memory.lastTapAt = e.timeStamp; memory.lastTapPos = p; }
    else if (mode === 'mouse-left') (h.click || h.tap)?.(p, { shift: start.shift });
    else if (mode === 'mouse-right') h.order?.(p);
    else if (mode === 'formation') h.formationEnd?.(start, p);
    else if (mode === 'lasso') { h.lassoEnd?.(start, p, { shift: start.shift, polygon: isClosedStroke(trail) ? trail : null }); if (fromSelectMode && start.touch) h.selectModeDone?.(); }
    else if (mode === 'path') { h.pathEnd?.([...trail, p]); h.pathModeDone?.(); }
    else if (mode === 'radial') h.radialSelect?.(p);
    mode = 'idle'; start = null;
  };

  const cancel = (e) => { pointers.delete(e.pointerId); clearLong(); if (mode === 'formation' || mode === 'lasso' || mode === 'path') h.cancel?.(); mode = 'idle'; start = null; };
  const wheel = (e) => { e.preventDefault(); const p = pos(e); h.zoom?.(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); };
  const context = (e) => e.preventDefault();
  // Space is a held modifier for panning; a typing field keeps its own Space.
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  const keyDown = (e) => { if (e.code === 'Space' && !typing(e)) { spaceHeld = true; e.preventDefault?.(); } };
  const keyUp = (e) => { if (e.code === 'Space') spaceHeld = false; };
  const blur = () => { spaceHeld = false; };

  // The HUD's panels sit over the field: a pinch whose second finger lands on one still zooms (the first finger is on the field).
  // Either finger may come first: one held on the HUD waits (`hudTouch`) for a finger on the field.
  let hudTouch = null;
  const joinDown = (e) => {
    if (e.pointerType !== 'touch' || e.target === el || pointers.has(e.pointerId)) return;
    if (pointers.size === 1) down(e); else if (!pointers.size) hudTouch = { id: e.pointerId, p: pos(e) };
  };
  const hudMove = (e) => { if (hudTouch?.id === e.pointerId) hudTouch.p = pos(e); };
  const hudUp = (e) => { if (hudTouch?.id === e.pointerId) hudTouch = null; };
  el.addEventListener('pointerdown', down);
  pinchFrom?.addEventListener('pointerdown', joinDown, true);
  pinchFrom?.addEventListener('pointermove', hudMove, true);
  pinchFrom?.addEventListener('pointerup', hudUp, true);
  pinchFrom?.addEventListener('pointercancel', hudUp, true);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('contextmenu', context);
  const win = el.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
  win?.addEventListener('keydown', keyDown);
  win?.addEventListener('keyup', keyUp);
  win?.addEventListener('blur', blur);
  return () => {
    win?.removeEventListener('keydown', keyDown);
    win?.removeEventListener('keyup', keyUp);
    win?.removeEventListener('blur', blur);
    clearLong();
    el.removeEventListener('pointerdown', down);
    pinchFrom?.removeEventListener('pointerdown', joinDown, true);
    pinchFrom?.removeEventListener('pointermove', hudMove, true);
    pinchFrom?.removeEventListener('pointerup', hudUp, true);
    pinchFrom?.removeEventListener('pointercancel', hudUp, true);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('wheel', wheel);
    el.removeEventListener('contextmenu', context);
  };
};
