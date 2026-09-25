// src/data/eventChains.js
// Registry of scripted follow-up events ("event chains with memory", plan §9.5 Layer 4). An
// option in events.js or proceduralEvents.js can attach `effects.spawnFollowUp: { id, delayTurns }`
// to schedule one of these to fire `delayTurns` turns later — see applyEventEffects.js (which
// records the schedule in state.pendingEventChains) and resolveTurn.js (which checks it every
// turn). Shaped exactly like a HISTORICAL_EVENTS entry so EventModal.jsx needs no changes to
// render one, except these have no fixed `year` since they fire on a turn delay, not a calendar
// date.
//
// spawnFollowUp carries only { id, delayTurns } — no per-instance payload — so a chain step can't
// know anything specific about the event that started it (which nation, which region). Every
// chain below is written generically for that reason, using the same nation-agnostic effect keys
// world events use (see events.js's header) rather than anything naming a specific nation/region.
//
// Four multi-step storylines, each kicked off from a real option in events.js/proceduralEvents.js
// (see the spawnFollowUp comments there):
//   succession_crisis (3 steps) <- continental_upheaval's "stay neutral" option
//   colonial_venture (3 steps)  <- columbian_exchange's "adopt aggressively" option
//   tech_gamble (2 steps)       <- digital_revolution's "invest heavily" option
//   border_dispute (2 steps)    <- frontier_raiders' "punitive expedition" option
export const EVENT_CHAINS = {
  // ---- Succession Crisis ----
  succession_crisis_1: {
    id: 'succession_crisis_1',
    title: 'A Succession Crisis Brews',
    description: 'Watching a neighboring dynasty collapse raises an uncomfortable question at home: who succeeds you, and will everyone actually accept it?',
    options: [
      { label: 'Name the eldest heir now, publicly', effects: { gold: -50, controlBonus: 5, spawnFollowUp: { id: 'succession_crisis_2', delayTurns: 5 } } },
      { label: 'Back whichever claimant has the strongest army', effects: { gold: -100, militaryStrengthBonus: 50, stability: -1, spawnFollowUp: { id: 'succession_crisis_2', delayTurns: 5 } } }
    ]
  },
  // Plan §M17: "a branching chain reaches different endings" — the two choices here don't just
  // reconverge on one shared step 3 (as every other chain below still does; the mechanism supports
  // a real fork at any option, this is the one place content actually uses it): purging sends the
  // crisis toward an autocratic close, negotiating toward a conciliatory one, each its own distinct
  // final chapter rather than the same text with different numbers plugged in.
  succession_crisis_2: {
    id: 'succession_crisis_2',
    title: 'The Court Splits',
    description: 'Rivals to your chosen successor refuse to accept the arrangement, and the court fractures into open, competing factions.',
    options: [
      { label: 'Purge the opposition', effects: { gold: -80, controlBonus: 10, spawnFollowUp: { id: 'succession_crisis_3_autocratic', delayTurns: 5 } } },
      { label: 'Negotiate a power-sharing settlement', effects: { gold: -40, dip: 20, stability: 1, spawnFollowUp: { id: 'succession_crisis_3_conciliatory', delayTurns: 5 } } }
    ]
  },
  succession_crisis_3_autocratic: {
    id: 'succession_crisis_3_autocratic',
    title: 'The Crisis Resolves: A Firmer Hand',
    description: 'With the opposition broken, the succession is no longer in doubt — but the court now answers to fear as much as loyalty.',
    options: [
      { label: 'Consolidate the new order firmly', effects: { controlBonus: 15, crownLand: 10, estateLoyalty: { nobility: -10 } } },
      { label: 'Offer a token amnesty to steady the realm', effects: { dip: 10, legitimacy: 5 } }
    ]
  },
  succession_crisis_3_conciliatory: {
    id: 'succession_crisis_3_conciliatory',
    title: 'The Crisis Resolves: A Shared Settlement',
    description: 'The power-sharing arrangement holds, and the crisis passes without open bloodshed — at the cost of a court that now has more factions with a real say.',
    options: [
      { label: 'Honor the settlement in full', effects: { controlPenalty: 5, dip: 15, estateLoyalty: { nobility: 10 } } },
      { label: 'Quietly claw back what was conceded', effects: { controlBonus: 5, legitimacy: -10 } }
    ]
  },

  // ---- Colonial Venture ----
  colonial_venture_1: {
    id: 'colonial_venture_1',
    title: 'A Venture Beyond the Horizon',
    description: 'Merchants and adventurers petition you to fund an expedition to distant, unclaimed shores — a fortune waiting to be made, or lost.',
    options: [
      { label: 'Fund it generously', effects: { gold: -200, prestige: 5, spawnFollowUp: { id: 'colonial_venture_2', delayTurns: 8 } } },
      { label: 'Fund it modestly and see what comes of it', effects: { gold: -80, crownLand: 3, spawnFollowUp: { id: 'colonial_venture_2', delayTurns: 10 } } }
    ]
  },
  colonial_venture_2: {
    id: 'colonial_venture_2',
    title: 'A Foothold Abroad',
    description: 'Word arrives that the expedition has reached its destination and is establishing a foothold — though it will not survive long without support from home.',
    options: [
      { label: 'Send reinforcements to secure it', effects: { gold: -150, spawnFollowUp: { id: 'colonial_venture_3', delayTurns: 6 } } },
      { label: 'Let them fend for themselves', effects: { spawnFollowUp: { id: 'colonial_venture_3', delayTurns: 8 } } }
    ]
  },
  colonial_venture_3: {
    id: 'colonial_venture_3',
    title: 'The Colony Takes Root',
    description: 'The venture has taken root and now sends real wealth home. The question is what to make of it — a formal extension of the state, or simply a source of profit.',
    options: [
      { label: 'Formalize it as a full province', effects: { gold: -100, techPoints: 20, controlBonus: 5 } },
      { label: 'Keep it as a trading post only', effects: { gold: 80, dip: 10 } }
    ]
  },

  // ---- Technological Gamble ----
  tech_gamble_1: {
    id: 'tech_gamble_1',
    title: 'The Gamble Reaches Its Trial',
    description: 'The ambitious, unproven technique you committed to is nearing its critical trial — the moment it either proves itself or fails spectacularly.',
    options: [
      { label: 'Push it to completion regardless of cost', effects: { gold: -100, techPoints: 80 } },
      { label: 'Cut your losses now', effects: { gold: 50, techPoints: -20, stability: 1 } }
    ]
  },

  // ---- Border Dispute ----
  border_dispute_1: {
    id: 'border_dispute_1',
    title: 'The Dispute Escalates',
    description: 'The punitive expedition crossed into contested ground, and what began as a raid has hardened into a genuine border dispute with a wary neighbor.',
    options: [
      { label: 'Press your claim firmly', effects: { dip: -10, militaryStrengthBonus: 30, legitimacy: -5, spawnFollowUp: { id: 'border_dispute_2', delayTurns: 5 } } },
      { label: 'Offer to submit the dispute to arbitration', effects: { dip: 15, spawnFollowUp: { id: 'border_dispute_2', delayTurns: 7 } } }
    ]
  },
  border_dispute_2: {
    id: 'border_dispute_2',
    title: 'The Dispute Concludes',
    description: 'The border dispute finally reaches its conclusion, one way or another.',
    options: [
      { label: 'Accept a compromise line', effects: { controlBonus: 5, dip: 10 } },
      { label: 'Hold firm and let tensions simmer', effects: { militaryStrengthBonus: 20, controlPenalty: 5 } }
    ]
  }
};
