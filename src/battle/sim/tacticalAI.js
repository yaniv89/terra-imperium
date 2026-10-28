// src/battle/sim/tacticalAI.js
// The enemy commander (Tactical Battles plan §9). It runs INSIDE the deterministic sim and speaks
// only through orders (src/battle/sim/orders.js), exactly like the player — so it replays
// identically and can never do anything a player couldn't — and it only knows what its own fog of
// war shows it. Difficulty changes how often it thinks and how sharply it plays: settler/chieftain
// fight straightforwardly; prince uses commander powers and abilities, plays the counters (cavalry
// on archers once the lines meet, spears onto riders near its archers) and focuses its archers' fire;
// king adds cavalry flanking, raids on laborers and pulling wounded squads out; emperor thinks
// fastest. (Archers stepping back from melee was tried and lost battles: they stop shooting.)
import { distSq, isqrt } from './fixed';
import { isFighting, inRangeOfSquad } from './combat';
import { getCounterMultiplier } from '../../data/unitClasses';
import { canSeeSquad, isTileVisibleTo } from './fog';
import { getSquadAbilities, powerState, POWERS, empTicks } from './effects';
import { canGarrison, garrisonRoom } from './objectives';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER, secondsToTicks, battleLimitTicks } from './constants';
import { makeGrid, rebuildGrid } from './spatial';
import { thinkEconomy } from './economyAI';
import { generalsOf } from './squadLists';
import { baseBuildings, hasBase } from './base';

const AI_CELL = 4 * Q;

export const AI_DIFFICULTY = {
  settler: { thinkEvery: 24, retreatAt: 0.15, powers: false, abilities: false, flank: false },
  chieftain: { thinkEvery: 20, retreatAt: 0.2, powers: false, abilities: false, flank: false },
  prince: { thinkEvery: 10, retreatAt: 0.25, powers: true, abilities: true, flank: false, micro: true },
  king: { thinkEvery: 6, retreatAt: 0.3, powers: true, abilities: true, flank: true, micro: true, pullBack: 0.25 },
  emperor: { thinkEvery: 4, retreatAt: 0.3, powers: true, abilities: true, flank: true, micro: true, pullBack: 0.3 }
};
// Each of the lane's behaviours on its own (battle-lab aiDuel.sim.js FEAT_OFF switches them off to
// measure one at a time); all on in play.
export const AI_FEATURES = { hold: true, walls: true, guard: true, cavalry: true, focus: true, pullBack: true };
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
  // Ambush (Stone): hide the army where it stands before the lines meet.
  if (ready('ambush') && mine.length && !mine.some((q) => q.engaged)) {
    orders.push({ side, type: 'power', power: 'ambush', x: Math.floor(mine.reduce((s, q) => s + q.x, 0) / mine.length), y: Math.floor(mine.reduce((s, q) => s + q.y, 0) / mine.length) });
    return;
  }
  // Information: jam the enemy once the lines meet, scout with a drone before they do.
  const engaged = mine.some((q) => q.engaged);
  if (engaged && ready('cyberJam')) { orders.push({ side, type: 'power', power: 'cyberJam', x: 0, y: 0 }); return; }
  if (!engaged && ready('droneRecon')) { orders.push({ side, type: 'power', power: 'droneRecon', x: 0, y: 0 }); return; }
  // Future (U68): turn an enemy robot once the lines meet.
  const robot = engaged && ready('hijack') ? enemies.find((q) => q.original?.robot && !q.hijack) : null;
  if (robot) { orders.push({ side, type: 'power', power: 'hijack', x: robot.x, y: robot.y }); return; }
  const cluster = densestEnemyCluster(w, side, enemies);
  if (!cluster) return;
  // An EMP where the enemy's machines stand.
  if (engaged && ready('emp') && enemies.some((q) => empTicks(q, POWERS.emp.emp) > 0)) { orders.push({ side, type: 'power', power: 'emp', x: cluster.x, y: cluster.y }); return; }
  const strike = ['orbitalStrike', 'airStrike', 'droneStrike', 'artilleryBarrage', 'arrowStorm'].find(ready);
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
// (`group`: idle or held; `advancing`: on its way with nothing to fight) holds where it is (it still
// fights whatever reaches it) and is sent on once the others have caught up.
const HIT_RECENT = secondsToTicks(2);
const hitRecently = (w, q) => q.lastHitTick >= 0 && w.tick - q.lastHitTick < HIT_RECENT;
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
  // A squad under fire is not held standing in it (gunpowder trace: held riders shot to pieces).
  const ahead = (i) => d.get(i) < trail - COHESION && !hitRecently(w, w.squads[i]);
  const wait = advancing.filter(ahead);
  // Hold, not Stop: an idle squad picks up and chases anything in sight, so a fast one that was
  // stopped ahead of the line charged alone (battle-ai-tactics trace: cavalry 9 tiles ahead of its
  // infantry, routed before the lines met). Held, it only fights what reaches it.
  if (wait.length) orders.push({ side, type: AI_FEATURES.hold ? 'hold' : 'stop', squads: wait });
  return group.filter((i) => !ahead(i));
};

