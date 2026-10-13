// src/battle/sim/__fixtures__/recordBattles.js
// Plays battles "live" through the real-time loop with a scripted, seeded player. Orders land at
// arbitrary frames, with pauses, speed changes, powers, abilities and reserve calls. Each battle's
// setup plus what the client ends up with (result, log, hash) is the recording that server
// verification must reproduce exactly (Tactical Battles plan §12.4, T9 exit gate).
import { createBattleLoop } from '../../worker/battleLoop';
import { buildSetupFromArmies, commandedSetup } from '../../setup/buildBattleSetup';
import { createRng } from '../../../utils/rng';
import { Q } from '../constants';
import { placementBlock } from '../economy';
import { deployZone } from '../world';

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

// ---- a commanded battle with the economy (playtest audit CB01, addendum X06) --------------------
// The battle the campaign really fights: the battle economy on, the commanded setup (the player's
// side never routs), a deployment before Start and every kind of order the screen sends: gather,
// build, assist, repair, train, cancelTrain, rally, cancelBuild, an attack on an economy building,
// next to the army's own. In the even battles the player's army is the weaker one, so without the
// commanded rule its squads would break and run: the same log over the bare setup is another battle.
const WEAK = ['infantry', 'infantry', 'ranged', 'cavalry'];
const STRONG = ['infantry', 'infantry', 'infantry', 'ranged', 'cavalry'];
const regiment = (prefix, classes, strength, morale) => classes.map((classId, i) => ({ id: `${prefix}${i}`, classId, strength, maxStrength: 1000, morale, promotions: [], commanderId: null, domain: 'land' }));

/** The bare setup (as buildInvasionSetup gives it); the battle is fought on commandedSetup(it). */
export const makeEconomySetup = (i = 0) => buildSetupFromArmies({
  regionId: `eco-replay-${i}`,
  terrain: ['plains', 'mixed', 'hills'][i % 3],
  seed: 77000 + i * 131,
  attackerUnits: i % 2 ? regiment('a', STRONG, 900, 90) : regiment('a', WEAK, 500, 55),
  defenderUnits: i % 2 ? regiment('d', WEAK, 500, 55) : regiment('d', STRONG, 900, 90),
  attackerAgeId: 'bronze',
  defenderAgeId: 'bronze',
  fortLevel: 0,
  deposits: [],
  controllers: i % 2 ? ['ai', 'player'] : ['player', 'ai'],
  difficultyId: 'king',
  powers: [[{ id: 'rallyCry' }], [{ id: 'rallyCry' }]],
  economy: true
});

// The first legal site for `type` near the side's headquarters, or null.
const findSite = (w, side, type) => {
  const hq = w.eco.buildings.find((b) => b.side === side && b.alive && (b.type === 'camp' || b.type === 'hall'));
  if (!hq) return null;
  const cx = Math.floor(hq.x / Q); const cy = Math.floor(hq.y / Q);
  for (let r = 3; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!placementBlock(w, side, type, cx + dx, cy + dy)) return { tx: cx + dx, ty: cy + dy };
      }
    }
  }
  return null;
};

/**
 * Plays `setup` (a commanded setup with an economy) live with the scripted player. `retreatAt`: the
 * tick after which the player sounds the retreat (a short battle for the campaign tests).
 * Returns { ended, used (the order types sent), refused (orders the loop did not admit) }.
 */
