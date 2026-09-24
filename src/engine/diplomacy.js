// src/engine/diplomacy.js
// Pure diplomatic state transitions shared between the reducer (player-initiated actions) and
// resolveTurn.js (AI-initiated wars). Keeping one implementation means a war declared by the
// player and one declared by an AI nation always produce the same shape of state change. Every
// nation (the player's included) is just an entry in state.nations with the same militaryStrength
// stat, so none of this needs to special-case which nation is the player.

import { RelationStatus } from '../data/types';
import { isAdjacentToOwner, REGIONS_DATA, getNationCapital } from '../data/regions';
import { CAPTURE_PREFERRING_DOCTRINES } from '../data/nations';
import { resolveSiegeControlDamage } from './siege';
import { TRUCE_DURATION_TURNS, TRADE_PACT_BASE_CAPACITY } from '../data/actionCosts';
import { getNationTotalDev, getTotalDev } from './development';
import { applyPeace, buildAITerms, getPeaceAcceptance } from './peace';
import { leansPositive, leansNegative } from '../data/identity';

// Trade Pact capacity (plan §M8.3/§M12): Globalism > 40 grants +1, Isolationism > 40 costs -1,
// floored at 0 so a committed isolationist can be locked out of trade pacts entirely.
export const getTradePactCapacity = (nation) =>
  Math.max(0, TRADE_PACT_BASE_CAPACITY + (leansPositive(nation?.identity, 'globalism') ? 1 : 0) - (leansNegative(nation?.identity, 'globalism') ? 1 : 0));

// Truces (plan §M13's own truce rules, pulled forward into M12 since this is where wars first get
// a redeclare-cooldown at all): mirrored on both former belligerents so either side's own
// `nation.truces[otherId]` reads the same shared expiry, the same "store the unlock turn" shape
// taxRateCooldownUntil/lawCooldowns already use. The AI never breaks one (aiLogic.js's
// pickWarTarget filters truce-active candidates out entirely); the player MAY declare anyway, at a
// real cost applied by the caller (gameReducer.js's DECLARE_WAR case) — declareWar itself doesn't
// enforce the block, since "can the player override this" is a policy decision for the action
// layer, not the shared war-transition primitive AI wars also go through.
export const isInTruce = (state, aId, bId) => (state.nations[aId]?.truces?.[bId] || 0) > state.turnNumber;

export const setTruce = (nations, aId, bId, turnNumber) => {
  const a = nations[aId];
  const b = nations[bId];
  if (!a || !b) return nations;
  const expiresTurn = turnNumber + TRUCE_DURATION_TURNS;
  return {
    ...nations,
    [aId]: { ...a, truces: { ...(a.truces || {}), [bId]: expiresTurn } },
    [bId]: { ...b, truces: { ...(b.truces || {}), [aId]: expiresTurn } }
  };
};

// A casus belli (plan §8/§9's "unjustified wars cost stability and global relations"): either a
// claim the aggressor already fabricated against this target (FABRICATE_CLAIM), or a naturally
// hostile relationship that needs no manufacturing. War without either is still possible — it's
// just costlier and carries a real diplomatic penalty (see GameContext.jsx's DECLARE_WAR).
export const CASUS_BELLI_HOSTILITY_THRESHOLD = 70;

export const hasCasusBelli = (state, aggressorId, targetId) => {
  const aggressor = state.nations[aggressorId];
  const target = state.nations[targetId];
  if (aggressor?.claims?.includes(targetId)) return true;
  return (target?.hostility || 0) >= CASUS_BELLI_HOSTILITY_THRESHOLD;
};

// Finds a region owned by `ownerId` that borders territory `attackerId` already holds — the
// natural "next target" for a war goal.
const findCaptureTarget = (regions, ownerId, attackerId) =>
  Object.keys(regions).find(id => regions[id].owner === ownerId && isAdjacentToOwner(id, regions, attackerId)) || null;

