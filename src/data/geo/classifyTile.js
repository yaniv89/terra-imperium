// src/data/geo/classifyTile.js
// The tile classifier and the resource scatter, shared by the Earth build (scripts/geo/
// build-tiles.mjs, which imports them back) and the world generator (src/worldgen/), so Earth and
// generated worlds follow one rule set (plans/MAP-VARIATIONS-PLAN.md 3.4). Pure and deterministic:
// the only "noise" is a hash of the cell id. Moved here unchanged from build-tiles.mjs, so Earth's
// tiles.json stays byte identical.

export const TERRAIN = ['ocean', 'coast', 'lake', 'grassland', 'plains', 'desert', 'tundra', 'snow'];
export const RELIEF = ['flat', 'hills', 'mountains'];
export const FEATURE = ['none', 'forest', 'jungle', 'marsh', 'oasis', 'floodplain', 'ice', 'reef'];

/** A stable 0..1 hash of (id, salt) for the seeded scatter of forests and so on. */
export const hash01 = (id, salt) => {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/**
 * Terrain, relief and feature of one cell from its facts: land, lat, elevMean, elevMax and rough
 * (metres, from 5 x 5 samples), koppen (class name or null), regionClasses (a Set of Natural Earth
 * feature classes: 'Range/mtn', 'Plateau', 'Foothills', 'Wetlands', 'Delta'), glaciated, lake,
 * riverEdges (the 6-bit mask), coastal, depth. `hash` defaults to hash01 (Earth); a generated
 * world passes one salted by its seed.
 */
export const classify = ({ id, land, lat, elevMean, elevMax, rough, koppen, regionClasses, glaciated, lake, riverEdges, coastal, depth }, hash = hash01) => {
  if (!land) {
    if (lake) return { terrain: 'lake', relief: 'flat', feature: 'none' };
    const terrain = coastal || depth > -200 ? 'coast' : 'ocean';
    return { terrain, relief: 'flat', feature: glaciated ? 'ice' : 'none' };
  }
  if (lake) return { terrain: 'lake', relief: 'flat', feature: 'none' };
  const k = koppen || 'Cfb';
  const group = k[0];
  // Relief from real elevation statistics (plus the named ranges as a tie-break).
  let relief = 'flat';
  const inRange = regionClasses.has('Range/mtn');
  const inPlateau = regionClasses.has('Plateau') || regionClasses.has('Foothills');
  if (glaciated) relief = rough > 550 ? 'mountains' : rough > 250 ? 'hills' : 'flat'; // an ice sheet is high but flat
  else if (elevMean > 2500 || (rough > 500 && elevMean > 700) || (inRange && rough > 300) || elevMax > 4000) relief = 'mountains';
  else if (rough > 220 || (elevMean > 900 && rough > 120) || (inPlateau && rough > 100) || (inRange && rough > 150)) relief = 'hills';
  // Base terrain from climate.
  let terrain;
  if (glaciated || k === 'EF') terrain = 'snow';
  else if (k === 'ET' || (group === 'D' && /[cd]$/.test(k) && lat > 60)) terrain = 'tundra';
  else if (k === 'BWh' || k === 'BWk') terrain = 'desert';
  else if (k === 'BSh' || k === 'BSk') terrain = 'plains';
  else if (group === 'A') terrain = k === 'Aw' || k === 'As' ? 'plains' : 'grassland';
  else if (group === 'C') terrain = /^Cs/.test(k) ? 'plains' : 'grassland';
  else if (group === 'D') terrain = /[ab]$/.test(k) ? 'grassland' : 'plains';
  else terrain = 'plains';
  if (relief === 'mountains' && elevMean > 3500) terrain = terrain === 'desert' ? 'desert' : 'tundra';
  // Features.
  let feature = 'none';
  const r = hash(id, 7);
  if (glaciated && terrain === 'snow') feature = 'ice';
  else if (group === 'A' && terrain === 'grassland' && r < 0.85) feature = 'jungle';
  else if (regionClasses.has('Wetlands') || (regionClasses.has('Delta') && r < 0.6)) feature = 'marsh';
  else if (terrain === 'desert' && riverEdges) feature = 'floodplain';
  else if (terrain === 'desert' && r < 0.04) feature = 'oasis';
  else if (relief !== 'mountains') {
    const forestChance = group === 'D' ? (/[cd]$/.test(k) ? 0.65 : 0.4) : group === 'C' ? (/^Cs/.test(k) ? 0.2 : 0.4) : group === 'A' ? 0.5 : 0.05;
    if (r < forestChance) feature = 'forest';
  }
  return { terrain, relief, feature };
};

/** Weighted pick among [name, weight] options by the hash of `id` (salt 31). */
export const pickWeighted = (id, options, hash = hash01) => {
  let total = 0; options.forEach(([, w]) => { total += w; });
  let r = hash(id, 31) * total;
  for (const [name, w] of options) { r -= w; if (r <= 0) return name; }
  return options[options.length - 1][0];
};

/**
 * The resource scatter (plans/civ-map-rework.md C1) for one cell: a deterministic pick by terrain,
 * relief and feature, or null. Most tiles carry nothing. `t`, `rel`, `feat` are names; `near`:
 * coastal; `land`: a land cell.
 */
export const scatterResource = (id, { land, t, rel, feat, near }, hash = hash01) => {
  if (!land) {
    if (t === 'coast' && hash(id, 11) < 0.18) return hash(id, 12) < 0.8 ? 'fish' : 'whales';
    return null;
  }
  if (t === 'snow' || t === 'lake') return null;
  const chance = hash(id, 13);
  if (chance > 0.42) return null; // most tiles carry nothing
  const options = [];
  if (rel === 'mountains') options.push(['gold', 2], ['silver', 2], ['copper', 2], ['iron', 2], ['stone', 3], ['gems', 1]);
  else if (rel === 'hills') options.push(['iron', 4], ['copper', 3], ['stone', 3], ['coal', 3], ['gold', 1], ['wine', 1], ['sheep', 3]);
  else if (feat === 'forest') options.push(['furs', 3], ['deer', 3], ['timber', 3], ['honey', 1]);
  else if (feat === 'jungle') options.push(['spices', 3], ['bananas', 3], ['dyes', 2], ['sugar', 2], ['rubber', 1]);
  else if (feat === 'marsh') options.push(['rice', 3], ['reeds', 1]);
  else if (feat === 'floodplain') options.push(['wheat', 4], ['cotton', 2], ['papyrus', 1]);
  else if (feat === 'oasis') options.push(['dates', 3]);
  else if (t === 'desert') options.push(['salt', 2], ['oil', 2], ['incense', 1], ['copper', 1], ['gold', 1]);
  else if (t === 'tundra') options.push(['furs', 3], ['oil', 1], ['iron', 1], ['uranium', 1]);
  else if (t === 'grassland') options.push(['wheat', 4], ['cattle', 4], ['horses', 3], ['sheep', 2], ['wine', 1], ['silk', 1], ['tea', 1]);
  else if (t === 'plains') options.push(['wheat', 3], ['horses', 4], ['cattle', 2], ['cotton', 2], ['olives', 1], ['coal', 1], ['salt', 1]);
  if (near && hash(id, 14) < 0.15) options.push(['fish', 3]);
  return options.length ? pickWeighted(id, options, hash) : null;
};