export const playCommandedBattle = (setup, seed = 0, { maxFrames = 120000, retreatAt = Infinity } = {}) => {
  const rng = createRng(909090 + seed);
  const messages = [];
  const loop = createBattleLoop({ setup, post: (m) => messages.push(m) });
  const side = setup.controllers.indexOf('player');
  const w = loop.world;
  const mapW = setup.map.w * Q; const mapH = setup.map.h * Q;
  const used = new Set();
  const push = (o) => { used.add(o.type); loop.pushOrders([{ side, ...o }]); };
  const army = () => w.squads.filter((q) => q.side === side && !q.eco && q.alive && q.onField && !q.fled).map((q) => q.idx);
  const workers = () => w.squads.filter((q) => q.side === side && q.worker && q.alive && q.onField).map((q) => q.idx);
  const own = (pred) => w.eco.buildings.filter((b) => b.side === side && b.alive && pred(b));

  // Before Start (tick 0, paused): an economy order FIRST, then the deployment. The live loop sets
  // the deployment down at once and runs the gather order at the first tick; the replay must too.
  loop.setPaused(true);
  let now = 0;
  loop.frame(now);
  const zone = deployZone(w, side);
  const firstNode = w.eco.nodes.findIndex((n) => n.amount !== 0 && n.kind !== 'farm');
  if (firstNode >= 0) push({ type: 'gather', squads: workers().slice(0, 2), node: firstNode });
  push({ type: 'deploy', squads: [...army(), ...workers().slice(0, 1)], x: Math.round(((zone.x0 + zone.x1) / 2) * Q), y: Math.round((zone.y0 + (zone.y1 - zone.y0) * 0.35) * Q), formation: 'line' });
  push({ type: 'deploy', squads: army().slice(0, 2), x: Math.round(zone.x1 * Q), y: Math.round(((zone.y0 + zone.y1) / 2) * Q), formation: 'column' });
  loop.setPaused(false);

  let barracks = -1; let spare = -1; let trained = false; let retreated = false;
  for (let f = 0; f < maxFrames && !messages.some((m) => m.type === 'ended'); f++) {
    now += 10 + Math.floor(rng.next() * 30);
    loop.frame(now);
    if (!retreated && w.tick >= retreatAt) { push({ type: 'retreatAll' }); retreated = true; }
    if (retreated || rng.next() >= 0.03) continue;
    const mine = army(); const hands = workers();
    const pick = mine.filter(() => rng.next() < 0.6);
    const roll = rng.next();
    const x = Math.floor(rng.next() * mapW); const y = Math.floor(rng.next() * mapH);
    const hq = own((b) => b.type === 'camp' || b.type === 'hall')[0];
    if (barracks < 0 && hands.length && w.tick > 20) {
      // Raise a barracks as soon as there is a legal, seen site for it.
      const site = findSite(w, side, 'barracks');
      if (site) { const before = w.eco.buildings.length; push({ type: 'build', squads: hands.slice(0, 2), building: 'barracks', ...site }); barracks = before; }
    } else if (spare === -1 && barracks >= 0 && hands.length && roll < 0.3) {
      // A house, placed and then called off (cancelBuild) a little later.
      const site = findSite(w, side, 'house');
      if (site) { const before = w.eco.buildings.length; push({ type: 'build', squads: hands.slice(-1), building: 'house', ...site }); spare = before; }
    } else if (spare >= 0 && w.eco.buildings[spare] && roll < 0.5) {
      push({ type: 'cancelBuild', building: spare }); spare = -2;
    } else if (barracks >= 0 && w.eco.buildings[barracks]?.built && !trained) {
      push({ type: 'train', building: barracks, role: 'infantry', count: 3 });
      push({ type: 'cancelTrain', building: barracks, slot: 2 });
      push({ type: 'rally', building: barracks, x, y });
      if (hq) push({ type: 'train', building: hq.idx, role: 'worker' });
      trained = true;
    } else if (roll < 0.12 && barracks >= 0 && w.eco.buildings[barracks]?.alive && hands.length) {
      push({ type: 'assist', squads: hands.slice(0, 1), target: { kind: 'eco', index: barracks } });
    } else if (roll < 0.2 && hands.length && hq) {
      push({ type: 'repair', squads: hands.slice(0, 1), target: hq.proxy != null ? { kind: 'structure', index: hq.proxy } : { kind: 'eco', index: hq.idx } });
    } else if (roll < 0.28 && hands.length) {
      const nodes = w.eco.nodes.map((n, k) => (n.amount !== 0 ? k : -1)).filter((k) => k >= 0);
      if (nodes.length) push({ type: 'gather', squads: hands.filter(() => rng.next() < 0.5), node: nodes[Math.floor(rng.next() * nodes.length)] });
    } else if (roll < 0.36) {
      const theirs = w.eco.buildings.filter((b) => b.side !== side && b.alive);
      if (theirs.length) push({ type: 'attack', squads: pick, target: { kind: 'eco', index: theirs[0].idx } });
    } else if (roll < 0.42 && barracks >= 0) {
      push({ type: 'rally', building: barracks }); // clear the rally point
    } else if (roll < 0.7) push({ type: 'attackMove', squads: pick, x, y, formation: rng.next() < 0.5 ? 'line' : 'column' });
    else if (roll < 0.8) push({ type: 'move', squads: [...pick, ...hands.slice(0, 1)], x, y });
    else if (roll < 0.86) push({ type: 'power', power: 'rallyCry', x, y });
    else if (roll < 0.92) push({ type: 'callReserve', squads: w.squads.filter((q) => q.side === side && q.reserve).map((q) => q.idx) });
    else push({ type: rng.next() < 0.5 ? 'hold' : 'stop', squads: pick });
  }
  const ended = messages.find((m) => m.type === 'ended');
  return { ended, used: [...used].sort(), refused: messages.filter((m) => m.type === 'ordersRefused').length };
};

/** Battle `i` of the commanded economy recordings: { setup (commanded), bare, ended, used, refused }. */
export const recordCommandedBattle = (i = 0, opts = {}) => {
  const bare = makeEconomySetup(i);
  const setup = commandedSetup(bare);
  return { setup, bare, ...playCommandedBattle(setup, i, opts) };
};
