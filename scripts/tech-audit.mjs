// scripts/tech-audit.mjs
// Every tech and what it gives a player: effects, unlocked units, buildings, improvements, laws,
// map effects, a boost, and how many other files name it. A tech with nothing but "counts toward
// the next age" is a dead pick (tech-depth lane). Run: node scripts/tech-audit.mjs [--dead]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSimEngine } from './simulate.mjs';

const { TECH_TREE, UNIT_UNLOCKS, BUILDING_CATEGORIES, IMPROVEMENTS, LAW_CATEGORIES, BOOSTS, TECH_MAP_EFFECTS } = await import(pathToFileURL(await buildSimEngine([
  "export { TECH_TREE } from '../src/data/techTree.js';",
  "export { UNIT_UNLOCKS } from '../src/data/unitClasses.js';",
  "export { BUILDING_CATEGORIES } from '../src/data/buildings.js';",
  "export { IMPROVEMENTS } from '../src/data/tileYields.js';",
  "export { LAW_CATEGORIES } from '../src/data/laws.js';",
  "export { BOOSTS } from '../src/data/boosts.js';",
  "export { TECH_MAP_EFFECTS } from '../src/data/techMapEffects.js';"
])).href);

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/locales|__/.test(f)) walk(p); } else if (/\.(js|jsx)$/.test(f) && !/\.test\./.test(f) && !/techTree\.js$|glossary/.test(p)) files.push([p, readFileSync(p, 'utf8')]); });
walk('src/engine'); walk('src/data'); walk('src/utils'); walk('src/battle');
const rows = Object.values(TECH_TREE).map((t) => {
  const units = Object.entries(UNIT_UNLOCKS).flatMap(([a, r]) => Object.keys(r).filter((c) => r[c] === t.id).map((c) => `${a}:${c}`));
  const buildings = Object.entries(BUILDING_CATEGORIES).flatMap(([c, d]) => d.tiers.map((x, i) => (x.requiresTech === t.id ? `${c}${i}` : null)).filter(Boolean));
  const imps = Object.entries(IMPROVEMENTS).filter(([, i]) => i.requiresTech === t.id).map(([k]) => k);
  const laws = Object.values(LAW_CATEGORIES).flat().filter((l) => l.requiresTech === t.id).map((l) => l.id);
  const refs = files.filter(([, s]) => s.includes(`'${t.id}'`)).map(([p]) => p.replace(/^src\//, ''));
  const fx = Object.keys(t.effects || {});
  const give = fx.length + units.length + buildings.length + imps.length + laws.length + (TECH_MAP_EFFECTS?.[t.id] ? 1 : 0);
  return { id: t.id, age: t.ageId, fx, units, buildings, imps, laws, map: !!TECH_MAP_EFFECTS?.[t.id], boost: !!BOOSTS[t.id], refs, give };
});
const dead = process.argv.includes('--dead');
rows.filter((r) => !dead || r.give === 0).forEach((r) => console.log(`${r.age.padEnd(11)} ${r.id.padEnd(36)} give=${r.give} fx=[${r.fx}] units=[${r.units}] bld=[${r.buildings}] imp=[${r.imps}] law=[${r.laws}] map=${r.map} boost=${r.boost} refs=${r.refs.join(',')}`));
