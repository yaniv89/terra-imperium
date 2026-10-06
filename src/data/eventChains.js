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
// Three multi-step storylines, each kicked off from a real option in events.js/proceduralEvents.js
// (see the spawnFollowUp comments there):
//   colonial_venture (3 steps)  <- columbian_exchange's "adopt aggressively" option
//   tech_gamble (2 steps)       <- digital_revolution's "invest heavily" option
//   border_dispute (2 steps)    <- frontier_raiders' "punitive expedition" option
export const EVENT_CHAINS = {
  // ---- Colonial Venture ----
  colonial_venture_1: {
    id: 'colonial_venture_1',
    title: 'A Venture Beyond the Horizon',
    description: 'Merchants and adventurers petition you to fund an expedition to distant, unclaimed shores — a fortune waiting to be made, or lost.',
    options: [
      { label: 'Fund it generously', effects: { gold: -200, prestige: 5, spawnFollowUp: { id: 'colonial_venture_2', delayTurns: 8 } } },
      { label: 'Fund it modestly and see what comes of it', effects: { gold: -80, spawnFollowUp: { id: 'colonial_venture_2', delayTurns: 10 } } }
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
