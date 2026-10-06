// src/battle/sim/tacticalAI.js
// The enemy commander (Tactical Battles plan §9). It runs INSIDE the deterministic sim and speaks
// only through orders (src/battle/sim/orders.js), exactly like the player — so it replays
// identically and can never do anything a player couldn't — and it only knows what its own fog of
// war shows it. Difficulty changes how often it thinks and how sharply it plays: settler/chieftain
// fight straightforwardly; prince uses commander powers and abilities; king adds cavalry flanking
// and missiles; emperor kites with its archers too. It never uses a nuclear strike.
import { distSq, isqrt } from './fixed';
import { fieldCap, fieldCount } from './world';
import { callCost } from './orders';
import { isFighting } from './combat';
import { canSeeSquad } from './fog';
import { getSquadAbilities, powerState, POWERS } from './effects';
import { canGarrison, garrisonRoom } from './objectives';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { makeGrid, rebuildGrid } from './spatial';

const AI_CELL = 4 * Q;

export const AI_DIFFICULTY = {
  settler: { thinkEvery: 24, retreatAt: 0.15, reserves: false, powers: false, abilities: false, flank: false, missiles: false },
  chieftain: { thinkEvery: 20, retreatAt: 0.2, reserves: true, powers: false, abilities: false, flank: false, missiles: false },
  prince: { thinkEvery: 10, retreatAt: 0.25, reserves: true, powers: true, abilities: true, flank: false, missiles: false },
  king: { thinkEvery: 6, retreatAt: 0.3, reserves: true, powers: true, abilities: true, flank: true, missiles: true },
  emperor: { thinkEvery: 4, retreatAt: 0.3, reserves: true, powers: true, abilities: true, flank: true, missiles: true, kite: true }
};
const DEFENSE_RADIUS = 24 * Q;

// Squads out in the open (a garrison stays put; its building does the fighting).
const own = (w, side) => w.squads.filter((q) => q.side === side && isFighting(q) && !q.routed && !q.retreating && !(q.inside >= 0));
const visibleEnemies = (w, side) => w.squads.filter((q) => q.side !== side && isFighting(q) && !q.routed && canSeeSquad(w, side, q));
const nearest = (list, x, y, maxD = Infinity) => {
  let best = null; let bestD = maxD * maxD;
  list.forEach((q) => { const d = distSq(q.x, q.y, x, y); if (d < bestD) { bestD = d; best = q; } });
  return best;
};

const callReinforcementsAndReserves = (w, side, orders) => {
  let slots = fieldCap(w) - fieldCount(w, side);
  let supply = w.supply[side];
  // Plain reserves first (cheaper), then neighbouring provinces' troops.
  w.squads
    .filter((q) => q.side === side && q.reserve && q.alive && q.enterTick < 0 && !q.fled)
    .sort((a, b) => (a.reinforcement ? 1 : 0) - (b.reinforcement ? 1 : 0) || b.strength - a.strength)
    .forEach((q) => {
      const cost = callCost(q, w);
      if (slots <= 0 || supply < cost) return;
      orders.push({ side, type: 'callReserve', squads: [q.idx] });
      slots -= 1; supply -= cost;
    });
};

// The 8×8-tile cell holding the most visible enemy strength with none of our own squads in it.
const densestEnemyCluster = (w, side, enemies) => {
  const cells = new Map();
  enemies.forEach((q) => { const k = Math.floor(q.x / (4 * Q)) * 1000 + Math.floor(q.y / (4 * Q)); const c = cells.get(k) || { s: 0, x: 0, y: 0, n: 0 }; c.s += q.strength; c.x += q.x; c.y += q.y; c.n += 1; cells.set(k, c); });
  let best = null;
  // Our squads near each cell centre, from a grid of where everyone stands now.
  const g = rebuildGrid(w.aiGrid && w.aiGrid.cell === AI_CELL ? w.aiGrid : makeGrid(AI_CELL, true), w.squads, (o) => o.alive && o.onField);
  w.aiGrid = g;
  const R = 3 * Q;
  const friendNear = (cx, cy) => {
    if (!g.n) return false;
    const ax = Math.max(Math.floor((cx - R) / g.cell) - g.cx0, 0); const bx = Math.min(Math.floor((cx + R) / g.cell) - g.cx0, g.cols - 1);
    const ay = Math.max(Math.floor((cy - R) / g.cell) - g.cy0, 0); const by = Math.min(Math.floor((cy + R) / g.cell) - g.cy0, g.rows - 1);
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        const b = (y * g.cols + x) * 2 + side;
        for (let s = g.start[b], end = g.start[b + 1]; s < end; s++) {
          const o = w.squads[g.items[s]];
          if (isFighting(o) && distSq(o.x, o.y, cx, cy) < R * R) return true;
        }
      }
    }
    return false;
  };
  cells.forEach((c) => {
    const cx = c.x / c.n; const cy = c.y / c.n;
    const friendlyClose = friendNear(cx, cy);
    if (!friendlyClose && (!best || c.s > best.s)) best = { s: c.s, x: cx, y: cy };
  });
  return best;
};

