// scripts/economyUse.mjs
// Differentiation plan U33: which economy features does anyone use? Measurement only, no rule changes.
// Runs whole peoples worlds with the scripted player (campaignTelemetry.mjs, rush buying on) and counts
// by state diff what the AI majors and the scripted player really did each turn: building tiers, laws,
// decrees, governments, reforms, rush buys, districts, development, growth, loans, taxes, advisors.
// The player's own reducer actions come from createActionCounter. Output: a markdown table (same bytes
// on a rerun) for plans/economy-use-2026.md.
//
//   node scripts/economyUse.mjs --games 6 --turns 300 --seed 1 --out plans/economy-use-2026.md
//   node scripts/economyUse.mjs --only 2 --dump g2.json     (one game, for parallel shells)
//   node scripts/economyUse.mjs --merge g0.json,g1.json --out report.md
import { buildSimEngine, advanceCampaign } from './simulate.mjs';
import { createScriptedPlayer, createActionCounter } from './campaignTelemetry.mjs';
import { pathToFileURL } from 'url';
import fs from 'fs';

const EXTRA = [
  "export { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from '../src/data/buildings.js';",
  "export { LAW_CATEGORIES } from '../src/data/laws.js';",
  "export { DECREE_ACTS, DECREE_DEEDS } from '../src/data/decrees.js';",
  "export { GOVERNMENT_TYPES, GOVERNMENT_REFORMS } from '../src/data/government.js';",
  "export { TAX_RATE_IDS } from '../src/data/taxRates.js';",
  "export { DISTRICTS, adjacencyOf } from '../src/engine/districts.js';",
  "export { DEV_TYPE_IDS } from '../src/engine/development.js';",
  "export { rushQuote } from '../src/engine/spending.js';",
  "export { ageOf } from '../src/engine/nationState.js';",
  "export { AGE_ORDER } from '../src/data/ages.js';"
];

// Reducer actions that spend or manage the economy (the player's side of the table).
const ECON_ACTIONS = ['QUEUE_PRODUCTION', 'DEQUEUE_PRODUCTION', 'MOVE_PRODUCTION', 'RUSH_PRODUCTION', 'CONSTRUCT_BUILDING', 'BUILD_INFRASTRUCTURE', 'BUILD_DEFENSES',
  'DEVELOP_PROVINCE', 'DEVELOP_RESOURCE_SITE', 'POPULATION_POLICY', 'QUELL_UNREST', 'SETTLE_COLONIZE', 'SET_TAX_RATE', 'REQUEST_LOAN', 'REPAY_LOAN', 'FUND_SCHOLARS',
  'CHANGE_LAW', 'CHANGE_GOVERNMENT_TYPE', 'ENACT_GOVERNMENT_REFORM', 'INCREASE_STABILITY', 'HIRE_ADVISOR', 'BUILD_CLIMATE_RESILIENCE', 'CULTURAL_EXPORT',
  'SET_CITY_FOCUS', 'TOGGLE_TILE_LOCK', 'BUY_TILE', 'SET_ARMY_MAINTENANCE', 'SET_NAVY_MAINTENANCE', 'ASSIGN_GOVERNOR', 'DISMISS_GOVERNOR', 'MOVE_CAPITAL',
  'RAISE_RULER_ATTRIBUTE', 'TAKE_RULER_VIRTUE', 'RESHAPE_RULER', 'SHIFT_IDENTITY', 'TRADE_AGREEMENT', 'GIFT_BRIBE', 'HIRE_MERCENARY', 'RECRUIT_UNIT'];

const parse = (argv) => {
  const a = { games: 6, turns: 300, seed: 1, only: null, dump: null, merge: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in a)) continue;
    const v = argv[++i];
    a[key] = ['games', 'turns', 'seed', 'only'].includes(key) ? Number(v) : v;
  }
  return a;
};

const playable = (n) => n && !n.isEliminated && n.kind !== 'independent' && n.id !== 'rebels' && !String(n.id).startsWith('free_');

