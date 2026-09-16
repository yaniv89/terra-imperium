// scripts/geo/build.mjs
// Turns the raw Natural Earth admin-0 (country) and admin-1 (state/province) GeoJSON into the
// two TopoJSON tiers, adjacency graphs, and lightweight metadata tables the game consumes. Run
// with `npm run build:geo` after `npm run fetch:geo`. Nothing here runs in the browser — its
// output (committed under src/data/geo/) is the only thing the app actually imports.
//
// Natural Earth's admin-1 layer has real data-quality quirks this script works around:
//  - ~60 subdivisions are split across multiple Features sharing one iso_3166_2 code (island
//    fragments of the same province, mostly) — merged into a single MultiPolygon per id before
//    simplification, so each real-world subdivision is exactly one game region.
//  - Two admin-1 groups (Somaliland, Northern Cyprus) and their parent "country" rows have no
//    real ISO code at all (Natural Earth marks disputed/unrecognized territories as -99) — given
//    stable synthetic ids ('xs'/'xn') following the same X-prefix convention ISO uses for its own
//    exceptional reservations (e.g. Kosovo's real, ISO-registered 'XK').
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import { neighbors as topoNeighbors } from 'topojson-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '.raw');
const TMP_DIR = path.join(__dirname, '.tmp');
const OUT_DIR = path.resolve(__dirname, '../../src/data/geo');

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

// --- id assignment -------------------------------------------------------------------------

const specialCountryId = (name) => {
  if (name === 'Somaliland') return 'xs';
  if (name === 'N. Cyprus' || name === 'Northern Cyprus') return 'xn';
  return null;
};

const isCleanIso2 = (code) => /^[A-Za-z]{2}$/.test(code || '');

// The one shared rule for "does this feature have a sovereign parent worth representing as a
// country id" — the special-cased unrecognized-but-de-facto-governed states, or a clean ISO2
// code, or nothing. Applied identically to both tiers so a feature is dropped for the same
// reason everywhere, instead of two independently-maintained lists drifting apart. Features that
// fail this (military bases, leases, disputed uninhabited islands/glaciers — Dhekelia,
// Guantanamo Bay, Kashmir/Siachen, Baykonur, Spratly Is., etc.) carry no meaningful population,
// economy or strategic weight for gameplay and are dropped rather than merged into a neighbor
// they aren't actually part of.
//
// ISO_A2_EH ("de facto"/geopolitically-neutral variant) is preferred over ISO_A2 when both exist:
// Natural Earth deliberately hedges some entries in the plain field (Taiwan is "CN-TW" there, not
// a real code, to avoid taking a side) — ISO_A2_EH gives the usable code ("TW") for the same row.
// Not a playable nation: an uninhabited (~300 rotating military/scientific staff, no permanent
// civilian population) grouping of scattered Pacific atolls administered as a U.S. dependency.
const NON_PLAYABLE_COUNTRIES = new Set(['um']);

const resolveCountryCode = (name, isoA2Eh, isoA2) => {
  const special = specialCountryId(name);
  if (special) return special;
  const code = isCleanIso2(isoA2Eh) ? isoA2Eh.toLowerCase() : isCleanIso2(isoA2) ? isoA2.toLowerCase() : null;
  return code && !NON_PLAYABLE_COUNTRIES.has(code) ? code : null;
};

const countryId = (props) => resolveCountryCode(props.NAME, props.ISO_A2_EH, props.ISO_A2);

// `fallback(directCode, adminName)` re-validates the directly-derived code against the real
// country tier (see buildAdminNameFallback) — e.g. Tokelau's own code 'tk' is syntactically fine
// but has no admin-0 row, so it falls back to matching "New Zealand" (its Natural Earth "admin"
// field) by name. Without a fallback function (only used pre-tier-construction), the direct code
// is trusted as-is.
const subregionCountryId = (props, fallback) => {
  const direct = resolveCountryCode(props.admin, undefined, props.iso_a2);
  return fallback ? fallback(direct, props.admin) : direct;
};

// admin-1 rows carry their own iso_3166_2 (e.g. "AU-WA"), but it's malformed or a duplicate
// placeholder for disputed territories and a real ~60-row chunk of legitimate multi-fragment
// subdivisions elsewhere in the world — cleaned generically, not just for the two special cases.
const subregionBaseId = (props, fallback) => {
  const cid = subregionCountryId(props, fallback);
  const raw = (props.iso_3166_2 || '').replace(/~/g, '').toLowerCase();
  if (!raw || raw.includes('-99') || raw === '-1') {
    return `${cid}-${(props.gu_a3 || props.name || 'x').toLowerCase()}`;
  }
  return raw;
};

