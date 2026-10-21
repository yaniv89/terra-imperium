// scripts/ai/human-playtest.mjs
// A playtester that plays the REAL game like a person, through screenshots only (development only, never
// for live players). The workflow builds the game with VITE_QA_HOOK=1 and serves it with `npm run preview`;
// this script drives it in Playwright's Chromium as a phone held landscape (844x390, touch, iPhone UA,
// safe-area insets as scripts/ui/iphone-check.mjs) or a desktop window. Each step is one fresh request to
// Claude Sonnet 5.5: the cached persona prompt, a text diary of the recent steps, the screenshot before the
// last action and the current one; the model answers with ONE tool call (a gesture, a note or done). No
// assistant turns are replayed, so only the last 2 screenshots are ever in context. After the play one
// Claude Opus 5.5 request turns the diary and notes into report.md. Writes plans/ai-output/human-playtest/
// diary.jsonl, shots/*.jpg (the screens noted) and report.md.
//   node scripts/ai/human-playtest.mjs --max-usd 1.5 --limit 40      (--limit = MAX_STEPS)
// Flags or env: --persona/PERSONA, --size/SIZE phone|desktop, --lang/LANG_UI en|he, --slices/SLICES
// bronze,classical,... (late-game slices: a headless scripted game, saved at each age, loaded through
// window.__game LOAD_GAME; an age the run does not reach in SLICE_TURNS turns is boosted by research),
// --url (default the preview), --max-steps/MAX_STEPS (default 60).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PRICES, call, estTokens, liveUsd } from './claudeJob.mjs';

const API = 'https://api.anthropic.com/v1/messages';
export const PLAY_MODEL = 'claude-sonnet-5-5';
export const REPORT_MODEL = 'claude-opus-5-5';
const PLAY_MAX_TOKENS = 4000;
const REPORT_MAX_TOKENS = 16000;
const OUT = path.join(ROOT, 'plans/ai-output/human-playtest');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INSET = { left: 47, right: 47, top: 0, bottom: 21 }; // iPhone landscape: notch side and home bar
export const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
export const SLICE_AGES = ['bronze', 'classical', 'gunpowder', 'modern', 'information'];

export const AREAS = ['start screen and world setup', 'map pan, zoom, close view and fog', 'cities, builds and settlers', 'units and armies',
  'tech tree', 'economy and gold', 'diplomacy', 'wars and AI behaviour', 'RTS battles (deploy, orders, workers, sieges)', 'naval',
  'crises, events, era goals, independents, raids, World Congress', 'glossary and help', 'save and load', 'speed feel', 'pacing and fun'];

export const PERSONAS = {
  'newcomer-phone': 'You have never played a grand-strategy game. You play on your phone on the bus, held sideways. You read little, tap what looks inviting and get lost easily. You say plainly when you do not know what to do next.',
  'civ-veteran': 'You have played every Civilization and some Paradox games for years. You know what a good city screen, tech tree and diplomacy screen feel like, and you compare. You are quick and impatient with slow menus.',
  warmonger: 'You want to conquer. You build armies early, look for a neighbour to attack, declare war and fight every battle yourself when the game lets you.',
  builder: 'You love growing cities, economy and wonders. You avoid war unless attacked, look at every number about gold, food and production, and plan builds carefully.',
  'rts-commander': 'You came for the real-time tactical battles. You get into a battle as early as you can, deploy, give orders, use workers and sieges, and judge the controls hard.',
  'hebrew-speaker': 'You are an Israeli player who plays in Hebrew. You notice text left in English, broken right-to-left order, mirrored things that should not be, and wording that sounds translated.'
};

