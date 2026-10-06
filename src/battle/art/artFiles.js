// src/battle/art/artFiles.js
// The art the build found in the asset folders of plans/ART-MODELS-PLAN.md Wave 0 (each folder's
// README.md lists its file and object names). Drop a file in and the next build picks it up; no
// file, and every caller keeps its placeholder. Units (src/assets/units/) are read by
// battle/render/unitModels.js, effect sheets by fxSheets.js, ground materials by
// data/groundMaterials.js; this index covers the model files:
//   src/assets/battle/rts/rts-<age>.glb                   battle buildings (economyLayer.js)
//   src/assets/battle/city/walls-<age>.glb, ruins-<age>.glb, fort-<age>.glb,
//     <age>[-<theme>]-houses-damage.glb                    city destruction (cityLayer.js, townDamage.js)
//   src/assets/battle/nature/<node>.glb, vegetation-<kit>.glb   nodes, herds, trees (economyLayer.js, BattleRenderer.js)
//   src/assets/battle/terrain/river-kit.glb, ford.glb, bridge-<material>.glb   (battleTerrain.js)
//   src/assets/battle/projectiles/<age>.glb               (projectiles.js)
//   src/assets/units/signature/<peopleId>.glb             (unitModels.js, data/signatureUnits.js)
//   src/assets/map/terrain/<kit>.glb                      (closeView/terrainKits.js)
import { createArtIndex } from './artIndex';

const BATTLE = import.meta.glob('../../assets/battle/*/*.glb', { query: '?url', import: 'default', eager: true });
const SIGNATURE = import.meta.glob('../../assets/units/signature/*.glb', { query: '?url', import: 'default', eager: true });
const MAP_TERRAIN = import.meta.glob('../../assets/map/terrain/*.glb', { query: '?url', import: 'default', eager: true });

/** The game's art index (artIndex.js resolvers over every file found). */
export const ART = createArtIndex({ ...BATTLE, ...SIGNATURE, ...MAP_TERRAIN });
