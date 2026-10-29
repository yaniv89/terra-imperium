// .claude/skills/battle-lab/skillDuel.sim.js
// Does commanding well win? (lane battle-skill-8, GPT math report section 2.) Mirrored even field
// battles, the player's side commanded (commandedSetup: it never routs, it gets Shaken) by one of
// three scripted controllers against the battle AI at DIFF:
//   novice   - attack-moves the whole army at the enemy every 10 s, nothing else;
//   baseline - the battle AI itself at DIFF (a mirror);
//   skilled  - a decent player: infantry line meets theirs, archers behind it focus one target,
//              cavalry waits for the lines to meet, then rides round the flank onto archers or the
//              rear of their engaged foot, a spent melee squad pulls back.
// Each seed is fought twice, the player attacking and defending, so the side's edge cancels.
//   N=20 DIFF=prince AGES=bronze,classical ECO=0 \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/skillDuel
// Per row and controller: player wins / battles with a Wilson 95% interval, and the share of
// strength each side kept. CTRL=novice,skilled limits the controllers.
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { toStrategicResult } from '../../../src/battle/sim/result';
import { battleLimitTicks, Q } from '../../../src/battle/sim/constants';
import { isFighting, inRangeOfSquad } from '../../../src/battle/sim/combat';
import { canSeeSquad } from '../../../src/battle/sim/fog';
import { distSq, polarX, polarY } from '../../../src/battle/sim/fixed';
import { thinkAI, AI_DIFFICULTY, AI_FEATURES } from '../../../src/battle/sim/tacticalAI';
import { thinkEconomy } from '../../../src/battle/sim/economyAI';
import { getAvailableClasses } from '../../../src/data/unitClasses';