const KEYS = /^(Escape|Enter|Tab|Space|Backspace|Delete|Arrow(Up|Down|Left|Right)|PageUp|PageDown|Home|End|F\d{1,2}|[A-Za-z0-9+\-=[\]])$/;
const MOOD = { type: 'integer', enum: [1, 2, 3, 4, 5] };
const COMMON = {
  thought: { type: 'string', description: 'One line: what you expect to happen, and how you feel right now.' },
  fun: { ...MOOD, description: 'How much fun you are having, 1 none to 5 great.' },
  frustration: { ...MOOD, description: 'How frustrated you are, 1 calm to 5 about to quit.' },
  area: { type: 'string', enum: AREAS, description: 'The checklist area this step is about.' }
};
const XY = { x: { type: 'number' }, y: { type: 'number' } };
const ACTIONS = {
  tap: ['Tap (click on desktop) at x,y in screenshot pixels.', XY],
  double_tap: ['Double-tap (double-click) at x,y.', XY],
  long_press: ['Press and hold about 0.9 s at x,y (hold for help).', XY],
  drag: ['Drag a finger (the mouse) from x1,y1 to x2,y2: pans the map, scrolls a list, moves a slider.', { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }],
  pinch: ['Pinch around x,y: scale over 1 zooms in, under 1 zooms out (the mouse wheel on desktop).', { ...XY, scale: { type: 'number' } }],
  type: ['Type text into the focused field.', { text: { type: 'string' } }],
  key: ['Press one key, for example Escape, Enter, Space, ArrowUp.', { name: { type: 'string' } }],
  wait: ['Wait while the game works (100 to 10000 ms).', { ms: { type: 'number' } }],
  note: ['Write down an observation for the team; the current screenshot is saved with it. Does not touch the game.', {
    kind: { type: 'string', enum: ['bug', 'ux', 'confusing', 'fun', 'boring', 'slow', 'praise'] }, severity: { type: 'integer', enum: [1, 2, 3], description: '3 blocks or ruins play, 2 clearly wrong or annoying, 1 polish.' }, text: { type: 'string' }
  }],
  done: ['End this session (only when every checklist area was at least looked at, or you would quit for real).', { summary: { type: 'string' } }]
};

export const TOOLS = Object.entries(ACTIONS).map(([name, [description, props]]) => ({
  name, description, strict: true,
  input_schema: { type: 'object', additionalProperties: false, required: [...Object.keys(props), ...Object.keys(COMMON)], properties: { ...props, ...COMMON } }
}));