// --- geometry merging (fragments sharing one id -> one MultiPolygon) -----------------------

const ringsOf = (geometry) => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

const mergeFeaturesById = (features, idFn) => {
  const byId = new Map();
  for (const f of features) {
    const id = idFn(f.properties);
    if (!byId.has(id)) {
      byId.set(id, { id, properties: f.properties, polygons: [] });
    }
    byId.get(id).polygons.push(...ringsOf(f.geometry));
  }
  return [...byId.values()];
};

// mapshaper preserves every property column it's given — Natural Earth's ~40 per-feature
// columns (multilingual name variants, internal codes, etc.) would otherwise end up duplicated
// across all 4400+ geometries in the final TopoJSON. Metadata is captured from the ORIGINAL
// properties here, before the geometry is handed to mapshaper carrying only `id`.
const toMapshaperInput = (merged) => ({
  type: 'FeatureCollection',
  features: merged.map(({ id, polygons }) => ({
    type: 'Feature',
    properties: { id },
    geometry: { type: 'MultiPolygon', coordinates: polygons }
  }))
});

// --- pipeline --------------------------------------------------------------------------------

// A handful of ISO2-coded, non-sovereign territories (Tokelau, at last check) carry their own
// admin-1 entry but have no admin-0 row at all in this Natural Earth cut — unlike similar
// dependencies (Bermuda, Greenland, Puerto Rico) that DO get their own country-tier row, and
// unlike Tokelau's own total land area (~10km²), which is too small to survive simplification as
// a standalone shape anyway. Rather than invent a country-tier entry for it, this folds such an
// orphan onto whichever real country-tier entry matches its Natural Earth "admin" field by name —
// e.g. Tokelau becomes a subregion of New Zealand, its actual sovereign administrator.
//
// Returns a resolver that only falls back when the direct code isn't one of the country tier's
// REAL ids — a syntactically clean ISO2 code (like Tokelau's own "TK") isn't enough on its own,
// since that's exactly the case where the code exists but has no admin-0 row to back it.
const buildAdminNameFallback = (admin0Features) => {
  const validIds = new Set(admin0Features.map((f) => countryId(f.properties)).filter(Boolean));
  const byName = new Map();
  admin0Features.forEach((f) => {
    const id = countryId(f.properties);
    if (id) byName.set(f.properties.NAME, id);
  });
  return (directCode, adminName) => (validIds.has(directCode) ? directCode : byName.get(adminName) || null);
};

