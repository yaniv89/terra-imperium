// scripts/ai/glossary-notes.mjs
// A short history note (2 to 3 sentences, English and Hebrew) and a "founded here" line for each of
// the 150 peoples of src/data/peoples.js, flagged uncertain where history is thin. Writes
// plans/ai-output/glossary-notes/notes.json keyed by people id, the shape src/data/glossary can read:
// { [id]: { note: { en, he }, founded: { en, he }, uncertain, basis } }. See claudeJob.mjs for the flags.
import fs from 'node:fs';
import path from 'node:path';
import { cli, loadSrc, params, resultJson } from './claudeJob.mjs';

const CHUNK = 10;

const SYSTEM = `You write glossary notes for a grand-strategy video game set on the real Earth.
For each people you get its game facts (name, first city, modern land, region, its one ruler, Hebrew names the game already uses).
Write in the plain, careful style of a good encyclopedia, as a historian would, only what the sources support:
- note: 2 to 3 short sentences on who they were, when and where, and what they are remembered for.
- founded: one sentence on the first city, e.g. "Historically, the Akkadians made Kish their first seat, around 2300 BCE." Use "c." for approximate dates.
- he: the same two texts in natural modern Hebrew, using the Hebrew names given.
- uncertain: true when the dating, the city or the people itself is debated or thinly attested, or when the game's ruler is legendary.
- basis: a few words on what the knowledge rests on (e.g. "cuneiform royal inscriptions, excavations at Tell Hariri").
Never invent a precise date, a ruler or a city: say "is thought to" or mark uncertain instead. No em dashes.`;

const text2 = { type: 'object', additionalProperties: false, required: ['en', 'he'], properties: { en: { type: 'string' }, he: { type: 'string' } } };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['peoples'],
  properties: {
    peoples: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['id', 'note', 'founded', 'uncertain', 'basis'], properties: { id: { type: 'string' }, note: text2, founded: text2, uncertain: { type: 'boolean' }, basis: { type: 'string' } } }
    }
  }
};

export const job = {
  name: 'glossary-notes',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  maxTokens: 12000,
  likelyOut: 5000,
  loadData: async () => {
    const m = await loadSrc("export { PEOPLES_LIST } from './src/data/peoples.js'; export { nameOf } from './src/i18n/names.js';");
    const peoples = m.PEOPLES_LIST.map((p) => ({
      id: p.id, name: p.name, adjective: p.adjective, firstCity: p.capital.name, modernLand: p.landName, region: p.region,
      ...(p.arrives ? { arrives: p.arrives } : {}),
      ruler: p.ruler?.name ? `${p.ruler.name}${p.ruler.epithet ? ` ${p.ruler.epithet}` : ''}` : null,
      hebrew: { people: m.nameOf('people', p.id, p.name, 'he'), firstCity: m.nameOf('city', null, p.capital.name, 'he'), ruler: p.ruler?.name ? m.nameOf('person', null, p.ruler.name, 'he') : null }
    }));
    return { peoples };
  },
  buildRequests: ({ peoples }) => {
    const out = [];
    for (let i = 0; i < peoples.length; i += CHUNK) {
      out.push({ custom_id: `peoples-${String(i / CHUNK).padStart(2, '0')}`, params: params(job, SYSTEM, JSON.stringify(peoples.slice(i, i + CHUNK)), SCHEMA) });
    }
    return out;
  },
  writeOutputs: (results, { peoples }, outDir) => {
    const ids = new Set(peoples.map((p) => p.id));
    const notes = {};
    results.flatMap((r) => resultJson(r)?.peoples || []).filter((p) => ids.has(p.id)).forEach(({ id, ...rest }) => { notes[id] = rest; });
    const missing = peoples.map((p) => p.id).filter((id) => !notes[id]);
    const sorted = Object.fromEntries(peoples.filter((p) => notes[p.id]).map((p) => [p.id, notes[p.id]]));
    fs.writeFileSync(path.join(outDir, 'notes.json'), `${JSON.stringify({ missing, notes: sorted }, null, 2)}\n`);
  }
};

cli(job, import.meta.url);
