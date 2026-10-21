// scripts/ai/hebrew-review.mjs
// Sends every English/Hebrew pair of src/i18n/locales (and the Hebrew-only data table, keyed by data
// id, whose English lives in src/data) in chunks, and asks for the Hebrew lines that are wrong,
// unnatural, untranslated or have broken placeholders. Writes plans/ai-output/hebrew-review/
// report.md (ranked) and fixes.json ({ key: suggested Hebrew }). See claudeJob.mjs for the flags.
import fs from 'node:fs';
import path from 'node:path';
import { cli, loadSrc, params, resultJson } from './claudeJob.mjs';

const CHUNK = 150;
const PROBLEMS = ['wrong', 'unnatural', 'untranslated', 'placeholder'];

const SYSTEM = `You review the Hebrew text of a grand-strategy video game (ancient to future history, Civilization-like).
You get a JSON list of lines: key (where it is used), en (the English source; null when only the key explains it) and he.
Report only the Hebrew lines that need a change:
- wrong: the meaning differs from the English or the game sense of the key
- unnatural: correct but stiff, machine-like or not how a Hebrew game would say it
- untranslated: English or Latin letters left in, or a transliteration where Hebrew has a common word
- placeholder: a {name} placeholder missing, renamed, added or translated (placeholders must match the English exactly)
Keep fixes short, in modern Hebrew, gender and plural agreeing with the placeholders, the same {placeholders} as the English.
severity: 3 a player would be confused or the line breaks, 2 clearly worth fixing, 1 polish.
Most lines are fine: return an empty list when nothing needs a change. Do not report a line just to rephrase it.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'problem', 'severity', 'fix', 'why'],
        properties: {
          key: { type: 'string' },
          problem: { type: 'string', enum: PROBLEMS },
          severity: { type: 'integer', enum: [1, 2, 3] },
          fix: { type: 'string' },
          why: { type: 'string' }
        }
      }
    }
  }
};

export const job = {
  name: 'hebrew-review',
  model: 'claude-haiku-5-5',
  effort: 'low',
  maxTokens: 8000,
  likelyOut: 2500,
  loadData: async () => {
    const m = await loadSrc("export { tableOf, dataTable } from './src/i18n/core.js';");
    const en = m.tableOf('en'), he = m.tableOf('he'), data = m.dataTable('he');
    const lines = [
      ...Object.keys(he).map((key) => ({ key, en: en[key] ?? null, he: he[key] })),
      ...Object.keys(data).filter((key) => he[key] === undefined).map((key) => ({ key, en: null, he: data[key] }))
    ].filter((l) => typeof l.he === 'string');
    return { lines, byKey: Object.fromEntries(lines.map((l) => [l.key, l])) };
  },
  buildRequests: ({ lines }) => {
    const out = [];
    for (let i = 0; i < lines.length; i += CHUNK) {
      out.push({ custom_id: `chunk-${String(i / CHUNK).padStart(3, '0')}`, params: params(job, SYSTEM, JSON.stringify(lines.slice(i, i + CHUNK)), SCHEMA) });
    }
    return out;
  },
  writeOutputs: (results, { byKey }, outDir) => {
    const issues = results.flatMap((r) => resultJson(r)?.issues || []).filter((x) => byKey[x.key] && x.fix && x.fix !== byKey[x.key].he);
    issues.sort((a, b) => b.severity - a.severity || PROBLEMS.indexOf(a.problem) - PROBLEMS.indexOf(b.problem) || a.key.localeCompare(b.key));
    const failed = results.filter((r) => !resultJson(r)).map((r) => r.custom_id);
    const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const md = [
      '# Hebrew review', '',
      `${issues.length} lines to look at, most serious first (3 confusing or broken, 2 worth fixing, 1 polish).`,
      failed.length ? `Chunks that failed and were not reviewed: ${failed.join(', ')}.` : 'Every chunk was reviewed.', '',
      '| Sev | Problem | Key | English | Hebrew now | Suggested | Why |', '|---|---|---|---|---|---|---|',
      ...issues.map((x) => `| ${x.severity} | ${x.problem} | \`${cell(x.key)}\` | ${cell(byKey[x.key].en)} | ${cell(byKey[x.key].he)} | ${cell(x.fix)} | ${cell(x.why)} |`)
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'report.md'), `${md}\n`);
    fs.writeFileSync(path.join(outDir, 'fixes.json'), `${JSON.stringify(Object.fromEntries(issues.map((x) => [x.key, x.fix])), null, 2)}\n`);
  }
};

cli(job, import.meta.url);