const buildTier = async ({ name, features: rawFeatures, countryOf, idFn, metaFn, simplifyPct, minArea }) => {
  console.log(`\n=== ${name} ===`);
  console.log(`raw features: ${rawFeatures.length}`);

  const kept = rawFeatures.filter((f) => countryOf(f.properties) !== null);
  if (kept.length !== rawFeatures.length) {
    console.log(`dropped ${rawFeatures.length - kept.length} non-sovereign/uninhabited fragments`);
  }

  const merged = mergeFeaturesById(kept, idFn);
  console.log(`merged features: ${merged.length}`);

  const usedIds = new Set();
  const meta = {};
  merged.forEach((f) => {
    if (usedIds.has(f.id)) throw new Error(`duplicate id after merge: ${f.id}`);
    usedIds.add(f.id);
    meta[f.id] = metaFn(f.properties);
  });

  const cleanedPath = path.join(TMP_DIR, `${name}.clean.geojson`);
  await writeFile(cleanedPath, JSON.stringify(toMapshaperInput(merged)));

  const topoPath = path.join(TMP_DIR, `${name}.topo.json`);
  await mapshaper.runCommands(
    `-i ${cleanedPath} ` +
    `-simplify ${simplifyPct}% weighted keep-shapes ` +
    (minArea ? `-filter-islands min-area=${minArea} remove-empty ` : '') +
    `-clean ` +
    // quantization caps coordinate precision to a fixed integer grid — this is what actually
    // makes TopoJSON small (delta-encoded small integers), independent of -simplify's point
    // count reduction. 1e5 is far finer than anything visible at game/globe scale.
    `-o ${topoPath} format=topojson id-field=id quantization=1e5`
  );

  const topology = await readJson(topoPath);
  const objectKey = Object.keys(topology.objects)[0];
  const geometries = topology.objects[objectKey].geometries;
  console.log(`topology geometries: ${geometries.length}`);

  // Adjacency straight from shared TopoJSON arcs — two regions border each other iff their
  // polygons share at least one arc. This is why fragments were merged first: an island
  // belonging to province A must not look "adjacent" to province B just because an unrelated
  // mainland fragment of A happened to touch B.
  const neighborIndexes = topoNeighbors(geometries);
  const ids = geometries.map((g) => g.id);
  const adjacency = {};
  ids.forEach((id, i) => {
    adjacency[id] = neighborIndexes[i].map((j) => ids[j]).sort();
  });

  // -filter-islands/-clean can drop a sliver geometry entirely (rare, but real) — meta/adjacency
  // must only speak about ids that actually survived into the final topology.
  const survivingIds = new Set(ids);
  if (survivingIds.size !== usedIds.size) {
    const dropped = [...usedIds].filter((id) => !survivingIds.has(id));
    console.log(`mapshaper dropped ${dropped.length} feature(s) entirely: ${dropped.slice(0, 10).join(', ')}`);
  }
  for (const id of Object.keys(meta)) {
    if (!survivingIds.has(id)) delete meta[id];
  }

  return { topology, adjacency, meta, ids };
};

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const admin0Raw = await readJson(path.join(RAW_DIR, 'admin0.geojson'));
  const admin1Raw = await readJson(path.join(RAW_DIR, 'admin1.geojson'));
  const adminNameFallback = buildAdminNameFallback(admin0Raw.features);
  const boundSubregionCountryId = (p) => subregionCountryId(p, adminNameFallback);
  const boundSubregionBaseId = (p) => subregionBaseId(p, adminNameFallback);

  const countries = await buildTier({
    name: 'countries',
    features: admin0Raw.features,
    countryOf: countryId,
    idFn: countryId,
    // population/gdp feed Phase 13's world nation generation (src/data/worldNations.js) —
    // fallback floors keep a handful of near-zero/uninhabited entries (Vatican's population is
    // recorded as 0 in this Natural Earth cut) from producing zero/negative derived stats.
    metaFn: (p) => ({
      name: p.NAME,
      continent: p.CONTINENT,
      population: p.POP_EST > 0 ? Math.round(p.POP_EST) : 1000,
      gdpMillions: p.GDP_MD > 0 ? Math.round(p.GDP_MD) : 10
    }),
    simplifyPct: 5
  });

  const subregions = await buildTier({
    name: 'subregions',
    features: admin1Raw.features,
    countryOf: boundSubregionCountryId,
    idFn: boundSubregionBaseId,
    // A handful of admin-1 rows (mostly tiny remainder islands, plus Antarctica as a whole —
    // which genuinely has no administrative subdivisions) carry no name at all in the source
    // data; a name derived from the country is more honest than leaving it blank or dropping
    // otherwise-real territory.
    metaFn: (p) => ({ name: p.name || `${p.admin} (unspecified)`, countryId: boundSubregionCountryId(p), countryName: p.admin }),
    // The admin-1 layer is ~40MB raw at 1:10m resolution — far more detail than a globe rendered
    // at game scale needs. keep-shapes stops small islands/slivers from being simplified into
    // nothing before -filter-islands runs.
    simplifyPct: 1.5,
    // -filter-islands drops per-RING, not per-feature — a nation whose entire territory is a
    // cluster of small atolls (Tuvalu) would otherwise vanish completely, ring by ring, even
    // though its total area is well above any reasonable "is this a real place" bar. Small
    // enough to still clear genuine cartographic noise (uninhabited reef dots, sub-hectare rocks).
    minArea: '0.1km2'
  });

  // Cross-check: every subregion's countryId must resolve to a real country in the other tier —
  // otherwise Phase 13's game logic would join subregions to nations that don't exist.
  const countryIds = new Set(countries.ids);
  const orphans = Object.entries(subregions.meta).filter(([, m]) => !countryIds.has(m.countryId));
  if (orphans.length > 0) {
    throw new Error(`${orphans.length} subregions reference an unknown country id, e.g. ${JSON.stringify(orphans.slice(0, 5))}`);
  }

  const outputs = {
    'countries.topo.json': countries.topology,
    'countries-adjacency.json': countries.adjacency,
    'countries-meta.json': countries.meta,
    'subregions.topo.json': subregions.topology,
    'subregions-adjacency.json': subregions.adjacency,
    'subregions-meta.json': subregions.meta
  };
  for (const [file, data] of Object.entries(outputs)) {
    await writeFile(path.join(OUT_DIR, file), JSON.stringify(data));
  }

  await rm(TMP_DIR, { recursive: true, force: true });

  console.log('\ndone. output sizes:');
  const { statSync } = await import('node:fs');
  for (const f of Object.keys(outputs)) {
    const size = statSync(path.join(OUT_DIR, f)).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(0)}KB`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