const num = (v, lo, hi, what) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${what} must be a number`);
  if (v < lo || v > hi) throw new Error(`${what} ${v} is outside ${lo}..${hi}`);
  return Math.round(v);
};

/** A tool_use block -> { name, args, thought, fun, frustration, area }; throws a plain reason on bad input. */
export const parseAction = (block, size = SIZES.phone) => {
  if (!block || block.type !== 'tool_use' || !ACTIONS[block.name]) throw new Error(`not a known tool call: ${block?.name ?? block?.type}`);
  const i = block.input || {};
  const W = size.width - 1; const H = size.height - 1;
  const p = (k) => num(i[k], 0, k.startsWith('x') ? W : H, k);
  const args = {
    tap: () => ({ x: p('x'), y: p('y') }), double_tap: () => ({ x: p('x'), y: p('y') }), long_press: () => ({ x: p('x'), y: p('y') }),
    drag: () => ({ x1: p('x1'), y1: p('y1'), x2: p('x2'), y2: p('y2') }),
    pinch: () => ({ x: p('x'), y: p('y'), scale: num(i.scale * 100, 25, 400, 'scale x100') / 100 }),
    type: () => { if (typeof i.text !== 'string' || !i.text || i.text.length > 200) throw new Error('text must be 1 to 200 characters'); return { text: i.text }; },
    key: () => { if (!KEYS.test(String(i.name))) throw new Error(`unknown key ${i.name}`); return { name: i.name }; },
    wait: () => ({ ms: num(i.ms, 100, 10000, 'ms') }),
    note: () => {
      if (!ACTIONS.note[1].kind.enum.includes(i.kind)) throw new Error(`unknown note kind ${i.kind}`);
      if (![1, 2, 3].includes(i.severity)) throw new Error('severity must be 1, 2 or 3');
      return { kind: i.kind, severity: i.severity, text: String(i.text || '').slice(0, 1000) };
    },
    done: () => ({ summary: String(i.summary || '').slice(0, 1000) })
  }[block.name]();
  const mood = (v) => ([1, 2, 3, 4, 5].includes(v) ? v : null);
  return { name: block.name, args, thought: String(i.thought || '').slice(0, 300), fun: mood(i.fun), frustration: mood(i.frustration), area: AREAS.includes(i.area) ? i.area : null };
};

/** An image's input tokens at its size (the API's width*height/750 rule). */
export const imageTokens = (size) => Math.ceil((size.width * size.height) / 750);
/** The worst case of one play step: its text, two screenshots, and max_tokens out. */
export const stepWorstUsd = (promptText, size) => {
  const p = PRICES[PLAY_MODEL];
  return ((estTokens(promptText) + 2 * imageTokens(size)) * p.in + PLAY_MAX_TOKENS * p.out) / 1e6;
};
/** The worst case of the closing report, kept back from the budget so the play never eats it. */
export const reportWorstUsd = (diaryText) => {
  const p = PRICES[REPORT_MODEL];
  return ((estTokens(diaryText) + 3000) * p.in + REPORT_MAX_TOKENS * p.out) / 1e6;
};

export const parseFlags = (argv, env = process.env) => {
  const val = (flag, key, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : (env[key] || dflt); };
  const persona = val('--persona', 'PERSONA', 'newcomer-phone');
  if (!PERSONAS[persona]) throw new Error(`Unknown persona ${persona}: ${Object.keys(PERSONAS).join(', ')}`);
  const sizeId = val('--size', 'SIZE', 'phone');
  if (!SIZES[sizeId]) throw new Error('--size must be phone or desktop');
  const lang = val('--lang', 'LANG_UI', persona === 'hebrew-speaker' ? 'he' : 'en');
  if (!['en', 'he'].includes(lang)) throw new Error('--lang must be en or he');
  const slices = String(val('--slices', 'SLICES', '')).split(',').map((s) => s.trim()).filter(Boolean);
  slices.forEach((a) => { if (!SLICE_AGES.includes(a)) throw new Error(`Unknown slice ${a}: ${SLICE_AGES.join(', ')}`); });
  const maxSteps = Number(val('--limit', 'MAX_STEPS', '') || val('--max-steps', 'MAX_STEPS', 60));
  if (!(Number.isInteger(maxSteps) && maxSteps > 0 && maxSteps <= 500)) throw new Error('MAX_STEPS must be 1 to 500');
  const maxUsd = Number(val('--max-usd', 'MAX_USD', 10));
  if (!(maxUsd > 0)) throw new Error('--max-usd must be a positive number');
  return { persona, sizeId, size: SIZES[sizeId], lang, slices, maxSteps, maxUsd, url: val('--url', 'GAME_URL', 'http://localhost:4173/terra-imperium/'), sliceTurns: Number(env.SLICE_TURNS) || 150 };
};

export const systemPrompt = (persona, size, lang) => `You are playtesting a grand-strategy video game (real Earth hex map, 150 peoples, Civilization-like research, cities, wars, diplomacy, real-time tactical battles) for its development team.
Who you are: ${PERSONAS[persona]}
You play the real game through screenshots only, like a person: you see the screen and nothing else. The game is in ${lang === 'he' ? 'Hebrew, laid out right to left' : 'English'}.
The screen is ${size.width}x${size.height} pixels${size.mobile ? ', a phone held landscape with touch (the notch and rounded corners cover about 47 px at the left and right edges)' : ', a desktop window with a mouse'}. Coordinates are pixels in the screenshot, x from the left, y from the top. Aim at the middle of a control.
Every turn you get a short diary of your recent steps, the screenshot before your last action and the current one. Answer with exactly ONE tool call, nothing else. Every call carries a one-line thought (what you expect, how you feel), fun and frustration from 1 to 5, and the checklist area it is about.
If the screen did not change after a tap, the tap may have missed or the game may be busy: try once more, wait, or try something else, and note it if it keeps happening.
Use note for anything the team should know: bugs (something broken or wrong), ux (hard to find or use, too small, covered), confusing (you do not understand it), boring, slow, fun and praise. Be specific: what you did, what you expected, what happened. One note per finding.
Play naturally, in your own style, but cover this checklist; before done make sure each area was at least looked at:
${AREAS.map((a) => `- ${a}`).join('\n')}
End turns now and then so the world moves (the End Turn button); answer the cards and prompts the game shows. If a battle opens, play it or pick Auto as your persona would. Do not stop early. No em dashes.`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Late-game saves: a headless scripted game (scripts/simulate.mjs engine) saved at each age it reaches. */
export const buildSlices = async (ages, turns, log) => {
  const { buildSimEngine, advanceCampaign } = await import('../simulate.mjs');
  const { createScriptedPlayer } = await import('../campaignTelemetry.mjs');
  const file = await buildSimEngine(["export { withAgesResearched } from '../src/engine/research.js';"]);
  const e = await import(pathToFileURL(file).href);
  fs.rmSync(file, { force: true });
  const seed = 4242;
  const player = e.MAJOR_PEOPLES_LIST[seed % e.MAJOR_PEOPLES_LIST.length].id;
  let s = e.createInitialState({ playerNationId: player, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
  s = e.gameReducer({ ...s, battleSettings: { defaultMode: 'auto', autoDefend: true } }, { type: e.ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } });
  const scripted = createScriptedPlayer({ engine: e, opinionOf: e.opinionOf });
  const saves = {};
  // battleSettings: undefined drops the harness's auto battles from the JSON, so the player gets the defaults
  const keep = (st, boosted) => { saves[e.getTechAgeId(st, player)] ??= { state: { ...st, battleSettings: undefined }, turn: st.turnNumber, boosted }; };
  for (let t = 0; t < turns && ages.some((a) => !saves[a]); t++) {
    if (s.activeEventId) s = e.gameReducer(s, { type: e.ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    s = scripted.answer(s).state;
    s = advanceCampaign(e, s);
    keep(s, false);
    if (s.gameStatus !== 'ACTIVE') break;
  }
  log(`slices: ${player}, turn ${s.turnNumber}, age ${e.getTechAgeId(s, player)}; reached ${Object.keys(saves).join(', ')}`);
  return Object.fromEntries(ages.map((a) => {
    if (saves[a]) return [a, saves[a]];
    // Not reached in time: every major gets the research of the ages before it, so the world moves on with the player.
    let b = s;
    Object.values(b.nations).filter((n) => !n.isEliminated && !e.isIndependentNation(n)).forEach((n) => { b = e.withAgesResearched(b, n.id, a); });
    return [a, { state: { ...b, battleSettings: undefined }, turn: b.turnNumber, boosted: true }];
  }));
};

const openGame = async (browser, { size, lang, url }) => {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.mobile ? 2 : 1, isMobile: size.mobile, hasTouch: size.mobile, ...(size.mobile ? { userAgent: UA } : {}), locale: lang === 'he' ? 'he-IL' : 'en-US' });
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('hpt')) { localStorage.clear(); sessionStorage.setItem('hpt', '1'); } localStorage.setItem('terra-imperium.language', l); } catch { /* storage blocked */ } }, lang);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (size.mobile) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSET }).catch(() => {});
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err.message || err).slice(0, 300)));
  await page.goto(url, { timeout: 240000 });
  await page.locator('[data-people]').first().waitFor({ timeout: 300000 });
  return { ctx, page, cdp, errors };
};

// The harness, not the player, starts a slice: through the start screen as qa-shots.mjs does, then LOAD_GAME.
const loadSlice = async (page, save) => {
  const click = (l) => l.dispatchEvent('click');
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-ready'));
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /^(Skip|דילוג|דלג)$/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 120000 });
  await page.evaluate((json) => window.__game.dispatch({ type: 'LOAD_GAME', payload: JSON.parse(json) }), JSON.stringify(save.state));
  await wait(4000);
};

/** Runs one gesture in the page. Touch through CDP on a phone, the mouse on desktop. */
export const perform = async ({ page, cdp, mobile }, { name, args: a }) => {
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (x, y, hold = 60) => { await touch('touchStart', [{ x, y, id: 1 }]); await wait(hold); await touch('touchEnd', []); };
  const m = page.mouse;
  switch (name) {
    case 'tap': return mobile ? tap(a.x, a.y) : m.click(a.x, a.y);
    case 'double_tap': return mobile ? tap(a.x, a.y).then(() => wait(90)).then(() => tap(a.x, a.y)) : m.dblclick(a.x, a.y);
    case 'long_press': return mobile ? tap(a.x, a.y, 900) : m.move(a.x, a.y).then(() => m.down()).then(() => wait(900)).then(() => m.up());
    case 'drag': {
      const at = (k) => [a.x1 + ((a.x2 - a.x1) * k) / 12, a.y1 + ((a.y2 - a.y1) * k) / 12];
      if (mobile) { await touch('touchStart', [{ x: a.x1, y: a.y1, id: 1 }]); for (let k = 1; k <= 12; k++) { const [x, y] = at(k); await touch('touchMove', [{ x, y, id: 1 }]); await wait(16); } return touch('touchEnd', []); }
      await m.move(a.x1, a.y1); await m.down(); await m.move(a.x2, a.y2, { steps: 12 }); return m.up();
    }
    case 'pinch': return mobile
      ? cdp.send('Input.synthesizePinchGesture', { x: a.x, y: a.y, scaleFactor: a.scale, gestureSourceType: 'touch' })
      : m.move(a.x, a.y).then(() => m.wheel(0, -300 * Math.log2(a.scale)));
    case 'type': return page.keyboard.type(a.text, { delay: 30 });
    case 'key': return page.keyboard.press(a.name);
    case 'wait': return wait(a.ms);
    default: return undefined; // note and done do not touch the game
  }
};

const ask = async (key, body) => (await call(API, { key, method: 'POST', body })).json();
const line = (d) => `#${d.step} [${d.segment}] ${d.name}${d.args ? ` ${JSON.stringify(d.args)}` : ''}${d.error ? ` (refused: ${d.error})` : ''} | ${d.thought || ''} | fun ${d.fun ?? '-'} frustration ${d.frustration ?? '-'}`;

