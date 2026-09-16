// src/data/combatWidth.js
// Combat width (plan §7's "Deployment" phase): the battlefield's terrain caps how many units can
// actually fight at once, regardless of how many are stacked in the region — a 40-unit doomstack
// in a mountain pass still only fights a handful at a time, which is what stops stack-spam from
// being the only strategy. Every region currently reports terrain: 'mixed' (real terrain diversity
// — mountains, deserts, etc. — is a later geo-data task), so this table already does its real job,
// capping stack size, even before the data differentiates by biome.
export const COMBAT_WIDTH_BY_TERRAIN = {
  plains: 6,
  mixed: 5,
  desert: 5,
  urban: 4,
  forest: 4,
  island: 4,
  hills: 4,
  mountains: 3,
  arctic: 3
};

const DEFAULT_COMBAT_WIDTH = 4;

export const getCombatWidth = (terrain) => COMBAT_WIDTH_BY_TERRAIN[terrain] ?? DEFAULT_COMBAT_WIDTH;
