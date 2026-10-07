// src/battle/input/gestures.js
// Pointer-event gesture recognizer for the battlefield (Tactical Battles plan §11). Touch and mouse
// get different, conventional mappings; a gesture is decided by the first ~10 px / 350 ms and can
// never turn into a different one mid-way — so panning can't accidentally open a menu (Company of
// Heroes mobile's main complaint).
//
// Touch:  tap · one-finger drag = pan · drag starting on a selected squad = formation line ·
//         double-tap then drag = lasso select · long-press = context (ground: attack-move;
//         selected squad: radial) · two fingers = pinch-zoom + pan
//         Select mode (the HUD's Select button, `h.isSelectMode()`): a one-finger drag draws the
//         lasso instead of panning; a completed lasso calls `h.selectModeDone()` (the HUD turns
//         the mode off). Two fingers still pinch and pan.
//         Placing a building (`h.isPlacing()`, B10): one finger drags the ghost (`h.placeDrag`), the
//         lift ends it (`h.placeEnd(p, { moved, onGhost, quick })`: a still tap on the ghost builds).
// Mouse:  left click = select (`h.click`, shift adds; empty ground deselects) · left drag = box
//         select (shift adds) · right click = order (`h.order`) · right drag = formation line while
//         something is selected (`h.hasSelection`), else pan · middle drag = pan · wheel = zoom.
//         The browser's context menu never opens on the battlefield.
export const TAP_MS = 260;
export const LONG_MS = 380;
export const MOVE_PX = 10;
export const DOUBLE_TAP_MS = 300;

export const createGestureRecognizer = (el, h) => {
  const pointers = new Map();
  let mode = 'idle';
  let start = null;
  let last = null;
  let longTimer = null;
  let lastTapAt = -1000;
  let pinch = null;
  let fromSelectMode = false; // this lasso was drawn in select mode (not a double-tap)

  const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const clearLong = () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } };

  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };

  const down = (e) => {
    el.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      clearLong();
      if (mode === 'formation' || mode === 'lasso') h.cancel?.();
      mode = 'pinch'; pinch = pinchState();
      return;
    }
    if (pointers.size > 2) return;
    start = { ...p, t: e.timeStamp, button: e.button, touch: e.pointerType === 'touch', shift: !!e.shiftKey };
    last = p;
    if (!start.touch) {
      mode = e.button === 2 ? 'mouse-right' : e.button === 1 ? 'mouse-pan' : 'mouse-left';
      return;
    }
    // Placing a building (B10): one finger moves the ghost; a tap on the ghost builds it.
    if (h.isPlacing?.()) {
      mode = 'place';
      start.onGhost = !!h.isOnGhost?.(p);
      if (!start.onGhost) h.placeDrag?.(p);
      return;
    }
    const onSelected = h.isOnSelectedSquad?.(p);
    fromSelectMode = !!h.isSelectMode?.();
    mode = fromSelectMode || e.timeStamp - lastTapAt < DOUBLE_TAP_MS ? 'lasso-armed' : onSelected ? 'press-selected' : 'press';
    longTimer = setTimeout(() => {
      longTimer = null;
      if (mode === 'press-selected') { mode = 'radial'; h.radial?.(start); }
      else if (mode === 'press') { mode = 'done'; h.longPress?.(start); }
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
    if (!moved && ['press', 'press-selected', 'lasso-armed', 'mouse-left', 'mouse-right', 'mouse-pan'].includes(mode)) return;
    clearLong();
    if (mode === 'press' || mode === 'mouse-pan') mode = 'pan';
    else if (mode === 'press-selected') mode = 'formation';
    else if (mode === 'lasso-armed' || mode === 'mouse-left') mode = 'lasso';
    else if (mode === 'mouse-right') mode = h.hasSelection?.() ? 'formation' : 'pan';
    if (mode === 'pan') h.pan?.(p.x - last.x, p.y - last.y);
    else if (mode === 'formation') h.formationDrag?.(start, p);
    else if (mode === 'lasso') h.lassoDrag?.(start, p);
    else if (mode === 'radial') h.radialHover?.(p);
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
    else if ((mode === 'press' || mode === 'press-selected' || mode === 'lasso-armed') && quick) { h.tap?.(p); lastTapAt = e.timeStamp; }
    else if (mode === 'mouse-left') (h.click || h.tap)?.(p, { shift: start.shift });
    else if (mode === 'mouse-right') h.order?.(p);
    else if (mode === 'formation') h.formationEnd?.(start, p);
    else if (mode === 'lasso') { h.lassoEnd?.(start, p, { shift: start.shift }); if (fromSelectMode && start.touch) h.selectModeDone?.(); }
    else if (mode === 'radial') h.radialSelect?.(p);
    mode = 'idle'; start = null;
  };

  const cancel = (e) => { pointers.delete(e.pointerId); clearLong(); if (mode === 'formation' || mode === 'lasso') h.cancel?.(); mode = 'idle'; start = null; };
  const wheel = (e) => { e.preventDefault(); const p = pos(e); h.zoom?.(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); };
  const context = (e) => e.preventDefault();

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('contextmenu', context);
  return () => {
    clearLong();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('wheel', wheel);
    el.removeEventListener('contextmenu', context);
  };
};