// Builds a war goal of a SPECIFIC type — exported so a player can pick one explicitly rather than
// only ever getting an auto-assigned one. Gracefully falls back to destroy_military if
// 'capture_region' is requested but no valid bordering target exists.
export const buildWarGoal = (state, nationId, aggressor, type) => {
  if (type === 'capture_region') {
    const targetRegion = findCaptureTarget(state.regions, nationId, aggressor);
    if (targetRegion) return { type: 'capture_region', regionId: targetRegion };
  }
  const nation = state.nations[nationId];
  return { type: 'destroy_military', threshold: Math.round((nation?.militaryStrength || 1000) * 0.5) };
};

// Picks a war goal for a newly-declared war when the caller doesn't supply one. Every war has a
// concrete objective instead of running until hostility happens to decay enough to seek peace.
export const assignDefaultWarGoal = (state, nationId, aggressor) => {
  // The human player always prefers taking territory over grinding down an army — this is a UI
  // default, not a doctrine-driven AI behavior.
  if (aggressor === state.playerNationId) {
    return buildWarGoal(state, nationId, aggressor, 'capture_region');
  }
  const aggressorNation = state.nations[aggressor];
  // Blitz/opportunist doctrines fight for territory; attrition/cautious nations (when they do go
  // to war) grind down the defender's army instead.
  const prefersCapture = CAPTURE_PREFERRING_DOCTRINES.includes(aggressorNation?.doctrine);
  return buildWarGoal(state, nationId, aggressor, prefersCapture ? 'capture_region' : 'destroy_military');
};

// A war record names an `aggressor` and an `enemy`, not "the player's side" and "the other side"
// — either nation could be either one, depending on who declared on whom. Callers that make peace
// or check status FROM one nation's perspective (e.g. "the player is suing nationId for peace")
// need to match a war regardless of which of the two fields holds which id.
export const isWarBetween = (war, idA, idB) =>
  (war.aggressor === idA && war.enemy === idB) || (war.aggressor === idB && war.enemy === idA);

// nation.isAtWar is true whenever a nation is in ANY war, anywhere — that's the correct signal for
// AI-tiering (a nation embroiled in a war becomes globally relevant) but it is NOT "at war with the
// player", and player-facing UI (map coloring, war badges, the diplomacy/military tab war lists)
// must use this instead, or two AI nations fighting each other lights up as if they'd attacked you.
export const isAtWarWithPlayer = (state, nationId) =>
  state.wars.some((w) => w.active && isWarBetween(w, state.playerNationId, nationId));

// True once a war's goal condition is actually met. Pure and side-effect-free — the caller
// (resolveWarProgress) decides what to do with a newly-achieved goal; since plan §M13, achieving a
// goal no longer auto-ends the war (it only feeds war score — see updateTickScore below).
export const checkWarGoal = (war, state) => {
  if (!war.goal || war.goalAchieved || !war.active) return false;

  if (war.goal.type === 'capture_region') {
    const region = state.regions[war.goal.regionId];
    // Occupation (plan §M13), not ownership: capturing a region during a war sets `occupiedBy`
    // and leaves `owner` unchanged until a peace deal formally cedes it (see peace.js).
    return !!region && region.occupiedBy === war.aggressor;
  }

  if (war.goal.type === 'destroy_military') {
    const nation = state.nations[war.enemy];
    return !!nation && nation.militaryStrength <= war.goal.threshold;
  }

  return false;
};

