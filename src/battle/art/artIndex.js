// src/battle/art/artIndex.js
// Which art file the game reads for each model class of plans/ART-MODELS-PLAN.md (Wave 0), from a
// map of asset paths to urls (what import.meta.glob gives; artFiles.js builds the game's own from
// the asset folders, tests pass their own). Pure: no three.js, no loading. Every resolver returns
// null when no file fits, and the caller keeps its procedural placeholder.
//
// Fallback chains (one rule each, the same for every caller):
//   age    an age's own file, else the nearest EARLIER age that has one (a Gunpowder battle with
//          only rts-bronze.glb draws the Bronze buildings), else null (the greybox)
//   theme  styleChain(style) (data/architecture.js: korea -> sinic, andalus -> levant ...), then
//          the age's base file; houses never cross ages (they must match the town kit's houses)
//   kit    vegetation kits fall back along VEGETATION_FALLBACK to temperate
//   bridge the age's bridge material, then the lighter ones (steel -> stone -> wood)
import { AGE_ORDER } from '../../data/ages';
import { styleChain } from '../../data/architecture';

/** The seven vegetation kits (plan D9) and where each falls back to. */
export const VEGETATION_KITS = ['temperate', 'conifer', 'mediterranean', 'tropical', 'steppe', 'desert', 'cold'];
export const VEGETATION_FALLBACK = { conifer: 'temperate', cold: 'conifer', mediterranean: 'temperate', tropical: 'temperate', steppe: 'temperate', desert: 'steppe' };
/** The bridge a road crossing gets in each age, and the lighter bridges it falls back to. */
export const BRIDGE_BY_AGE = { bronze: 'wood', classical: 'stone', kingdoms: 'stone', gunpowder: 'stone', modern: 'steel' };
const BRIDGE_FALLBACK = { steel: 'stone', stone: 'wood' };
/** Resource node files (S9). */
export const NATURE_NODES = ['stone-outcrop', 'ore-outcrop', 'gold-vein', 'fish-shoal', 'herd-sheep-goat', 'herd-cattle'];
/** Map terrain kits (S11) the close view can read. */
export const MAP_TERRAIN_KITS = ['mountain-ridges', 'hills', 'cliffs', 'dunes', 'coasts', 'lakes', 'wetlands', 'field-edges'];

