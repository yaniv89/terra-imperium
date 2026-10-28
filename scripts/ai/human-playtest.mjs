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
// bronze,classical,... (late-game slices: the era saves of scripts/ai/build-era-saves.mjs, a real game played headless,
// loaded through window.__game.load, which runs migrateSave; a slice that loads to no map or a blank screen is a harness-error line, not played),
// --url (default the preview), --max-steps/MAX_STEPS (default 60).
// --scene/SCENE campaign|battle: battle opens ?battleSandbox once per age of --battle-ages/BATTLE_AGES (default all eight),
// each with its own setup (field, walls, naval, sack), and splits the steps across them.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PRICES, call, estTokens, liveUsd } from './claudeJob.mjs';
import { AGE_ORDER } from '../../src/data/ages.js';
import { eraSaveFile, readEraSave } from './build-era-saves.mjs';

const API = 'https://api.anthropic.com/v1/messages';
export const PLAY_MODEL = process.env.PLAY_MODEL === 'opus' ? 'claude-opus-5-5' : 'claude-sonnet-5-5'; // workflow input play_model
export const REPORT_MODEL = 'claude-opus-5-5';
const PLAY_MAX_TOKENS = 4000;
const REPORT_MAX_TOKENS = 16000;
const OUT = path.join(ROOT, 'plans/ai-output/human-playtest');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INSET = { left: 47, right: 47, top: 0, bottom: 21 }; // iPhone landscape: notch side and home bar
export const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
export const SLICE_AGES = AGE_ORDER.slice(1); // the era saves (scripts/ai/era-saves/); the start session is the stone age

export const SCENES = ['campaign', 'battle'];
export const AREAS = ['start screen and world setup', 'map pan, zoom, close view and fog', 'cities, builds and settlers', 'units and armies',
  'tech tree', 'economy and gold', 'diplomacy', 'wars and AI behaviour', 'RTS battles (deploy, orders, workers, sieges)', 'naval',
  'crises, events, era goals, independents, raids, World Congress', 'glossary and help', 'save and load', 'speed feel', 'pacing and fun'];
export const BATTLE_AREAS = ['battle setup screen (age, armies, terrain, walls)', 'deploy phase', 'selection and orders on touch (tap, circle select, draw a path, attack-move)',
  'unit readability and size', 'camera pan and zoom', 'combat clarity (who is winning, damage, morale, rout)', 'economy and workers HUD', 'powers',
  'buildings, sieges and walls', 'naval', 'end of battle and the result screen', 'speed and smoothness', 'layout on this screen and language', 'fun'];
export const AREAS_OF = { campaign: AREAS, battle: BATTLE_AREAS };
// Round 2 graded several areas after one glance: these are done for real before done (lead, 28 Oct).
export const MUST_DO = {
  campaign: ['open the tech tree, tap three techs and open one tech\'s glossary entry', 'pinch and drag the map, open the close view on a city, find your army with the next army button',
    'build a ship in a coastal city, carry an army by sea and land it', 'answer at least three event cards and look for the World Congress or a crisis', 'hold a name for help and open the glossary index',
    'build in a city and buy one item with gold', 'meet a neighbour, open its card and try a diplomatic action', 'fight one battle yourself and one on Auto'],
  battle: ['deploy with a preset, then move one squad by hand', 'circle select and draw a path', 'use every power once', 'train a worker and a unit', 'attack a building or the walls', 'zoom the camera in and out']
};
// One setup per battle, in turn, so a run meets walls, the sea and a sack as well as an open field (BattleSandbox.jsx URL options).
export const BATTLE_SETUPS = [
  { id: 'field', query: '&fort=0', what: 'an open field battle, your army against theirs' }, // the sandbox's own default is fort 2: an assault on a base (battle-engage)
  { id: 'walls', query: '&fort=4&city=medium', what: 'an assault on a walled city (walls, gate, towers)' },
  { id: 'naval', query: '&sea', what: 'a sea battle between two fleets' },
  { id: 'sack', query: '&raid=sack', what: 'you defend a town against raiders come to sack it' }
];
export const battleUrl = (base, age, i) => `${base}${base.includes('?') ? '&' : '?'}battleSandbox&age=${age}${BATTLE_SETUPS[i % BATTLE_SETUPS.length].query}`;