const runGame = (engine, player, seed, turns) => {
  let state = {
    ...engine.createInitialState({ playerNationId: player, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } }),
    firedEvents: Object.fromEntries(Object.keys(engine.HISTORICAL_EVENTS).map((id) => [id, true])),
    proceduralEventCooldown: 999999,
    battleSettings: { defaultMode: 'auto', autoDefend: true }
  };
    const counter = createActionCounter(engine.ActionTypes);
  state = counter.wrap(engine.gameReducer)(state, { type: engine.ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }); // a human picks techs; the bot would sit in the Stone Age
  const bot = createScriptedPlayer({ engine, opinionOf: engine.opinionOf, rush: true, counter });
  const counts = { player: {}, ai: {} };
  const hit = (side, key, n = 1) => { if (n > 0) counts[side][key] = (counts[side][key] || 0) + n; };
  const sideOf = (id) => (id === player ? 'player' : 'ai');
  const aiAtStart = Object.values(state.nations).filter((n) => playable(n) && n.id !== player).length;

  const keyOf = (it) => (it ? `${it.kind}:${it.id ?? it.classId ?? it.categoryId ?? it.type ?? ''}` : '');
  const observe = (b, a) => {
    for (const n of Object.values(a.nations)) {
      if (!playable(n)) continue;
      const p = b.nations[n.id]; if (!p) continue;
      const s = sideOf(n.id);
      for (const [cat, id] of Object.entries(n.laws || {})) if (p.laws?.[cat] && p.laws[cat] !== id) hit(s, `law|${cat}:${id}`);
      if (n.government?.type !== p.government?.type && n.government?.type) hit(s, `government|${n.government.type}`);
      for (const [age, id] of Object.entries(n.government?.reforms || {})) if (p.government?.reforms?.[age] !== id) hit(s, `reform|${id}`);
      const seen = new Set(p.ruler?.decreeLog || []);
      for (const e of n.ruler?.decreeLog || []) {
        if (seen.has(e)) continue;
        if (e.act) hit(s, `decreeSpend|${e.act}`); else hit(s, `decreeGrant|${e.deed}`);
      }
      for (const pool of Object.keys(n.advisors || {})) if (n.advisors[pool] && !p.advisors?.[pool]) hit(s, `advisor|${pool}`);
      if ((n.loans || []).length > (p.loans || []).length) hit(s, 'loan|taken');
      if (n.taxRate !== p.taxRate && n.taxRate) hit(s, `taxRate|${n.taxRate}`);
    }
    for (const c of Object.values(a.regions)) {
      const o = c.owner; if (!playable(a.nations[o])) continue;
      const pc = b.regions[c.id]; if (!pc) continue;
      const s = sideOf(o);
      for (const [cat, t] of Object.entries(c.buildings?.categories || {})) for (let k = (pc.buildings?.categories?.[cat] ?? -1) + 1; k <= t; k++) hit(s, `building|${cat}:${k}`);
      for (const [res, on] of Object.entries(c.buildings?.extraction || {})) if (on && !pc.buildings?.extraction?.[res]) hit(s, `extraction|${res}`);
      if (c.rush && (c.rush.turn !== pc.rush?.turn || c.rush.heat > (pc.rush?.heat || 0))) hit(s, 'rush|buy');
      for (const d of engine.DEV_TYPE_IDS) hit(s, `develop|${d}`, (c.investment?.[d] || 0) - (pc.investment?.[d] || 0));
      hit(s, 'infrastructure|level', (c.currentInfrastructure || 0) - (pc.currentInfrastructure || 0));
      hit(s, 'defenses|level', (c.defenseLevel || 0) - (pc.defenseLevel || 0));
      if (c.production?.current && keyOf(c.production.current) !== keyOf(pc.production?.current)) hit(s, `produce|${c.production.current.kind}`);
      if (c.focus !== pc.focus && c.focus) hit(s, `cityFocus|${c.focus}`);
    }
    const ts = a.world?.tileState || {}; const pts = b.world?.tileState || {};
    for (const t of Object.keys(ts)) {
      const k = ts[t].district;
      if (!k || pts[t]?.district) continue;
      const city = Object.values(a.regions).find((c) => (c.tiles || []).includes(Number(t)));
      if (city && playable(a.nations[city.owner])) hit(sideOf(city.owner), `district|${k}`);
    }
  };

  for (let t = 0; t < turns; t++) {
    const before = state; // diff from before the bot answers, so its purchases count
    state = bot.answer(state).state;
    const next = advanceCampaign(engine, state);
    observe(before, next);
    state = next;
    if (state.gameStatus !== 'ACTIVE') break;
  }
  // The adjacency each standing district earned (the plan's "districts with adjacency").
  const tiles = engine.getTiles(); const adj = {};
  for (const [t, e] of Object.entries(state.world?.tileState || {})) {
    if (!e.district) continue;
    const city = Object.values(state.regions).find((c) => (c.tiles || []).includes(Number(t)));
    const v = engine.adjacencyOf(tiles, state.world, Number(t), e.district, city);
    adj[`${e.district}:${v}`] = (adj[`${e.district}:${v}`] || 0) + 1;
  }
  const ages = {};
  for (const n of Object.values(state.nations)) if (playable(n)) { const k = `${n.id === player ? 'player' : 'ai'}|${engine.ageOf(state, n.id)}`; ages[k] = (ages[k] || 0) + 1; }
  const actions = {}; for (const t of ECON_ACTIONS) if (t in engine.ActionTypes) actions[t] = counter.get(t);
  return { seed, player, turns: state.turnNumber, aiNations: aiAtStart, counts, actions, adj, ages };
};

