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
// Consequences of the common draws (events-8, round 2: "a choice had no visible follow-up"): one card a
// few turns later in the same city ({city}: the city the draw bound, eventDeck.js), each a new choice:
//   raiders_return    <- frontier_raiders' "reinforce the border"
//   hunger_at_doors   <- failed_harvest's "ration what remains"
//   black_silt        <- river_flood's "let the waters recede"
//   caravan_returns   <- traveling_merchants' "buy up their entire stock"
//   harbour_grows     <- coastal_trade_boom's "keep tariffs low"
//   newcomers_settle  <- refugee_crisis' "take them in"
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
      { label: 'Keep it as a trading post only', effects: { gold: 130 } }
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
      { label: 'Press your claim firmly', effects: { gold: -50, militaryStrengthBonus: 30, legitimacy: -5, spawnFollowUp: { id: 'border_dispute_2', delayTurns: 5 } } },
      { label: 'Offer to submit the dispute to arbitration', effects: { gold: 75, spawnFollowUp: { id: 'border_dispute_2', delayTurns: 7 } } }
    ]
  },
  border_dispute_2: {
    id: 'border_dispute_2',
    title: 'The Dispute Concludes',
    description: 'The border dispute finally reaches its conclusion, one way or another.',
    options: [
      { label: 'Accept a compromise line', effects: { controlBonus: 5, gold: 50 } },
      { label: 'Hold firm and let tensions simmer', effects: { militaryStrengthBonus: 20, controlPenalty: 5 } }
    ]
  },

  // ---- Consequences of the common draws (events-8) ----
  raiders_return: {
    id: 'raiders_return',
    title: 'The Raiders Return',
    description: 'The raiders come back to {city}, and this time they find the border manned and waiting.',
    options: [
      { label: 'Ride out and break them', effects: { hr: -20, militaryStrengthBonus: 20, prestige: 5 } },
      { label: 'Stay behind the walls and let them pass', effects: { cityFood: -5, cityLoyalty: -5 } }
    ]
  },
  hunger_at_doors: {
    id: 'hunger_at_doors',
    title: 'Hunger at the Doors',
    description: 'The rationing has left {city} hungry, and a crowd gathers at the doors of the stores.',
    options: [
      { label: 'Open the stores to the crowd', effects: { cityFood: -10, cityLoyalty: 5 } },
      { label: 'Send guards to hold the doors', effects: { cityUnrest: 10, controlBonus: 3 } }
    ]
  },
  black_silt: {
    id: 'black_silt',
    title: 'Black Silt',
    description: 'Where the flood lay, the fields of {city} are black with new silt, and families argue over who may farm the new ground.',
    options: [
      { label: 'Share the new ground by lot', effects: { cityFood: 10, cityUnrest: 5 } },
      { label: 'Give it to the families who lost the most', effects: { cityLoyalty: 8, hr: -10 } }
    ]
  },
  caravan_returns: {
    id: 'caravan_returns',
    title: 'The Caravan Returns',
    description: 'The merchants you bought out come back to {city} with their friends, and ask for a market of their own inside the walls.',
    options: [
      { label: 'Grant them a market quarter', effects: { techPoints: 15, prestige: 3, controlPenalty: 2 } },
      { label: 'Let them trade outside the walls only', effects: { cityLoyalty: 3 } }
    ]
  },
  harbour_grows: {
    id: 'harbour_grows',
    title: 'The Harbour Grows',
    description: 'Low tariffs kept the ships coming. The harbour of {city} is crowded, and the shipwrights want the old fishing quarter for new docks.',
    options: [
      { label: 'Clear the fishing quarter for docks', effects: { hr: 20, prestige: 4, cityUnrest: 8 } },
      { label: 'Keep the fishermen and build along the shore', effects: { cityLoyalty: 5, controlPenalty: 2 } }
    ]
  },
  newcomers_settle: {
    id: 'newcomers_settle',
    title: 'The Newcomers Settle',
    description: 'The refugees taken in at {city} have built a quarter of their own. Some want to stay apart; others ask to join the city\'s crafts.',
    options: [
      { label: 'Welcome them into the crafts', effects: { techPoints: 10, cityLoyalty: 5, cityUnrest: 5 } },
      { label: 'Let them keep their own quarter', effects: { hr: 20, cityLoyalty: -5 } }
    ]
  }
};