export const PERSONAS = {
  'newcomer-phone': 'You have never played a grand-strategy game. You play on your phone on the bus, held sideways. You read little, tap what looks inviting and get lost easily. You say plainly when you do not know what to do next.',
  'civ-veteran': 'You have played every Civilization and some Paradox games for years. You know what a good city screen, tech tree and diplomacy screen feel like, and you compare. You are quick and impatient with slow menus.',
  warmonger: 'You want to conquer. You build armies early, look for a neighbour to attack, declare war and fight every battle yourself when the game lets you.',
  builder: 'You love growing cities, economy and wonders. You avoid war unless attacked, look at every number about gold, food and production, and plan builds carefully.',
  'battle-commander': 'You are an RTS fan (Age of Empires, Total War, StarCraft). You judge a battle by its controls, its readability and its tactics: you deploy with care, flank, focus fire, use every power and worker, push the speed up when it drags, and say exactly where it feels worse than the games you know.',
  'rts-commander': 'You came for the real-time tactical battles. You get into a battle as early as you can, deploy, give orders, use workers and sieges, and judge the controls hard.',
  'hebrew-speaker': 'You are an Israeli player who plays in Hebrew. You notice text left in English, broken right-to-left order, mirrored things that should not be, and wording that sounds translated.'
};

const KEYS = /^(Escape|Enter|Tab|Space|Backspace|Delete|Arrow(Up|Down|Left|Right)|PageUp|PageDown|Home|End|F\d{1,2}|[A-Za-z0-9+\-=[\]])$/;
const MOOD = { type: 'integer', enum: [1, 2, 3, 4, 5] };
const common = (areas) => ({
  thought: { type: 'string', description: 'One line: what you expect to happen, and how you feel right now.' },
  fun: { ...MOOD, description: 'How much fun you are having, 1 none to 5 great.' },
  frustration: { ...MOOD, description: 'How frustrated you are, 1 calm to 5 about to quit.' },
  area: { type: 'string', enum: areas, description: 'The checklist area this step is about.' }
});
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

export const toolsFor = (areas) => Object.entries(ACTIONS).map(([name, [description, props]]) => ({
  name, description, strict: true,
  input_schema: { type: 'object', additionalProperties: false, required: [...Object.keys(props), ...Object.keys(common(areas))], properties: { ...props, ...common(areas) } }
}));
export const TOOLS = toolsFor(AREAS);

