// .claude/skills/balance-sim/stateHash.sim.js
// A strict "nothing changed" check for refactors: plays fixed-seed games and prints a hash of the
// WHOLE game state (keys sorted) at every checkpoint. Two commits that play identically print the
// same hashes; the first differing checkpoint shows when they diverge.
//   TURNS=280 SEEDS=11 EVERY=20 SPEED=fast JUMP=0 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/stateHash
// JUMP=<year> starts the calendar at that year (and its age), to reach the late ages quickly.
import { it } from 'vitest';
import { createHash } from 'node:crypto';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { getCalendarAgeId } from '../../../src/data/ages';

const TURNS = Number(process.env.TURNS || 280);
const EVERY = Number(process.env.EVERY || 20);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const SPEED = process.env.SPEED || 'fast';
const JUMP = process.env.JUMP ? Number(process.env.JUMP) : null;
const PLAYER = process.env.PLAYER || 'au';
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    if (ArrayBuffer.isView(v)) return `<${Array.from(v).join(',')}>`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  return JSON.stringify(v) ?? 'undefined';
};
const hash = (s) => createHash('sha1').update(stable(s)).digest('hex').slice(0, 12);

SEEDS.forEach((seed) => {
  it(`state hash seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, gameSpeed: SPEED }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    if (JUMP != null) s = { ...s, year: JUMP, age: getCalendarAgeId(JUMP) };
    console.log(`HASH seed=${seed} turn=0 year=${s.year} age=${s.age} ${hash(s)}`);
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      if (s.activeEvent) s = { ...s, activeEvent: null };
      if (s.pendingDefense) s = { ...s, pendingDefense: null };
      if (t % EVERY === 0 || t === TURNS) console.log(`HASH seed=${seed} turn=${t} year=${s.year} age=${s.age} ${hash(s)}`);
    }
  });
});
