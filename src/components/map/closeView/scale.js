// src/components/map/closeView/scale.js
// The close view's sizes, shared with the banner overlay (kept free of three.js so the overlay
// does not pull the 3D engine into the main bundle).
// Pixels per model unit at zoom k.
export const unitPx = (k) => Math.max(2, k * 0.55);
// Where an army's soldiers stand, in model units from the province centre (screen x, screen y).
export const ARMY_SPOT = { x: 2.4, y: 1.6 };
