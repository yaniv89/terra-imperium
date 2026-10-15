// src/components/battle/pendingPins.js
// RTS-03: a small pin over every order given while paused (the renderer's pendingMarks), plain DOM
// over the canvas and moved by the render loop like the site labels (siteLabels.js), so the spot
// shows even inside a wood, where the ground ring hides under the trees. Gone once the sim takes
// the order (the renderer drops the mark).

/** The pins to draw: [{ x, z, color }] in tiles (a battle line has one at each end). Pure. */
export const pinsFor = (marks = []) => {
  const out = [];
  marks.forEach((m) => {
    if (m.ringless) return; // an attack on a squad: its own ring follows the target
    out.push({ x: m.x, z: m.z, color: m.color });
    if (m.x2 != null) out.push({ x: m.x2, z: m.z2, color: m.color });
  });
  return out;
};

/** Place this frame's pins in `box` (a pool of divs, the extras hidden). */
export const updatePendingPins = (box, renderer) => {
  if (!box || !renderer) return;
  const pins = pinsFor(renderer.pendingMarks);
  while (box.children.length < pins.length) {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'battle-pending-pin');
    el.className = 'absolute left-0 top-0 w-4 h-4 rounded-full border-[3px] bg-fa-ink/60 shadow-[0_0_0_2px_rgba(0,0,0,0.55)] pointer-events-none';
    box.appendChild(el);
  }
  for (let k = 0; k < box.children.length; k++) {
    const el = box.children[k]; const p = pins[k];
    if (!p) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    const sp = renderer.worldToScreen(p.x, p.z, 0.3);
    el.style.display = 'block';
    el.style.borderColor = p.color;
    el.style.transform = `translate(${Math.round(sp.x)}px, ${Math.round(sp.y)}px) translate(-50%, -50%)`;
  }
};
