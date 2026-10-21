// scripts/research-pace.mjs
// Research pace telemetry (follow-ups 17 and 18): per age, the turn the player and the top AI majors
// enter it, the median turns per tech, science per turn, and the year label's biggest one-turn jump.
//   node scripts/research-pace.mjs --seeds 11,12,13 --turns 300 [--speed normal] [--player akkad]
import { buildSimEngine, advanceCampaign } from './simulate.mjs';
import { createScriptedPlayer } from './campaignTelemetry.mjs';
import { pathToFileURL } from 'url';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i === -1 ? d : process.argv[i + 1]; };
const seeds = arg('seeds', '11,12,13').split(',').map(Number);
const turns = Number(arg('turns', 300));
const speed = arg('speed', null);
const player = arg('player', 'akkad');
const engine = await import(pathToFileURL(await buildSimEngine([
  "export { getResearchCost } from '../src/engine/research.js';",
  "export { AGE_ORDER } from '../src/data/ages.js';",
  "export { speedTrainMult } from '../src/data/ages.js';",
  "export { calcIncome } from '../src/utils/helpers.js';",
  "export { calcAllNationIncomes } from '../src/engine/aiEconomy.js';"
])).href);
const { AGE_ORDER } = engine;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rows = [];
for (const seed of seeds) {
  const fired = Object.fromEntries(Object.keys(engine.HISTORICAL_EVENTS).map((id) => [id, true]));
  let state = engine.createInitialState({ playerNationId: player, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed }, ...(speed ? { gameSpeed: speed } : {}) });
  state = { ...state, firedEvents: fired, proceduralEventCooldown: 999999, battleSettings: { defaultMode: 'auto', autoDefend: true } };
  state = engine.gameReducer(state, { type: engine.ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } });
  const scripted = createScriptedPlayer({ engine, demands: 'refuse', opinionOf: engine.opinionOf });
  const majors = Object.values(state.nations).filter((n) => !engine.isIndependentNation(n)).map((n) => n.id);
  const enter = {}; const done = {}; const techSpans = {}; const sci = {}; const costs = {};
  majors.forEach((id) => { enter[id] = { [engine.getTechAgeId(state, id)]: 0 }; done[id] = new Set(engine.getResearched(state, id)); techSpans[id] = {}; sci[id] = {}; costs[id] = {}; });
  let lastPlayerTech = 0; let longestTech = 0; let longestTechAt = null; let maxJump = 0; let maxJumpLate = 0; let maxJumpClassical = 0; let maxJumpLateAt = null; let minJump = 0; let maxJumpAt = null; let frozen = 0; let longestFreeze = 0; const years = [];
  for (let t = 0; t < turns && state.gameStatus === 'ACTIVE'; t++) {
    state = scripted.answer(state).state;
    const next = advanceCampaign(engine, state);
    const ai = engine.calcAllNationIncomes(next); const mine = engine.calcIncome(next).techPoints || 0;
    for (const id of majors) {
      if (next.nations[id]?.isEliminated) continue;
      const a0 = engine.getTechAgeId(state, id);
      const age = engine.getTechAgeId(next, id);
      if (enter[id][age] == null) enter[id][age] = next.turnNumber;
      const fresh = engine.getResearched(next, id).filter((x) => !done[id].has(x));
      fresh.forEach((x) => { (costs[id][a0] ||= []).push(engine.getResearchCost(state, id, x)); done[id].add(x); });
      techSpans[id][a0] = (techSpans[id][a0] || 0) + fresh.length;
      if (id === player && fresh.length) { if (next.turnNumber - lastPlayerTech > longestTech) { longestTech = next.turnNumber - lastPlayerTech; longestTechAt = `T${lastPlayerTech}-T${next.turnNumber} ${fresh[0]}`; } lastPlayerTech = next.turnNumber; }
      (sci[id][a0] ||= []).push(id === player ? mine : (ai[id]?.techPoints || 0));
    }
    const jump = (next.year ?? 0) - (state.year ?? 0);
    if (jump < minJump) minJump = jump;
    if (AGE_ORDER.indexOf(engine.getTechAgeId(state, player)) >= AGE_ORDER.indexOf('classical') && jump > maxJumpClassical) maxJumpClassical = jump;
    if (next.turnNumber > 10 && jump > maxJumpLate) { maxJumpLate = jump; maxJumpLateAt = `${state.year}->${next.year} @T${next.turnNumber} ${engine.getTechAgeId(state, player)}->${engine.getTechAgeId(next, player)} cur=${next.research?.current}`; }
    if (jump > maxJump) { maxJump = jump; maxJumpAt = `${state.year}->${next.year} @T${next.turnNumber}`; }
    if (jump === 0) { frozen++; longestFreeze = Math.max(longestFreeze, frozen); } else frozen = 0;
    if (next.turnNumber % 25 === 0) years.push(`T${next.turnNumber}:${next.year}`);
    state = next;
  }
  const top = [...majors].filter((id) => !state.nations[id]?.isEliminated).sort((a, b) => engine.getResearched(state, b).length - engine.getResearched(state, a).length);
  const medianMajor = top[Math.floor(top.length / 2)];
  console.log(`\n=== seed ${seed} speed=${state.gameSpeed} turns=${state.turnNumber} player=${player} final year ${state.year}`);
  console.log(`year: biggest one-turn jump ${maxJump} (${maxJumpAt}), after turn 10 ${maxJumpLate} (${maxJumpLateAt}); from Classical on ${maxJumpClassical}; biggest drop ${minJump}; longest freeze ${longestFreeze} turns`);
  console.log(`player's longest tech: ${longestTech} turns (${longestTechAt})`);
  console.log(`year over time: ${years.join(' ')}`);
  const show = [player, ...top.filter((x) => x !== player).slice(0, 3), medianMajor];
  for (const id of show) {
    const line = AGE_ORDER.map((a) => {
      if (enter[id][a] == null) return null;
      const turnsIn = (sci[id][a] || []).length; const n = techSpans[id][a] || 0;
      return `${a}@${enter[id][a]} techs=${n} tpt=${n ? (turnsIn / n).toFixed(1) : '-'} sci=${median(sci[id][a] || [])?.toFixed(0) ?? '-'} cost=${median(costs[id][a] || [])?.toFixed(0) ?? '-'}`;
    }).filter(Boolean).join(' | ');
    console.log(`${id === medianMajor ? '(median) ' : ''}${id === player ? '(player) ' : ''}${id}: techs=${engine.getResearched(state, id).length} ${line}`);
  }
  // Share of living majors in each age at the end and the turn half the majors entered each age.
  const half = AGE_ORDER.map((a) => { const ts = majors.map((id) => enter[id][a]).filter((x) => x != null).sort((x, y) => x - y); return ts.length >= majors.length / 2 ? `${a}:${ts[Math.ceil(majors.length / 2) - 1]}` : null; }).filter(Boolean);
  console.log(`turn half the majors entered: ${half.join(' ')}`);
  rows.push({ seed, maxJump, maxJumpLate, maxJumpClassical, minJump, longestFreeze, longestTech });
}
console.log('\nSUMMARY', JSON.stringify(rows));
