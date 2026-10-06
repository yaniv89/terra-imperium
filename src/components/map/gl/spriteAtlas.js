// src/components/map/gl/spriteAtlas.js
// One canvas texture holding every badge, banner, marker, glyph and label the WebGL map draws
// (plans/rts-world-review.md 6.5: "instanced sprites with a text atlas"). Each picture is drawn
// once with the 2D canvas, keyed by what it shows, into a shelf of the atlas; the sprite layer
// draws all of them in one instanced call. When the atlas is full it starts over with the
// pictures the current frame needs (the map asks again on its next rebuild).
// Pure layout logic (packShelf) is separate from the canvas so it can be tested without a DOM.
export const ATLAS_SIZE = 2048;
const PAD = 2;

/** Shelf packing: where a w x h box goes, or null when the atlas is full. Mutates `state`. */
export const packShelf = (state, w, h, size = ATLAS_SIZE) => {
  const bw = Math.ceil(w) + PAD; const bh = Math.ceil(h) + PAD;
  if (bw > size || bh > size) return null;
  // the first shelf tall enough (but not wastefully so) with room left
  let shelf = state.shelves.find((s) => s.h >= bh && s.h <= bh * 2 + 4 && s.x + bw <= size);
  if (!shelf) {
    if (state.top + bh > size) return null;
    shelf = { y: state.top, h: bh, x: 0 };
    state.shelves.push(shelf);
    state.top += bh;
  }
  const at = { x: shelf.x, y: shelf.y };
  shelf.x += bw;
  return at;
};

/**
 * The atlas: `get(art)` returns the entry { u0, v0, u1, v1, w, h } for an art descriptor
 * { key, w, h, draw(ctx) } (w, h in device pixels; draw paints into [0, w] x [0, h]), drawing it
 * the first time. `version` bumps whenever the canvas changed (the layer re-uploads it).
 */
export const createAtlas = (size = ATLAS_SIZE) => {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const atlas = { canvas, size, version: 0, entries: new Map(), pack: { shelves: [], top: 0 }, full: false };
  const place = (art) => {
    const at = packShelf(atlas.pack, art.w, art.h, size);
    if (!at) return null;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.beginPath(); ctx.rect(0, 0, Math.ceil(art.w), Math.ceil(art.h)); ctx.clip();
    try { art.draw(ctx); } catch (e) { console.warn('map sprite failed to draw:', art.key, e.message); }
    ctx.restore();
    const e = { x: at.x, y: at.y, w: art.w, h: art.h, u0: at.x / size, v0: at.y / size, u1: (at.x + art.w) / size, v1: (at.y + art.h) / size, pending: !!art.pending };
    atlas.entries.set(art.key, e);
    atlas.version += 1;
    return e;
  };
  atlas.get = (art) => {
    const hit = atlas.entries.get(art.key);
    if (hit) return hit;
    const e = place(art);
    if (!e) atlas.full = true;
    return e;
  };
  /** Start over (the map then asks for what it needs again). */
  atlas.reset = () => {
    ctx.clearRect(0, 0, size, size);
    atlas.entries.clear();
    atlas.pack = { shelves: [], top: 0 };
    atlas.full = false;
    atlas.version += 1;
  };
  /** Forget the pictures drawn while one of their images was still loading. */
  atlas.dropPending = () => {
    let any = false;
    atlas.entries.forEach((e, key) => { if (e.pending) { atlas.entries.delete(key); any = true; } });
    return any;
  };
  return atlas;
};
