// src/battle/sim/__fixtures__/recordBattles.js
// Plays battles "live" through the real-time loop with a scripted, seeded player. Orders land at
// arbitrary frames, with pauses, speed changes, powers, abilities and reserve calls. Each battle's
// setup plus what the client ends up with (result, log, hash) is the recording that server
// verification must reproduce exactly (Tactical Battles plan §12.4, T9 exit gate).
import { createBattleLoop } from '../../worker/battleLoop';
import { buildSetupFromArmies } from '../../setup/buildBattleSetup';
import { createRng } from '../../../utils/rng';
import { Q } from '../constants';

const TERRAINS = ['plains', 'forest', 'hills', 'mixed', 'desert', 'mountains', 'urban', 'arctic'];
const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const CLASSES = ['infantry', 'infantry', 'ranged', 'cavalry', 'siege', 'support'];

const army = (rng, prefix, n) => Array.from({ length: n }, (_, i) => ({
  id: `${prefix}${i}`, classId: CLASSES[Math.floor(rng.next() * CLASSES.length)], strength: 600 + Math.floor(rng.next() * 400), maxStrength: 1000,
  morale: 80 + Math.floor(rng.next() * 20), promotions: [], commanderId: null, domain: 'land'
}));

export const makeRecordedSetup = (i) => {
  const rng = createRng(1000 + i * 7919);
  return buildSetupFromArmies({
    regionId: `replay-${i}`,
    terrain: TERRAINS[i % TERRAINS.length],
    seed: Math.floor(rng.next() * 0xffffffff),
    attackerUnits: army(rng, 'a', 3 + Math.floor(rng.next() * 5)),
    defenderUnits: army(rng, 'd', 2 + Math.floor(rng.next() * 4)),
    attackerAgeId: AGES[i % AGES.length],
    defenderAgeId: AGES[(i + 1) % AGES.length],
    fortLevel: i % 4,
    deposits: i % 3 ? ['iron'] : [],
    controllers: i % 5 === 4 ? ['ai', 'player'] : ['player', 'ai'],
    difficultyId: ['settler', 'prince', 'king', 'emperor'][i % 4],
    powers: [[{ id: 'rallyCry' }, { id: 'arrowStorm' }], [{ id: 'rallyCry' }]]
  });
};

// A scripted player: every so often, a random order for some of its own squads.
export const recordBattle = (i) => {
  const setup = makeRecordedSetup(i);
  const rng = createRng(424242 + i);
  const messages = [];
  const loop = createBattleLoop({ setup, post: (m) => messages.push(m) });
  const side = setup.controllers.indexOf('player');
  const mapW = setup.map.w * Q; const mapH = setup.map.h * Q;
  let now = 0;
  loop.frame(now);
  for (let f = 0; f < 60000 && !messages.some((m) => m.type === 'ended'); f++) {
    now += 10 + Math.floor(rng.next() * 30); // uneven frame times, like a real phone
    loop.frame(now);
    if (rng.next() < 0.02) {
      const mine = loop.world.squads.filter((q) => q.side === side && q.alive).map((q) => q.idx);
      const pick = mine.filter(() => rng.next() < 0.6);
      const roll = rng.next();
      const x = Math.floor(rng.next() * mapW); const y = Math.floor(rng.next() * mapH);
      if (roll < 0.45) loop.pushOrders([{ side, type: 'attackMove', squads: pick, x, y, formation: rng.next() < 0.5 ? 'line' : 'column' }]);
      else if (roll < 0.6) loop.pushOrders([{ side, type: 'move', squads: pick, x: x + 0.5, y }]);
      else if (roll < 0.7) loop.pushOrders([{ side, type: 'attack', squads: pick, target: { kind: 'structure', index: 0 } }]);
      else if (roll < 0.78) loop.pushOrders([{ side, type: 'callReserve', squads: mine }]);
      else if (roll < 0.86) loop.pushOrders([{ side, type: 'power', power: rng.next() < 0.5 ? 'rallyCry' : 'arrowStorm', x, y }]);
      else if (roll < 0.92) loop.pushOrders([{ side, type: 'formationLine', squads: pick, x, y, x2: x, y2: Math.min(mapH - Q, y + 8 * Q) }]);
      else loop.pushOrders([{ side, type: rng.next() < 0.5 ? 'hold' : 'stop', squads: pick }]);
    }
    if (rng.next() < 0.003) loop.setSpeed([1, 2, 4][Math.floor(rng.next() * 3)]);
    if (rng.next() < 0.002) { loop.setPaused(true); loop.pushOrders([{ side, type: 'stop', squads: [0] }]); loop.setPaused(false); }
  }
  const ended = messages.find((m) => m.type === 'ended');
  return { setup, ended };
};
