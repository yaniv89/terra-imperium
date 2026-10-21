// scripts/ai/fact-check.mjs
// A historian's pass over the event cards: the hand-written events of src/data/events.js (Hebrew in
// src/i18n/locales/data/he.events.js) and the AI cards of the event-cards job, read with
// `git show $CARDS_REF:plans/ai-output/event-cards/cards.json` (CARDS_FILE, a local path, overrides
// it). Per card: dates against its age, anachronisms, wrong facts, whether the theme fits the people,
// and the Hebrew title and options against the English. Writes plans/ai-output/fact-check/report.md
// (problems ranked by severity, each with a fix) and verdicts.json ({ id: { ok, severity, problem, fix } }).
// Flags: claudeJob.mjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cli, loadSrc, params, resultJson } from './claudeJob.mjs';

const CHUNK = 10;
export const DEFAULT_CARDS_REF = 'origin/ai/event-cards-39615084757';
const CARDS_PATH = 'plans/ai-output/event-cards/cards.json';
const KINDS = ['date', 'anachronism', 'fact', 'theme', 'hebrew', 'none'];

const SYSTEM = `You are a careful historian checking the event cards of a grand-strategy video game on the real Earth (5000 BCE to 2300 CE).
You get a list of cards. Each has an id, its age (name and year range), its year (negative = BCE), the art theme (a cultural sphere) with the peoples of that sphere,
the subject (a city, a people or a ruler), the English title, description and option labels, and the Hebrew title, description and options.
A card with theme null is a world event that fires for every people; land, when given, is the modern country it is meant for.
Check each card for:
- date: the year falls outside its age, or is clearly wrong for what the card describes.
- anachronism: a person, place, technology, institution, word or name that did not exist yet at that year (or no longer existed).
- fact: a historical claim that is wrong, or a specific event that never happened presented as real.
- theme: the subject or story does not belong to that sphere's peoples, or the subject name is wrong for the people.
- hebrew: the Hebrew title, description or an option says something different from the English, is missing, or is in the wrong order.
Plausible invented everyday dilemmas ("your merchants ask...") are fine when they fit the time and place; do not flag them as fact.
Give every card a verdict. ok true when nothing needs a change. severity: 3 wrong history a knowledgeable player would notice, or a Hebrew line with a different meaning;
2 clearly worth fixing; 1 polish; 0 when ok. kind: the main problem (none when ok). problem: one short sentence. fix: the concrete change
(a corrected year, a replacement word or name, a rewritten line, or the corrected Hebrew); empty when ok. No em dashes.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'ok', 'severity', 'kind', 'problem', 'fix'],
        properties: {
          id: { type: 'string' },
          ok: { type: 'boolean' },
          severity: { type: 'integer', enum: [0, 1, 2, 3] },
          kind: { type: 'string', enum: KINDS },
          problem: { type: 'string' },
          fix: { type: 'string' }
        }
      }
    }
  }
};

/** The AI cards file: CARDS_FILE (a path) or `git show <CARDS_REF>:<path>`. Throws with the fix when the ref is missing. */
export const readAiCards = () => {
  if (process.env.CARDS_FILE) return JSON.parse(fs.readFileSync(process.env.CARDS_FILE, 'utf8'));
  const ref = process.env.CARDS_REF || DEFAULT_CARDS_REF;
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${CARDS_PATH}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    throw new Error(`Cannot read ${CARDS_PATH} at ${ref} (git fetch origin ${ref.replace(/^origin\//, '')} first?): ${String(e.stderr || e.message).trim()}`);
  }
};

/** One card for the prompt: English, Hebrew from the he table under evt.<id>.*, the age range and the theme's peoples. */
export const cardFor = (e, he, ages, peoplesOf) => {
  const opts = e.options.map((o, i) => ({ en: o.label, he: he[`evt.${e.id}.opt${i}`] ?? null }));
  const age = ages[e.ageId] || {};
  return {
    id: e.id, source: e.id.startsWith('ai_') ? 'ai' : 'hand', year: e.year,
    age: { id: e.ageId, name: age.name, startYear: age.startYear, endYear: age.endYear },
    theme: e.theme ?? null, peoples: e.theme ? peoplesOf[e.theme] || [] : undefined, land: e.land, subject: e.subject,
    title: { en: e.title, he: he[`evt.${e.id}.title`] ?? null }, description: { en: e.description, he: he[`evt.${e.id}.desc`] ?? null }, options: opts
  };
};

export const job = {
  name: 'fact-check',
  model: 'claude-opus-5-5',
  effort: 'high',
  maxTokens: 12000,
  likelyOut: 5000,
  loadData: async () => {
    const m = await loadSrc("export { AGES } from './src/data/ages.js'; export { HISTORICAL_EVENTS } from './src/data/events.js'; export { PEOPLES_LIST } from './src/data/peoples.js'; export { default as HE } from './src/i18n/locales/data/he.events.js';");
    const ai = readAiCards();
    const peoplesOf = {};
    m.PEOPLES_LIST.forEach((p) => { (peoplesOf[p.theme] ||= []).push(p.name); });
    const he = { ...m.HE, ...(ai.he || {}) };
    const cards = [...Object.values(m.HISTORICAL_EVENTS), ...Object.values(ai.cards || {})].map((e) => cardFor(e, he, m.AGES, peoplesOf));
    return { cards, byId: Object.fromEntries(cards.map((c) => [c.id, c])) };
  },
  buildRequests: ({ cards }) => {
    // Group by theme so a request shares one sphere's peoples; the hand-written world events go first.
    const sorted = [...cards].sort((a, b) => String(a.theme ?? '').localeCompare(String(b.theme ?? '')) || a.year - b.year);
    const out = [];
    for (let i = 0; i < sorted.length; i += CHUNK) {
      out.push({ custom_id: `cards-${String(i / CHUNK).padStart(3, '0')}`, params: params(job, SYSTEM, JSON.stringify(sorted.slice(i, i + CHUNK)), SCHEMA) });
    }
    return out;
  },
  writeOutputs: (results, { byId }, outDir) => {
    const verdicts = {};
    results.forEach((r) => (resultJson(r)?.verdicts || []).forEach((v) => {
      if (byId[v.id] && !verdicts[v.id]) verdicts[v.id] = { ok: v.ok && v.severity === 0, severity: v.severity, kind: v.kind, problem: v.problem, fix: v.fix };
    }));
    const unchecked = Object.keys(byId).filter((id) => !verdicts[id]);
    const bad = Object.entries(verdicts).filter(([, v]) => !v.ok).sort(([a, x], [b, y]) => y.severity - x.severity || KINDS.indexOf(x.kind) - KINDS.indexOf(y.kind) || a.localeCompare(b));
    const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const md = [
      '# Event cards: fact check', '',
      `${Object.keys(verdicts).length} cards checked, ${bad.length} with a problem (3 wrong history or a Hebrew line with another meaning, 2 worth fixing, 1 polish).`,
      unchecked.length ? `Not checked (a failed or incomplete request): ${unchecked.join(', ')}.` : 'Every card was checked.', '',
      '| Sev | Kind | Card | Year | Title | Problem | Suggested fix |', '|---|---|---|---|---|---|---|',
      ...bad.map(([id, v]) => `| ${v.severity} | ${v.kind} | \`${id}\` | ${byId[id].year} | ${cell(byId[id].title.en)} | ${cell(v.problem)} | ${cell(v.fix)} |`)
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'report.md'), `${md}\n`);
    fs.writeFileSync(path.join(outDir, 'verdicts.json'), `${JSON.stringify(verdicts, null, 2)}\n`);
  }
};

cli(job, import.meta.url);
