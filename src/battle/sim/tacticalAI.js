// src/battle/sim/tacticalAI.js
// The enemy commander (Tactical Battles plan §9). It runs INSIDE the deterministic sim and speaks
// only through orders (src/battle/sim/orders.js), exactly like the player — so it replays
// identically and can never do anything a player couldn't — and it only knows what its own fog of
// war shows it. Difficulty changes how often it thinks and how sharply it plays: settler/chieftain
// fight straightforwardly; prince uses commander powers and abilities; king adds cavalry flanking
// and missiles; emperor kites with its archers too. It never uses a nuclear strike.
import { distSq, isqrt } from './fixed';
import { isFighting, inRangeOfSquad } from './combat';
import { canSeeSquad, isTileVisibleTo } from './fog';
import { getSquadAbilities, powerState, POWERS } from './effects';
import { canGarrison, garrisonRoom } from './objectives';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { makeGrid, rebuildGrid } from './spatial';
import { thinkEconomy } from './economyAI';
import { generalsOf } from './squadLists';
import { baseBuildings, hasBase } from './base';

const AI_CELL = 4 * Q;

export const AI_DIFFICULTY = {
  settler: { thinkEvery: 24, retreatAt: 0.15, powers: false, abilities: false, flank: false, missiles: false },
  chieftain: { thinkEvery: 20, retreatAt: 0.2, powers: false, abilities: false, flank: false, missiles: false },
  prince: { thinkEvery: 10, retreatAt: 0.25, powers: true, abilities: true, flank: false, missiles: false },
  king: { thinkEvery: 6, retreatAt: 0.3, powers: true, abilities: true, flank: true, missiles: true },
  emperor: { thinkEvery: 4, retreatAt: 0.3, powers: true, abilities: true, flank: true, missiles: true, kite: true }
};
const DEFENSE_RADIUS = 24 * Q;
const RAID_GUARD_RADIUS = 14 * Q;

// Squads out in the open (a garrison stays put; its building does the fighting).
// (Workers are the economy AI's: economyAI.js.)
// (Generals ride behind the army: keepGeneralsBack.)
const own = (w, side) => w.squads.filter((q) => q.side === side && !q.worker && !q.isGeneral && isFighting(q) && !q.routed && !q.retreating && !(q.inside >= 0));

// An AI general keeps GENERAL_BEHIND tiles behind the middle of its army, within reach of its aura.
const GENERAL_BEHIND = 3 * Q;
const keepGeneralsBack = (w, side, mine, orders) => {
  if (!mine.length) return;
  generalsOf(w).forEach((g) => {
    if (g.side !== side || !isFighting(g) || g.routed || g.retreating) return;
    const cx = Math.trunc(mine.reduce((s, q) => s + q.x, 0) / mine.length);
    const cy = Math.trunc(mine.reduce((s, q) => s + q.y, 0) / mine.length);
    const x = cx + (side === SIDE_ATTACKER ? -GENERAL_BEHIND : GENERAL_BEHIND);
    if (distSq(g.x, g.y, x, cy) > (2 * Q) * (2 * Q)) orders.push({ side, type: 'move', squads: [g.idx], x, y: cy });
  });
};
const visibleEnemies = (w, side) => w.squads.filter((q) => q.side !== side && isFighting(q) && !q.routed && canSeeSquad(w, side, q));
const nearest = (list, x, y, maxD = Infinity) => {
  let best = null; let bestD = maxD * maxD;
  list.forEach((q) => { const d = distSq(q.x, q.y, x, y); if (d < bestD) { bestD = d; best = q; } });
  return best;
};

// The enemy's nearest standing base building (base.js) to (x, y), as an attack target, or null.
// In a battle with bases that is what wins it (Q3, Q4): the keep alone is not enough.
const nearestBase = (w, enemySide, x, y) => {
  let best = null; let bestD = Infinity;
  baseBuildings(w, enemySide).forEach((b) => { const d = distSq(b.x, b.y, x, y); if (d < bestD) { bestD = d; best = b; } });
  return best ? { kind: best.kind, index: best.index } : null;
};
// Has the enemy no army left on the field (only laborers and generals, or nothing)?
const enemyArmyGone = (w, side) => !w.squads.some((q) => q.side !== side && !q.worker && !q.isGeneral && q.alive && !q.fled && q.onField && !q.routed);

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