const report = (games, engine) => {
  const N = games.length;
  const sum = (side, key) => games.reduce((x, g) => x + (g.counts[side][key] || 0), 0);
  const used = (side, key) => games.filter((g) => (g.counts[side][key] || 0) > 0).length;
  const maxAge = Math.max(...games.flatMap((g) => Object.keys(g.ages).map((k) => engine.AGE_ORDER.indexOf(k.split('|')[1]))));
  const rows = []; // { group, id, label, key, note }
  const add = (group, id, label, key, extra = {}) => rows.push({ group, id, label, key, ...extra });
  for (const [cat, def] of Object.entries(engine.BUILDING_CATEGORIES)) def.tiers.forEach((t, i) => add('Building line: ' + cat, `${cat}:${i}`, `${t.name} (${t.age})`, `building|${cat}:${i}`, { unreached: engine.AGE_ORDER.indexOf(t.age) > maxAge }));
  for (const [cat, list] of Object.entries(engine.LAW_CATEGORIES)) for (const l of list) add('Law: ' + cat, l.id, `${l.name} (tier ${l.tier})`, `law|${cat}:${l.id}`, { baseline: l.tier === 1 });
  for (const id of Object.keys(engine.DECREE_ACTS)) add('Decree spend', id, engine.DECREE_ACTS[id].label, `decreeSpend|${id}`);
  for (const id of Object.keys(engine.DECREE_DEEDS)) add('Decree grant', id, engine.DECREE_DEEDS[id], `decreeGrant|${id}`);
  for (const id of Object.keys(engine.GOVERNMENT_TYPES)) add('Government', id, engine.GOVERNMENT_TYPES[id].name, `government|${id}`, { baseline: id === 'tribal' });
  for (const [type, ages] of Object.entries(engine.GOVERNMENT_REFORMS)) for (const [age, list] of Object.entries(ages)) for (const r of list) add('Reform', r.id, `${r.name} (${type}, ${age})`, `reform|${r.id}`);
  for (const id of Object.keys(engine.DISTRICTS)) add('District', id, `${engine.DISTRICTS[id].name} (${engine.DISTRICTS[id].line} line)`, `district|${id}`);
  for (const id of Object.keys(engine.EXTRACTION_BUILDINGS)) add('Extraction', id, engine.EXTRACTION_BUILDINGS[id].name, `extraction|${id}`);
  for (const id of engine.DEV_TYPE_IDS) add('Development', id, `Develop ${id} (+1)`, `develop|${id}`);
  for (const [id, label] of [['infrastructure|level', 'Build infrastructure level'], ['defenses|level', 'Build defenses level'], ['rush|buy', 'Rush buy (gold for hammers)'], ['loan|taken', 'Take a loan']]) add('Spending', id, label, id);
  for (const id of engine.TAX_RATE_IDS) add('Tax rate', id, `Tax rate ${id}`, `taxRate|${id}`);
  for (const id of ['adm', 'mil', 'dip']) add('Advisor', id, `Advisor (${id})`, `advisor|${id}`);

  const verdict = (r) => {
    const p = sum('player', r.key); const a = sum('ai', r.key); const u = Math.max(used('player', r.key), used('ai', r.key));
    if (p + a === 0 && r.unreached) return 'keep, age not reached in these turns';
    if (p + a === 0) return r.baseline ? 'keep (the starting default)' : 'CUT or merge: nobody used it';
    if (u <= Math.max(1, Math.floor(N / 3)) && p + a < N * 3) return 'merge or review: almost never used';
    return 'keep';
  };
  const out = [];
  out.push('# Economy use measurement (U33)', '',
    `${N} peoples worlds, ${games[0].turns} turns each (turn reached: ${games.map((g) => g.turns).join(', ')}), seeds ${games.map((g) => g.seed).join(', ')}.`,
    `Player: the scripted player of scripts/campaignTelemetry.mjs with rush buying on (it queues what the AI would, rushes, answers blockers; it never changes a law, builds infrastructure or develops by hand). AI: every other major, ${games.reduce((x, g) => x + g.aiNations, 0)} AI nations in all.`,
    'Counts are state diffs per turn summed over all games: one count is one tier built, one law adopted, one decree spent. "Games" is how many of the games had at least one use on either side.',
    `Highest age reached by any nation: ${engine.AGE_ORDER[maxAge]}. Rows marked "not reachable" belong to later ages.`, '');
  const groups = [...new Set(rows.map((r) => r.group))];
  for (const g of groups) {
    out.push(`## ${g}`, '', '| Feature | Player | AI | Games | Proposal |', '|---|---:|---:|---:|---|');
    for (const r of rows.filter((x) => x.group === g)) out.push(`| ${r.label} | ${sum('player', r.key)} | ${sum('ai', r.key)} | ${Math.max(used('player', r.key), used('ai', r.key))}/${N} | ${verdict(r)} |`);
    out.push('');
  }
  out.push('## Player actions the scripted player dispatched (reducer counts)', '', '| Action | Count | Note |', '|---|---:|---|');
  const AI_HAS = new Set(['RUSH_PRODUCTION', 'CONSTRUCT_BUILDING', 'DEVELOP_PROVINCE', 'CHANGE_LAW', 'CHANGE_GOVERNMENT_TYPE', 'ENACT_GOVERNMENT_REFORM', 'INCREASE_STABILITY', 'HIRE_ADVISOR', 'QUEUE_PRODUCTION']);
  for (const t of ECON_ACTIONS.filter((x) => x in engine.ActionTypes)) {
    const n = games.reduce((x, g) => x + (g.actions[t] || 0), 0);
    out.push(`| ${t} | ${n} | ${n > 0 ? 'used by the script' : AI_HAS.has(t) ? 'script never tries; AI has the same act (see tables above)' : 'script never tries; no AI path: needs human counts (U1) before any cut'} |`);
  }
  out.push('', '## District adjacency at the end of each run', '', '| District:adjacency | Standing districts |', '|---|---:|');
  const adj = {}; for (const g of games) for (const [k, v] of Object.entries(g.adj)) adj[k] = (adj[k] || 0) + v;
  for (const k of Object.keys(adj).sort()) out.push(`| ${k} | ${adj[k]} |`);
  if (!Object.keys(adj).length) out.push('| none built | 0 |');
  out.push('', '## Nations by age at the end', '', '| Side and age | Nations |', '|---|---:|');
  const ages = {}; for (const g of games) for (const [k, v] of Object.entries(g.ages)) ages[k] = (ages[k] || 0) + v;
  for (const k of Object.keys(ages).sort()) out.push(`| ${k.replace('|', ' ')} | ${ages[k]} |`);
  out.push('## Reading the table (written by hand, for the Q7 cut list)', '',
    '- The scripted player never picks laws, governments, reforms, loans, tax rates, infrastructure, defenses, growth, tile buys or focus, so its zeros there say nothing about players. Only human counts (U1 browser counter) can justify cutting a player-only action. Research is set to auto.',
    '- Chores the research warns of: infrastructure and defenses levels (price +25% a level, to level 10), growth purchases (price by city size), and rush buying (price +20% per heat step) are rising-cost purchases. No AI path buys infrastructure, defenses, growth or loans. Crafting does not exist in the economy code (the word appears only in battle code).',
    '- A zero on an AI row means the AI doctrine tables (DOCTRINE_LAWS, DOCTRINE_GOVERNMENT, DOCTRINE_REFORMS, DOCTRINE_BUILDING_PRIORITY) never pick it, which is a data choice, not proof the feature is bad. A law or reform no doctrine lists is dead for the AI and only a player can ever take it.',
    '- Proposals are mechanical (zero use or under one use a game). The user decides in Q7; U34 acts on that list only.', '');
  return out.join('\n');
};

const main = async () => {
  const args = parse(process.argv.slice(2));
  const engine = await import(pathToFileURL(await buildSimEngine(EXTRA)).href);
  let games;
  if (args.merge) games = args.merge.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  else {
    const ids = engine.MAJOR_PEOPLES_LIST.map((p) => p.id);
    const picks = args.only != null ? [args.only] : [...Array(args.games).keys()];
    games = picks.map((g) => {
      const r = runGame(engine, ids[(args.seed + g) % ids.length], args.seed * 1000 + g, args.turns);
      console.error(`game ${g + 1}: ${r.player} seed ${r.seed} turn ${r.turns}`);
      return r;
    });
  }
  if (args.dump) { fs.writeFileSync(args.dump, JSON.stringify(args.only != null ? games[0] : games)); return; }
  const text = report(games.flat(), engine);
  if (args.out) fs.writeFileSync(args.out, text); else console.log(text);
};

main().catch((e) => { console.error(e); process.exit(1); });