// Declares war on `nationId`. No-op (returns state unchanged) if the nation doesn't exist or is
// already at war. If the target had a peace treaty, this sets a permanent hostilityFloor — the
// nation remembers the betrayal and can never fully cool back down, even after a later peace.
// Marks BOTH sides isAtWar — every isAtWar reader in the codebase (UI war counts, the globe's
// war-red coloring, resolveTurn.js's war exhaustion accrual, aiLogic.js's "one war per turn" gate)
// means "this nation is currently a belligerent," not "this nation is currently a war's target."
//
// Scope trim (plan §M13): a nation can be party to at most one active war at a time (declareWar
// refuses an already-isAtWar target/aggressor, same as before M13). The plan's own multi-war
// support and full `state.relations`-driven CB matrix are NOT built here — see this file's other
// M13 comments and peace.js's header for what's trimmed and why.
export const declareWar = (state, nationId, { aggressor, goal = null } = {}) => {
  const nation = state.nations[nationId];
  if (!nation || nation.isAtWar) return state;

  const brokePeace = !!nation.hasPeaceTreaty;
  const resolvedGoal = goal || assignDefaultWarGoal(state, nationId, aggressor);
  const aggressorNation = state.nations[aggressor];
  // A fabricated claim is spent the moment it justifies a war — it doesn't carry over to the next one.
  const hadClaim = !!aggressorNation?.claims?.includes(nationId);
  const nextNations = {
    ...state.nations,
    [nationId]: {
      ...nation,
      isAtWar: true,
      hostility: 100,
      relationStatus: RelationStatus.WAR,
      hostilityFloor: brokePeace ? Math.max(nation.hostilityFloor || 0, 40) : (nation.hostilityFloor || 0)
    }
  };
  if (aggressorNation) {
    nextNations[aggressor] = {
      ...aggressorNation,
      isAtWar: true,
      relationStatus: RelationStatus.WAR,
      claims: hadClaim ? aggressorNation.claims.filter((id) => id !== nationId) : aggressorNation.claims
    };
  }
  return {
    ...state,
    nations: nextNations,
    wars: [...state.wars, {
      id: `war_${nationId}_${state.year}`,
      enemy: nationId,
      startYear: state.year,
      startTurn: state.turnNumber,
      active: true,
      aggressor,
      goal: resolvedGoal,
      goalAchieved: false,
      // Trimmed CB system (plan §M13/peace.js header): a single claim/none flag rather than the
      // full 8-type CB table — a fabricated claim discounts ceding that land at the peace table;
      // every other justification (including the pre-existing hostility-threshold one) is 'none'.
      cb: hadClaim ? 'claim' : 'none',
      battleScore: 0,
      tickScore: 0,
      score: 0,
      peaceOfferCooldownTurn: 0
    }]
  };
};

// Mutual military attrition every turn a war actively runs — this is what makes a
// `destroy_military` goal (checkWarGoal above) something that can genuinely happen, and it costs
// both sides, not just whoever eventually loses.
const WAR_ATTRITION_RATE = 0.02;

// Per-turn probability an AI aggressor's `capture_region` goal actually succeeds this turn, scaled
// by its share of the two belligerents' combined military strength and the game's difficulty.
// Deliberately NOT a full battle.js simulation — running that for every active AI war, every turn,
// across up to 240 nations, would be far too expensive. This is the "simpler, probabilistic
// resolver" tier the AI's territorial wars need, mirroring the tiered-cost model the AI's war
// DECISIONS already use (plan §8.5).
const AI_CAPTURE_BASE_CHANCE = 0.15;

// --- War score (plan §M13/§B) ---
const BATTLE_SCORE_CLAMP = 40;
const TICK_SCORE_CLAMP = 25;
const WAR_SCORE_CLAMP = 100;
const CAPITAL_OCCUPATION_SCORE_WEIGHT = 3;
const TICK_SCORE_GRACE_TURNS = 5;

// Battle results move the score toward whichever side won this particular engagement, scaled by
// how badly the loser was hurt (a bigger rout matters more than a narrow win), clamped so no single
// battle — or even a long streak of them — can single-handedly force a peace on its own; occupation
// and ticking goal-progress (below) matter too. `winnerId` is a nation id (war.aggressor or
// war.enemy), NOT a literal "attacker/defender" role — either side of a war can win an engagement.
export const recordBattle = (war, winnerId, lossShare) => {
  const magnitude = 2 + Math.min(8, 10 * Math.max(0, Math.min(1, lossShare)));
  const signedDelta = winnerId === war.aggressor ? magnitude : -magnitude;
  return Math.max(-BATTLE_SCORE_CLAMP, Math.min(BATTLE_SCORE_CLAMP, (war.battleScore || 0) + signedDelta));
};

