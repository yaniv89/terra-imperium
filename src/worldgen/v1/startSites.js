// src/worldgen/v1/startSites.js
// Fair start sites of a generated world (plans/MAP-VARIATIONS-PLAN.md 6.1), part of the global pass
// and so of the world (its hash): the people assignment at game start (src/engine/worldgen/
// generatedPeoples.js) only chooses among them.
//
// startScore(tile), built on settlers.js siteQuality: the tile's own yields (food x 1.2 +
// production + gold) plus rings 1 to 3 at 0.6, 0.3 and 0.15; +2 river, +1.5 coast, +1 fresh lake;
// strategic reach (+2 copper or iron within 6 rings, +1 horses within 8, +1 a luxury within 4);
// room (+1 for every 6 open land tiles within 3 rings); -4 when more than half of the land of
// rings 1 to 3 is desert, tundra, snow or mountains. Never on a pentagon, a lake, ice, beyond 66
// degrees, or on a landmass under 150 tiles that is not coastal.
//
// The pass: candidates above the 30th percentile of land scores; majors greedily by score with the
// 612 km gap (MAJOR_MIN_GAP_KM) for the Large world (42; Small and Standard take a prefix, since a
// greedy pick never depends on how many follow), then repairs: a major short of copper or iron
// within 6 rings or horses within 8 gets one placed on a suitable tile in reach (by hash), and a
// major below 85% of the median score gets food resources in ring 1 until it is within, at most 3.
// Deterministic: id tie-breaks, hash choices, exact operations only.
import { tileYields } from '../../data/tileYields';
import { MAJOR_MIN_GAP_KM, WORLD_SIZES } from '../../data/worldSizes';
import { EARTH_RADIUS_KM } from '../../data/geo/geodesic';

export const MAX_MAJORS = Math.max(...Object.values(WORLD_SIZES).map((s) => s.majors));
export const CANDIDATE_KEEP = 4000;
const LUXURY = new Set(['gold', 'silver', 'gems', 'wine', 'silk', 'spices', 'dyes', 'incense', 'furs', 'whales', 'tea', 'sugar', 'cotton', 'olives', 'honey', 'dates', 'papyrus']);

// cos of the gap angle by its series (exact operations only).
const cosOf = (x) => { const x2 = x * x; return 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - x2 / 56))); };
export const GAP_COS = cosOf(MAJOR_MIN_GAP_KM / EARTH_RADIUS_KM);

/**
 * Scores every land tile, picks the major sites and repairs them. Mutates raw.resource (repairs).
 * `G`: the prepared grid (nb, vec, latDeg). `hashS(id, salt)`: the world's seeded hash in [0, 1).
 * Returns { majors, majorScores, candidates, scores } (scores: Float64Array per tile, -Infinity
 * where no start may stand).
 */
