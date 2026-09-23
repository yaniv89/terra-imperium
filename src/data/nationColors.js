// src/data/nationColors.js
// One distinct fill color per nation for the globe (GlobeView.jsx) — replaces the earlier flat
// "every foreign nation is gray" fill plus a separate white national-border line layer, which
// looked visually detached/floating from the terrain at a fixed altitude. With every nation its
// own color, the color boundary between two provinces IS the national border; no extra geometry
// layer is needed on top of the existing black province-level stroke.
//
// Colors are assigned once at module load from STATIC geography (startOwner + REGIONS_DATA's own
// neighbor lists), not live ownership — a nation's color must stay the same for the whole game
// regardless of conquest, or the map would recolor itself mid-playthrough for reasons that have
// nothing to do with what the player did. A live-ownership-based scheme (getBorderingNationIds,
// regions.js) would be wrong for this: it changes as territory changes hands, which is exactly
// what a stable color identity must NOT do.
import { REGIONS_DATA } from './regions';

// Deliberately excludes the hues the rest of the globe already uses for something else: green/
// lime/yellow/orange/red (the player's own 5-band control gradient, GlobeView.jsx's fillColorFor)
// and pure red (the at-war stroke highlight). That leaves roughly 200° of the hue wheel to work
// with (cyan through rose) — NOT enough room to fit many genuinely eye-distinguishable hues on
// its own (a first version packed 5 mid-tone hues from that arc — blue/sky/cyan/teal/indigo — and
// they all read as "the same blue" at a glance, exactly the floating-white-line problem this
// palette was meant to fix). The real fix is varying LIGHTNESS as hard as hue: 5 well-separated
// hue families (~35-40° apart), each with a vivid and a very dark variant, plus two warm neutral
// grays that are unmistakable against any of the saturated colors regardless of hue.
export const NATION_COLOR_PALETTE = [
  '#06b6d4', '#164e63', // cyan: vivid, near-black dark
  '#3b82f6', '#1e3a8a', // blue: vivid, navy
  '#8b5cf6', '#312e81', // violet: vivid, deep indigo
  '#d946ef', '#581c87', // fuchsia: vivid, deep purple
  '#ec4899', '#831843', // pink: vivid, deep maroon-pink
  '#78716c', '#44403c' // stone: warm gray, dark warm gray/brown
];

// Fallback for a region with no recognized owner at all (shouldn't happen — every region has a
// startOwner — but matches the old NEUTRAL_LAND_COLOR's defensive role in GlobeView.jsx).
export const UNKNOWN_NATION_COLOR = '#334155'; // slate-700

// A simple, stable string hash — used only as a deterministic fallback pick (see below), never as
// the primary assignment, so it doesn't need to be cryptographically anything, just consistent
// across a rebuild of this module (no random seed, no Date.now()).
const hashToIndex = (str, mod) => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % mod;
};

// Static nation-to-nation adjacency, built once from every region's real geographic neighbor list
// (REGIONS_DATA[id].neighbors) mapped through each neighbor's own startOwner — this is "who
// actually borders whom on Earth," independent of anything that happens in a playthrough.
const buildNationAdjacency = () => {
  const adjacency = {};
  Object.values(REGIONS_DATA).forEach((region) => {
    const nationId = region.startOwner;
    if (!nationId) return;
    const set = (adjacency[nationId] ||= new Set());
    (region.neighbors || []).forEach((neighborRegionId) => {
      const neighborNation = REGIONS_DATA[neighborRegionId]?.startOwner;
      if (neighborNation && neighborNation !== nationId) set.add(neighborNation);
    });
  });
  return adjacency;
};

// Greedy graph coloring (Welsh-Powell order — nations with the most neighbors colored first, when
// the fewest palette options remain to avoid a clash): each nation takes the first palette color
// none of its already-colored neighbors currently holds. Falls back to a deterministic hash pick
// only in the rare case every palette color is already taken by a neighbor (a nation bordering 20+
// others) — a repeat is an acceptable rarity there, not a correctness bug.
const assignNationColors = () => {
  const adjacency = buildNationAdjacency();
  const nationIds = Object.keys(adjacency).sort((a, b) => adjacency[b].size - adjacency[a].size);
  const colors = {};
  nationIds.forEach((nationId) => {
    const usedByNeighbors = new Set(
      Array.from(adjacency[nationId]).map((n) => colors[n]).filter(Boolean)
    );
    const color = NATION_COLOR_PALETTE.find((c) => !usedByNeighbors.has(c))
      || NATION_COLOR_PALETTE[hashToIndex(nationId, NATION_COLOR_PALETTE.length)];
    colors[nationId] = color;
  });
  return colors;
};

export const NATION_COLORS = assignNationColors();

export const getNationColor = (nationId) => NATION_COLORS[nationId] || UNKNOWN_NATION_COLOR;