// Computed fresh every turn from live region state, NOT stored — avoids the redundant-state-drift
// risk the rest of the codebase's "ownership by derivation" pattern (getGreatProjectOwner, etc.)
// warns about. Each side's occupation is scored as a % of the OTHER side's total development, so
// occupying a small sliver of a huge nation barely moves the score, and a capital counts triple.
export const getOccupationScore = (state, war) => {
  const aggressorCapital = getNationCapital(war.aggressor);
  const enemyCapital = getNationCapital(war.enemy);
  let occupiedByAggressor = 0;
  let occupiedByEnemy = 0;
  Object.values(state.regions).forEach((region) => {
    if (!region.occupiedBy) return;
    const dev = getTotalDev(region);
    if (region.occupiedBy === war.aggressor && region.owner === war.enemy) {
      occupiedByAggressor += dev * (region.id === enemyCapital ? CAPITAL_OCCUPATION_SCORE_WEIGHT : 1);
    } else if (region.occupiedBy === war.enemy && region.owner === war.aggressor) {
      occupiedByEnemy += dev * (region.id === aggressorCapital ? CAPITAL_OCCUPATION_SCORE_WEIGHT : 1);
    }
  });
  const enemyTotalDev = getNationTotalDev(state, war.enemy) || 1;
  const aggressorTotalDev = getNationTotalDev(state, war.aggressor) || 1;
  return (100 * occupiedByAggressor) / enemyTotalDev - (100 * occupiedByEnemy) / aggressorTotalDev;
};

// Rewards the aggressor for actually holding a `capture_region` goal's target, and penalizes
// stalling once they've had a fair chance (a grace period) to take it. Goalless/destroy_military
// wars don't tick at all — their score comes from battles and occupation only.
export const updateTickScore = (war, state) => {
  if (war.goal?.type !== 'capture_region') return war.tickScore || 0;
  const region = state.regions[war.goal.regionId];
  const holdsGoal = !!region && region.occupiedBy === war.aggressor;
  const turnsSinceStart = (state.turnNumber || 0) - (war.startTurn ?? state.turnNumber ?? 0);
  const delta = holdsGoal ? 1 : (turnsSinceStart >= TICK_SCORE_GRACE_TURNS ? -1 : 0);
  return Math.max(-TICK_SCORE_CLAMP, Math.min(TICK_SCORE_CLAMP, (war.tickScore || 0) + delta));
};

// The final, aggressor-POV war score shown in the UI and used by tests — an O(regions) scan per
// call, fine for a single lookup, but resolveWarProgress needs this for EVERY active war EVERY
// turn, which the "player-only real computation" perf pattern (economy.js's own header) warns
// against doing per-war: buildOccupationIndexes/scoreWarFromIndexes below give it the same numbers
// from one shared O(regions) pass instead.
export const computeWarScore = (war, state) =>
  Math.max(-WAR_SCORE_CLAMP, Math.min(WAR_SCORE_CLAMP, Math.round((war.battleScore || 0) + getOccupationScore(state, war) + (war.tickScore || 0))));

// One O(regions) pass building { devByNation, occupiedDev } so resolveWarProgress can score every
// active war in O(1) each afterward, instead of O(regions) per war. Built once from this turn's
// STARTING regions, before any of this turn's own captures/peace deals — a capture that happens
// this same turn shows up in occupation score starting next turn, a deliberate one-turn lag traded
// for turning O(wars x regions) into O(regions + wars) at up to 240 nations' worth of active wars.
const buildOccupationIndexes = (regions, nationIds) => {
  const capitalIds = new Set();
  nationIds.forEach((id) => { const capitalId = getNationCapital(id); if (capitalId) capitalIds.add(capitalId); });
  const devByNation = {};
  const occupiedDev = {};
  Object.values(regions).forEach((region) => {
    if (!region.owner) return;
    devByNation[region.owner] = (devByNation[region.owner] || 0) + getTotalDev(region);
    if (region.occupiedBy && region.occupiedBy !== region.owner) {
      const key = `${region.occupiedBy}|${region.owner}`;
      const weight = capitalIds.has(region.id) ? CAPITAL_OCCUPATION_SCORE_WEIGHT : 1;
      occupiedDev[key] = (occupiedDev[key] || 0) + getTotalDev(region) * weight;
    }
  });
  return { devByNation, occupiedDev };
};

