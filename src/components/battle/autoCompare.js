// src/components/battle/autoCompare.js
// B08's Auto comparison: how often the honest auto-resolve wins the battle you just commanded,
// for you, with the same armies, from the campaign state as it stood when the battle began (the
// outcome is applied only when you press Continue). Read only, the engine's own estimators.
import { estimateInvasionOdds, estimateLandingOdds, estimateFieldOdds, estimateFleetOdds } from '../../engine/battleOdds';
import { estimateDefenseOdds } from '../../engine/defense';
import { queuedBattleView } from '../../engine/battleQueue';

const SAMPLES = 40;

/** { win } (0..1, your chance on Auto) or null when it cannot be estimated. */
export const autoOddsForPendingBattle = (state, pb) => {
  try {
    // The battle's units are locked while it is pending; the estimators look at it as if it were not.
    const s = { ...state, pendingBattle: null };
    if (pb.defenseId) {
      const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
      if (!def) return null;
      if (pb.kind === 'defense') return { win: estimateDefenseOdds(s, def, SAMPLES).holdChance };
      return { win: queuedBattleView(s, def, SAMPLES).odds.holdChance };
    }
    const o = pb.kind === 'amphibious' ? estimateLandingOdds(s, pb.navalUnitId, pb.targetRegionId, SAMPLES)
      : pb.kind === 'naval' ? estimateFleetOdds(s, pb.fromTile, pb.tile, SAMPLES)
      : pb.kind === 'field' ? estimateFieldOdds(s, pb.fromRegionId, pb.tile, SAMPLES)
      : estimateInvasionOdds(s, pb.fromRegionId, pb.targetRegionId, SAMPLES);
    return o && Number.isFinite(o.attacker) && !o.undefended ? { win: o.attacker } : null;
  } catch {
    return null;
  }
};
