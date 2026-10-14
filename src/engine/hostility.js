// src/engine/hostility.js
// Who may fight whom (plans/independent-cities.md 3.1 and 6, phase W1). One place answers it, so
// every system that used to ask "is there a war between these two?" now asks this instead:
//
//   canFight(a, b)    a and b are hostile: an active war between them, or one of them is the
//                     rebels, or one of them is an independent city (independents are never in
//                     state.wars: anyone may fight them without a declaration), unless a truce with
//                     the independent holds (`nation.indep.truceWith[other] > turn`: phase W2 sets
//                     one while `other` pays it tribute, raids.js).
//                     Symmetric. Used where hostility is a fact on the ground: zone of control, enemy
//                     armies on a tile, land access, blockades.
//   canAttack(a, b)   a may start a fight against b: canFight, and `a` is not an independent
//                     (INDEPENDENTS_ATTACK stays false). Used where someone acts: sieges, assaults,
//                     field attacks, plunder. An independent never besieges or assaults through
//                     these paths: its raids and sacks (phase W2) are raids.js's own and can never
//                     capture a city.
//   warBetween(a, b)  the war record between them, or null (for war score and peace terms; an
//                     attack on an independent has no war, so it never touches war score).
//
// Pure; no state is written here.
import { REBEL_OWNER_ID } from '../data/rebellion';
import { isIndependentNation } from '../data/independents';
import { isWarBetween } from './diplomacy';
import { getTiles } from '../data/geo/tiles';

/** Independents start no siege, assault or field attack through the shared paths; raids.js runs their
 * raids and sacks (phase W2). */
export const INDEPENDENTS_ATTACK = false;

export const isIndependentId = (state, id) => !!id && isIndependentNation(state?.nations?.[id]);

const truceWith = (state, indepId, otherId) => {
  const until = state?.nations?.[indepId]?.indep?.truceWith?.[otherId];
  return until != null && until > (state.turnNumber || 0);
};

/** The active war record between `a` and `b`, or null. */
export const warBetween = (state, a, b) => (state?.wars || []).find((w) => w.active && isWarBetween(w, a, b)) || null;

/** Are `a` and `b` hostile? See the header. */
export const canFight = (state, a, b) => {
  if (!a || !b || a === b) return false;
  if (a === REBEL_OWNER_ID || b === REBEL_OWNER_ID) return true;
  const indepA = isIndependentId(state, a);
  const indepB = isIndependentId(state, b);
  if (indepA || indepB) {
    const nA = state.nations?.[a]; const nB = state.nations?.[b];
    if (!nA || !nB || nA.isEliminated || nB.isEliminated) return false;
    return !(indepA && truceWith(state, a, b)) && !(indepB && truceWith(state, b, a));
  }
  return !!warBetween(state, a, b);
};

/** May `attacker` start a fight against `target`? See the header. */
export const canAttack = (state, attacker, target) => {
  if (!INDEPENDENTS_ATTACK && isIndependentId(state, attacker)) return false;
  return canFight(state, attacker, target);
};

/** The nation whose land `tile` is (through the city that owns the tile), or null (nobody's land). */
export const tileOwnerNation = (state, tile) => (tile == null ? null : state?.regions?.[state.world?.tileOwner?.[tile]]?.owner ?? null);

/** What the pre-battle and defence cards say about a no man's land clash (decision 41). */
export const NO_MANS_LAND_TEXT = "No man's land: fought on Auto";
export const NO_MANS_LAND_REASON = "No man's land: a clash outside both peoples' borders is fought on Auto.";

/**
 * Decision 41: a clash between two stacks on a land tile inside neither side's borders (nobody's
 * land, or a third people's, an independent's included) is fought on Auto only; on either side's
 * own land the player may still command it. Sea tiles are not covered (they are nobody's, and sea
 * battles keep Command: an assumption until the user rules), and neither are city battles.
 */
export const isNoMansLand = (state, tile, a, b) => {
  if (tile == null || getTiles().land[tile] !== 1) return false;
  const owner = tileOwnerNation(state, tile);
  return owner !== a && owner !== b;
};

/**
 * Fog hook (phase A, plans/MASTER-PLAN.md 5.1, on claude/phase-a-fog-speed): "independents count
 * as met when seen". The fog branch meets two peoples the first time one sees the other's land or
 * units (`state.fog.met[a][b]`); an independent needs nothing more, so it is met exactly then,
 * never by homeland overlap at the start and never through diplomacy. `hasMet` reads that
 * record when it exists and treats a world without fog (or "explored world") as all met.
 * fog.js initFog skips the start-of-game homeland contact for any pair where
 * `metOnlyBySight` is true (wired on claude/integration); the AI (W3) uses `hasMet` before
 * targeting one.
 */
export const metOnlyBySight = (state, id) => isIndependentId(state, id);
export const hasMet = (state, viewerId, otherId) => {
  const fog = state?.fog;
  if (!fog || fog.on === false || !fog.met) return true;
  return fog.met[viewerId]?.[otherId] != null;
};