const scoreWarFromIndexes = (war, indexes) => {
  const enemyTotalDev = indexes.devByNation[war.enemy] || 1;
  const aggressorTotalDev = indexes.devByNation[war.aggressor] || 1;
  const occByAggressor = 100 * (indexes.occupiedDev[`${war.aggressor}|${war.enemy}`] || 0) / enemyTotalDev;
  const occByEnemy = 100 * (indexes.occupiedDev[`${war.enemy}|${war.aggressor}`] || 0) / aggressorTotalDev;
  const total = (war.battleScore || 0) + occByAggressor - occByEnemy + (war.tickScore || 0);
  return Math.max(-WAR_SCORE_CLAMP, Math.min(WAR_SCORE_CLAMP, Math.round(total)));
};

// --- Peace flow thresholds (plan §M13/§B, trimmed — see this file's other M13 comments) ---
const PEACE_SCORE_OFFER_THRESHOLD = 30;    // the AI offers the player peace once winning by this much
const PEACE_SCORE_ENFORCE_THRESHOLD = 90;  // an overwhelming win enforces peace outright, no offer needed
                                            // (trim: the plan's own "held for 3 turns" streak isn't tracked)
const AI_VS_AI_PEACE_SCORE_THRESHOLD = 25;
// Exported so gameReducer's REJECT_PENDING_PEACE case can reuse the same cadence when the player
// turns an offer down, rather than the AI immediately re-offering next turn.
export const PEACE_OFFER_COOLDOWN_TURNS = 5;
const WHITE_PEACE_EXHAUSTION_THRESHOLD = 80;

