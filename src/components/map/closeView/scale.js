// src/components/map/closeView/scale.js
// The close view's sizes, shared with the banner overlay (kept free of three.js so the overlay
// does not pull the 3D engine into the main bundle).
// Pixels per model unit at zoom k.
// Linear up to the super zoom, then slower (power SUPER_GROWTH), so in the super zoom a town
// stays inside its hex and the land around it shows (plans/playtest-1.md P1.1).
export const SUPER_FROM_K = 40;
export const SUPER_GROWTH = 0.7;
export const unitPx = (k) => (k <= SUPER_FROM_K ? Math.max(2, k * 0.55) : SUPER_FROM_K * 0.55 * (k / SUPER_FROM_K) ** SUPER_GROWTH);
// Where an army's soldiers stand, in model units from the province centre (screen x, screen y).
export const ARMY_SPOT = { x: 2.4, y: 1.6 };
// How far the models lean toward the viewer (radians about the screen x axis): the three-quarter
// look of the close view, lower still in the super zoom (plans/playtest-1.md P1.1), from k 40 to 200.
export const TILT_CLOSE = 0.95;
export const TILT_SUPER = 1.2;
export const tiltFor = (k) => {
  const t = Math.max(0, Math.min(1, Math.log(Math.max(1, k) / SUPER_FROM_K) / Math.log(5)));
  return TILT_CLOSE + (TILT_SUPER - TILT_CLOSE) * t;
};
