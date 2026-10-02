// src/data/regionCoordinates.js
// Real-world lat/lng of each city (plus a rough on-screen size, `extent`): the globe's effects
// overlay and camera flights read it. On the tile world it is a view over the registry
// (src/engine/world/registry.js), rebuilt from game state whenever the cities change.
import { WORLD_REGISTRY } from '../engine/world/registry';

export const REGION_COORDINATES = WORLD_REGISTRY.coordinates;
