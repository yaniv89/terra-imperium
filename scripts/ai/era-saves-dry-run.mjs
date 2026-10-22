// Dry run of the playtest era saves, no API: build them, then play TURNS (default 20) of each headless with the
// scripted policy (as balance-sim POLICY=scripted). Prints one line per age: turns played, stall, audit violations, war and city counts.
//   node scripts/ai/era-saves-dry-run.mjs [--ages bronze,modern] [--turns 20] [--slice-turns 400]
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { buildSlices, SLICE_ENGINE, SLICE_AGES } from './human-playtest.mjs';
import { buildSimEngine, advanceCampaign } from '../simulate.mjs';
import { createScriptedPlayer } from '../campaignTelemetry.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ages = arg('--ages', SLICE_AGES.join(',')).split(',');
const turns = Number(arg('--turns', 20));
const file = await buildSimEngine(SLICE_ENGINE);
const e = await import(pathToFileURL(file).href);
fs.rmSync(file, { force: true });
const saves = await buildSlices(ages, Number(arg('--slice-turns', 400)), console.log);
for (const [age, save] of Object.entries(saves)) {
  const migrated = e.migrateSave({ version: e.CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(save.state)) });
  if (!migrated) { console.log(`${age}: LOAD REFUSED`); continue; }
  let s = { ...migrated.state, battleSettings: { defaultMode: 'auto', autoDefend: true } };
  const p = s.playerNationId; const scripted = createScriptedPlayer({ engine: e, opinionOf: e.opinionOf });
  const t0 = s.turnNumber; let problem = null; let warTurns = 0; let battles = 0;
  const own = (st) => Object.values(st.regions).filter((c) => (c.owner ?? c.ownerId) === p).length;
  const cities0 = own(s);
  try {
    for (let t = 0; t < turns && s.gameStatus === 'ACTIVE'; t++) {
      if (s.activeEventId) s = e.gameReducer(s, { type: e.ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
      s = scripted.answer(s).state;
      s = advanceCampaign(e, s);
      if (s.wars.some((w) => w.active && (w.aggressor === p || w.enemy === p))) warTurns++;
      battles = Math.max(battles, (s.battleReports || []).length);
    }
  } catch (err) { problem = String(err.message).split('\n')[0]; }
  const audit = e.auditGameState(s);
  console.log(`${age}: boosted=${save.boosted} turn ${t0}->${s.turnNumber} status=${s.gameStatus} cities ${cities0}->${own(s)} warTurns=${warTurns} battleReports=${battles} audit=${audit.length}${audit.length ? ' ' + JSON.stringify(audit.slice(0, 2)) : ''}${problem ? ' PROBLEM ' + problem : ''}`);
}