const decidePowers = (w, side, cfg, mine, enemies, orders) => {
  const ready = (id) => { const st = powerState(w, side, id); return st.available && st.usesLeft > 0 && st.readyAt <= w.tick && w.supply[side] >= POWERS[id].cost; };
  if (ready('rallyCry') && mine.filter((q) => q.morale < 40).length >= 3) { orders.push({ side, type: 'power', power: 'rallyCry', x: 0, y: 0 }); return; }
  const cluster = densestEnemyCluster(w, side, enemies);
  if (!cluster) return;
  const enemyTotal = enemies.reduce((s, q) => s + q.strength, 0) || 1;
  if (cfg.missiles && cluster.s / enemyTotal >= 0.4) {
    const missile = ['missileTheatre', 'missileTactical'].find(ready);
    if (missile) { orders.push({ side, type: 'power', power: missile, x: cluster.x, y: cluster.y }); return; }
  }
  const strike = ['airStrike', 'artilleryBarrage', 'arrowStorm'].find(ready);
  if (strike && cluster.s >= 1200) orders.push({ side, type: 'power', power: strike, x: cluster.x, y: cluster.y });
};

const decideAbilities = (w, side, mine, enemies, orders) => {
  mine.forEach((q) => {
    const abilities = getSquadAbilities(w, q).filter((id) => !((q.cooldowns?.[id] || 0) > w.tick));
    if (!abilities.length) return;
    const foe = nearest(enemies, q.x, q.y, 10 * Q);
    const dist = foe ? isqrt(distSq(q.x, q.y, foe.x, foe.y)) : Infinity;
    const pick = (id) => abilities.includes(id) && orders.push({ side, type: 'ability', squads: [q.idx], ability: id });
    if (abilities.includes('volley') && foe && dist < q.stats.range + Q) pick('volley');
    else if (abilities.includes('charge') && foe && dist < 4 * Q) pick('charge');
    else if (abilities.includes('bombard') && foe) pick('bombard');
    else if ((abilities.includes('entrench') || abilities.includes('shieldWall')) && foe && dist < 8 * Q && side === SIDE_DEFENDER) pick(abilities.includes('shieldWall') ? 'shieldWall' : 'entrench');
    else if (abilities.includes('fieldHospital') && mine.some((o) => o.strength < o.startStrength * 0.6)) pick('fieldHospital');
    else if (abilities.includes('forcedMarch') && !foe && side === SIDE_ATTACKER) pick('forcedMarch');
  });
};

// The attacker advances as ONE army in formation (arriving piecemeal just gets squads beaten one
// at a time): idle squads are ordered together toward the nearest known enemy — or the keep — and
// the formation code keeps the front line in front and matches the slowest squad's pace.
const thinkAttacker = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  const idle = mine.filter((q) => q.order.type === 'idle' && q.target < 0);
  const group = [];
  idle.forEach((q) => {
    if (q.stats.structureBonus) {
      const tower = w.structures.find((s) => s.alive && s.kind === 'tower');
      const s = tower || (keep.alive ? keep : null);
      if (s) { orders.push({ side, type: 'attack', squads: [q.idx], target: { kind: 'structure', index: w.structures.indexOf(s) } }); return; }
    }
    // King+: cavalry swings wide around the flank of whatever it's going for.
    if (cfg.flank && q.classId === 'cavalry' && enemies.length) {
      const foe = nearest(enemies, q.x, q.y);
      const flankY = foe.y + (foe.y < w.map.h * Q / 2 ? 6 * Q : -6 * Q);
      if (Math.abs(q.y - flankY) > 3 * Q) { orders.push({ side, type: 'move', squads: [q.idx], x: foe.x - 2 * Q, y: flankY }); return; }
    }
    group.push(q.idx);
  });
  if (!group.length) return;
  // Nothing in sight: assault the keep — it's the objective, and closing in reveals whoever is
  // still hiding around it.
  if (!enemies.length) {
    orders.push({ side, type: 'attackMove', squads: group, x: keep.x - 2 * Q, y: keep.y, formation: 'line' });
    return;
  }
  const cx = Math.trunc(group.reduce((s, i) => s + w.squads[i].x, 0) / group.length);
  const cy = Math.trunc(group.reduce((s, i) => s + w.squads[i].y, 0) / group.length);
  const foe = nearest(enemies, cx, cy);
  // Step toward the objective in bounded hops, so the line re-forms instead of stringing out.
  const tx = foe ? foe.x : keep.x - 2 * Q; const ty = foe ? foe.y : keep.y;
  const dx = tx - cx; const dy = ty - cy; const d = isqrt(dx * dx + dy * dy) || 1;
  const hop = Math.min(d, 14 * Q);
  orders.push({ side, type: 'attackMove', squads: group, x: cx + Math.trunc((dx * hop) / d), y: cy + Math.trunc((dy * hop) / d), formation: 'line' });
};

