// src/engine/battleOdds.js
// "What are my chances?" for the battle choice sheet (Tactical Battles plan §13): runs the real
// auto-resolve (resolveBattle) with the real inputs over many seeds, and applies the real siege
// rule to each result, so the numbers shown are exactly what pressing Auto-resolve does. Also
// explains WHY — the multipliers each side fights under (numbers, matchups, terrain, walls, age)
// — so the calculation isn't a black box. Pure and fast (~a few ms for 200 samples).
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs } from './invasion';
import { resolveSiegeControlDamage, hasMeleeUnitDeployed, isGarrisonBroken } from './siege';
import { getCounterMultiplier, getRosterCombatMultiplier } from '../data/unitClasses';
import { getTerrainCombatModifier } from '../data/terrain';

const sumStrength = (units) => units.reduce((s, u) => s + Math.max(0, u.strength), 0);

// How well one army's classes match up against the other's, strength-weighted (1 = even).
const matchup = (from, to) => {
  const total = sumStrength(from) * sumStrength(to);
  if (!total) return 1;
  let acc = 0;
  from.forEach((a) => to.forEach((d) => { acc += a.strength * d.strength * getCounterMultiplier(a.classId, d.classId); }));
  return acc / total;
};

// The multipliers the attacker fights under, as readable lines (value > 1 favours you).
export const explainInvasion = (v, ctx) => {
  const att = sumStrength(v.attackerUnits); const def = sumStrength(v.defenderUnits);
  const lines = [
    { id: 'numbers', label: 'Numbers', value: def ? att / def : 1, detail: `${att} vs ${def}` },
    { id: 'matchup', label: 'Unit matchups', value: matchup(v.attackerUnits, v.defenderUnits) / Math.max(0.01, matchup(v.defenderUnits, v.attackerUnits)) },
    { id: 'terrain', label: 'Terrain', value: getTerrainCombatModifier(ctx.terrain).attackerMult, detail: ctx.terrain },
    { id: 'walls', label: 'Walls & forts', value: ctx.defenderDamageReductionMultiplier ?? 1 },
    { id: 'age', label: 'Technology', value: getRosterCombatMultiplier(ctx.attackerAgeId, ctx.defenderAgeId) / Math.max(0.01, getRosterCombatMultiplier(ctx.defenderAgeId, ctx.attackerAgeId)) }
  ];
  if (ctx.attackerPenaltyMultiplier && ctx.attackerPenaltyMultiplier !== 1) lines.push({ id: 'landing', label: 'Landing from the sea', value: ctx.attackerPenaltyMultiplier });
  return lines.map((l) => ({ ...l, value: Math.round(l.value * 100) / 100 }));
};

export const estimateInvasionOdds = (state, fromRegionId, targetRegionId, samples = 200) => {
  const v = validateInvasion(state, fromRegionId, targetRegionId, { ignoreCost: true });
  if (!v.ok) return null;
  if (v.defenderUnits.length === 0) return { attacker: 1, defender: 0, stalemate: 0, capture: 1, undefended: true, attackerLossShare: 0, defenderLossShare: 0, factors: [] };
  const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
  const args = getResolveBattleArgs(v, ctx);
  const attStart = sumStrength(v.attackerUnits); const defStart = sumStrength(v.defenderUnits);
  const tally = { attacker: 0, defender: 0, stalemate: 0 };
  let attLoss = 0; let defLoss = 0; let captures = 0; let controlLeft = 0;
  for (let i = 1; i <= samples; i++) {
    const r = resolveBattle({ ...args, rng: createRng(Math.imul(i, 2654435761) >>> 0) });
    tally[r.outcome] += 1;
    attLoss += attStart - sumStrength(r.attackerUnits);
    defLoss += defStart - sumStrength(r.defenderUnits);
    const siege = resolveSiegeControlDamage({
      currentControl: v.targetRegion.control,
      outcome: r.outcome,
      hasMeleeUnit: hasMeleeUnitDeployed(r.attackerUnits.filter((u) => u.strength > 0 && !u.routed)),
      garrisonBroken: isGarrisonBroken(r.defenderUnits)
    });
    if (siege.captured) captures += 1;
    controlLeft += siege.nextControl;
  }
  return {
    attacker: tally.attacker / samples,
    defender: tally.defender / samples,
    stalemate: tally.stalemate / samples,
    // The chance this one attack takes the province (it also needs infantry or cavalry to hold it).
    capture: captures / samples,
    expectedControl: Math.round(controlLeft / samples),
    hasMelee: hasMeleeUnitDeployed(v.attackerUnits),
    attackerLossShare: attStart ? attLoss / samples / attStart : 0,
    defenderLossShare: defStart ? defLoss / samples / defStart : 0,
    attackerStrength: attStart,
    defenderStrength: defStart,
    factors: explainInvasion(v, ctx)
  };
};
