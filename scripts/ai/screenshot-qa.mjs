// scripts/ai/screenshot-qa.mjs
// Layout faults in screenshots of the main screens. The workflow builds the game with VITE_QA_HOOK=1,
// serves it with `npm run preview` and runs scripts/ui/qa-shots.mjs, which writes JPEGs and
// manifest.json into plans/ai-output/screenshot-qa/shots/ (SHOTS_DIR overrides). One request per screen
// and size sends the English and the Hebrew shot together, so right-to-left mirroring can be compared,
// and asks for layout faults only. Writes plans/ai-output/screenshot-qa/report.md (each finding with the
// screen, size, language, severity and file). Without screenshots (a local --dry-run) the requests are
// built from the screen list with empty images, priced at the image cap. Flags: claudeJob.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cli, params, resultJson } from './claudeJob.mjs';
import { LANGS, SCREENS, SIZES, shotFile } from '../ui/qa-shots.mjs';

export const SHOTS = 'plans/ai-output/screenshot-qa/shots';
const MAX_DIR_BYTES = 15 * 1024 * 1024;
const KINDS = ['cut-off', 'overlap', 'off-screen', 'notch', 'small-text', 'rtl', 'untranslated', 'empty', 'other'];
const LANG_NAME = { en: 'English', he: 'Hebrew (right to left)' };

const SYSTEM = `You check screenshots of a grand-strategy video game for layout faults only. You do not judge art, colours, game design or wording style.
You get one screen at one size, in English and in Hebrew (the Hebrew build mirrors the layout right to left).
Report only real faults you can see:
- cut-off: text or a control clipped by its box or the screen edge, or ending in a cut word.
- overlap: text or controls drawn over each other.
- off-screen: a control or panel partly outside the screen.
- notch: on the phone (844x390 landscape) an important control within about 44 px of the left or right edge, where a notch or rounded corner covers it.
- small-text: numbers or labels too small to read at that size.
- rtl: in Hebrew, something not mirrored that should be (text alignment, icon order, panel side), mirrored that should not be (numbers, clocks, the map), or mixed Hebrew and Latin in a broken order.
- untranslated: English or Latin text left in the Hebrew shot, or a raw key, an id or a {placeholder} shown on screen in either language.
- empty: a panel, list or card that is empty, broken, or shows an error.
severity: 3 a player cannot read or use it, 2 clearly wrong, 1 polish. where: the place on screen in a few words (for example "top bar, right end").
Most screens are fine: return an empty list when nothing is wrong. A map with fog, dark areas or few labels is normal. No em dashes.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lang', 'severity', 'kind', 'where', 'problem'],
        properties: {
          lang: { type: 'string', enum: LANGS },
          severity: { type: 'integer', enum: [1, 2, 3] },
          kind: { type: 'string', enum: KINDS },
          where: { type: 'string' },
          problem: { type: 'string' }
        }
      }
    }
  }
};

const shotsDir = () => path.resolve(ROOT, process.env.SHOTS_DIR || SHOTS);

export const job = {
  name: 'screenshot-qa',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  maxTokens: 6000,
  likelyOut: 1500,
  loadData: async () => {
    const dir = shotsDir();
    const manifestFile = path.join(dir, 'manifest.json');
    const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
    const captured = new Set((manifest || []).filter((m) => m.ok).map((m) => m.file));
    const cells = SIZES.flatMap((size) => SCREENS.map((screen) => ({
      screen, size, shots: LANGS.map((lang) => ({ lang, file: shotFile(screen.id, size.id, lang) })).filter((s) => !manifest || captured.has(s.file))
    }))).filter((c) => c.shots.length);
    return { dir, manifest, cells, estimated: !manifest };
  },
  check: ({ dir, manifest, cells }) => {
    if (!manifest) throw new Error(`No ${path.join(dir, 'manifest.json')}: run scripts/ui/qa-shots.mjs first`);
    if (!cells.length) throw new Error('No screenshot was captured');
    const bytes = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
    if (bytes > MAX_DIR_BYTES) throw new Error(`The shots folder is ${(bytes / 1048576).toFixed(1)} MB, over 15 MB: lower the JPEG quality in qa-shots.mjs`);
  },
  buildRequests: ({ dir, cells, estimated }) => cells.map((c) => {
    const content = [{ type: 'text', text: `Screen: ${c.screen.what} (${c.screen.id}). Size: ${c.size.width}x${c.size.height}${c.size.mobile ? `, a phone held landscape, device pixel ratio ${c.size.dpr}` : ', a desktop window'}.` }];
    c.shots.forEach((s) => {
      content.push({ type: 'text', text: `${LANG_NAME[s.lang]} (${s.file}):` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: estimated ? '' : fs.readFileSync(path.join(dir, s.file)).toString('base64') } });
    });
    return { custom_id: `${c.screen.id}-${c.size.id}`, params: params(job, SYSTEM, content, SCHEMA) };
  }),
  writeOutputs: (results, { manifest, cells }, outDir) => {
    const cellOf = Object.fromEntries(cells.map((c) => [`${c.screen.id}-${c.size.id}`, c]));
    const findings = results.flatMap((r) => {
      const c = cellOf[r.custom_id];
      return c ? (resultJson(r)?.findings || []).map((f) => ({ ...f, screen: c.screen.id, size: `${c.size.width}x${c.size.height}`, file: shotFile(c.screen.id, c.size.id, f.lang) })) : [];
    }).sort((a, b) => b.severity - a.severity || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.screen.localeCompare(b.screen));
    const failed = results.filter((r) => !resultJson(r)).map((r) => r.custom_id);
    const missed = (manifest || []).filter((m) => m.file && !m.ok);
    const pageErrors = (manifest || []).filter((m) => m.pageErrors);
    const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const md = [
      '# Screenshot QA: layout faults', '',
      `${findings.length} findings over ${cells.length} screen and size pairs (English and Hebrew together), most serious first (3 unreadable or unusable, 2 clearly wrong, 1 polish).`,
      'The screenshots are in `shots/`. World Congress has no screen yet, so it is not covered.',
      failed.length ? `Requests that failed (not checked): ${failed.join(', ')}.` : 'Every captured screen was checked.', '',
      '| Sev | Kind | Screen | Size | Lang | Where | Problem | File |', '|---|---|---|---|---|---|---|---|',
      ...findings.map((f) => `| ${f.severity} | ${f.kind} | ${f.screen} | ${f.size} | ${f.lang} | ${cell(f.where)} | ${cell(f.problem)} | \`shots/${f.file}\` |`),
      ...(missed.length ? ['', '## Screens that could not be captured', '', ...missed.map((m) => `- \`${m.file}\`: ${cell(m.error)}`)] : []),
      ...(pageErrors.length ? ['', '## Page errors during capture', '', ...pageErrors.flatMap((m) => m.pageErrors.map((e) => `- ${m.size} ${m.lang}: ${cell(e)}`))] : [])
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'report.md'), `${md}\n`);
  }
};

cli(job, import.meta.url);
