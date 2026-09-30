// src/engine/battleOdds.js
// "What are my chances?" for the battle choice sheet (Tactical Battles plan §13): runs the real
// auto-resolve (resolveBattle) with the real inputs over many seeds. Pure and fast (~1 ms for 200
// samples), so the sheet can show it instantly.
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs } from './invasion';

export const estimateInvasionOdds = (state, fromRegionId, targetRegionId, samples = 200) => {
  const v = validateInvasion(state, fromRegionId, targetRegionId, { ignoreCost: true });
  if (!v.ok) return null;
  if (v.defenderUnits.length === 0) return { attacker: 1, defender: 0, stalemate: 0, undefended: true, attackerLossShare: 0, defenderLossShare: 0 };
  const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
  const args = getResolveBattleArgs(v, ctx);
  const total = (units) => units.reduce((s, u) => s + u.strength, 0);
  const attStart = total(v.attackerUnits); const defStart = total(v.defenderUnits);
  const tally = { attacker: 0, defender: 0, stalemate: 0 };
  let attLoss = 0; let defLoss = 0;
  for (let i = 1; i <= samples; i++) {
    const r = resolveBattle({ ...args, rng: createRng(Math.imul(i, 2654435761) >>> 0) });
    tally[r.outcome] += 1;
    attLoss += attStart - total(r.attackerUnits);
    defLoss += defStart - total(r.defenderUnits);
  }
  return {
    attacker: tally.attacker / samples,
    defender: tally.defender / samples,
    stalemate: tally.stalemate / samples,
    attackerLossShare: attStart ? attLoss / samples / attStart : 0,
    defenderLossShare: defStart ? defLoss / samples / defStart : 0,
    attackerStrength: attStart,
    defenderStrength: defStart
  };
};