/** 'src/assets/battle/rts/rts-bronze.glb' or '../../assets/battle/...' -> 'battle/rts/rts-bronze.glb'. */
export const assetKey = (path) => String(path).replace(/^.*?assets\//, '');

/** An age and the earlier ages after it, nearest first: 'kingdoms' -> kingdoms, classical, bronze. */
export const ageChain = (ageId) => {
  const i = AGE_ORDER.indexOf(ageId);
  return i < 0 ? (ageId ? [ageId] : []) : AGE_ORDER.slice(0, i + 1).reverse();
};

export const vegetationChain = (kit) => {
  const out = [];
  for (let k = kit; k && !out.includes(k); k = VEGETATION_FALLBACK[k]) out.push(k);
  if (!out.includes('temperate')) out.push('temperate');
  return out;
};

/**
 * The art index over `files` ({ path: url }). Every resolver returns { url, ... } or null.
 */
export const createArtIndex = (files = {}) => {
  const byKey = {};
  Object.entries(files).forEach(([path, url]) => { byKey[assetKey(path)] = url; });
  const url = (key) => byKey[key] || null;
  const byAge = (ageId, name) => {
    for (const a of ageChain(ageId)) {
      const u = url(name(a));
      if (u) return { url: u, ageId: a, key: name(a) };
    }
    return null;
  };
  return {
    /** Every key in the index (for tests and the asset READMEs' checks). */
    keys: () => Object.keys(byKey),
    url,
    /** S5 battle buildings: battle/rts/rts-<age>.glb, one object per role. */
    rts: (ageId) => byAge(ageId, (a) => `battle/rts/rts-${a}.glb`),
    /** Culture skins of the battle buildings (barracks, tower, trade post): battle/rts/rts-<age>-<theme>.glb
     * for this exact age along the style chain; null leaves the age's shared building. */
    rtsSkin: (ageId, style = null) => {
      for (const s of styleChain(style)) {
        const key = `battle/rts/rts-${ageId}-${s}.glb`;
        if (url(key)) return { url: url(key), ageId, style: s, key };
      }
      return null;
    },
    /** Decorative prop kits; placement is supplied by a consumer. */
    props: (ageId) => byAge(ageId, (a) => `battle/props/props-${a}.glb`),
    /** S7 wall kit: battle/city/walls-<age>.glb. */
    walls: (ageId) => byAge(ageId, (a) => `battle/city/walls-${a}.glb`),
    /** S6 ruin library: battle/city/ruins-<age>.glb. */
    ruins: (ageId) => byAge(ageId, (a) => `battle/city/ruins-${a}.glb`),
    /** S7 fort: battle/city/fort-<age>.glb. */
    fort: (ageId) => byAge(ageId, (a) => `battle/city/fort-${a}.glb`),
    /** S6 damaged and ruined kit houses: battle/city/<age>-<theme>-houses-damage.glb, the base
     * kit's battle/city/<age>-houses-damage.glb; the style chain, then the base, never another age. */
    housesDamage: (ageId, style = null) => {
      for (const s of [...styleChain(style), 'base']) {
        const key = s === 'base' ? `battle/city/${ageId}-houses-damage.glb` : `battle/city/${ageId}-${s}-houses-damage.glb`;
        if (url(key)) return { url: url(key), ageId, style: s, key };
      }
      return null;
    },
    /** Civic halls and palace damage match the city's exact age and style, then its base. */
    civic: (ageId, style = null) => {
      for (const s of [...styleChain(style), 'base']) {
        const key = s === 'base' ? `battle/city/civic-${ageId}.glb` : `battle/city/civic-${ageId}-${s}.glb`;
        if (url(key)) return { url: url(key), ageId, style: s, key };
      }
      return null;
    },
    palaceDamage: (ageId, style = null) => {
      for (const s of [...styleChain(style), 'base']) {
        const key = s === 'base' ? `battle/city/palace-damage-${ageId}.glb` : `battle/city/palace-damage-${ageId}-${s}.glb`;
        if (url(key)) return { url: url(key), ageId, style: s, key };
      }
      return null;
    },
    /** S9 resource nodes and herds: battle/nature/<id>.glb. */
    nature: (id) => (url(`battle/nature/${id}.glb`) ? { url: url(`battle/nature/${id}.glb`), id, key: `battle/nature/${id}.glb` } : null),
    /** S9 vegetation kits: battle/nature/vegetation-<kit>.glb along the kit chain. */
    vegetation: (kit) => {
      for (const k of vegetationChain(kit)) {
        const key = `battle/nature/vegetation-${k}.glb`;
        if (url(key)) return { url: url(key), kit: k, key };
      }
      return null;
    },
    /** S11 battle terrain: battle/terrain/<id>.glb (river-kit, ford). */
    terrain: (id) => (url(`battle/terrain/${id}.glb`) ? { url: url(`battle/terrain/${id}.glb`), id, key: `battle/terrain/${id}.glb` } : null),
    /** S11 bridges: battle/terrain/bridge-<wood|stone|steel>.glb for the age, lighter ones after. */
    bridge: (ageId) => {
      for (let m = BRIDGE_BY_AGE[ageId] || 'wood'; m; m = BRIDGE_FALLBACK[m]) {
        const key = `battle/terrain/bridge-${m}.glb`;
        if (url(key)) return { url: url(key), material: m, object: `bridge-${m}`, key };
      }
      return null;
    },
    /** Projectiles: battle/projectiles/<age>.glb, the age chain. */
    projectiles: (ageId) => byAge(ageId, (a) => `battle/projectiles/${a}.glb`),
    /** Signature units: units/signature/<model>.glb (data/signatureUnits.js: the people's model id, age and role). */
    signature: (model) => (url(`units/signature/${model}.glb`) ? { url: url(`units/signature/${model}.glb`), model, key: `units/signature/${model}.glb` } : null),
    /** Map terrain kits: map/terrain/<id>.glb. */
    mapTerrain: (id) => (url(`map/terrain/${id}.glb`) ? { url: url(`map/terrain/${id}.glb`), id, key: `map/terrain/${id}.glb` } : null)
  };
};