export const pickStartSites = (raw, G, hashS) => {
  const { n, nb, vec, latDeg } = G;
  const T = raw.terrainNames; const R = raw.reliefNames; const F = raw.featureNames; const RES = raw.resourceNames;
  const terr = (i) => T[raw.terrain[i]]; const rel = (i) => R[raw.relief[i]]; const feat = (i) => F[raw.feature[i]];
  const res = (i) => (raw.resource[i] >= 0 ? RES[raw.resource[i]] : null);
  const isLake = (i) => terr(i) === 'lake';
  const facts = (i) => ({ id: i, land: raw.land[i] === 1, terrain: terr(i), relief: rel(i), feature: feat(i), river: raw.rivers[i] !== 0, coastal: raw.coastal[i] === 1, resource: res(i), improvement: null, district: null, pillaged: false, road: false });
  const ownOf = (i) => { const y = tileYields(facts(i)); return y.food * 1.2 + y.production + y.gold; };

  // Landmass sizes (lakes are not land for this).
  const mass = new Int32Array(n).fill(-1); const massSize = [];
  const queue = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (raw.land[s] !== 1 || isLake(s) || mass[s] >= 0) continue;
    const id = massSize.length; let qh = 0; let qt = 0; queue[qt++] = s; mass[s] = id;
    while (qh < qt) { const i = queue[qh++]; for (const j of nb[i]) if (raw.land[j] === 1 && !isLake(j) && mass[j] < 0) { mass[j] = id; queue[qt++] = j; } }
    massSize.push(qt);
  }
  // Rings to the nearest tile holding one of `names` (breadth first over every tile).
  const distTo = (pred) => {
    const d = new Int16Array(n).fill(-1); let qh = 0; let qt = 0;
    for (let i = 0; i < n; i++) if (pred(res(i))) { d[i] = 0; queue[qt++] = i; }
    while (qh < qt) { const i = queue[qh++]; if (d[i] >= 10) continue; for (const j of nb[i]) if (d[j] < 0) { d[j] = d[i] + 1; queue[qt++] = j; } }
    return d;
  };
  let dMetal = distTo((r) => r === 'copper' || r === 'iron');
  let dHorse = distTo((r) => r === 'horses');
  const dLux = distTo((r) => r != null && LUXURY.has(r));
  const within = (d, i, k) => d[i] >= 0 && d[i] <= k;

  const own = new Float64Array(n);
  for (let i = 0; i < n; i++) own[i] = ownOf(i);
  const stamp = new Int32Array(n); let st = 0;
  const rings = (c, k, visit) => {
    st++; stamp[c] = st; let frontier = [c];
    for (let d = 1; d <= k; d++) {
      const next = [];
      for (const i of frontier) for (const j of nb[i]) if (stamp[j] !== st) { stamp[j] = st; next.push(j); visit(j, d); }
      frontier = next;
    }
  };
  const eligible = (c) => raw.land[c] === 1 && !isLake(c) && nb[c].length === 6 && terr(c) !== 'snow' && feat(c) !== 'ice' && rel(c) !== 'mountains'
    && (latDeg[c] < 0 ? -latDeg[c] : latDeg[c]) <= 66 && (massSize[mass[c]] >= 150 || raw.coastal[c] === 1);
  const W = [1, 0.6, 0.3, 0.15];
  const score = (c) => {
    let s = own[c]; let landN = 0; let bad = 0; let open = 0; let lakeNear = false;
    rings(c, 3, (j, d) => {
      s += own[j] * W[d];
      if (raw.land[j] === 1 && !isLake(j)) {
        landN++;
        const t = terr(j);
        if (t === 'desert' || t === 'tundra' || t === 'snow' || rel(j) === 'mountains') bad++;
        else open++;
      }
      if (d === 1 && isLake(j)) lakeNear = true;
    });
    if (raw.rivers[c]) s += 2;
    if (raw.coastal[c] === 1) s += 1.5;
    if (lakeNear) s += 1;
    if (within(dMetal, c, 6)) s += 2;
    if (within(dHorse, c, 8)) s += 1;
    if (within(dLux, c, 4)) s += 1;
    s += open / 6;
    if (landN && bad * 2 > landN) s -= 4;
    return Math.round(s * 100) / 100;
  };
  const scores = new Float64Array(n).fill(-Infinity);
  const landScores = [];
  for (let c = 0; c < n; c++) if (eligible(c)) { scores[c] = score(c); landScores.push(scores[c]); }
  landScores.sort((a, b) => a - b);
  const floor = landScores.length ? landScores[Math.floor(landScores.length * 0.3)] : 0;
  const cands = [];
  for (let c = 0; c < n; c++) if (scores[c] >= floor) cands.push(c);
  cands.sort((a, b) => scores[b] - scores[a] || a - b);

  // Majors: greedy by score with the gap.
  const majors = [];
  const far = (c) => majors.every((m) => vec[3 * m] * vec[3 * c] + vec[3 * m + 1] * vec[3 * c + 1] + vec[3 * m + 2] * vec[3 * c + 2] <= GAP_COS);
  for (const c of cands) { if (majors.length >= MAX_MAJORS) break; if (far(c)) majors.push(c); }

  // Repairs: strategic reach, then food for the weak.
  const place = (c, name, minR, maxR, ok, salt) => {
    const opts = [];
    rings(c, maxR, (j, d) => { if (d >= minR && raw.land[j] === 1 && !isLake(j) && raw.resource[j] < 0 && ok(j)) opts.push(j); });
    if (!opts.length) return false;
    opts.sort((a, b) => hashS(a, salt) - hashS(b, salt) || a - b);
    raw.resource[opts[0]] = RES.indexOf(name);
    own[opts[0]] = ownOf(opts[0]);
    return true;
  };
  let repairs = 0;
  majors.forEach((c, k) => {
    if (!within(dMetal, c, 6)) {
      const metal = hashS(c, 301) < 0.5 ? 'copper' : 'iron';
      if (place(c, metal, 1, 5, (j) => rel(j) === 'hills' || rel(j) === 'mountains' || terr(j) === 'plains', 302 + k)) repairs++;
    }
    if (!within(dHorse, c, 8)) {
      if (place(c, 'horses', 1, 6, (j) => rel(j) === 'flat' && (terr(j) === 'grassland' || terr(j) === 'plains') && feat(j) === 'none', 303 + k)) repairs++;
    }
  });
  dMetal = distTo((r) => r === 'copper' || r === 'iron');
  dHorse = distTo((r) => r === 'horses');
  let majorScores = majors.map(score);
  const median = () => { const s = majorScores.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const med = median();
  majors.forEach((c, k) => {
    for (let tries = 0; tries < 3 && majorScores[k] < med * 0.85; tries++) {
      const done = place(c, hashS(c, 310 + tries) < 0.5 ? 'wheat' : 'cattle', 1, 1, (j) => rel(j) === 'flat' && (terr(j) === 'grassland' || terr(j) === 'plains') && feat(j) === 'none', 311 + tries)
        || (() => { // fish on a coast hex beside the site
          const opts = nb[c].filter((j) => raw.land[j] !== 1 && terr(j) === 'coast' && raw.resource[j] < 0).sort((a, b) => a - b);
          if (!opts.length) return false;
          raw.resource[opts[0]] = RES.indexOf('fish'); own[opts[0]] = ownOf(opts[0]); return true;
        })();
      if (!done) break;
      repairs++;
      majorScores[k] = score(c);
    }
  });
  majorScores = majors.map(score);
  const majorSet = new Set(majors);
  const candidates = cands.filter((c) => !majorSet.has(c)).slice(0, CANDIDATE_KEEP);
  return { majors, majorScores, candidates, scores, floor, repairs };
};