const play = async (opts, log = console.log) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const { launchBrowser } = await import('../lib/browserLaunch.mjs');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const diaryFile = path.join(OUT, 'diary.jsonl');
  const diary = [];
  const write = (d) => { diary.push(d); fs.appendFileSync(diaryFile, `${JSON.stringify(d)}\n`); log(line(d)); };
  const system = [{ type: 'text', text: systemPrompt(opts.persona, opts.size, opts.lang), cache_control: { type: 'ephemeral' } }];
  const saves = opts.slices.length ? await buildSlices(opts.slices, opts.sliceTurns, log) : {};
  const segments = [{ id: 'start', what: 'a new game from the start screen' }, ...opts.slices.map((a) => ({ id: a, what: `a game already in the ${a} age (turn ${saves[a].turn}${saves[a].boosted ? ', research boosted by the harness' : ''}): carry on from here`, save: saves[a] }))];
  const perSegment = Math.max(1, Math.floor(opts.maxSteps / segments.length));
  const covered = new Set();
  let spent = 0; let step = 0; let stopped = null;
  const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
  try {
    for (const seg of segments) {
      if (stopped) break;
      const g = await openGame(browser, opts);
      if (seg.save) await loadSlice(g.page, seg.save);
      const shoot = () => g.page.screenshot({ type: 'jpeg', quality: 55, scale: 'css', timeout: 120000 });
      let prev = null; let now = await shoot();
      for (let k = 0; k < perSegment; k++) {
        const left = AREAS.filter((a) => !covered.has(a));
        const text = [`Session: ${seg.what}. Step ${k + 1} of ${perSegment} in this session (${step + 1} of ${opts.maxSteps} overall).`,
          `Checklist areas not looked at yet: ${left.join('; ') || 'none'}.`,
          'Your diary (oldest first):', ...diary.slice(-30).map(line)].join('\n');
        const worst = stepWorstUsd(JSON.stringify(system) + JSON.stringify(TOOLS) + text, opts.size);
        if (spent + worst + reportWorstUsd(diary.map(line).join('\n')) > opts.maxUsd) { stopped = `budget: $${spent.toFixed(2)} spent of $${opts.maxUsd}`; break; }
        const content = [{ type: 'text', text }];
        if (prev) content.push({ type: 'text', text: 'Before your last action:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: prev.toString('base64') } });
        content.push({ type: 'text', text: 'The screen now:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: now.toString('base64') } }, { type: 'text', text: 'Answer with one tool call.' });
        const res = await ask(key, { model: PLAY_MODEL, max_tokens: PLAY_MAX_TOKENS, system, tools: TOOLS, tool_choice: { type: 'auto', disable_parallel_tool_use: true }, output_config: { effort: 'low' }, messages: [{ role: 'user', content }] });
        spent += liveUsd(PLAY_MODEL, res.usage);
        step += 1;
        const errorsBefore = g.errors.length;
        const base = { step, segment: seg.id, usd: Number(spent.toFixed(4)) };
        if (res.stop_reason === 'refusal') { write({ ...base, name: 'refusal', error: res.stop_details?.category || 'refused' }); stopped = 'the model refused'; break; }
        const block = (res.content || []).find((b) => b.type === 'tool_use');
        let act;
        try { act = parseAction(block, opts.size); } catch (err) {
          write({ ...base, name: block?.name || 'no-tool', error: err.message, said: (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').slice(0, 300) });
          continue;
        }
        if (act.area) covered.add(act.area);
        const d = { ...base, ...act };
        if (act.name === 'done' && left.length > 1 && k + left.length < perSegment) { write({ ...d, error: `not yet: look at ${left.join('; ')}` }); continue; }
        if (act.name === 'note') { d.shot = `shots/step-${String(step).padStart(3, '0')}.jpg`; fs.writeFileSync(path.join(OUT, d.shot), now); }
        try { await perform({ ...g, mobile: opts.size.mobile }, act); } catch (err) { d.error = String(err.message).split('\n')[0]; }
        if (act.name === 'done') { write(d); break; }
        await wait(act.name === 'wait' || act.name === 'note' ? 300 : 1500);
        if (g.errors.length > errorsBefore) d.pageErrors = g.errors.slice(errorsBefore, errorsBefore + 3);
        write(d);
        if (act.name !== 'note') { prev = now; now = await shoot(); }
      }
      await g.ctx.close();
    }
  } finally { await browser.close(); }
  return { diary, spent, stopped, covered: [...covered], segments: segments.map((s) => s.id) };
};

const REPORT_SYSTEM = `You turn a playtest diary into a report for the development team of a grand-strategy game (real Earth hex map, research, cities, wars, diplomacy, real-time tactical battles).
A model played the real game through screenshots as a persona, one gesture a step; each diary line has the action, a one-line thought, fun and frustration from 1 to 5, and the checklist area; notes are its findings, each with a screenshot path. Page errors were caught by the harness, not seen by the player.
Write Markdown, plain English, no em dashes:
1. Summary: one paragraph, and the three things that matter most.
2. Scorecard: a table of every checklist area with a score out of 10 and a one-line why; "not reached" when the diary never got there.
3. Fun curve: how fun and frustration moved over the steps (quote step numbers), where it peaked and where it sank, and why.
4. Top issues, ranked by how much they hurt a real player: what happened, the step numbers, the screenshot paths, and a suggested fix.
5. Bugs: each with steps to reproduce from the diary.
6. What was good.
7. Coverage: which areas were played, only glanced at, or missed, and what the next run should aim at.
Judge from the diary only; say when something is unclear (a missed tap is not always a game bug).`;

const writeReport = async (opts, run, log = console.log) => {
  const key = process.env.ANTHROPIC_API_KEY;
  const notes = run.diary.filter((d) => d.name === 'note');
  const errors = run.diary.filter((d) => d.pageErrors).map((d) => `step ${d.step}: ${d.pageErrors.join(' / ')}`);
  const user = [`Persona: ${opts.persona} (${PERSONAS[opts.persona]})`, `Screen: ${opts.sizeId} ${opts.size.width}x${opts.size.height}, language ${opts.lang}. Sessions: ${run.segments.join(', ')}. Steps: ${run.diary.length}${run.stopped ? `, stopped early (${run.stopped})` : ''}.`,
    `Areas the player said it looked at: ${run.covered.join('; ') || 'none'}.`, '', 'Diary:', ...run.diary.map(line), '', 'Notes:',
    ...notes.map((d) => `#${d.step} ${d.args.kind} sev ${d.args.severity} (${d.shot}): ${d.args.text}`), '', `Page errors: ${errors.join('\n') || 'none'}`].join('\n');
  const res = await ask(key, { model: REPORT_MODEL, max_tokens: REPORT_MAX_TOKENS, system: REPORT_SYSTEM, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: user }] });
  const cost = liveUsd(REPORT_MODEL, res.usage);
  const md = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || `The report request ended with ${res.stop_reason}.`;
  const total = run.spent + cost;
  fs.writeFileSync(path.join(OUT, 'report.md'), `# Human playtest: ${opts.persona}\n\n${md}\n\n---\n${run.diary.length} steps, play $${run.spent.toFixed(2)} (${PLAY_MODEL}) + report $${cost.toFixed(2)} (${REPORT_MODEL}) = $${total.toFixed(2)}. Diary: \`diary.jsonl\`, noted screens: \`shots/\`.\n`);
  log(`human-playtest: ${run.diary.length} steps, ${notes.length} notes, $${total.toFixed(2)} in all`);
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const opts = parseFlags(process.argv.slice(2));
  play(opts).then((run) => writeReport(opts, run)).catch((err) => { console.error(err.stack || err.message); process.exit(1); });
}
