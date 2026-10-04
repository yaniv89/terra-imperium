// src/components/map/closeView/wonderAssets.js
// Wonder models in the close view (plans/art-image-spec.md section 5): a wonder stands on its own
// tile beside the city that built it (wonders.js), and grows through three tiers. A file
// src/assets/map/wonders/<projectId>.glb holds three objects `tier1`, `tier2`, `tier3` at one
// origin, each with LOD0..LOD2 children (blender-delivery-spec 3.8: up to 120 m, 12 units, across).
// The close view shows the object of the built tier (the highest one the file has at or below
// it), at the towns' scale (scale.js townUnitPx: capped by the coast and by the next town), with
// Team tinted in the owner's colour, and never on a water tile. A wonder without a file shows
// nothing here; its banner and the flat map's star stay. Kept free of three.js.
import { getGreatProjectOwner } from '../../../data/greatProjects';

// { '../../../assets/map/wonders/masada.glb': '/terra-imperium/assets/masada-abc123.glb' }
const FILES = import.meta.glob('../../../assets/map/wonders/*.glb', { query: '?url', import: 'default', eager: true });
const BY_ID = {};
Object.entries(FILES).forEach(([path, url]) => {
  const m = path.match(/\/([a-z0-9_]+)\.glb$/);
  if (m) BY_ID[m[1]] = url;
});

/** The model file of a wonder, or null. `files` overrides the bundled set (tests). */
export const wonderAssetUrl = (projectId, files = BY_ID) => files[projectId] || null;

// The radius (model units) a wonder claims when its file does not say: 120 m across.
export const WONDER_RADIUS = 6;

/** The object of a file to show for a built tier: `tier<n>`, else the highest tier below it. */
export const wonderTierObject = (objects, tier) => {
  if (!objects) return null;
  for (let t = Math.min(3, Math.max(1, tier || 1)); t >= 1; t--) if (objects[`tier${t}`]) return objects[`tier${t}`];
  return null;
};

/**
 * The wonders standing on the map: [{ projectId, tile, tier, ownerId }], one per built wonder
 * whose tile still carries it (world.tileState[tile].wonder) and lies on land. Sorted by tile.
 */
export const wonderPlacements = (state, tiles) => {
  const tileState = state.world?.tileState || {};
  return Object.entries(state.greatProjects || {})
    .filter(([projectId, e]) => e?.tier && e.tile != null && tileState[e.tile]?.wonder === projectId && tiles.land[e.tile] === 1)
    .map(([projectId, e]) => ({ projectId, tile: e.tile, tier: e.tier, ownerId: getGreatProjectOwner(state, projectId) }))
    .sort((a, b) => a.tile - b.tile);
};
