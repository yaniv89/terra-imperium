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
// Mouse:  left click = select/tap · left drag = box select · left drag from a selected squad =
//         formation line · right click = order · right/middle drag = pan · wheel = zoom
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
    start = { ...p, t: e.timeStamp, button: e.button, touch: e.pointerType === 'touch' };
    last = p;
    const onSelected = h.isOnSelectedSquad?.(p);
    if (!start.touch) {
      mode = e.button === 2 || e.button === 1 ? 'mouse-right' : onSelected ? 'press-selected' : 'mouse-left';
      return;
    }
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
    if (!moved && ['press', 'press-selected', 'lasso-armed', 'mouse-left', 'mouse-right'].includes(mode)) return;
    clearLong();
    if (mode === 'press') mode = 'pan';
    else if (mode === 'press-selected') mode = 'formation';
    else if (mode === 'lasso-armed' || mode === 'mouse-left') mode = 'lasso';
    else if (mode === 'mouse-right') mode = 'pan';
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
    if ((mode === 'press' || mode === 'press-selected' || mode === 'lasso-armed') && quick) { h.tap?.(p); lastTapAt = e.timeStamp; }
    else if (mode === 'mouse-left' || (mode === 'press-selected' && !start.touch)) h.tap?.(p);
    else if (mode === 'mouse-right') h.order?.(p);
    else if (mode === 'formation') h.formationEnd?.(start, p);
    else if (mode === 'lasso') { h.lassoEnd?.(start, p); if (fromSelectMode) h.selectModeDone?.(); }
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