const num = (v, lo, hi, what) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${what} must be a number`);
  if (v < lo || v > hi) throw new Error(`${what} ${v} is outside ${lo}..${hi}`);
  return Math.round(v);
};

/** A tool_use block -> { name, args, thought, fun, frustration, area }; throws a plain reason on bad input. */
export const parseAction = (block, size = SIZES.phone, areas = AREAS) => {
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
  return { name: block.name, args, thought: String(i.thought || '').slice(0, 300), fun: mood(i.fun), frustration: mood(i.frustration), area: areas.includes(i.area) ? i.area : null };
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
  const scene = val('--scene', 'SCENE', 'campaign');
  if (!SCENES.includes(scene)) throw new Error(`--scene must be ${SCENES.join(' or ')}`);
  const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
  const slices = scene === 'campaign' ? list(val('--slices', 'SLICES', '')) : [];
  slices.forEach((a) => { if (!SLICE_AGES.includes(a)) throw new Error(`Unknown slice ${a}: ${SLICE_AGES.join(', ')}`); });
  const battleAges = scene === 'battle' ? list(val('--battle-ages', 'BATTLE_AGES', '') || AGE_ORDER.join(',')) : [];
  battleAges.forEach((a) => { if (!AGE_ORDER.includes(a)) throw new Error(`Unknown battle age ${a}: ${AGE_ORDER.join(', ')}`); });
  const maxSteps = Number(val('--limit', 'MAX_STEPS', '') || val('--max-steps', 'MAX_STEPS', 60));
  if (!(Number.isInteger(maxSteps) && maxSteps > 0 && maxSteps <= 500)) throw new Error('MAX_STEPS must be 1 to 500');
  const maxUsd = Number(val('--max-usd', 'MAX_USD', 10));
  if (!(maxUsd > 0)) throw new Error('--max-usd must be a positive number');
  return { persona, scene, sizeId, size: SIZES[sizeId], lang, slices, battleAges, maxSteps, maxUsd, url: val('--url', 'GAME_URL', 'http://localhost:4173/terra-imperium/') };
};

const BATTLE_PLAY = `This run is the battle sandbox: the real-time tactical battles alone, no campaign. Each session opens its setup screen in one age with one kind of battle; you may change the pickers (they are native drop-downs: tap one, then ArrowUp or ArrowDown and Enter), then tap Fight.
In battle: deploy your army in the deploy phase and start, then command it: tap a unit to select it, circle or box several, tap the ground to move, draw a path with your finger, attack-move, focus an enemy, use the powers, the workers (laborers) and the economy HUD to gather, build and train, batter walls and the gate in an assault, and fight at sea when it is a naval battle. Pan and zoom the camera. The battle runs in real time while you think, so pause when you need time and use the speed buttons when it drags; try to see each battle to its end and read the result screen, then you may fight again.`;

export const systemPrompt = (persona, size, lang, scene = 'campaign') => `You are playtesting a grand-strategy video game (real Earth hex map, 150 peoples, Civilization-like research, cities, wars, diplomacy, real-time tactical battles) for its development team.
Who you are: ${PERSONAS[persona]}
You play the real game through screenshots only, like a person: you see the screen and nothing else. The game is in ${lang === 'he' ? 'Hebrew, laid out right to left' : 'English'}.
The screen is ${size.width}x${size.height} pixels${size.mobile ? ', a phone held landscape with touch (the notch and rounded corners cover about 47 px at the left and right edges)' : ', a desktop window with a mouse'}. Coordinates are pixels in the screenshot, x from the left, y from the top. Aim at the middle of a control.
Every turn you get a short diary of your recent steps, the screenshot before your last action and the current one. Answer with exactly ONE tool call, nothing else. Every call carries a one-line thought (what you expect, how you feel), fun and frustration from 1 to 5, and the checklist area it is about.
If the screen did not change after a tap, the tap may have missed or the game may be busy: try once more, wait, or try something else, and note it if it keeps happening.
Use note for anything the team should know: bugs (something broken or wrong), ux (hard to find or use, too small, covered), confusing (you do not understand it), boring, slow, fun and praise. Be specific: what you did, what you expected, what happened. One note per finding.
${scene === 'battle' ? `${BATTLE_PLAY}\n` : ''}Play naturally, in your own style, but cover this checklist; before done make sure each area was at least looked at:
${AREAS_OF[scene].map((a) => `- ${a}`).join('\n')}
Before done, also do each of these for real (several steps each, not one look), so your grades rest on use:
${MUST_DO[scene].map((a) => `- ${a}`).join('\n')}
${scene === 'battle' ? `Judge the controls on this screen${size.mobile ? ' with your fingers: are the units and buttons big enough to hit' : ''}, and ${lang === 'he' ? 'the Hebrew text and right-to-left layout' : 'the text'}.` : 'End turns now and then so the world moves (the End Turn button); answer the cards and prompts the game shows. If a battle opens, play it or pick Auto as your persona would.'} Do not stop early. No em dashes.`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Late-game saves: built ahead by playing the real engine (scripts/ai/build-era-saves.mjs), committed in scripts/ai/era-saves/. */
export const loadSlices = (ages, log) => Object.fromEntries(ages.map((a) => {
  if (!fs.existsSync(eraSaveFile(a))) throw new Error(`No era save for ${a}: run node scripts/ai/build-era-saves.mjs --ages ${a}`);
  const { state, facts } = readEraSave(a);
  log(`slice ${a}: turn ${facts.turn}, ${facts.cities} cities, ${facts.metMajors} majors met, at war with ${facts.enemies.join(', ') || 'nobody'}${facts.pendingBattles ? ', a battle waiting' : ''}`);
  return [a, { state, turn: facts.turn, facts }];
}));

export const openGame = async (browser, { size, lang, url, ready = '[data-people]' }) => {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.mobile ? 2 : 1, isMobile: size.mobile, hasTouch: size.mobile, ...(size.mobile ? { userAgent: UA } : {}), locale: lang === 'he' ? 'he-IL' : 'en-US' });
  await ctx.addInitScript((l) => { try { if (!sessionStorage.getItem('hpt')) { localStorage.clear(); sessionStorage.setItem('hpt', '1'); } localStorage.setItem('terra-imperium.language', l); } catch { /* storage blocked */ } }, lang);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (size.mobile) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSET }).catch(() => {});
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err.message || err).slice(0, 300)));
  await page.goto(url, { timeout: 240000 });
  await page.locator(ready).first().waitFor({ timeout: 300000 });
  return { ctx, page, cdp, errors };
};

// The harness, not the player, starts a slice: through the start screen as qa-shots.mjs does, then __game.load.
export const loadSlice = async ({ page, errors }, save) => {
  const click = (l) => l.dispatchEvent('click');
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-ready'));
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /^(Skip|דילוג|דלג)$/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 120000 });
  // __game.load runs migrateSave: a bare LOAD_GAME kept the fog's encoded arrays and the map crashed to a black page.
  await page.evaluate((json) => window.__game.load(JSON.parse(json)), JSON.stringify(save.state));
  const canvas = await page.locator('canvas').first().waitFor({ timeout: 60000 }).then(() => true, () => false);
  await wait(4000);
  const shot = await page.screenshot({ type: 'jpeg', quality: 55, scale: 'css', timeout: 120000 });
  const blank = !canvas ? 'no map canvas' : (await isBlankShot(shot)) ? 'a near-uniform screen' : null;
  if (blank) throw new Error(`the slice loaded to ${blank}${errors.length ? `; page errors: ${errors.slice(0, 3).join(' / ')}` : ''}`);
};

/** True when a screenshot is almost one colour (every RGB channel's spread under 6 of 255): a black or blank page. */
export const isBlankShot = async (buf) => {
  const { default: sharp } = await import('sharp');
  return (await sharp(buf).stats()).channels.slice(0, 3).every((c) => c.stdev < 6);
};

/**
 * Battle mode, after every gesture: waits out the loading screen (the battle worker took over 30 s to start on a
 * loaded machine) and returns a harness-error reason when the battle failed to start or its canvas drew nothing.
 * `seen` remembers that this battle's canvas drew, so the check runs once per battle.
 */
export const battleCheck = async ({ page }, seen) => {
  const loading = page.locator('[data-testid=battle-loading], [data-testid=battle-starting]');
  if (await loading.first().isVisible().catch(() => false)) await loading.first().waitFor({ state: 'hidden', timeout: 180000 }).catch(() => {});
  const failure = page.getByTestId('battle-failure');
  if (await failure.isVisible().catch(() => false)) {
    const detail = await page.getByTestId('battle-failure-detail').textContent({ timeout: 2000 }).catch(() => '');
    return `the battle could not start (BattleFailure)${detail ? `: ${detail.slice(0, 200)}` : ''}`;
  }
  const canvas = page.locator('[data-testid=tactical-battle] canvas').first();
  if (!(await canvas.isVisible().catch(() => false))) { seen.drawn = false; return null; } // the setup screen again
  if (seen.drawn) return null;
  for (let k = 0; k < 3; k++) { // a software-GL first frame can take a few seconds
    const shot = await canvas.screenshot({ type: 'jpeg', quality: 55, scale: 'css', timeout: 60000 }).catch(() => null);
    if (shot && !(await isBlankShot(shot))) { seen.drawn = true; return null; }
    await wait(5000);
  }
  return 'the battle canvas drew nothing (a near-uniform field)';
};

/** Runs one gesture in the page. Touch through CDP on a phone, the mouse on desktop. */
export const perform = async ({ page, cdp, mobile }, { name, args: a }) => {
  // Each event carries its own time: CDP answers only once a slow frame has handled the event, so a
  // 60 ms tap used to reach the page as a press of seconds, a long press (r3-battle, playtest 40736779836).
  const t0 = Date.now() / 1000;
  const touch = (type, pts, at = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts, timestamp: t0 + at / 1000 });
  const tap = async (x, y, hold = 60) => { const down = touch('touchStart', [{ x, y, id: 1 }]); await wait(hold); await touch('touchEnd', [], hold); await down; };
  const m = page.mouse;
  switch (name) {
    case 'tap': return mobile ? tap(a.x, a.y) : m.click(a.x, a.y);
    case 'double_tap': return mobile ? tap(a.x, a.y).then(() => wait(90)).then(() => tap(a.x, a.y)) : m.dblclick(a.x, a.y);
    case 'long_press': return mobile ? tap(a.x, a.y, 900) : m.move(a.x, a.y).then(() => m.down()).then(() => wait(900)).then(() => m.up());
    case 'drag': {
      const at = (k) => [a.x1 + ((a.x2 - a.x1) * k) / 12, a.y1 + ((a.y2 - a.y1) * k) / 12];
      if (mobile) { const sent = [touch('touchStart', [{ x: a.x1, y: a.y1, id: 1 }])]; for (let k = 1; k <= 12; k++) { const [x, y] = at(k); sent.push(touch('touchMove', [{ x, y, id: 1 }], k * 16)); await wait(16); } sent.push(touch('touchEnd', [], 13 * 16)); return Promise.all(sent); }
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
const line = (d) => `#${d.step} [${d.segment}] ${d.name}${d.args ? ` ${JSON.stringify(d.args)}` : ''}${d.error ? ` (refused: ${d.error})` : ''} | ${d.thought || ''} | fun ${d.fun ?? '-'} frustration ${d.frustration ?? '-'}${d.area ? ` | ${d.area}` : ''}`;