const N = Number(process.env.N || 20);
const SEED0 = Number(process.env.SEED0 || 1);
const DIFF = process.env.DIFF || 'prince';
// The player's own play for baseline and skilled is the battle AI at PDIFF (prince: a player who keeps a line and focuses fire).
// AIOVR='{"thinkEvery":30}': try another tuning of the opponent's level.
if (process.env.AIOVR) Object.assign(AI_DIFFICULTY[DIFF], JSON.parse(process.env.AIOVR));
// FEAT_OFF=guard,hold: the battle AI without those behaviours, on both sides (tacticalAI.js AI_FEATURES).
(process.env.FEAT_OFF || '').split(',').filter(Boolean).forEach((k) => { AI_FEATURES[k] = false; });
const PDIFF = process.env.PDIFF || 'prince';
const playerAI = (w, side, orders) => { const d = w.setup.difficultyId; w.setup.difficultyId = PDIFF; thinkAI(w, side, orders); w.setup.difficultyId = d; };
const AGES = (process.env.AGES || 'bronze,classical').split(',');
const TERRAIN = process.env.TERRAIN || 'plains';
const ECO = process.env.ECO === '1';
const CTRL = (process.env.CTRL || 'novice,baseline,skilled').split(',');
const SKILLS = (process.env.SKILLS || 'nochase').split(','); // the skilled controller's habits
const NOVICE_EVERY = Number(process.env.NOVICE_EVERY || 200); // ticks between the novice's attack-moves
const TRACE = Number(process.env.TRACE || 0); // ticks between squad lines (N=1 SEED0=s)
const ARMIES = [
  ['infantry', 'infantry', 'infantry', 'cavalry', 'ranged', 'ranged'],
  ['infantry', 'infantry', 'cavalry', 'cavalry', 'ranged', 'ranged']
].filter((_, i) => !process.env.MATCH || process.env.MATCH.split(',').map(Number).includes(i));
const ofAge = (cls, ageId) => cls.map((c) => (getAvailableClasses(ageId).includes(c) ? c : 'infantry'));
const mk = (p, cls) => cls.map((c, i) => ({ id: `${p}${i}`, classId: c, domain: 'land', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);

const army = (w, side) => w.squads.filter((q) => q.side === side && !q.worker && !q.isGeneral && isFighting(q) && !q.retreating && !(q.inside >= 0));
const centre = (list) => ({ x: Math.trunc(list.reduce((s, q) => s + q.x, 0) / list.length), y: Math.trunc(list.reduce((s, q) => s + q.y, 0) / list.length) });
const nearest = (list, x, y) => list.reduce((b, t) => (!b || distSq(x, y, t.x, t.y) < distSq(x, y, b.x, b.y) ? t : b), null);

// Every controller sees what the player would: its own fog; before contact, the enemy's start.
const makeController = (kind, side) => {
  let enemyStart = null;
  const enemyCentre = (w, foes) => (foes.length ? centre(foes) : enemyStart);
  return (w, orders) => {
    if (kind === 'baseline') { playerAI(w, side, orders); return; }
    if (!enemyStart) enemyStart = centre(w.squads.filter((q) => q.side !== side && !q.worker && !q.isGeneral));
    const mine = army(w, side);
    const foes = w.squads.filter((q) => q.side !== side && isFighting(q) && !q.routed && !q.worker && canSeeSquad(w, side, q));
    const at = enemyCentre(w, foes);
    if (!mine.length || !at) return;
    const go = (list, o) => { if (list.length) orders.push({ side, squads: list.map((q) => q.idx), ...o }); };
    if (kind === 'novice') {
      thinkEconomy(w, side, DIFF, orders); // the base runs itself: only command is measured
      if (w.tick % NOVICE_EVERY === 1) go(mine, { type: 'attackMove', x: at.x, y: at.y });
      return;
    }
    // Skilled: the battle AI's own play (lines, focus fire, guards), plus what a good player adds on
    // top: horse into the rear of their engaged foot, and no foot chasing men who run (they rally).
    const ai = [];
    playerAI(w, side, ai);
    if (w.tick % 10 !== side) { orders.push(...ai); return; } // a player acts about twice a second
    const taken = new Set();
    const mineOrders = [];
    const go2 = (q, o) => { taken.add(q.idx); mineOrders.push({ side, squads: [q.idx], ...o }); };
    const attack = (q, t) => { if (!(q.order.type === 'attack' && q.target === t.idx)) go2(q, { type: 'attack', target: { kind: 'squad', index: t.idx } }); else taken.add(q.idx); };
    const foot = mine.filter((q) => q.classId === 'infantry');
    const riders = mine.filter((q) => q.classId === 'cavalry');
    if (SKILLS.includes('nochase')) foot.forEach((q) => {
      if (q.target >= 0 && q.targetKind === 'squad' && w.squads[q.target].routed) { const t = nearest(foes, q.x, q.y); if (t) attack(q, t); }
    });
    // The horse: waits on the wing until their foot is locked with ours, then rides round behind the
    // their archers (else their nearest locked foot) and hits from behind; left to the AI until then.
    if (SKILLS.includes('rear')) riders.forEach((q) => {
      const locked = foes.filter((t) => t.classId === 'infantry' && t.targetKind === 'squad' && t.target >= 0 && w.squads[t.target].side === side && inRangeOfSquad(t, w.squads[t.target]));
      const prey = locked.length ? nearest(foes.filter((t) => t.classId === 'ranged' || t.classId === 'siege'), q.x, q.y) || nearest(locked, q.x, q.y) : null;
      if (!prey) return;
      if (q.order.type === 'attack' && q.target === prey.idx) { taken.add(q.idx); return; }
      const behind = { x: prey.x - polarX(prey.facing, 3 * Q), y: prey.y - polarY(prey.facing, 3 * Q) };
      if (distSq(q.x, q.y, behind.x, behind.y) <= (2 * Q) ** 2) { attack(q, prey); return; }
      if (q.order.type === 'movePath' || q.order.type === 'move') { taken.add(q.idx); return; } // on its way round
      // Round the end of their line, never through it.
      const ys = foes.map((f) => f.y);
      const wing = q.y > centre(foes).y ? Math.max(...ys) + 5 * Q : Math.min(...ys) - 5 * Q;
      go2(q, { type: 'movePath', path: [{ x: q.x, y: wing }, { x: behind.x, y: wing }, behind] });
    });
    ai.forEach((o) => {
      if (!o.squads) { orders.push(o); return; }
      const squads = o.squads.filter((i) => !taken.has(i));
      if (squads.length) orders.push({ ...o, squads });
    });
    orders.push(...mineOrders);
  };
};

const wilson = (k, n) => {
  if (!n) return '-';
  const z = 1.96; const p = k / n; const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d; const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `${Math.round((c - h) * 100)}-${Math.round((c + h) * 100)}%`;
};

it('scripted controllers against the battle AI', () => {
  ARMIES.forEach((cls) => AGES.forEach((age) => {
    const acc = Object.fromEntries(CTRL.map((k) => [k, { w: 0, n: 0, mine: 0, theirs: 0 }]));
    for (let seed = SEED0; seed < SEED0 + N; seed++) {
      [0, 1].forEach((playerSide) => {
        const A = mk('a', ofAge(cls, age)); const D = mk('d', ofAge(cls, age));
        const base = buildSetupFromArmies({
          regionId: `skill-${seed}`, terrain: TERRAIN, seed, attackerUnits: A, defenderUnits: D, attackerAgeId: age, defenderAgeId: age,
          deposits: [], powers: [[], []], battleType: 'field', difficultyId: DIFF,
          controllers: playerSide === 0 ? ['player', 'ai'] : ['ai', 'player'],
          economy: ECO, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
        });
        CTRL.forEach((kind) => {
          const w = createWorld(commandedSetup(base));
          const ctl = makeController(kind, playerSide);
          const limit = battleLimitTicks(w.setup) + 20;
          while (!w.ended && w.tick < limit) {
            const orders = []; ctl(w, orders); step(w, orders); w.events.length = 0;
            if (TRACE && w.tick % TRACE === 0) console.log(`  ${kind} p${playerSide} t=${w.tick / 20}s ${w.squads.filter((q) => q.alive && q.onField && !q.fled && !q.worker && !q.isGeneral).map((q) => `${q.side}#${q.idx}${q.classId[0]}${Math.round(q.strength / 10)}m${Math.round(q.morale)}${q.routed ? 'R' : ''}:${q.order.type.slice(0, 4)}${q.target >= 0 ? `>${q.target}${q.targetKind === 'squad' && inRangeOfSquad(q, w.squads[q.target]) ? '!' : ''}` : ''}@${q.x >> 8},${q.y >> 8}`).join(' ')}`);
          }
          const r = toStrategicResult(w);
          if (TRACE) console.log(`  -> ${kind} p${playerSide} ${r.outcome} ${r.report.tactical.reason} ${r.report.tactical.durationSec}s`);
          const a = acc[kind];
          a.n += 1;
          if (r.outcome === (playerSide === 0 ? 'attacker' : 'defender')) a.w += 1;
          const [pu, pStart, eu, eStart] = playerSide === 0 ? [r.attackerUnits, A, r.defenderUnits, D] : [r.defenderUnits, D, r.attackerUnits, A];
          a.mine += sum(pu) / sum(pStart); a.theirs += sum(eu) / sum(eStart);
        });
      });
    }
    const row = CTRL.map((k) => { const a = acc[k]; return `${k}=${a.w}/${a.n} [${wilson(a.w, a.n)}] kept ${Math.round((a.mine / a.n) * 100)}% v ${Math.round((a.theirs / a.n) * 100)}%`; }).join(' | ');
    console.log(`SKILL ${age} ${DIFF} p=${PDIFF} ${TERRAIN}${ECO ? ' eco' : ''} ${cls.join('+')}: ${row}`);
  }));
});
