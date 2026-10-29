// .claude/skills/balance-sim/earlyPace.sim.js
// Early build pace (lane early-pace-8): turns from the start until the player's capital finishes its
// first Settlers and, in a second game on the same seed, its first infantry unit (a Warband), with
// nothing else queued. Also the capital's size and production at turn 1 and the turn it reached
// SETTLER_MIN_SIZE. Per seed one EARLY line.
//   SEEDS=11,12,13,14,15,16,17,18 SPEED=normal npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/earlyPace.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { cityLive } from '../../../src/engine/cityEconomy';

const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const SPEED = process.env.SPEED || 'normal';
const MAX = Number(process.env.TURNS || 60);

const start = (seed) => {
  let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
  s = { ...s, gameSpeed: SPEED, research: { ...s.research, auto: true }, battleSettings: { ...(s.battleSettings || {}), autoDefend: true } };
  return s;
};
const capital = (s) => Object.values(s.regions).find((c) => c.owner === PLAYER && c.isCapital);
const clear = (s) => {
  for (let k = 0; k < 6 && (s.activeEventId || s.activeProceduralEvent); k++) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: k } });
  if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.RESPOND_PEACE_OFFER, payload: { accept: true } });
  return s;
};
const firstDone = (seed, item, test) => {
  let s = start(seed);
  const cap = capital(s);
  s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cap.id, item } });
  let sizeAt = null;
  for (let t = 1; t <= MAX && s.gameStatus === GameStatus.ACTIVE; t++) {
    s = resolveTurn(clear(s));
    const c = s.regions[cap.id];
    if (sizeAt == null && c.size >= 2) sizeAt = t;
    if (test(s, c)) return { turns: t, sizeAt };
  }
  return { turns: null, sizeAt };
};

SEEDS.forEach((seed) => {
  it(`early pace seed ${seed}`, () => {
    const s0 = start(seed);
    const cap = capital(s0);
    const live = cityLive(s0, cap.id);

    const settler = firstDone(seed, { kind: 'settler' }, (s) => (s.regions[cap.id].production?.current?.kind !== 'settler' && !(s.regions[cap.id].production?.queue || []).some((q) => q.kind === 'settler')));
    const warband = firstDone(seed, { kind: 'unit', classId: 'infantry' }, (s) => ![s.regions[cap.id].production?.current, ...(s.regions[cap.id].production?.queue || [])].some((q) => q?.kind === "unit"));
    const pits = firstDone(seed, { kind: "building", category: "food", tier: 0 }, (s) => (s.regions[cap.id].buildings?.categories?.food ?? -1) >= 0);
    console.log('EARLY', JSON.stringify({ seed, speed: SPEED, size: cap.size, prod: live?.yields?.production ?? live?.production, settler: settler.turns, size2At: settler.sizeAt, warband: warband.turns, storagePits: pits.turns }));
  });
});
