// src/engine/peace.js
// Plan §M13/§B: peace-deal term costs, AI acceptance, and term application. Split out of
// diplomacy.js so the two files can stay free of a circular import — applyPeace deliberately does
// NOT call diplomacy.js's setTruce itself; the caller (resolveWarProgress in diplomacy.js, or
// gameReducer's OFFER_PEACE/ACCEPT_PENDING_PEACE cases) calls setTruce after applyPeace returns.
//
// Scope trim from the plan's full 8 peace-term list (documented once, here, rather than at each
// term): only 5 of 8 terms are implemented — cede, gold, reparations, humiliate, vassalize.
// annulTreaties, changeGovernment, and release are dropped; none of the systems they'd touch
// (treaty-tracking beyond truces, government-reform-by-force, released-nation respawning) exist yet
// at a fidelity worth spending a peace term on, and adding them later is a pure addition, not a
// reshape of what's here.
import { getNationTotalDev, getTotalDev } from './development';
import { getNationCapital } from '../data/regions';
import { getFormerOwnerOnConquest } from '../data/rebellion';
import { applyAggressiveExpansion } from './expansion';
import { addNationModifier } from './modifiers/timed';
import { clampPrestige, clampStability } from './nationalPower';

const CEDE_MIN_COST = 3;
const GOLD_COST_DIVISOR = 500;
const GOLD_COST_CAP = 30;
const REPARATIONS_COST = 15;
const REPARATIONS_DURATION_TURNS = 10;
const REPARATIONS_GOLD_MULT = 0.10;
const HUMILIATE_COST = 15;
const HUMILIATE_PRESTIGE_GAIN = 20;
const HUMILIATE_PRESTIGE_LOSS = 20;
const HUMILIATE_STABILITY_LOSS = 1;
const VASSALIZE_BASE_COST = 60;

// A war record only names `aggressor`/`enemy`, not "offerer"/"recipient" — either belligerent can
// offer terms to the other, so every function here takes the OFFERING nation's id explicitly and
// derives the other side from the war record itself.
const otherSide = (war, nationId) => (nationId === war.aggressor ? war.enemy : war.aggressor);

export const getTermCost = (state, war, offererId, term) => {
  const recipientId = otherSide(war, offererId);
  const recipientTotalDev = getNationTotalDev(state, recipientId) || 1;
  switch (term.type) {
    case 'cede': {
      const region = state.regions[term.regionId];
      if (!region || region.owner !== recipientId) return Infinity; // can only cede what the recipient still owns
      const isClaimedOrGoal = war.cb === 'claim' || (war.goal?.type === 'capture_region' && war.goal.regionId === term.regionId);
      return Math.max(CEDE_MIN_COST, Math.round((100 * getTotalDev(region) / recipientTotalDev) * (isClaimedOrGoal ? 0.5 : 1)));
    }
    case 'gold':
      return Math.min(GOLD_COST_CAP, Math.round((term.amount || 0) / GOLD_COST_DIVISOR));
    case 'reparations':
      return REPARATIONS_COST;
    case 'humiliate':
      return HUMILIATE_COST;
    case 'vassalize': {
      const offererTotalDev = getNationTotalDev(state, offererId) || 1;
      const devShare = (100 * recipientTotalDev) / (offererTotalDev + recipientTotalDev);
      return VASSALIZE_BASE_COST + Math.round(0.5 * devShare);
    }
    default:
      return Infinity;
  }
};

export const getPeaceCost = (state, war, offererId, terms) =>
  terms.reduce((sum, term) => sum + getTermCost(state, war, offererId, term), 0);

// How much an offerer can justify demanding, in war-score-cost terms — tied to how much they're
// WINNING by, not merely how lopsided the war is: a losing offerer gets only the flat +10 floor
// (enough for a token reparations ask), never a share scaled off how badly they themselves are
// losing, which the plan's own literal "|score| + 10" reading would otherwise grant them.
export const getMaxPeaceCost = (war, offererId) => {
  const offererScore = offererId === war.aggressor ? (war.score || 0) : -(war.score || 0);
  return Math.min(100, Math.max(0, offererScore) + 10);
};

// The recipient's acceptance ledger — positive components make accepting more likely, negative
// ones make it less likely. `accepted` iff the total covers the terms' combined cost.
export const getPeaceAcceptance = (state, war, offererId, terms) => {
  const recipientId = otherSide(war, offererId);
  const recipient = state.nations[recipientId];
  const offerer = state.nations[offererId];
  const offererScore = offererId === war.aggressor ? (war.score || 0) : -(war.score || 0);
  const recipientCapitalId = getNationCapital(recipientId);
  const recipientCapitalOccupied = !!recipientCapitalId && state.regions[recipientCapitalId]?.occupiedBy === offererId;
  const offererStrength = offerer?.militaryStrength || 1;
  const recipientStrength = recipient?.militaryStrength || 1;
  const strengthShare = offererStrength / (offererStrength + recipientStrength);
  const turnsAtWar = Math.max(0, (state.turnNumber || 0) - (war.startTurn ?? state.turnNumber ?? 0));
  const cedesCapital = terms.some((t) => t.type === 'cede' && t.regionId === recipientCapitalId);

  const breakdown = [
    { label: 'War situation', value: Math.round(offererScore) },
    { label: 'War exhaustion', value: Math.round(0.4 * (recipient?.warExhaustion || 0)) },
    { label: 'Military balance', value: Math.round(20 * (2 * strengthShare - 1)) },
    { label: 'War weariness', value: Math.round(Math.min(10, turnsAtWar / 5)) },
    { label: 'Capital secure', value: recipientCapitalOccupied ? 0 : -10 },
    { label: 'Demands include capital', value: cedesCapital ? -15 : 0 }
  ];
  const total = Math.round(breakdown.reduce((sum, line) => sum + line.value, 0));
  const cost = getPeaceCost(state, war, offererId, terms);
  return { total, cost, accepted: total >= cost, breakdown };
};

