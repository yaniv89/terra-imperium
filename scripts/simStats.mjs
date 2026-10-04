// scripts/simStats.mjs
// Statistics for the balance harness (plans/math-ideas.md 8.1 and 8.2): paired-seed confidence
// intervals for before/after comparisons, and runaway and health measures for one world (Gini,
// Herfindahl-Hirschman, Kaplan-Meier survival, a Zipf rank-size slope). Plain ESM with no imports,
// so the vitest sim (.claude/skills/balance-sim), scripts/simulate.mjs and the compare CLI share it.
// Tooling only: never imported by the engine, so Math.log / Math.sqrt are fine here.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// Sample standard deviation (n - 1).
export const sd = (xs) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
};

// Two-sided 95% Student t critical values by degrees of freedom. With the 2 to 10 seeds a balance
// run can afford, the normal 1.96 would make intervals far too narrow (df 1 needs 12.71).
const T95 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
export const tCritical95 = (df) => (df < 1 ? NaN : df < T95.length ? T95[df] : df < 60 ? 2.00 : df < 120 ? 1.98 : 1.96);

// Deterministic percentile bootstrap of the mean (mulberry32 from a fixed seed). Only worth it from
// about 10 pairs up; below that the t interval is the honest one.
export const bootstrapMeanCI = (xs, { reps = 2000, seed = 1 } = {}) => {
  if (xs.length < 2) return [NaN, NaN];
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const means = [];
  for (let r = 0; r < reps; r++) { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[Math.floor(rand() * xs.length)]; means.push(s / xs.length); }
  means.sort((p, q) => p - q);
  return [means[Math.floor(0.025 * (reps - 1))], means[Math.ceil(0.975 * (reps - 1))]];
};

// Paired comparison of one metric. base and head are arrays aligned by seed (same seed, same index).
// Returns the mean difference (head - base), its 95% t interval, whether the interval excludes 0,
// how many seeds moved up and down, and the seeds a study would need to resolve the observed effect
// at 80% power: n ~ ((1.96 + 0.84) x sd / effect)^2 (the 2.8 rule from the proposal).
export const pairedDiff = (base, head) => {
  const pairs = base.map((b, i) => [b, head[i]]).filter(([b, h]) => finite(b) && finite(h));
  const d = pairs.map(([b, h]) => h - b);
  const n = d.length;
  const md = mean(d);
  const s = sd(d);
  const half = n >= 2 ? tCritical95(n - 1) * s / Math.sqrt(n) : NaN;
  const lo = md - half; const hi = md + half;
  const significant = n >= 2 && md !== 0 && (lo > 0 || hi < 0);
  const up = d.filter((x) => x > 0).length; const down = d.filter((x) => x < 0).length;
  const seedsNeeded = n >= 2 && md !== 0 && s > 0 ? Math.max(2, Math.ceil(((2.8 * s) / Math.abs(md)) ** 2)) : null;
  const boot = n >= 10 ? bootstrapMeanCI(d) : null;
  return { n, baseMean: mean(pairs.map((p) => p[0])), headMean: mean(pairs.map((p) => p[1])), meanDiff: md, sdDiff: s, lo, hi, significant, up, down, seedsNeeded, boot };
};