// Advances every ACTIVE war by one turn: AI-aggressor territorial/military rolls, war-score
// bookkeeping (battle/occupation/tick), and the peace machinery that actually ends wars now that
// goal completion alone no longer does (plan §M13's core change from the pre-M13 instant-annexation
// version of this function). A war the PLAYER started still has its capture rolls handled by their
// own LAUNCH_INVASION/AMPHIBIOUS_ASSAULT actions, not synthesized here — but its score and peace
// flow (including the AI defender eventually offering or being forced to accept peace) run through
// this same code every turn, same as an AI-vs-AI war.
export const resolveWarProgress = (state, regions, nations, wars, rng) => {
  let nextRegions = regions;
  let nextNations = nations;
  let nextResources = state.resources;
  let nextPendingPeaceOffer = state.pendingPeaceOffer || null;
  const logs = [];
  // One shared O(regions) pass for every active war's score this turn (see buildOccupationIndexes's
  // own header) — skipped entirely when nothing is at war, the common case for most of the game.
  const occupationIndexes = wars.some(w => w.active) ? buildOccupationIndexes(regions, Object.keys(nations)) : null;

  // Ends a war right now: applies `terms` (may be [] for a white peace), marks both belligerents
  // at peace, and starts a truce. Reads/writes the outer next* closures directly since every call
  // site below is one of this turn's per-war peace resolutions.
  const concludeWar = (war, offererId, terms, snapshotState) => {
    const recipientId = offererId === war.aggressor ? war.enemy : war.aggressor;
    const applied = applyPeace(snapshotState, war, offererId, terms);
    nextRegions = applied.regions;
    nextNations = applied.nations;
    nextResources = applied.resources;
    const winner = nextNations[offererId];
    const loser = nextNations[recipientId];
    nextNations = {
      ...nextNations,
      ...(winner ? { [offererId]: { ...winner, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE } } : {}),
      ...(loser ? { [recipientId]: { ...loser, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE } } : {})
    };
    nextNations = setTruce(nextNations, war.aggressor, war.enemy, state.turnNumber);
    logs.push({
      message: terms.length === 0
        ? `${winner?.name || offererId} and ${loser?.name || recipientId} agree to a white peace.`
        : `${winner?.name || offererId}'s war against ${loser?.name || recipientId} ends in a negotiated peace.`,
      type: 'diplomacy'
    });
    return { ...war, active: false, goalAchieved: true };
  };

  const nextWars = wars.map((war) => {
    if (!war.active) return war;
    let currentWar = war;

    // Scope trim: only the AI-aggressor side rolls a capture/attrition attempt here — an AI
    // DEFENDER in a player-declared war doesn't counter-invade, since picking and attacking an
    // arbitrary target region is attack-initiative the AI doesn't have until M14's stack/movement
    // overhaul. Until then, a war the player started still ends via war exhaustion or the
    // score/peace machinery below, using whatever battleScore the player's own invasions produced.
    if (war.aggressor !== state.playerNationId) {
      const aggressor = nextNations[war.aggressor];
      const defender = nextNations[war.enemy];
      if (!aggressor || !defender) return war;

      const aggressorLoss = Math.round(defender.militaryStrength * WAR_ATTRITION_RATE);
      const defenderLoss = Math.round(aggressor.militaryStrength * WAR_ATTRITION_RATE);
      nextNations = {
        ...nextNations,
        [war.aggressor]: { ...aggressor, militaryStrength: Math.max(100, aggressor.militaryStrength - aggressorLoss) },
        [war.enemy]: { ...defender, militaryStrength: Math.max(100, defender.militaryStrength - defenderLoss) }
      };

      // A capture_region goal only rolls while the aggressor doesn't already occupy the target —
      // if it changed hands some other way mid-war, this war keeps running on destroy_military
      // terms instead (checkWarGoal watches militaryStrength regardless of goal.type).
      if (currentWar.goal?.type === 'capture_region') {
        const targetRegion = nextRegions[currentWar.goal.regionId];
        if (targetRegion && targetRegion.owner === currentWar.enemy && targetRegion.occupiedBy !== currentWar.aggressor) {
          const updatedAggressor = nextNations[currentWar.aggressor];
          const updatedDefender = nextNations[currentWar.enemy];
          const totalStrength = updatedAggressor.militaryStrength + updatedDefender.militaryStrength;
          const chance = AI_CAPTURE_BASE_CHANCE * (updatedAggressor.militaryStrength / totalStrength) * (state.difficultyMultiplier || 1);
          if (rng.next() < chance) {
            // Same control-as-defense-HP grind as the player's own LAUNCH_INVASION (src/engine/
            // siege.js) — a successful roll damages the region's control instead of instantly
            // flipping it, unless the region is genuinely undefended.
            const isDefended = Object.values(state.units || {}).some(u => u.regionId === currentWar.goal.regionId && u.domain === 'land');
            const { nextControl, captured } = isDefended
              ? resolveSiegeControlDamage({ currentControl: targetRegion.control, outcome: 'attacker', hasMeleeUnit: true })
              : { nextControl: targetRegion.control, captured: true };

            // Occupation (plan §M13), not annexation: `owner` stays put, `occupiedBy` marks who
            // holds it militarily. Ownership only changes at the peace table (see peace.js) — so,
            // unlike the pre-M13 version of this function, no Aggressive Expansion fires here; it
            // fires when land actually changes hands (applyPeace's 'cede' term).
            nextRegions = {
              ...nextRegions,
              [currentWar.goal.regionId]: captured
                ? { ...targetRegion, occupiedBy: currentWar.aggressor, control: 25, unrest: Math.max(targetRegion.unrest || 0, 50), lastAttackedTurn: state.turnNumber, underInvasion: false }
                : { ...targetRegion, control: nextControl, lastAttackedTurn: state.turnNumber, underInvasion: true }
            };
            currentWar = { ...currentWar, battleScore: recordBattle(currentWar, currentWar.aggressor, captured ? 0.3 : 0.15) };
            logs.push(captured
              ? { message: `${updatedAggressor.name} occupies ${REGIONS_DATA[currentWar.goal.regionId]?.name || currentWar.goal.regionId}, taken from ${updatedDefender.name}!`, type: 'combat' }
              : { message: `${updatedAggressor.name} breaks through at ${REGIONS_DATA[currentWar.goal.regionId]?.name || currentWar.goal.regionId} (control now ${nextControl}%).`, type: 'combat' });
          }
        }
      }
    }

    // --- score bookkeeping: runs for EVERY active war, regardless of who the aggressor is ---
    const snapshotState = { ...state, regions: nextRegions, nations: nextNations, resources: nextResources };
    if (!currentWar.goalAchieved && checkWarGoal(currentWar, snapshotState)) {
      // destroy_military has no capture roll of its own to have already fed battleScore above —
      // the enemy's army being crushed IS treated as a maximally decisive result, routed through
      // the same score/peace pipeline below rather than an automatic goal-completion shortcut
      // (that shortcut is exactly what plan §M13 removes: wars now always end at the table).
      currentWar = currentWar.goal?.type === 'destroy_military'
        ? { ...currentWar, goalAchieved: true, battleScore: BATTLE_SCORE_CLAMP }
        : { ...currentWar, goalAchieved: true };
    }
    const tickScore = updateTickScore(currentWar, snapshotState);
    currentWar = { ...currentWar, tickScore, score: scoreWarFromIndexes({ ...currentWar, tickScore }, occupationIndexes) };

    // --- peace decision-making ---
    const aggressorNation = nextNations[currentWar.aggressor];
    const enemyNation = nextNations[currentWar.enemy];
    const bothExhausted = (aggressorNation?.warExhaustion || 0) >= WHITE_PEACE_EXHAUSTION_THRESHOLD && (enemyNation?.warExhaustion || 0) >= WHITE_PEACE_EXHAUSTION_THRESHOLD;
    const involvesPlayer = currentWar.aggressor === state.playerNationId || currentWar.enemy === state.playerNationId;

    // Forced-peace backstop (plan §M13): neither side can grind the other down further, so the war
    // ends white regardless of score. Checked before either peace path below, for AI and player
    // wars alike.
    if (bothExhausted) return concludeWar(currentWar, currentWar.aggressor, [], snapshotState);

    if (!involvesPlayer) {
      const leaderId = currentWar.score >= 0 ? currentWar.aggressor : currentWar.enemy;
      const leaderScore = Math.abs(currentWar.score);
      if (leaderScore >= AI_VS_AI_PEACE_SCORE_THRESHOLD) {
        const terms = buildAITerms(snapshotState, currentWar, leaderId);
        const acceptance = getPeaceAcceptance(snapshotState, currentWar, leaderId, terms);
        // Trim: the plan's own "score 100 held for 3 turns" enforcement streak isn't tracked —
        // a sufficiently lopsided score enforces immediately instead.
        if (leaderScore >= PEACE_SCORE_ENFORCE_THRESHOLD || acceptance.accepted) return concludeWar(currentWar, leaderId, terms, snapshotState);
      }
      return currentWar;
    }

    // Involves the player: the AI side may enforce, offer (queuing state.pendingPeaceOffer for the
    // player to accept/reject via the reducer), or simply wait out its own cooldown. Only one offer
    // is queued per turn — if another war already queued one this turn, this war just waits.
    if (nextPendingPeaceOffer || state.turnNumber < (currentWar.peaceOfferCooldownTurn || 0)) return currentWar;
    const aiSide = currentWar.aggressor === state.playerNationId ? currentWar.enemy : currentWar.aggressor;
    const aiScore = aiSide === currentWar.aggressor ? currentWar.score : -currentWar.score;
    if (aiScore < PEACE_SCORE_OFFER_THRESHOLD) return currentWar;

    const terms = buildAITerms(snapshotState, currentWar, aiSide);
    if (aiScore >= PEACE_SCORE_ENFORCE_THRESHOLD) {
      logs.push({ message: `${nextNations[aiSide]?.name || aiSide} forces a peace on you — the war is lost.`, type: 'diplomacy' });
      return concludeWar(currentWar, aiSide, terms, snapshotState);
    }
    nextPendingPeaceOffer = { warId: currentWar.id, from: aiSide, terms };
    logs.push({ message: `${nextNations[aiSide]?.name || aiSide} offers to end the war.`, type: 'diplomacy' });
    return { ...currentWar, peaceOfferCooldownTurn: state.turnNumber + PEACE_OFFER_COOLDOWN_TURNS };
  });

  return { regions: nextRegions, nations: nextNations, resources: nextResources, wars: nextWars, pendingPeaceOffer: nextPendingPeaceOffer, logs };
};