// Applies an agreed (or enforced) set of terms. Pure — returns the new regions/nations/resources
// slices; does NOT touch state.wars (the caller closes the war record) or truces (see file header).
export const applyPeace = (state, war, offererId, terms) => {
  const recipientId = otherSide(war, offererId);

  // A signed peace ends occupation between these two belligerents outright, regardless of terms —
  // any occupied region not explicitly ceded below is simply liberated back to its own owner. Runs
  // BEFORE terms are applied so a 'cede' term's own owner-change below isn't skipped by this pass.
  let nextRegions = Object.fromEntries(Object.entries(state.regions).map(([id, region]) => {
    const isBetweenBelligerents =
      (region.occupiedBy === offererId && region.owner === recipientId) ||
      (region.occupiedBy === recipientId && region.owner === offererId);
    if (!isBetweenBelligerents) return [id, region];
    // eslint-disable-next-line no-unused-vars -- destructured only to omit it from rest
    const { occupiedBy, ...rest } = region;
    return [id, rest];
  }));
  let nextNations = state.nations;
  let nextResources = state.resources;

  terms.forEach((term) => {
    if (term.type === 'cede') {
      const region = nextRegions[term.regionId];
      if (!region || region.owner !== recipientId) return;
      nextRegions = {
        ...nextRegions,
        [term.regionId]: {
          ...region,
          owner: offererId,
          formerOwner: getFormerOwnerOnConquest(term.regionId, region.owner, offererId),
          control: 25,
          unrest: Math.max(region.unrest || 0, 50)
        }
      };
      nextNations = applyAggressiveExpansion(nextNations, nextRegions, term.regionId, recipientId, offererId);
    } else if (term.type === 'gold') {
      const amount = term.amount || 0;
      // AI has no simulated treasury pre-M16 (economy.js's own "player-only real computation"
      // pattern) — a gold indemnity only actually moves state.resources when the player is a party.
      if (recipientId === state.playerNationId) nextResources = { ...nextResources, gold: Math.max(0, (nextResources.gold || 0) - amount) };
      else if (offererId === state.playerNationId) nextResources = { ...nextResources, gold: (nextResources.gold || 0) + amount };
    } else if (term.type === 'reparations') {
      const loser = nextNations[recipientId];
      const winner = nextNations[offererId];
      if (loser) {
        nextNations = { ...nextNations, [recipientId]: addNationModifier(loser, {
          sourceType: 'peace', sourceId: war.id, label: 'War Reparations',
          mods: { 'national.goldMult': -REPARATIONS_GOLD_MULT }, duration: REPARATIONS_DURATION_TURNS, turnNumber: state.turnNumber
        }) };
      }
      if (winner) {
        nextNations = { ...nextNations, [offererId]: addNationModifier(nextNations[offererId] || winner, {
          sourceType: 'peace', sourceId: war.id, label: 'War Reparations',
          mods: { 'national.goldMult': REPARATIONS_GOLD_MULT }, duration: REPARATIONS_DURATION_TURNS, turnNumber: state.turnNumber
        }) };
      }
    } else if (term.type === 'humiliate') {
      const winner = nextNations[offererId];
      if (winner) nextNations = { ...nextNations, [offererId]: { ...winner, prestige: clampPrestige((winner.prestige || 0) + HUMILIATE_PRESTIGE_GAIN) } };
      const loser = nextNations[recipientId];
      if (loser) {
        nextNations = { ...nextNations, [recipientId]: {
          ...loser,
          prestige: clampPrestige((loser.prestige || 0) - HUMILIATE_PRESTIGE_LOSS),
          stability: clampStability((loser.stability || 0) - HUMILIATE_STABILITY_LOSS)
        } };
      }
    } else if (term.type === 'vassalize') {
      const overlord = nextNations[offererId];
      const vassal = nextNations[recipientId];
      if (overlord && vassal && !vassal.vassalOf) {
        nextNations = {
          ...nextNations,
          [offererId]: { ...overlord, vassals: [...(overlord.vassals || []), recipientId] },
          [recipientId]: { ...vassal, vassalOf: offererId, vassalizedTurn: state.turnNumber }
        };
      }
    }
  });

  return { regions: nextRegions, nations: nextNations, resources: nextResources };
};

// Greedy AI term-picking (plan §C): the goal region first (if the offerer already occupies it),
// then any other occupied regions cheapest-first, within the offerer's justified budget; falls back
// to reparations if nothing is affordable to cede, and to white peace ([]) if even that isn't.
export const buildAITerms = (state, war, offererId) => {
  const recipientId = otherSide(war, offererId);
  const maxCost = getMaxPeaceCost(war, offererId);
  const terms = [];
  let spent = 0;
  const tryAdd = (term) => {
    const cost = getTermCost(state, war, offererId, term);
    if (!Number.isFinite(cost) || spent + cost > maxCost) return;
    terms.push(term);
    spent += cost;
  };

  if (war.goal?.type === 'capture_region') {
    const goalRegion = state.regions[war.goal.regionId];
    if (goalRegion && goalRegion.owner === recipientId && goalRegion.occupiedBy === offererId) tryAdd({ type: 'cede', regionId: war.goal.regionId });
  }

  Object.values(state.regions)
    .filter((r) => r.owner === recipientId && r.occupiedBy === offererId && r.id !== war.goal?.regionId)
    .sort((a, b) => getTotalDev(a) - getTotalDev(b))
    .forEach((region) => tryAdd({ type: 'cede', regionId: region.id }));

  if (terms.length === 0) tryAdd({ type: 'reparations' });

  return terms;
};