// Every squad walks at its own pace (Q6), so an army keeps together the way a player keeps it
// together: a squad more than COHESION closer to the objective than the hindmost of the army
// (`group`: idle; `advancing`: on its way with nothing to fight) stops where it is (a Stop order; it
// still fights whatever it sees) and is sent on once the others have caught up.
const COHESION = 6 * Q;
const STRAGGLER = 16 * Q;
const keepTogether = (w, side, group, advancing, tx, ty, orders) => {
  const all = [...group, ...advancing];
  const d = new Map(all.map((i) => [i, isqrt(distSq(w.squads[i].x, w.squads[i].y, tx, ty))]));
  // A straggler far behind the bulk (a reinforcement just in from the edge, a squad stuck behind
  // rock) is not waited for.
  const sorted = [...d.values()].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const trail = Math.max(...sorted.filter((v) => v <= median + STRAGGLER));
  const ahead = (i) => d.get(i) < trail - COHESION;
  const wait = advancing.filter(ahead);
  if (wait.length) orders.push({ side, type: 'stop', squads: wait });
  return group.filter((i) => !ahead(i));
};

// The attacker advances as ONE army in formation (arriving piecemeal just gets squads beaten one
// at a time): idle squads are ordered together toward the nearest known enemy — or the keep — and
// the formation code keeps the front line in front; the fast ones wait for the slow (keepTogether).
const thinkAttacker = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  const idle = mine.filter((q) => q.order.type === 'idle' && q.target < 0);
  const group = [];
  idle.forEach((q) => {
    if (q.stats.structureBonus) {
      const tower = w.structures.find((s) => s.alive && s.kind === 'tower' && s.damage > 0); // an armed one
      const s = tower || (keep.alive ? keep : null);
      if (s) { orders.push({ side, type: 'attack', squads: [q.idx], target: { kind: 'structure', index: w.structures.indexOf(s) } }); return; }
      const goal = hasBase(w) ? nearestBase(w, SIDE_DEFENDER, q.x, q.y) : null;
      if (goal) { orders.push({ side, type: 'attack', squads: [q.idx], target: goal }); return; }
    }
    // King+: cavalry swings wide around the flank of whatever it's going for.
    if (cfg.flank && q.classId === 'cavalry' && enemies.length) {
      const foe = nearest(enemies, q.x, q.y);
      const flankY = foe.y + (foe.y < w.map.h * Q / 2 ? 6 * Q : -6 * Q);
      if (Math.abs(q.y - flankY) > 3 * Q) { orders.push({ side, type: 'move', squads: [q.idx], x: foe.x - 2 * Q, y: flankY }); return; }
    }
    group.push(q.idx);
  });
  const advancing = mine.filter((q) => q.order.type === 'attackMove' && q.target < 0 && !q.stats.structureBonus).map((q) => q.idx);
  const army = group.length ? group : advancing;
  if (!army.length) return;
  // Nothing in sight: assault the keep — it's the objective, and closing in reveals whoever is
  // still hiding around it.
  const cx = Math.trunc(army.reduce((s, i) => s + w.squads[i].x, 0) / army.length);
  const cy = Math.trunc(army.reduce((s, i) => s + w.squads[i].y, 0) / army.length);
  if (!enemies.length) {
    // With bases, once the keep is down the rest of the base must burn too (base.js).
    const goal = hasBase(w) && !keep.alive ? nearestBase(w, SIDE_DEFENDER, cx, cy) : null;
    if (goal) { if (group.length) orders.push({ side, type: 'attack', squads: group, target: goal }); return; }
    const go = keepTogether(w, side, group, advancing, keep.x - 2 * Q, keep.y, orders);
    if (go.length) orders.push({ side, type: 'attackMove', squads: go, x: keep.x - 2 * Q, y: keep.y, formation: 'line' });
    return;
  }
  const foe = nearest(enemies, cx, cy);
  // Step toward the objective in bounded hops, so the line re-forms instead of stringing out.
  const tx = foe ? foe.x : keep.x - 2 * Q; const ty = foe ? foe.y : keep.y;
  const dx = tx - cx; const dy = ty - cy; const d = isqrt(dx * dx + dy * dy) || 1;
  const hop = Math.min(d, 14 * Q);
  const go = keepTogether(w, side, group, advancing, tx, ty, orders);
  if (go.length) orders.push({ side, type: 'attackMove', squads: go, x: cx + Math.trunc((dx * hop) / d), y: cy + Math.trunc((dy * hop) / d), formation: 'line' });
};

