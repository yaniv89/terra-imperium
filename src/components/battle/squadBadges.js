// src/components/battle/squadBadges.js
// Playtest 6: at the default and wider zooms a soldier is a few pixels tall, and a squad standing in
// a wood or among houses is hidden under the canopy or the roofs. A small flag over every squad then
// says whose it is, how much of it is left, and (a bright rim) that it is swinging. The models keep
// their world size at every zoom; only these flags are screen sized. Plain DOM over the canvas, moved
// by the render loop like the pending pins (pendingPins.js).
import { TILE } from '../../battle/setup/mapgen';

/** Flags show at this camera zoom and wider (1 is the default view); closer in the soldiers read alone. */
export const BADGE_MAX_ZOOM = 1;
const COVER = new Set([TILE.FOREST, TILE.BUILDING]);
const YOU = '#60a5fa'; const ENEMY = '#f87171';

/** The flags to draw: [{ x, z, side, share, striking, selected }] in tiles. Pure. */
export const badgesFor = (prev, cur, alpha, { zoom, playerSide, map, selected }) => {
  if (!cur) return [];
  const wide = zoom <= BADGE_MAX_ZOOM;
  const out = [];
  cur.squads.forEach((q) => {
    if (!q.alive || !q.onField || q.fled || q.classId === 'worker' || (q.side !== playerSide && q.visible === false)) return;
    const p = prev?.squads?.[q.idx];
    const useP = p && p.alive && p.onField;
    const x = (useP ? p.x + (q.x - p.x) * alpha : q.x) / 256; const z = (useP ? p.y + (q.y - p.y) * alpha : q.y) / 256;
    const under = map && COVER.has(map.tiles?.[Math.floor(z) * map.w + Math.floor(x)]);
    if (!wide && !under) return;
    out.push({ x, z, side: q.side === playerSide ? 'you' : 'them', share: Math.max(0, Math.min(1, q.strength / Math.max(1, q.maxStrength))), striking: !!q.striking, selected: !!selected?.has(q.idx) });
  });
  return out;
};

const build = () => {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'battle-squad-badge');
  el.style.cssText = 'position:absolute;left:0;top:0;width:26px;height:9px;border-radius:5px;background:rgba(15,23,32,.85);padding:1.5px;box-sizing:border-box;border:1.5px solid;pointer-events:none';
  el.appendChild(document.createElement('div')).style.cssText = 'height:100%;border-radius:3px';
  return el;
};

/** Place this frame's flags in `box` (a pool of divs, the extras hidden). */
export const updateSquadBadges = (box, renderer, list) => {
  if (!box || !renderer) return;
  while (box.children.length < list.length) box.appendChild(build());
  for (let k = 0; k < box.children.length; k++) {
    const el = box.children[k]; const b = list[k];
    if (!b) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    const sp = renderer.worldToScreen(b.x, b.z, 1.6);
    const c = b.side === 'you' ? YOU : ENEMY;
    el.style.display = 'block';
    el.style.borderColor = b.striking ? '#fbbf24' : c;
    el.style.boxShadow = b.selected ? '0 0 0 2px #fff' : b.striking ? '0 0 6px 1px #fbbf24' : '0 0 0 1px rgba(0,0,0,.5)';
    el.firstChild.style.width = `${Math.round(b.share * 100)}%`;
    el.firstChild.style.background = c;
    el.style.transform = `translate(${Math.round(sp.x)}px, ${Math.round(sp.y)}px) translate(-50%, -100%)`;
  }
};