// The attacker advances as ONE army in formation (arriving piecemeal just gets squads beaten one
// at a time): idle squads are ordered together toward the nearest known enemy — or the keep — and
// the formation code keeps the front line in front; the fast ones wait for the slow (keepTogether).
const thinkAttacker = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  const idle = mine.filter((q) => (q.order.type === 'idle' || q.order.type === 'hold') && q.target < 0);
  const group = [];
  idle.forEach((q) => {
    if (q.stats.structureBonus) {
      const tower = w.structures.find((s) => s.alive && s.kind === 'tower' && s.damage > 0); // an armed one
      const s = tower || (keep.alive && !keep.passive ? keep : null);
      if (s) { orders.push({ side, type: 'attack', squads: [q.idx], target: { kind: 'structure', index: w.structures.indexOf(s) } }); return; }
      const goal = hasBase(w) ? nearestBase(w, SIDE_DEFENDER, q.x, q.y) : null;
      if (goal) { orders.push({ side, type: 'attack', squads: [q.idx], target: goal }); return; }
    }
    // (King+ cavalry rides round the flank once it is sent on a target: micro.)
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

// A field defender's march-out (playtest 40550100958). Never before FIELD_GRACE (the attacker's
// build phase: camp, towers, first training), and only after a third of the clock has passed with
// FIELD_QUIET of nobody hit: 200 s of a 10-minute economy clock, 400 s of a 20-minute one.
const FIELD_GRACE = secondsToTicks(180);
const FIELD_QUIET = secondsToTicks(30);
const fieldMarchDue = (w) => {
  if (w.tick < Math.max(FIELD_GRACE, Math.floor(battleLimitTicks(w.setup) / 3))) return false;
  for (let i = 0; i < w.squads.length; i++) { const q = w.squads[i]; if (!q.worker && w.tick - q.lastHitTick < FIELD_QUIET) return false; }
  return true;
};
const basePos = (w, b) => { const s = b && (b.kind === 'eco' ? w.eco?.buildings[b.index] : w.structures[b.index]); return s ? { x: s.x, y: s.y } : null; };
// The radius of a city's wall ring while any wall or gate of it stands (0: no walls to hold).
const wallRing = (w, keep) => {
  let r2 = 0;
  w.structures.forEach((s) => { if (s.alive && (s.kind === 'wall' || s.kind === 'gate')) r2 = Math.max(r2, distSq(s.x, s.y, keep.x, keep.y)); });
  return r2 ? isqrt(r2) : 0;
};
const WALL_MARGIN = 3 * Q;

const thinkDefender = (w, side, cfg, mine, enemies, orders) => {
  const keep = w.structures[0];
  if (cfg.abilities && w.assimilation === 0) mine = garrisonBuildings(w, side, mine, orders);
  // Behind standing walls the defenders hold them (Total War's garrison AI): they meet only what comes
  // up to the walls, not an army still forming up outside (trace: a walled garrison marched out
  // through its gate and lost its whole field army in the open, attacker 16 of 16).
  const ring = AI_FEATURES.walls ? wallRing(w, keep) : 0;
  let threat = nearest(enemies, keep.x, keep.y, ring ? ring + WALL_MARGIN : DEFENSE_RADIUS);
  // At sea there is nothing to hold: the fleet goes for the nearest enemy ship it can see, or
  // sails for where the enemy fleet formed up until it sees one.
  if (!threat && w.setup.battleType === 'naval') {
    const z = w.map.attackerZone;
    threat = nearest(enemies, keep.x, keep.y) || { x: ((z.x0 + z.x1) >> 1) * Q + (Q >> 1), y: keep.y };
  }
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
  // A field battle has no walls to hold (playtest 40550100958: an idle attacker, or the remnant of a
  // beaten one, waited out the clock with nobody fighting): once the march is due (fieldMarchDue)
  // the defenders go out as one army, with all they trained meanwhile, to the nearest enemy still
  // standing, else to the enemy's camp. Earlier only the stronger-enemy sally (below) sends them out.
  if (!threat && (w.setup.battleType || 'field') === 'field' && fieldMarchDue(w)) {
    threat = nearest(enemies.filter((q) => !q.retreating), keep.x, keep.y) || basePos(w, nearestBase(w, SIDE_ATTACKER, keep.x, keep.y));
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
    if (!threat && enemies.length && strengthOf(own(w, side)) >= SALLY_ODDS * strengthOf(enemies)) threat = nearest(enemies, keep.x, keep.y);
  }
  const group = [];
  mine.forEach((q) => {
    if (q.target >= 0 || q.order.type === 'attackMove' || q.order.type === 'garrison') return;
    group.push(q.idx);
  });
  // The defenders go out as one army, as the attacker does (playtest issue 4: they came one squad at a time).
  if (!threat || !group.length) return;
  const advancing = mine.filter((q) => q.order.type === 'attackMove' && q.target < 0).map((q) => q.idx);
  const go = keepTogether(w, side, group, advancing, threat.x, threat.y, orders);
  if (go.length) orders.push({ side, type: 'attackMove', squads: go, x: threat.x, y: threat.y });
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

// Micro (prince+, battle-ai-tactics lane), the way a good player fights a battle: Age of Empires'
// counter targeting, StarCraft's focus fire and pulling the wounded, Total War's cavalry kept back
// until the lines meet. All through ordinary orders, on what its own fog shows it. Returns the
// squads it gave an order, so the army's plan leaves them alone this think.
const GUARD_RADIUS = 6 * Q;   // an enemy rider this close to our archers or engines is met by a spear
const GUARD_REACH = 10 * Q;   // how far a spear goes to meet it
const RIDE_REACH = 22 * Q;    // how far our cavalry rides for a soft target
const ESCORT = 4 * Q;         // a soft target with enemy foot this close is escorted
const FLANK_OFFSET = 6 * Q;
const FOCUS_SWITCH = 1.5;
const RESERVE_BACK = 3 * Q;
const RESERVE_WING = 4 * Q;
const inMeleeWith = (w, q) => (q.target >= 0 && q.targetKind === 'squad' && inRangeOfSquad(q, w.squads[q.target]) ? w.squads[q.target] : null);
const soft = (q) => q.classId === 'ranged' || q.classId === 'siege' || q.classId === 'support';
const micro = (w, side, cfg, mine, enemies, orders) => {
  const used = new Set();
  const foes = enemies.filter((t) => !t.retreating && !(t.inside >= 0));
  if (!foes.length) return used;
  const order = (q, o) => { orders.push({ side, squads: [q.idx], ...o }); used.add(q.idx); };
  const attackSquad = (q, t) => { if (!(q.order.type === 'attack' && q.targetKind === 'squad' && q.target === t.idx)) order(q, { type: 'attack', target: { kind: 'squad', index: t.idx } }); else used.add(q.idx); };

  // King+: a melee squad nearly spent, still being cut down, leaves the field and keeps its men.
  if (cfg.pullBack && AI_FEATURES.pullBack) {
    mine.forEach((q) => {
      if ((q.classId !== 'infantry' && q.classId !== 'cavalry') || q.strength >= q.startStrength * cfg.pullBack || !hitRecently(w, q)) return;
      const t = inMeleeWith(w, q);
      if (t && t.strength <= q.strength * 2) return; // its foe is as spent: finish it
      order(q, { type: 'retreat' });
    });
  }

  // Spears onto riders that come at our archers or engines (pikes guarding the archers, AoE), and
  // the nearest free soldier onto any raider among our laborers (AoE's town defence).
  const softOnes = mine.filter(soft);
  const workers = w.squads.filter((q) => q.worker && q.side === side && isFighting(q));
  const near = (list, t) => list.some((q) => distSq(q.x, q.y, t.x, t.y) <= GUARD_RADIUS * GUARD_RADIUS);
  if (AI_FEATURES.guard) foes.forEach((t) => {
    if (t.worker || t.routed) return;
    const rider = t.classId === 'cavalry' && near(softOnes, t);
    if (!rider && !near(workers, t)) return;
    if (mine.some((q) => q.order.type === 'attack' && q.target === t.idx)) return;
    const free = mine.filter((q) => !used.has(q.idx) && !inMeleeWith(w, q) && (q.classId === 'infantry' || (!rider && q.classId === 'cavalry')));
    const guard = nearest(free, t.x, t.y, GUARD_REACH);
    if (guard) attackSquad(guard, t);
  });

  // Cavalry: kept with the line until the lines meet (or a soft target stands alone), then on the
  // enemy's archers and engines; king+ rides round the flank to them rather than through the line.
  // The lines have met when our foot is fighting at its own reach (being shot from afar is not it).
  const met = mine.some((q) => q.classId === 'infantry' && inMeleeWith(w, q));
  const targets = foes.filter((t) => soft(t) && !t.routed);
  const escorted = (t) => foes.some((o) => o.classId === 'infantry' && !o.routed && distSq(o.x, o.y, t.x, t.y) <= ESCORT * ESCORT);
  // King+: riders with nothing better raid the enemy's unguarded laborers (AoE's villager raids).
  const laborers = cfg.flank ? foes.filter((t) => t.worker && !escorted(t)) : [];
  // Until then they wait on the wings behind the foot (Total War's cavalry reserve): in the front
  // row of a line they rode ahead of it and were shot down alone (gunpowder trace).
  const foot = mine.filter((q) => q.classId === 'infantry');
  const back = side === SIDE_ATTACKER ? -RESERVE_BACK : RESERVE_BACK;
  if (AI_FEATURES.cavalry) mine.forEach((q) => {
    if (used.has(q.idx) || q.classId !== 'cavalry') return;
    const now = inMeleeWith(w, q);
    if (now && (soft(now) || now.classId === 'cavalry')) return; // already on a good target
    const fresh = q.strength * 5 >= q.startStrength * 2; // spent riders do not charge
    // An escorted one only once the lines have met and only round the flank (king+); else alone ones.
    const prey = fresh ? nearest(targets.filter((t) => (met && cfg.flank) || !escorted(t)), q.x, q.y, RIDE_REACH) : null;
    const raid = !prey && fresh && !met ? nearest(laborers, q.x, q.y, RIDE_REACH) : null;
    if (raid) { attackSquad(q, raid); return; }
    if (!prey) {
      if (now || hitRecently(w, q) || !foot.length) return; // fighting what reached it
      const x = Math.trunc(foot.reduce((a, o) => a + o.x, 0) / foot.length) + back;
      const y = Math.trunc(foot.reduce((a, o) => a + o.y, 0) / foot.length) + (q.idx % 2 ? RESERVE_WING : -RESERVE_WING);
      if (distSq(q.x, q.y, x, y) > (2 * Q) * (2 * Q)) order(q, { type: 'move', x, y });
      else if (q.order.type !== 'hold') order(q, { type: 'hold' }); // idle, it would charge whatever it sees
      else used.add(q.idx);
      return;
    }
    if (cfg.flank && !now) {
      // Enemy foot between us and the prey: ride to its flank first.
      const mx = (q.x + prey.x) >> 1; const my = (q.y + prey.y) >> 1;
      const blocked = foes.some((o) => o.classId === 'infantry' && !o.routed && distSq(o.x, o.y, mx, my) <= ESCORT * ESCORT);
      const flankY = prey.y + (prey.y < w.map.h * Q / 2 ? -FLANK_OFFSET : FLANK_OFFSET);
      if (blocked && Math.abs(q.y - flankY) > 2 * Q && distSq(q.x, q.y, prey.x, prey.y) > (8 * Q) * (8 * Q)) { order(q, { type: 'move', x: prey.x, y: flankY }); return; }
    }
    attackSquad(q, prey);
  });

  // Focus fire: each archer takes, of the targets in its reach, the one most of our archers reach,
  // that it counters and that has the fewest men left; enemy foot on top of our archers first.
  const shooters = mine.filter((q) => !used.has(q.idx) && q.classId === 'ranged');
  if (AI_FEATURES.focus && shooters.length) {
    const live = foes.filter((t) => !t.routed && !t.worker);
    const pool = live.length ? live : foes.filter((t) => !t.worker);
    const reach = new Map();
    const inReach = shooters.map((q) => pool.filter((t) => inRangeOfSquad(q, t)));
    inReach.forEach((list) => list.forEach((t) => reach.set(t.idx, (reach.get(t.idx) || 0) + 1)));
    shooters.forEach((q, k) => {
      let best = null; let bestScore = 0;
      inReach[k].forEach((t) => {
        const threat = t.stats.melee && softOnes.some((o) => distSq(o.x, o.y, t.x, t.y) <= GUARD_RADIUS * GUARD_RADIUS) ? 2 : 1;
        const score = (getCounterMultiplier(q.classId, t.classId, q.ageId) * reach.get(t.idx) * threat) / (t.strength + 250);
        if (score > bestScore) { bestScore = score; best = t; }
      });
      // Switch only for a clearly better target: a squad that keeps changing aim chases (ships did).
      const cur = q.targetKind === 'squad' && q.target >= 0 ? w.squads[q.target] : null;
      const curScore = cur && inReach[k].includes(cur) ? (getCounterMultiplier(q.classId, cur.classId, q.ageId) * reach.get(cur.idx)) / (cur.strength + 250) : 0;
      if (best && best !== cur && bestScore > curScore * FOCUS_SWITCH) attackSquad(q, best);
    });
  }
  return used;
};

export const thinkAI = (w, side, orders) => {
  const cfg = AI_DIFFICULTY[w.setup.difficultyId] || AI_DIFFICULTY.prince;
  thinkEconomy(w, side, w.setup.difficultyId, orders); // on its own ticks; nothing without an economy
  if (w.tick % cfg.thinkEvery !== side) return; // the two sides think on different ticks
  let mine = own(w, side);
  const enemies = visibleEnemies(w, side);
  const start = w.setup.sides[side].units.reduce((s, u) => s + u.strength, 0) || 1;
  const now = w.squads.filter((q) => q.side === side && q.alive && !q.fled && !q.reinforcement && !q.worker && !q.isGeneral).reduce((s, q) => s + q.strength, 0);
  // An attacking AI that has lost most of its army withdraws rather than fighting to the last.
  if (side === SIDE_ATTACKER && now / start < cfg.retreatAt && mine.length) { orders.push({ side, type: 'retreatAll' }); return; }
  if (cfg.powers && enemies.length) decidePowers(w, side, cfg, mine, enemies, orders);
  if (cfg.abilities) decideAbilities(w, side, mine, enemies, orders);
  keepGeneralsBack(w, side, mine, orders);
  const raiding = side === SIDE_ATTACKER && (w.setup.battleType === 'raid' || w.setup.battleType === 'sack');
  if (cfg.micro && !raiding && w.assimilation === 0) {
    const used = micro(w, side, cfg, mine, enemies, orders);
    if (used.size) mine = mine.filter((q) => !used.has(q.idx));
  }
  if (raiding) thinkRaider(w, side, mine, enemies, orders);
  else if (side === SIDE_ATTACKER) thinkAttacker(w, side, cfg, mine, enemies, orders);
  else thinkDefender(w, side, cfg, mine, enemies, orders);
};