// Gini coefficient of non-negative values: 0 = all equal, 1 = one holder has everything.
// Sorted formula G = sum((2i - n - 1) x_i) / (n sum x), i = 1..n ascending.
export const gini = (values) => {
  const xs = values.filter((v) => finite(v) && v >= 0).sort((a, b) => a - b);
  const n = xs.length; const total = xs.reduce((a, b) => a + b, 0);
  if (n < 2 || total <= 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (2 * (i + 1) - n - 1) * xs[i];
  return acc / (n * total);
};

// Herfindahl-Hirschman index on shares (0..1): sum of squared shares. 1 = monopoly, 1/k = k equal
// holders. Its inverse is the "effective number" of holders. Shares make it independent of how
// many cells the grid has.
export const hhi = (values) => {
  const xs = values.filter((v) => finite(v) && v > 0);
  const total = xs.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return xs.reduce((a, x) => a + (x / total) ** 2, 0);
};

// Kaplan-Meier survival with staggered entry. Each subject is { born, died } in turns; died is null
// while alive (censored at the end of the observation). A subject is at risk at turn t when
// born < t <= (died ?? Infinity). Returns S(t) at each requested turn and the median lifetime
// (first turn S drops to 0.5 or below, null if it never does).
export const kaplanMeier = (subjects, atTurns = []) => {
  const deaths = [...new Set(subjects.filter((s) => s.died != null).map((s) => s.died))].sort((a, b) => a - b);
  let surv = 1; const curve = [[0, 1]]; let median = null;
  deaths.forEach((t) => {
    const atRisk = subjects.filter((s) => s.born < t && (s.died == null || s.died >= t)).length;
    const d = subjects.filter((s) => s.died === t && s.born < t).length;
    if (atRisk > 0 && d > 0) { surv *= 1 - d / atRisk; curve.push([t, surv]); if (median == null && surv <= 0.5) median = t; }
  });
  const at = (t) => { let v = 1; for (const [ct, cv] of curve) { if (ct <= t) v = cv; else break; } return v; };
  return { at: Object.fromEntries(atTurns.map((t) => [t, at(t)])), median, curve };
};

// Zipf rank-size slope: least-squares slope of log(size) on log(rank) over the largest `top`
// values. Zipf's law for cities gives about -1; flatter (towards 0) means every city is alike.
export const zipfSlope = (values, top = 50) => {
  const xs = values.filter((v) => finite(v) && v > 0).sort((a, b) => b - a).slice(0, top);
  if (xs.length < 3) return NaN;
  const pts = xs.map((v, i) => [Math.log(i + 1), Math.log(v)]);
  const mx = mean(pts.map((p) => p[0])); const my = mean(pts.map((p) => p[1]));
  let num = 0; let den = 0;
  pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return den > 0 ? num / den : NaN;
};

// Visit every owned tile of state.world.tileOwner whatever its storage: a plain object or Map of
// tile -> cityId, or an array / typed array indexed by tile (0 or null = unowned). Calls fn(tile,
// cityId). Kept here so the harness survives the typed-array tile storage (math wave idea 10.1).
export const forEachOwnedTile = (tileOwner, fn) => {
  if (!tileOwner) return;
  if (tileOwner instanceof Map) { tileOwner.forEach((city, tile) => { if (city) fn(Number(tile), city); }); return; }
  if (ArrayBuffer.isView(tileOwner) || Array.isArray(tileOwner)) { for (let i = 0; i < tileOwner.length; i++) if (tileOwner[i]) fn(i, tileOwner[i]); return; }
  for (const tile in tileOwner) if (tileOwner[tile]) fn(Number(tile), tileOwner[tile]);
};

const round = (v, d = 3) => (finite(v) ? +v.toFixed(d) : v);

// Runaway and health measures of one state. All are shares, indices or ratios, so they mean the
// same on a denser grid (frequency 100+) as on frequency 75. landTiles = land cells in the grid;
// isLand(tile) tells land from sea; cityOf(cityId) resolves a tileOwner value to a city record
// (defaults to state.regions[cityId]).
export const worldHealth = (state, { isLand, landTiles, playerId, cityOf } = {}) => {
  const living = Object.values(state.nations || {}).filter((n) => !n.isEliminated);
  const cities = Object.values(state.regions || {});
  const resolve = cityOf || ((id) => state.regions?.[id]);
  const cityCount = {}; const pop = {}; const land = {};
  living.forEach((n) => { cityCount[n.id] = 0; pop[n.id] = 0; land[n.id] = 0; });
  cities.forEach((c) => {
    if (c.owner == null || !(c.owner in cityCount)) return;
    cityCount[c.owner] += 1; pop[c.owner] += c.currentPopulation || 0;
  });
  let ownedLand = 0;
  forEachOwnedTile(state.world?.tileOwner, (tile, cityId) => {
    if (isLand && !isLand(tile)) return;
    const owner = resolve(cityId)?.owner;
    if (owner == null || !(owner in land)) return;
    land[owner] += 1; ownedLand += 1;
  });
  const wealth = living.map((n) => Math.max(0, n.id === playerId ? (state.resources?.gold || 0) : (n.economy?.gold || 0)));
  const landShares = Object.values(land);
  const topLand = Math.max(0, ...landShares);
  return {
    nationsAlive: living.length,
    giniCities: round(gini(Object.values(cityCount))),
    giniPopulation: round(gini(Object.values(pop))),
    giniWealth: round(gini(wealth)),
    giniLand: round(gini(landShares)),
    hhiLand: round(hhi(landShares), 4),
    effectiveNations: round(hhi(landShares) > 0 ? 1 / hhi(landShares) : 0, 1),
    // Share of the world's land cells held by the biggest nation (the proposal's empire-size target:
    // a few percent to a quarter).
    topLandShare: landTiles ? round(topLand / landTiles) : null,
    landClaimedShare: landTiles ? round(ownedLand / landTiles) : null,
    zipfSlope: round(zipfSlope(cities.map((c) => c.currentPopulation || 0)), 2)
  };
};
