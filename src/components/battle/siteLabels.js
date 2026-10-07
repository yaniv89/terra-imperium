// src/components/battle/siteLabels.js
// "Building 43%" over every one of the player's building sites, on the field, always (not only when
// selected; plans/UI-DESIGN.md section 10): plain DOM chips over the canvas, moved every frame by the
// render loop (TacticalBattleScreen.jsx) so they stay on their site while the camera pans. The brass
// bar under each chip is the renderer's (economyLayer.js bars, BattleRenderer drawStructures).
import { Q } from '../../battle/sim/constants';

/** The sites to label: the player's unfinished, standing buildings. Pure. */
export const sitesToLabel = (view, playerSide) => (view?.eco?.buildings || [])
  .filter((b) => b.side === playerSide && b.alive && !b.built && !b.proxy)
  .map((b) => ({ idx: b.idx, x: b.x / Q, z: b.y / Q, lift: 2.6 + b.size * 0.35, text: `Building ${b.progress}%` }));

/** Place (and add or drop) the chips in `box` for this frame. */
export const updateSiteLabels = (box, renderer, view, playerSide) => {
  if (!box || !renderer) return;
  const sites = sitesToLabel(view, playerSide);
  const keep = new Set();
  sites.forEach((s) => {
    const key = String(s.idx);
    keep.add(key);
    let el = box.querySelector(`[data-site="${key}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.site = key;
      el.setAttribute('data-testid', 'battle-site-label');
      el.className = 'absolute left-0 top-0 px-1.5 py-px rounded-md bg-fa-ink/85 border border-fa-brass/70 text-fa-brass text-[10.5px] font-bold fa-num whitespace-nowrap pointer-events-none';
      box.appendChild(el);
    }
    const p = renderer.worldToScreen(s.x, s.z, s.lift);
    if (el.textContent !== s.text) el.textContent = s.text;
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  });
  [...box.children].forEach((el) => { if (!keep.has(el.dataset.site)) el.remove(); });
};
