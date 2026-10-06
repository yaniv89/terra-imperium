// scripts/peoples/build-peoples.mjs
// Builds src/data/geo/peopleCapitals.json for the peoples pool (src/data/peoples.js, phase W0):
//   capitals  { [peopleId]: tile }  every capital snapped to the nearest livable land tile of the
//             grid, then checked against the settling rule (src/data/geo/citySpacing.js): a pair
//             that breaks it moves the lighter people (weight, then id) to the nearest clear
//             livable tile within NUDGE_KM, or the build fails naming the pair.
//   colors    { [peopleId]: '#rrggbb' }  a palette of 150 colours, given out greedily so that
//             capitals within NEIGHBOUR_KM of each other get colours far apart (CIE76 delta E);
//             the smallest such difference is printed.
//   legacy    { [countryId]: peopleId }  LEGACY_NATION_IDS: the heaviest people whose land is that
//             country (nearest the country's capital on ties), else the people nearest its capital.
// Run after build:tiles whenever the pool or the grid changes:  npm run build:peoples
// The game modules use extensionless imports, so they are loaded through Vite's SSR loader.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const NUDGE_KM = 400;
const NEIGHBOUR_KM = 1500;
const CONTRAST_KM = 1000; // "within 10 hexes" of the plan, for the printed check

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outFile = path.join(root, 'src/data/geo/peopleCapitals.json');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { getTiles } = await server.ssrLoadModule('/src/data/geo/tiles.js');
  const { PEOPLES_LIST } = await server.ssrLoadModule('/src/data/peoples.js');
  const { spacedApart, ringsFrom } = await server.ssrLoadModule('/src/data/scenarios.js');
  const { distanceKm } = await server.ssrLoadModule('/src/data/geo/geodesic.js');
  const { ringsForKm } = await server.ssrLoadModule('/src/data/geo/gridScale.js');
  const tiles = getTiles();
  const livable = (t) => tiles.land[t] === 1 && !tiles.lake?.[t] && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice';
  const km = (a, b) => distanceKm(tiles.centres[a], tiles.centres[b]);

  // 1. Snap.
  const capitals = {};
  const snapNotes = [];
  PEOPLES_LIST.forEach((p) => {
    const near = tiles.nearest(p.capital.lat, p.capital.lon, 64);
    let tile = near.find(livable);
    if (tile == null) {
      const rings = ringsFrom(tiles, near[0], ringsForKm(800, { tiles }));
      tile = [...rings.entries()].filter(([t]) => livable(t)).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]?.[0];
    }
    if (tile == null) throw new Error(`no livable tile near ${p.id}`);
    const exact = tiles.nearest(p.capital.lat, p.capital.lon, 1);
    const off = km(exact, tile);
    if (off > 60) snapNotes.push(`${p.id} snapped ${Math.round(off)} km to a livable tile`);
    capitals[p.id] = tile;
  });

  // 2. The settling rule, heaviest first.
  const order = [...PEOPLES_LIST].sort((a, b) => b.weightValue - a.weightValue || (a.id < b.id ? -1 : 1));
  const placed = [];
  const nudges = [];
  order.forEach((p) => {
    const clear = (t) => placed.every((q) => spacedApart(tiles, capitals[q], t));
    if (!clear(capitals[p.id])) {
      const from = capitals[p.id];
      const rings = ringsFrom(tiles, from, ringsForKm(NUDGE_KM, { tiles }));
      const tile = [...rings.entries()].filter(([t]) => livable(t) && clear(t)).sort((a, b) => a[1] - b[1] || km(from, a[0]) - km(from, b[0]) || a[0] - b[0])[0]?.[0];
      if (tile == null) {
        const by = placed.find((q) => !spacedApart(tiles, capitals[q], from));
        throw new Error(`${p.id} breaks the settling rule against ${by} and has no clear tile within ${NUDGE_KM} km`);
      }
      nudges.push(`${p.id} moved ${Math.round(km(from, tile))} km (crowded by ${placed.find((q) => !spacedApart(tiles, capitals[q], from))})`);
      capitals[p.id] = tile;
    }
    placed.push(p.id);
  });

  // 3. Colours.
  const hslToRgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
  };
  const toHex = (rgb) => `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  const toLab = ([r, g, b]) => {
    const lin = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const TONES = [[70, 46], [55, 60], [75, 34], [42, 52], [60, 72]];
  const palette = [];
  for (let i = 0; i < 30; i++) TONES.forEach(([s, l], k) => palette.push({ hex: toHex(hslToRgb((i * 12 + k * 5) % 360, s, l)) }));
  palette.forEach((c) => { c.lab = toLab(c.hex.slice(1).match(/../g).map((x) => parseInt(x, 16))); });
  const neighbours = (id, radius) => PEOPLES_LIST.filter((q) => q.id !== id && km(capitals[id], capitals[q.id]) <= radius).map((q) => q.id);
  const colorOrder = [...PEOPLES_LIST].map((p) => ({ id: p.id, n: neighbours(p.id, NEIGHBOUR_KM).length })).sort((a, b) => b.n - a.n || (a.id < b.id ? -1 : 1));
  const colors = {};
  const used = new Set();
  colorOrder.forEach(({ id }) => {
    const near = neighbours(id, NEIGHBOUR_KM).filter((q) => colors[q]).map((q) => palette.find((c) => c.hex === colors[q]).lab);
    let best = null;
    palette.forEach((c, i) => {
      if (used.has(i)) return;
      const score = near.length ? Math.min(...near.map((lab) => dE(lab, c.lab))) : 999;
      if (!best || score > best.score) best = { i, score };
    });
    used.add(best.i);
    colors[id] = palette[best.i].hex;
  });
  let worst = null;
  PEOPLES_LIST.forEach((p) => neighbours(p.id, CONTRAST_KM).forEach((q) => {
    const d = dE(toLab(colors[p.id].slice(1).match(/../g).map((x) => parseInt(x, 16))), toLab(colors[q].slice(1).match(/../g).map((x) => parseInt(x, 16))));
    if (!worst || d < worst.d) worst = { d, pair: `${p.id}-${q}` };
  }));

  // 4. Legacy ids.
  const legacy = {};
  Object.keys(tiles.capitals).sort().forEach((cid) => {
    const home = tiles.capitals[cid];
    if (home == null) return;
    const own = PEOPLES_LIST.filter((p) => p.land === cid);
    const pool = own.length ? own : PEOPLES_LIST;
    const best = [...pool].sort((a, b) => (own.length ? b.weightValue - a.weightValue : 0) || km(home, capitals[a.id]) - km(home, capitals[b.id]) || (a.id < b.id ? -1 : 1))[0];
    legacy[cid] = best.id;
  });

  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const previous = (() => { try { return readFileSync(outFile, 'utf8'); } catch { return ''; } })();
  const text = `${JSON.stringify({ capitals: sorted(capitals), colors: sorted(colors), legacy: sorted(legacy) }, null, 1)}\n`;
  writeFileSync(outFile, text);
  console.log(`peopleCapitals.json: ${Object.keys(capitals).length} capitals, ${Object.keys(legacy).length} legacy ids${previous === text ? ' (unchanged)' : ''}`);
  snapNotes.forEach((n) => console.log(`  snap: ${n}`));
  nudges.forEach((n) => console.log(`  nudge: ${n}`));
  console.log(`  closest colours within ${CONTRAST_KM} km: delta E ${worst ? worst.d.toFixed(1) : '-'} (${worst?.pair || ''})`);
} finally {
  await server.close();
}