// Prince+: man the keep and towers — ranged first — while keeping at least half the army outside.
const GARRISON_REACH = 16 * Q;
const garrisonBuildings = (w, side, mine, orders) => {
  const army = w.squads.filter((q) => q.side === side && isFighting(q) && !q.routed);
  const inside = army.filter((q) => q.inside >= 0 || q.order.type === 'garrison').length;
  let budget = Math.floor(army.length / 2) - inside;
  if (budget <= 0 || mine.length < 2) return mine;
  const sent = new Set();
  w.structures.forEach((s, si) => {
    let room = garrisonRoom(w, si) - w.squads.filter((q) => q.order.type === 'garrison' && q.order.structure === si).length;
    while (room > 0 && budget > 0) {
      const candidates = mine.filter((q) => !sent.has(q.idx) && canGarrison(q) && q.order.type !== 'garrison' && q.target < 0 && distSq(q.x, q.y, s.x, s.y) <= GARRISON_REACH * GARRISON_REACH);
      const pick = nearest(candidates.filter((q) => q.classId === 'ranged'), s.x, s.y) || nearest(candidates, s.x, s.y);
      if (!pick) break;
      orders.push({ side, type: 'garrison', squads: [pick.idx], structure: si });
      sent.add(pick.idx); room -= 1; budget -= 1;
    }
  });
  return mine.filter((q) => !sent.has(q.idx));
};

const thinkDefender = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  if (cfg.abilities && w.assimilation === 0) mine = garrisonBuildings(w, side, mine, orders);
  const threat = nearest(enemies, keep.x, keep.y, DEFENSE_RADIUS);
  // The keep being taken beats everything else: everyone back to it.
  if (w.assimilation > 0) {
    mine.forEach((q) => orders.push({ side, type: 'attackMove', squads: [q.idx], x: keep.x, y: keep.y }));
    return;
  }
  mine.forEach((q) => {
    if (cfg.kite && q.classId === 'ranged' && threat && q.target >= 0) {
      const t = w.squads[q.target];
      if (t && t.stats.melee && distSq(t.x, t.y, q.x, q.y) < (3 * Q) * (3 * Q)) {
        orders.push({ side, type: 'move', squads: [q.idx], x: q.x + (q.x - t.x), y: q.y + (q.y - t.y) });
        return;
      }
    }
    if (q.target >= 0 || q.order.type === 'attackMove' || q.order.type === 'garrison') return;
    if (threat) orders.push({ side, type: 'attackMove', squads: [q.idx], x: threat.x, y: threat.y });
  });
};

export const thinkAI = (w, side, orders) => {
  const cfg = AI_DIFFICULTY[w.setup.difficultyId] || AI_DIFFICULTY.prince;
  if (w.tick % cfg.thinkEvery !== side) return; // the two sides think on different ticks
  const mine = own(w, side);
  const enemies = visibleEnemies(w, side);
  if (cfg.reserves) callReinforcementsAndReserves(w, side, orders);
  const start = w.setup.sides[side].units.reduce((s, u) => s + u.strength, 0) || 1;
  const now = w.squads.filter((q) => q.side === side && q.alive && !q.fled && !q.reinforcement).reduce((s, q) => s + q.strength, 0);
  // An attacking AI that has lost most of its army withdraws rather than fighting to the last.
  if (side === SIDE_ATTACKER && now / start < cfg.retreatAt && mine.length) { orders.push({ side, type: 'retreatAll' }); return; }
  if (cfg.powers && enemies.length) decidePowers(w, side, cfg, mine, enemies, orders);
  if (cfg.abilities) decideAbilities(w, side, mine, enemies, orders);
  if (side === SIDE_ATTACKER) thinkAttacker(w, side, cfg, mine, enemies, orders);
  else thinkDefender(w, side, cfg, mine, enemies, orders);
};