// Prince+: man the keep and towers — ranged first — while keeping at least half the army outside.
const GARRISON_REACH = 16 * Q;
const garrisonBuildings = (w, side, mine, orders) => {
  const army = w.squads.filter((q) => q.side === side && !q.worker && isFighting(q) && !q.routed);
  const inside = army.filter((q) => q.inside >= 0 || q.order.type === 'garrison').length;
  let budget = Math.floor(army.length / 2) - inside;
  if (budget <= 0 || mine.length < 2) return mine;
  const sent = new Set();
  w.structures.forEach((s, si) => {
    const open = garrisonRoom(w, si);
    if (open <= 0) return;
    let room = open - w.squads.filter((q) => q.order.type === 'garrison' && q.order.structure === si).length;
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

// The defender's counter-attacks (I125, CB10). It knows only what its own fog shows it and speaks
// only through orders, exactly like a player.
//   Siege engines that batter the town are the first prey: the nearest free melee squad (cavalry
//   first) is sent at each engine it can see near the walls, one hunter an engine.
//   King+: an enemy camp it can see with no enemy soldier near it is raided by part of its cavalry
//   (with bases, a camp burned wins the battle: base.js).
// Returns the squads it sent.
const strengthOf = (list) => list.reduce((s, q) => s + q.strength, 0);
const SALLY_ODDS = 1.5;
const SIEGE_HUNT_RADIUS = DEFENSE_RADIUS + 8 * Q;
const HUNTER_REACH = 30 * Q;
const CAMP_GUARD_RADIUS = 10 * Q;
const counterAttack = (w, side, cfg, mine, enemies, keep, orders) => {
  const sent = new Set();
  const isEngine = (t) => t && t.stats.structureBonus && t.side !== side;
  const hunted = new Set(mine.filter((q) => q.order.type === 'attack' && q.targetKind === 'squad' && isEngine(w.squads[q.target])).map((q) => q.target));
  const free = mine.filter((q) => q.stats.melee && q.order.type !== 'attack' && q.order.type !== 'garrison' && !(q.target >= 0 && q.targetKind === 'squad' && inRangeOfSquad(q, w.squads[q.target])));
  enemies.filter((t) => isEngine(t) && distSq(t.x, t.y, keep.x, keep.y) <= SIEGE_HUNT_RADIUS * SIEGE_HUNT_RADIUS && !hunted.has(t.idx))
    .sort((a, b) => distSq(a.x, a.y, keep.x, keep.y) - distSq(b.x, b.y, keep.x, keep.y) || a.idx - b.idx)
    .forEach((t) => {
      const pool = free.filter((q) => !sent.has(q.idx));
      const hunter = nearest(pool.filter((q) => q.classId === 'cavalry'), t.x, t.y, HUNTER_REACH) || nearest(pool, t.x, t.y, HUNTER_REACH);
      if (!hunter) return;
      orders.push({ side, type: 'attack', squads: [hunter.idx], target: { kind: 'squad', index: t.idx } });
      sent.add(hunter.idx);
    });
  if (cfg.flank && hasBase(w)) {
    const riders = free.filter((q) => q.classId === 'cavalry' && !sent.has(q.idx) && q.target < 0);
    const camp = riders.length ? nearestBase(w, side === SIDE_DEFENDER ? SIDE_ATTACKER : SIDE_DEFENDER, keep.x, keep.y) : null;
    const b = camp ? (camp.kind === 'eco' ? w.eco?.buildings[camp.index] : w.structures[camp.index]) : null;
    const guarded = b && w.squads.some((o) => o.side !== side && !o.worker && isFighting(o) && !o.routed && distSq(o.x, o.y, b.x, b.y) <= CAMP_GUARD_RADIUS * CAMP_GUARD_RADIUS && canSeeSquad(w, side, o));
    if (b && isTileVisibleTo(w, side, b.x, b.y) && !guarded) {
      const raiders = riders.slice(0, Math.ceil(riders.length / 2)).map((q) => q.idx);
      orders.push({ side, type: 'attack', squads: raiders, target: camp });
      raiders.forEach((i) => sent.add(i));
    }
  }
  return sent;
};

const thinkDefender = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  if (cfg.abilities && w.assimilation === 0) mine = garrisonBuildings(w, side, mine, orders);
  let threat = nearest(enemies, keep.x, keep.y, DEFENSE_RADIUS);
  // Against raiders the loot is what needs guarding: the raider closest to a target still standing.
  if (w.setup.battleType === 'raid' || w.setup.battleType === 'sack') {
    let bestD = Infinity;
    w.structures.forEach((s) => {
      if (!s.loot || !s.alive) return;
      const foe = nearest(enemies, s.x, s.y, RAID_GUARD_RADIUS);
      if (!foe) return;
      const d = distSq(foe.x, foe.y, s.x, s.y);
      if (d < bestD) { bestD = d; threat = foe; }
    });
  }
  // With bases: once the attacker has no army left on the field, the defenders go out and burn its
  // camp (the battle is not over while its base stands: base.js), rather than wait for the clock.
  if (hasBase(w) && !threat && enemyArmyGone(w, side)) {
    const goal = nearestBase(w, SIDE_ATTACKER, keep.x, keep.y);
    if (goal) {
      const idle = mine.filter((q) => q.order.type !== 'attack' && q.order.type !== 'garrison' && q.target < 0);
      if (idle.length) orders.push({ side, type: 'attack', squads: idle.map((q) => q.idx), target: goal });
      return;
    }
  }
  // The keep being taken beats everything else: everyone back to it.
  if (w.assimilation > 0) {
    mine.forEach((q) => orders.push({ side, type: 'attackMove', squads: [q.idx], x: keep.x, y: keep.y }));
    return;
  }
  // I125 (prince+): a defender does not just wait at its walls.
  if (cfg.powers) {
    const sent = counterAttack(w, side, cfg, mine, enemies, keep, orders);
    if (sent.size) mine = mine.filter((q) => !sent.has(q.idx));
    // Clearly the stronger of what it can see: it goes out to meet the enemy wherever it stands.
    if (!threat && enemies.length && strengthOf(mine) >= SALLY_ODDS * strengthOf(enemies)) threat = nearest(enemies, keep.x, keep.y);
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

// Raiders (battleType.js raid and sack): burn the loot and run. Squads with an enemy close by
// fight it; the others go for the nearest loot target still standing. With the loot taken (or
// nothing left to burn) everyone withdraws by the raiders' own edge.
const RAID_ENGAGE = 4 * Q;
const thinkRaider = (w, side, mine, enemies, orders) => {
  const targets = w.structures.map((s, i) => (s.loot && s.alive ? i : -1)).filter((i) => i >= 0);
  if (w.looted || !targets.length) { if (!w.retreatOrdered?.[side] && mine.length) orders.push({ side, type: 'retreatAll' }); return; }
  mine.forEach((q) => {
    if (q.order.type !== 'idle' || q.target >= 0) return;
    const foe = nearest(enemies, q.x, q.y, RAID_ENGAGE);
    if (foe) { orders.push({ side, type: 'attackMove', squads: [q.idx], x: foe.x, y: foe.y }); return; }
    let best = -1; let bestD = Infinity;
    targets.forEach((i) => { const s = w.structures[i]; const d = distSq(q.x, q.y, s.x, s.y); if (d < bestD) { bestD = d; best = i; } });
    orders.push({ side, type: 'attack', squads: [q.idx], target: { kind: 'structure', index: best } });
  });
};

export const thinkAI = (w, side, orders) => {
  const cfg = AI_DIFFICULTY[w.setup.difficultyId] || AI_DIFFICULTY.prince;
  thinkEconomy(w, side, w.setup.difficultyId, orders); // on its own ticks; nothing without an economy
  if (w.tick % cfg.thinkEvery !== side) return; // the two sides think on different ticks
  const mine = own(w, side);
  const enemies = visibleEnemies(w, side);
  const start = w.setup.sides[side].units.reduce((s, u) => s + u.strength, 0) || 1;
  const now = w.squads.filter((q) => q.side === side && q.alive && !q.fled && !q.reinforcement && !q.worker && !q.isGeneral).reduce((s, q) => s + q.strength, 0);
  // An attacking AI that has lost most of its army withdraws rather than fighting to the last.
  if (side === SIDE_ATTACKER && now / start < cfg.retreatAt && mine.length) { orders.push({ side, type: 'retreatAll' }); return; }
  if (cfg.powers && enemies.length) decidePowers(w, side, cfg, mine, enemies, orders);
  if (cfg.abilities) decideAbilities(w, side, mine, enemies, orders);
  keepGeneralsBack(w, side, mine, orders);
  if (side === SIDE_ATTACKER && (w.setup.battleType === 'raid' || w.setup.battleType === 'sack')) thinkRaider(w, side, mine, enemies, orders);
  else if (side === SIDE_ATTACKER) thinkAttacker(w, side, cfg, mine, enemies, orders);
  else thinkDefender(w, side, cfg, mine, enemies, orders);
};
