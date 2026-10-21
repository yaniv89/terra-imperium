// scripts/ai/event-cards.mjs
// Old World-style event cards: for each age of src/data/ages.js and each art theme of the peoples,
// about 8 short historical cards with 2 or 3 choices, in the event shape of src/data/events.js
// ({ id, year, title, description, options: [{ label, effects }] }) plus the subject (city, people or
// ruler) and the theme, with the Hebrew under the keys of src/i18n/locales/data/he.events.js
// (evt.<id>.title / .desc / .optN). Writes plans/ai-output/event-cards/cards.json. Flags: claudeJob.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { cli, loadSrc, params, resultJson } from './claudeJob.mjs';

const PER_REQUEST = 8;
// The nation-agnostic effect keys events.js allows (src/engine/applyEventEffects.js applies them).
export const EFFECT_KEYS = ['gold', 'hr', 'copper', 'iron', 'oil', 'techPoints', 'diplomacyPoints', 'militaryStrengthBonus', 'defenseBonus', 'controlBonus', 'controlPenalty'];

const SYSTEM = `You write event cards for a grand-strategy video game on the real Earth, in the spirit of Old World's event cards:
short, concrete, historical, a real dilemma with no obviously right answer, told to the ruler in the second person.
You get one age (years), one art theme (a cultural sphere) with its peoples, their first cities and rulers, and example cards from the game.
Write the requested number of cards set in that age and sphere:
- each card is about one subject: a city, a people or a ruler from the list (kind and the exact English name given).
- title up to 5 words; description 1 to 2 sentences, under 40 words; 2 or 3 options, each label under 10 words.
- effects: 1 to 3 per option, only these keys: ${EFFECT_KEYS.join(', ')}. Match the sizes in the examples
  (resources tens to a few hundred; defenseBonus about 0.05 to 0.15; control 3 to 15). Every option has a cost or a risk.
- year: a whole year inside the age (negative for BCE), when such a thing plausibly happened.
- id: short snake_case, unique, about the event (no theme or age prefix).
- he: the title, description and option labels in natural modern Hebrew, the same meaning and order.
Ground every card in real history of that sphere and age; never claim a specific event that did not happen. No em dashes.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'year', 'subject', 'title', 'description', 'options', 'he'],
        properties: {
          id: { type: 'string' },
          year: { type: 'integer' },
          subject: { type: 'object', additionalProperties: false, required: ['kind', 'name'], properties: { kind: { type: 'string', enum: ['city', 'people', 'ruler'] }, name: { type: 'string' } } },
          title: { type: 'string' },
          description: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['label', 'effects'],
              properties: { label: { type: 'string' }, effects: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: { type: 'string', enum: EFFECT_KEYS }, value: { type: 'number' } } } } }
            }
          },
          he: { type: 'object', additionalProperties: false, required: ['title', 'description', 'options'], properties: { title: { type: 'string' }, description: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } } }
        }
      }
    }
  }
};

/** A model card in the events.js shape, its Hebrew under he.events.js keys; null when it breaks the rules. */
export const toEvent = (card, { ageId, theme, age }) => {
  const id = `ai_${theme}_${String(card.id).toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const ok = card.options?.length >= 2 && card.options.length <= 3 && card.he?.options?.length === card.options.length
    && Number.isInteger(card.year) && card.year >= age.startYear && card.year < age.endYear;
  if (!ok) return null;
  const event = {
    id, year: card.year, ageId, theme, subject: card.subject, title: card.title, description: card.description,
    options: card.options.map((o) => ({ label: o.label, effects: Object.fromEntries(o.effects.filter((e) => EFFECT_KEYS.includes(e.key)).map((e) => [e.key, e.value])) }))
  };
  const he = { [`evt.${id}.title`]: card.he.title, [`evt.${id}.desc`]: card.he.description };
  card.he.options.forEach((label, i) => { he[`evt.${id}.opt${i}`] = label; });
  return { event, he };
};

export const job = {
  name: 'event-cards',
  model: 'claude-opus-5-5',
  effort: 'medium',
  maxTokens: 8000,
  likelyOut: 5500,
  loadData: async () => {
    const m = await loadSrc("export { AGES, AGE_ORDER } from './src/data/ages.js'; export { HISTORICAL_EVENTS } from './src/data/events.js'; export { PEOPLES_LIST } from './src/data/peoples.js';");
    const themes = [...new Set(m.PEOPLES_LIST.map((p) => p.theme))].sort();
    const events = Object.values(m.HISTORICAL_EVENTS);
    const cells = m.AGE_ORDER.flatMap((ageId) => themes.map((theme) => ({
      ageId, theme, age: { name: m.AGES[ageId].name, startYear: m.AGES[ageId].startYear, endYear: m.AGES[ageId].endYear },
      peoples: m.PEOPLES_LIST.filter((p) => p.theme === theme).map((p) => ({ people: p.name, firstCity: p.capital.name, ruler: p.ruler?.name || null, land: p.landName })),
      examples: events.filter((e) => e.ageId === ageId && !e.land).slice(0, 3).map(({ title, description, options }) => ({ title, description, options }))
    })));
    return { cells };
  },
  buildRequests: ({ cells }) => cells.map((c) => ({
    custom_id: `${c.ageId}-${c.theme}`,
    params: params(job, SYSTEM, JSON.stringify({ cards: PER_REQUEST, age: c.age, theme: c.theme, peoples: c.peoples, examples: c.examples }), SCHEMA)
  })),
  writeOutputs: (results, { cells }, outDir) => {
    const byId = Object.fromEntries(cells.map((c) => [`${c.ageId}-${c.theme}`, c]));
    const cards = {}, he = {}, rejected = [];
    results.forEach((r) => (resultJson(r)?.cards || []).forEach((card) => {
      const made = toEvent(card, byId[r.custom_id]);
      if (!made || cards[made.event.id]) { rejected.push({ cell: r.custom_id, id: card.id }); return; }
      cards[made.event.id] = made.event;
      Object.assign(he, made.he);
    }));
    const failed = results.filter((r) => !resultJson(r)).map((r) => r.custom_id);
    fs.writeFileSync(path.join(outDir, 'cards.json'), `${JSON.stringify({ failed, rejected, cards, he }, null, 2)}\n`);
  }
};

cli(job, import.meta.url);