const play = async (opts, log = console.log) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const { launchBrowser } = await import('../lib/browserLaunch.mjs');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const diaryFile = path.join(OUT, 'diary.jsonl');
  const diary = [];
  const write = (d) => { diary.push(d); fs.appendFileSync(diaryFile, `${JSON.stringify(d)}\n`); log(line(d)); };
  const battle = opts.scene === 'battle';
  const areas = AREAS_OF[opts.scene];
  const tools = toolsFor(areas);
  const system = [{ type: 'text', text: systemPrompt(opts.persona, opts.size, opts.lang, opts.scene), cache_control: { type: 'ephemeral' } }];
  const saves = opts.slices.length ? loadSlices(opts.slices, log) : {};
  const segments = battle
    ? opts.battleAges.map((a, i) => ({ id: `${a}-${BATTLE_SETUPS[i % BATTLE_SETUPS.length].id}`, what: `the battle sandbox in the ${a} age, already set up by the link for ${BATTLE_SETUPS[i % BATTLE_SETUPS.length].what} (the pickers may not show it; change them only if you want): scroll down to Fight if it is below the screen, tap it, and play the battle to its end`, url: battleUrl(opts.url, a, i) }))
    : [{ id: 'start', what: 'a new game from the start screen' }, ...opts.slices.map((a) => ({ id: a, what: `a game already in the ${a} age (turn ${saves[a].turn}, ${saves[a].facts.cities} cities, at war with a neighbour${saves[a].facts.pendingBattles ? ', a battle waiting for you' : ''}): carry on from here`, save: saves[a] }))];
  const perSegment = Math.max(1, Math.floor(opts.maxSteps / segments.length));
  const covered = new Set();
  let spent = 0; let step = 0; let stopped = null;
  const browser = await launchBrowser({ args: ['--disable-dev-shm-usage'] });
  let g = null;
  try {
    for (const seg of segments) {
      if (stopped) break;
      // Battles share one tab, as a player would: the first-battle tips show once, not in every age.
      if (battle && g) { await g.page.goto(seg.url, { timeout: 240000 }); await g.page.getByTestId('sandbox-ageId').waitFor({ timeout: 300000 }); }
      else g = await openGame(browser, battle ? { ...opts, url: seg.url, ready: '[data-testid=sandbox-ageId]' } : opts);
      const seen = { drawn: false };
      if (seg.save) {
        // A slice that does not show the game is the harness's fault: log it and skip, never let the model play a black screen.
        const failed = await loadSlice(g, seg.save).then(() => null, (err) => String(err.message).split('\n')[0]);
        if (failed) { write({ step, segment: seg.id, usd: Number(spent.toFixed(4)), name: 'harness-error', error: failed }); await g.ctx.close(); continue; }
      }
      const shoot = () => g.page.screenshot({ type: 'jpeg', quality: 55, scale: 'css', timeout: 120000 });
      let prev = null; let now = await shoot();
      for (let k = 0; k < perSegment; k++) {
        const left = areas.filter((a) => !covered.has(a));
        const text = [`Session: ${seg.what}. Step ${k + 1} of ${perSegment} in this session (${step + 1} of ${opts.maxSteps} overall).`,
          `Checklist areas not looked at yet: ${left.join('; ') || 'none'}.`,
          'Your diary (oldest first):', ...diary.slice(-30).map(line)].join('\n');
        const worst = stepWorstUsd(JSON.stringify(system) + JSON.stringify(tools) + text, opts.size);
        if (spent + worst + reportWorstUsd(diary.map(line).join('\n')) > opts.maxUsd) { stopped = `budget: $${spent.toFixed(2)} spent of $${opts.maxUsd}`; break; }
        const content = [{ type: 'text', text }];
        if (prev) content.push({ type: 'text', text: 'Before your last action:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: prev.toString('base64') } });
        content.push({ type: 'text', text: 'The screen now:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: now.toString('base64') } }, { type: 'text', text: 'Answer with one tool call.' });
        const res = await ask(key, { model: PLAY_MODEL, max_tokens: PLAY_MAX_TOKENS, system, tools, tool_choice: { type: 'auto', disable_parallel_tool_use: true }, output_config: { effort: 'low' }, messages: [{ role: 'user', content }] });
        spent += liveUsd(PLAY_MODEL, res.usage);
        step += 1;
        const errorsBefore = g.errors.length;
        const base = { step, segment: seg.id, usd: Number(spent.toFixed(4)) };
        if (res.stop_reason === 'refusal') { write({ ...base, name: 'refusal', error: res.stop_details?.category || 'refused' }); stopped = 'the model refused'; break; }
        const block = (res.content || []).find((b) => b.type === 'tool_use');
        let act;
        try { act = parseAction(block, opts.size, areas); } catch (err) {
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
        // A battle that does not start or draw is the harness's line, never something the model plays on.
        const failed = battle && act.name !== 'note' ? await battleCheck(g, seen) : null;
        if (failed) { write({ ...base, name: 'harness-error', error: failed }); break; }
        if (act.name !== 'note') { prev = now; now = await shoot(); }
      }
      if (!battle) await g.ctx.close();
    }
  } finally { await browser.close(); }
  return { diary, spent, stopped, covered: [...covered], segments: segments.map((s) => s.id) };
};

const REPORT_CAMPAIGN = `You turn a playtest diary into a report for the development team of a grand-strategy game (real Earth hex map, research, cities, wars, diplomacy, real-time tactical battles).
A model played the real game through screenshots as a persona, one gesture a step; each diary line has the action, a one-line thought, fun and frustration from 1 to 5, and the checklist area; notes are its findings, each with a screenshot path. Page errors were caught by the harness, not seen by the player; a harness-error line is a session the harness could not open on a working game screen (not played).
Write Markdown, plain English, no em dashes:
1. Summary: one paragraph, and the three things that matter most.
2. Scorecard: a table of every checklist area with a score out of 10 and a one-line why; "not reached" when the diary never got there.
3. Fun curve: how fun and frustration moved over the steps (quote step numbers), where it peaked and where it sank, and why.
4. Top issues, ranked by how much they hurt a real player: what happened, the step numbers, the screenshot paths, and a suggested fix.
5. Bugs: each with steps to reproduce from the diary.
6. What was good.
7. Coverage: which areas were played, only glanced at, or missed, and what the next run should aim at.
Judge from the diary only; say when something is unclear (a missed tap is not always a game bug).`;

const REPORT_BATTLE = `You turn a playtest diary into a report for the development team of a grand-strategy game's real-time tactical battles (RTS battles on a real Earth tile, eight ages from stone to future, a battle economy with workers and buildings, powers, sieges, naval).
A model played the battle sandbox of the real game through screenshots as a persona, one gesture a step, one session per age (its segment tag is age-setup, for example bronze-walls); each diary line has the action, a one-line thought, fun and frustration from 1 to 5, and the checklist area; notes are its findings, each with a screenshot path. The battle runs in real time between steps. Page errors were caught by the harness, not seen by the player; a harness-error line is a battle the harness could not start or that drew nothing (not played), and it is a bug to list.
Write Markdown, plain English, no em dashes:
1. Summary: one paragraph, and the three things that matter most.
2. Scorecard by area: a table of every checklist area with a score out of 10 and a one-line why; "not reached" when the diary never got there.
3. Scorecard by age: a table of each session (age and kind of battle) with a score out of 10, whether the battle started, was played to its end and who won, and a one-line why.
4. Fun curve: how fun and frustration moved over the steps (quote step numbers), where it peaked and where it sank, and why.
5. Top issues, ranked by how much they hurt a real player: what happened, the step numbers, the screenshot paths, and a suggested fix.
6. Bugs: each with steps to reproduce from the diary.
7. What was fun, and what else was good.
8. Coverage: which areas and ages were played, only glanced at, or missed, and what the next run should aim at.
Judge from the diary only; say when something is unclear (a missed tap is not always a game bug, and units moving while the model thought is real time, not lag).`;

const writeReport = async (opts, run, log = console.log) => {
  const key = process.env.ANTHROPIC_API_KEY;
  const notes = run.diary.filter((d) => d.name === 'note');
  const errors = run.diary.filter((d) => d.pageErrors).map((d) => `step ${d.step}: ${d.pageErrors.join(' / ')}`);
  const user = [`Persona: ${opts.persona} (${PERSONAS[opts.persona]})`, `Scene: ${opts.scene}.`, `Screen: ${opts.sizeId} ${opts.size.width}x${opts.size.height}, language ${opts.lang}. Sessions: ${run.segments.join(', ')}. Steps: ${run.diary.length}${run.stopped ? `, stopped early (${run.stopped})` : ''}.`,
    `Areas the player said it looked at: ${run.covered.join('; ') || 'none'}.`, '', 'Diary:', ...run.diary.map(line), '', 'Notes:',
    ...notes.map((d) => `#${d.step} ${d.args.kind} sev ${d.args.severity} (${d.shot}): ${d.args.text}`), '', `Page errors: ${errors.join('\n') || 'none'}`].join('\n');
  const res = await ask(key, { model: REPORT_MODEL, max_tokens: REPORT_MAX_TOKENS, system: opts.scene === 'battle' ? REPORT_BATTLE : REPORT_CAMPAIGN, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: user }] });
  const cost = liveUsd(REPORT_MODEL, res.usage);
  const md = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || `The report request ended with ${res.stop_reason}.`;
  const total = run.spent + cost;
  fs.writeFileSync(path.join(OUT, 'report.md'), `# Human playtest: ${opts.persona}${opts.scene === 'battle' ? ', battles' : ''}\n\n${md}\n\n---\n${run.diary.length} steps, play $${run.spent.toFixed(2)} (${PLAY_MODEL}) + report $${cost.toFixed(2)} (${REPORT_MODEL}) = $${total.toFixed(2)}. Diary: \`diary.jsonl\`, noted screens: \`shots/\`.\n`);
  log(`human-playtest: ${run.diary.length} steps, ${notes.length} notes, $${total.toFixed(2)} in all`);
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const opts = parseFlags(process.argv.slice(2));
  play(opts).then((run) => writeReport(opts, run)).catch((err) => { console.error(err.stack || err.message); process.exit(1); });
}
