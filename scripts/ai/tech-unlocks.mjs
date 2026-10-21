// scripts/ai/tech-unlocks.mjs
// A Civilization-style unlock map: which tech unlocks each base unit and each building tier, and what
// to give the techs that unlock nothing. One request an age. Writes plans/ai-output/tech-unlocks/
// unlocks.json ({ units: {"age.class": techId|null}, buildings: {"category.tierIndex": techId|null},
// emptyTechs: {techId: suggestion}, notes, rejected, missing }) and report.md. See claudeJob.mjs for the flags.
import fs from 'node:fs';
import path from 'node:path';
import { cli, loadSrc, params, resultJson } from './claudeJob.mjs';

const SYSTEM = `You design the tech unlock map of a grand-strategy video game on the real Earth, in the spirit of Civilization: a tech unlocks specific units and buildings.
You get one age: its techs (id, name, line, prerequisites, boosts, existing effects), the techs of earlier ages (id, name, age), the base units of the age (key "<age>.<class>", role, attack, defense), the building tiers of the age (key "<category>.<tierIndex>", name, current requiresTech), the wonders and the tile improvements.
Produce:
- units: for every unit of the age, the ONE tech that unlocks it, or null when it is available at the start of the age. Pick what history suggests (Archery or Composite Bow for archers, Horseback Riding or The Wheel for chariots and horsemen). Spread the unlocks over the age's techs where the history allows.
- buildings: for every building tier of the age whose requiresTech is null or looks wrong (wrong age, wrong theme), a tech; leave out tiers whose requiresTech is already sensible.
- emptyTechs: every tech of this age that unlocks nothing after your map (no unit, no building tier of the data, no improvement or wonder already gated by it), each with one suggestion: a unit, building, improvement, wonder or ability ALREADY in the input, never an invented one.
- notes: a few sentences on the choices and any doubt.
Rules:
- Use only ids and keys that appear in the input. Never invent one.
- A unit must be unlocked by a tech of its own age or an earlier age, never a later one.
- The infantry unit of the age must be null (available at the start, so no nation is ever stuck); so must the age's first tech-free worker or settler, which are not units here and need no entry.
- Keep the counter triangle (infantry beats cavalry, cavalry beats ranged, ranged beats infantry) playable: no age where a nation can build only one class for long. Do not put all three core classes behind techs of the same line deep in the age: at least two of infantry, cavalry and ranged must be available from the age's first two techs of any line, or at the start.
- No em dashes.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['units', 'buildings', 'emptyTechs', 'notes'],
  properties: {
    units: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['unit', 'tech'], properties: { unit: { type: 'string' }, tech: { type: ['string', 'null'] } } } },
    buildings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['building', 'tech'], properties: { building: { type: 'string' }, tech: { type: 'string' } } } },
    emptyTechs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tech', 'suggestion'], properties: { tech: { type: 'string' }, suggestion: { type: 'string' } } } },
    notes: { type: 'string' }
  }
};

export const job = {
  name: 'tech-unlocks',
  model: 'claude-opus-5-5',
  effort: 'high',
  maxTokens: 16000,
  likelyOut: 6000,
  loadData: async () => {
    const m = await loadSrc(`
      export { AGE_ORDER } from './src/data/ages.js';
      export { TECH_TREE } from './src/data/techTree.js';
      export { BOOSTS } from './src/data/boosts.js';
      export { UNIT_ROSTER, UNIT_CLASSES } from './src/data/unitClasses.js';
      export { BUILDING_CATEGORIES } from './src/data/buildings.js';
      export { GREAT_PROJECTS } from './src/data/greatProjects.js';
      export { IMPROVEMENTS } from './src/data/tileYields.js';`);
    const techs = Object.values(m.TECH_TREE).map((t) => ({ id: t.id, name: t.name, age: t.ageId, line: t.category, prerequisites: t.prerequisites, boost: m.BOOSTS[t.id]?.label || null, effects: t.effects }));
    const units = Object.entries(m.UNIT_ROSTER).flatMap(([age, byClass]) => Object.entries(byClass).map(([cls, u]) => ({ key: `${age}.${cls}`, age, class: cls, name: u.name, role: m.UNIT_CLASSES[cls].role, attack: u.baseAttack, defense: u.baseDefense })));
    const buildings = Object.entries(m.BUILDING_CATEGORIES).flatMap(([cat, c]) => c.tiers.map((t, i) => ({ key: `${cat}.${i}`, age: t.age, category: c.label, name: t.name, requiresTech: t.requiresTech })));
    const wonders = Object.values(m.GREAT_PROJECTS).map((w) => ({ id: w.id, name: w.name, age: w.ageId, description: w.description }));
    const improvements = Object.entries(m.IMPROVEMENTS).map(([id, i]) => ({ id, name: i.name, requiresTech: i.requiresTech }));
    return { ages: m.AGE_ORDER, techs, units, buildings, wonders, improvements };
  },
  buildRequests: ({ ages, techs, units, buildings, wonders, improvements }) => ages.map((age, i) => {
    const before = ages.slice(0, i);
    const input = {
      age,
      techsOfAge: techs.filter((t) => t.age === age),
      techsOfEarlierAges: techs.filter((t) => before.includes(t.age)).map(({ id, name, age: a }) => ({ id, name, age: a })),
      units: units.filter((u) => u.age === age),
      buildingTiers: buildings.filter((b) => b.age === age),
      wonders: wonders.filter((w) => w.age === age),
      improvements
    };
    return { custom_id: `age-${age}`, params: params(job, SYSTEM, JSON.stringify(input), SCHEMA) };
  }),
  writeOutputs: (results, { ages, techs, units, buildings }, outDir) => {
    const techAge = Object.fromEntries(techs.map((t) => [t.id, ages.indexOf(t.age)]));
    const unitAge = Object.fromEntries(units.map((u) => [u.key, ages.indexOf(u.age)]));
    const bKeys = new Set(buildings.map((b) => b.key));
    const out = { units: {}, buildings: {}, emptyTechs: {}, notes: {}, rejected: [], missing: [] };
    const reject = (age, what, why) => out.rejected.push(`${age}: ${what} (${why})`);
    for (const r of results) {
      const age = r.custom_id.replace('age-', '');
      const j = resultJson(r);
      if (!j) { out.missing.push(`${age}: request failed or bad JSON`); continue; }
      out.notes[age] = j.notes;
      for (const { unit, tech } of j.units) {
        if (!(unit in unitAge)) reject(age, `unit ${unit}`, 'unknown unit');
        else if (tech !== null && !(tech in techAge)) reject(age, `${unit} -> ${tech}`, 'unknown tech');
        else if (tech !== null && techAge[tech] > unitAge[unit]) reject(age, `${unit} -> ${tech}`, 'tech is of a later age');
        else if (unit.endsWith('.infantry') && tech !== null) reject(age, `${unit} -> ${tech}`, 'infantry must need no tech');
        else out.units[unit] = tech;
      }
      for (const { building, tech } of j.buildings) {
        if (!bKeys.has(building)) reject(age, `building ${building}`, 'unknown building tier');
        else if (!(tech in techAge)) reject(age, `${building} -> ${tech}`, 'unknown tech');
        else out.buildings[building] = tech;
      }
      for (const { tech, suggestion } of j.emptyTechs) {
        if (!(tech in techAge)) reject(age, `empty tech ${tech}`, 'unknown tech');
        else out.emptyTechs[tech] = suggestion;
      }
    }
    out.missing.push(...units.map((u) => u.key).filter((k) => !(k in out.units)).map((k) => `unit ${k} has no accepted tech`));
    fs.writeFileSync(path.join(outDir, 'unlocks.json'), `${JSON.stringify(out, null, 2)}\n`);

    const tname = Object.fromEntries(techs.map((t) => [t.id, t.name]));
    const show = (id) => (id === null ? 'at the start' : tname[id] || id);
    const md = ['# Tech unlocks', '', `Rejected: ${out.rejected.length}. Missing: ${out.missing.length}.`, ''];
    for (const age of ages) {
      md.push(`## ${age}`, '', out.notes[age] || '', '', '| Unlocked | Tech |', '|---|---|');
      units.filter((u) => u.age === age && u.key in out.units).forEach((u) => md.push(`| unit ${u.name} (${u.class}) | ${show(out.units[u.key])} |`));
      buildings.filter((b) => b.age === age && b.key in out.buildings).forEach((b) => md.push(`| building ${b.name} (was ${show(b.requiresTech)}) | ${show(out.buildings[b.key])} |`));
      const empties = techs.filter((t) => t.age === age && t.id in out.emptyTechs);
      if (empties.length) md.push('', 'Techs that unlock nothing:', '', ...empties.map((t) => `- ${t.name}: ${out.emptyTechs[t.id]}`));
      md.push('');
    }
    if (out.rejected.length) md.push('## Rejected', '', ...out.rejected.map((x) => `- ${x}`), '');
    if (out.missing.length) md.push('## Missing', '', ...out.missing.map((x) => `- ${x}`), '');
    fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
  }
};

cli(job, import.meta.url);
