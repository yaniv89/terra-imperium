// scripts/perf/save-size.mjs
// How big the autosave grows over a long game (the crash hunt, plans: iOS kills a page over its
// memory limit, and Safari's localStorage holds about 5 MB per site). Plays a peoples world with
// the scripted player (scripts/campaignTelemetry.mjs) and prints, every N turns, the size of the
// save's JSON (what GameContext writes to localStorage) and its ten biggest top-level keys.
//
//   node scripts/perf/save-size.mjs [--turns 150] [--every 25] [--seed 1] [--size standard] [--write save.json]
import { writeFileSync } from 'node:fs';
import { buildSimEngine, advanceCampaign } from '../simulate.mjs';
import { createScriptedPlayer } from '../campaignTelemetry.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const TURNS = Number(arg('turns', '150'));
const EVERY = Number(arg('every', '25'));
const SEED = Number(arg('seed', '1'));
const SIZE = arg('size', 'standard');

const engine = await import(new URL(`file:///${(await buildSimEngine()).replace(/\\/g, '/')}`).href);
let state = {
  ...engine.createInitialState({ playerNationId: 'akkad', rngSeed: SEED, scenario: { mode: 'peoples', size: SIZE, seed: SEED } }),
  battleSettings: { defaultMode: 'auto', autoDefend: true }
};
const scripted = createScriptedPlayer({ engine, opinionOf: engine.opinionOf });
const kb = (s) => Math.round(s.length / 1024);
const report = (s) => {
  const json = JSON.stringify({ version: 10, state: s, savedAt: 0 });
  const keys = Object.entries(s).map(([k, v]) => [k, v === undefined ? 0 : JSON.stringify(v)?.length || 0]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`turn ${s.turnNumber}: save ${kb(json)} KB | ${keys.map(([k, n]) => `${k} ${Math.round(n / 1024)}`).join(', ')}`);
};
report(state);
for (let t = 1; t <= TURNS; t++) {
  state = scripted.answer(state).state;
  if (state.activeEventId) state = { ...state, activeEventId: null };
  state = advanceCampaign(engine, state);
  if (t % EVERY === 0) report(state);
}
// --write file: the last state as a save file (memory-soak.mjs loads it to start a long game late)
const OUT = arg('write', null);
if (OUT) writeFileSync(OUT, JSON.stringify({ version: engine.CURRENT_SAVE_VERSION, state, savedAt: Date.now() }));
