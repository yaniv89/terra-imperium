// src/battle/art/vegetation.js
// Which of the seven vegetation kits (plans/ART-MODELS-PLAN.md D9, src/assets/battle/nature/
// vegetation-<kit>.glb) a battle grows: from the fought-over tile's Koppen climate when the tile
// world is loaded, else from the battle's terrain. `setup.vegetation` overrides both (a sandbox
// or a scripted battle). The index's kit chain (artIndex.js) covers a kit with no file yet.
import { getTiles, tilesLoaded } from '../../data/geo/tiles';

/** The kit for a Koppen climate code ('Cfb', 'BWh' ...), or null. */
export const kitForClimate = (code) => {
  if (!code) return null;
  if (code[0] === 'A') return 'tropical';
  if (code.startsWith('BW')) return 'desert';
  if (code.startsWith('BS')) return 'steppe';
  if (code.startsWith('Cs')) return 'mediterranean';
  if (code[0] === 'C') return 'temperate';
  if (code[0] === 'D') return /^D.[cd]$/.test(code) ? 'conifer' : 'temperate';
  if (code[0] === 'E') return 'cold';
  return null;
};

const BY_TERRAIN = { arctic: 'cold', desert: 'desert', island: 'tropical', mountains: 'conifer', forest: 'temperate', hills: 'temperate', plains: 'temperate', mixed: 'temperate', urban: 'temperate' };
/** The kit for a battle terrain ('plains', 'desert' ...). */
export const kitForTerrain = (terrain) => BY_TERRAIN[terrain] || 'temperate';

/** A vegetation kit's stump objects in variant order (build_nature.py stump_variants; a felled tree
 *  picks one by its tile: render/treeFelling.js stumpVariant). A kit without the later ones uses `stump`. */
export const STUMP_NAMES = ['stump', 'stump-2', 'stump-3'];

// W12 berry bushes (berry-bushes.glb): the temperate bramble is the plain `full`, `half`, `depleted`;
// the other bands are `<state>-<band>`.
const BERRY_BANDS = { mediterranean: 'dry', desert: 'dry', steppe: 'dry', cold: 'cold', conifer: 'cold', tropical: 'tropical' };
/** The berry bush band for a vegetation kit: 'dry', 'cold', 'tropical', or '' (temperate). */
export const berryBand = (kit) => BERRY_BANDS[kit] || '';
/** A berry node's object names by its state names (economyLayer.js nodeStateNames), its band's first. */
export const berryNames = (states, band) => (band ? states.flatMap((s) => [`${s}-${band}`, s]) : states);

/** The battle's vegetation kit id. */
export const vegetationKitFor = (setup, tiles = tilesLoaded() ? getTiles() : null) => {
  if (setup?.vegetation) return setup.vegetation;
  const t = setup?.tile;
  if (tiles && t != null && t >= 0 && tiles.climate && tiles.climate[t] >= 0) {
    const kit = kitForClimate(tiles.climateNames[tiles.climate[t]]);
    if (kit) return kit;
  }
  return kitForTerrain(setup?.terrain);
};
