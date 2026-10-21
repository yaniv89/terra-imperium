// src/data/actionCosts.js
// Single source of truth for player-action costs, shared by the reducer (enforcement) and the
// panels (display). Keeping one copy prevents the UI and the rules from drifting.
//
// Calibrated against the new economy: a fresh nation starts with 500 gold and 100 HR, and a
// mid-size nation earns roughly 100-600 gold/turn (see build-world-regions.mjs's log-scaled
// gdp/population -> gold/hr formulas) — costs in the tens-to-low-hundreds keep every action
// affordable within a few turns without being free.
//
// Differentiation plan U7 (Appendix A): the ADM/DIP/MIL pools are gone. A cost is gold (and other
// resources), `decrees` spent from the ruler's bank (src/engine/decrees.js), or nothing; the one
// cost helper for decree acts is src/utils/costs.js (canPay, payCost).

export const ACTION_COSTS = {
  gainControl: { gold: 40 },
  buildInfrastructure: { gold: 80 },
  buildDefenses: { gold: 60 },
  constructBuilding: { gold: 100 },
  developResourceSite: { gold: 120 },
  quellUnrest: { gold: 50 },
  // Peacefully absorbing a bordering nation whose own grip on its territory has collapsed — no
  // military required, unlike Launch Invasion, so it costs more gold than any other
  // single-region domestic action to compensate.
  settleColonize: { gold: 150 },
  populationPolicy: { gold: 100 },
  // A slider flip, not a strategic decision — free.
  setTaxRate: {},
  // Great Projects (plan §M10): cost scales by tier (500/1000/2000 gold, 4/6/8
  // turns) via src/data/greatProjects.js's getGreatProjectCost — no flat ACTION_COSTS entry here,
  // matching the RESEARCH_TECH/CHANGE_LAW pattern for dynamically-priced actions.

  recruitUnit: { gold: 60, hr: 100 },
  // Free since routes (plan §4g): marching costs supplies and gold instead (routes.js).
  moveArmy: {},
  launchInvasion: {},
  // Bookkeeping, not a strategic decision — free, like setTaxRate/appointGeneral.
  promoteUnit: {},
  hireGeneral: { gold: 150 },
  appointGeneral: {},

  embarkUnit: {},
  disembarkUnit: {},
  amphibiousAssault: {},
  navalEngagement: {},
  suppressRebellion: {},

  // Research itself has no action cost: science pays for the chosen tech turn by turn
  // (src/engine/research.js).
  setResearchFocus: {},
  fundScholars: { gold: 100 },

  // Plan §M8.1: changing government TYPE is the big, rare decision (2 decrees, plus -2 stability
  // applied directly in the reducer); enacting a reform for the current age tier is the smaller,
  // routine one. A law change is changeLaw below (one decree).
  changeGovernmentType: { decrees: 2 },
  enactGovernmentReform: { decrees: 1 },
  // Plan §M15: relocating the capital is a rare, deliberate decision — priced like changing
  // government type (the other big act of state), plus a real gold cost the plan itself specifies.
  moveCapital: { gold: 300, decrees: 1 },
  // Declaring independence costs nothing beyond the war itself (like every other DECLARE_WAR variant
  // in this codebase) — a vassal already pays 10% tribute every turn just for existing as a subject.
  declareIndependence: {},

  // Declaring war with a real casus belli (a fabricated claim or organic hostility) costs one
  // decree; without one it costs a real gold premium on top — see GameContext.jsx's DECLARE_WAR for
  // the rest of an unjustified war's cost (global relations, home unrest).
  declareWarJustified: { decrees: 1 },
  declareWarUnjustified: { gold: 300 },
  fabricateClaim: { gold: 150, decrees: 1 },
  tradeAgreement: { gold: 100 },
  openBorders: { gold: 50 },
  borderStele: { gold: 40 },
  demand: { decrees: 1 },
  militaryAlliance: { gold: 150, decrees: 1 },
  giftBribe: { gold: 100 },
  // Espionage risks the gold on a coin-flip-ish roll (see ESPIONAGE_SUCCESS_CHANCE, gameReducer.js)
  // — priced like a real covert operation, not a guaranteed purchase of techPoints.
  espionage: { gold: 200 },
  // Counter-Intelligence auto-targets whoever is currently most hostile toward you rather than
  // needing a chosen target, so it's priced like Gift/Bribe (a direct relations action) rather than
  // Espionage's riskier, pricier covert-ops tier.
  counterIntelligence: { gold: 120 },

  // Diplomacy overhaul (plan §M12).
  // Rivals/Insult/Break Alliance are free relationship declarations, like Gift/Bribe's flavor
  // sibling — their real cost is the relationship consequence itself, not a resource.
  rivalNation: {},
  proposeMarriage: { gold: 100, decrees: 1 },
  breakAlliance: {},
  insult: {},
  assignDiplomat: {},
  // Vassalize is a major diplomatic commitment, priced well above Military Alliance; annexing a
  // vassal (after VASSAL_ANNEX_COOLDOWN_TURNS) is one decree.
  vassalize: { gold: 300, decrees: 1 },
  annexVassal: { decrees: 1 },
  // A law change needs authority (canEnactLaw) and one decree.
  changeLaw: { decrees: 1 },
  releaseVassal: {},

  // Plan §M2/§M8.3: identity shifts cost one decree — a real decision, priced
  // between a reform and a law change, with its own 5-turn cooldown (IDENTITY_SHIFT_COOLDOWN_TURNS).
  shiftIdentity: { decrees: 1 },
  // Priced like Build Defenses — a persistent, steadily-improving region investment of the same shape.
  buildClimateResilience: { gold: 90 },
  // Priced like Gift/Bribe — a direct relations action, but empire-wide rather than one target.
  culturalExport: { gold: 130 }
};

// Every nation's flat techPoints/turn before any Science building. Tech points otherwise came ONLY
// from Science buildings, whose first tier (Library) itself needs a researched tech — a closed loop
// that no AI nation could ever enter (the player could only via Fund Scholars). 2/turn funds a
// 10-TP Bronze tech every 5 turns and a 25-TP Classical one every ~12, so Libraries still matter.
export const BASE_TECHPOINTS_PER_TURN = 2;
// Science (tech points) from development (plan §2): this share of each controlled province's total
// development every turn, so a growing realm researches faster. Player and AI alike.
export const SCIENCE_PER_DEV = 0.02;

// Above this climateResilience level, a region is considered adequately prepared — the same
// mechanical role defenseLevel 3 already plays gating frontier_raiders (src/data/proceduralEvents.js).
export const CLIMATE_RESILIENCE_THRESHOLD = 3;
export const CLIMATE_RESILIENCE_MAX = 10;

// Cultural Export (nation.culturalInfluence): a modest flat accumulation per use, and a small
// hostility reduction applied to EVERY other nation at once (broad soft power, unlike Gift/Bribe's
// single chosen target) — smaller per-nation than Gift/Bribe since it touches everyone.
export const CULTURAL_EXPORT_INFLUENCE_GAIN = 50;
export const CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION = 3;

// Army maintenance (added per user request, "keep things balanced and sane") — recruiting a unit
// (recruitUnit above) was a one-time cost with no ongoing one, so a large standing army cost nothing
// to simply hold once paid for. A flat per-turn gold upkeep per player-owned unit (resolveTurn.js)
// makes army size a real, continuous tradeoff against everything else gold buys, the way a real
// standing army has to be paid to stay fielded, not just raised. ~12 turns of upkeep equals one
// unit's own recruit cost, so a long-lived army is a real ongoing expense, not a rounding error.
export const UNIT_UPKEEP_GOLD_PER_TURN = 5;

// Military maintenance slider (plan §M11): army/navy upkeep scale linearly with it (100% = full
// UNIT_UPKEEP_GOLD_PER_TURN, 50% = half). The plan's own "morale recovery/reinforcement also scale
// with it" is deferred — this codebase has no per-turn morale-recovery or reinforcement mechanic
// yet at all (units are only ever initialized at 100 morale/organization, never regenerated), so
// scaling a mechanic that doesn't exist would be faking it; M14 (Military overhaul) is where both
// land and the maintenance scaling on them ship together.
export const ARMY_MAINTENANCE_MIN = 50;
export const ARMY_MAINTENANCE_MAX = 100;
export const ARMY_MAINTENANCE_DEFAULT = 100;

// Fort upkeep (plan §M6.2/§M11): "1g x fortLevel per turn" — the Defense building line's
// local.fortLevel already exists (src/data/buildings.js) but had no upkeep consumer until now.
export const FORT_UPKEEP_GOLD_PER_FORT_LEVEL = 1;

// Building upkeep (mobile audit H-13: 7,000 gold idle at T100, nothing to spend it on). The player's
// cities pay BUILDING_UPKEEP_GOLD x (tier + 1) a turn for each standing building, rounded down (tier 0 = 0.5g,
// tier 1 = 1g, tier 2 = 1.5g...; halved from 1 until a playtest calibrates it), so a fully built empire carries a real bill that grows with its tech
// instead of a hoard. The Defense line is left out (fort upkeep above). AI nations keep thin treasuries
// already and pay none.
export const BUILDING_UPKEEP_GOLD = 0.5;

// Loans (plan §M11). Requires the Banking Houses tech; before that the treasury simply can't go
// negative (RESOURCE floor at 0 everywhere already), so actions just fail for lack of gold.
export const LOAN_BASE_INTEREST_RATE = 0.04;
export const LOAN_INTEREST_PER_EXISTING_LOAN = 0.01;
export const LOAN_INTEREST_BANKING_HOUSES_DISCOUNT = 0.01;
export const LOAN_MIN_INTEREST_RATE = 0.01;
export const LOAN_BASE_CAPACITY = 3;
export const LOAN_BANK_CAPACITY_CAP = 3; // plan: "Bank tier +1 loan capacity each, max +3 total"
export const LOAN_MIN_SIZE = 200;
// Plan's own formula is "5 x avg net income over the last 5 turns" — this codebase has no per-turn
// income history buffer yet (state.history is M20 work), so this uses the CURRENT turn's net
// income as the proxy instead of a 5-turn average; an honest scope trim, not a different formula.
export const LOAN_SIZE_INCOME_MULTIPLIER = 5;

// Bankruptcy (plan §M11): triggers when a loan is needed (a would-be-negative treasury) and loan
// capacity is already full. BANKRUPTCY_MODIFIER_MODS reuses the existing timed nation.modifiers[]
// mechanism (M1/M4/M9 already push entries there) rather than inventing a second timed-effect
// list. Only 2 of the plan's 4 listed modifier effects have a real hook today: goldMult
// (national.taxIncome) and stabilityBonus (national.unrest, sign-flipped — see registry.js). The
// plan's other two, "-50% land/naval morale", have no substrate: battle.js doesn't consume the
// modifier engine at all yet (no `national.land*`/`navalMorale*` keys exist, and no combat
// multiplier is read from a nation's timed modifiers) — that's M14 (Military overhaul) work, so
// it's left out rather than added as a modifier line nothing will ever read.
export const BANKRUPTCY_DURATION_TURNS = 10;
export const BANKRUPTCY_STABILITY_PENALTY = 3;
export const BANKRUPTCY_PRESTIGE_PENALTY = 20;
// Keyed by the FULL modifier-engine key (national.goldMult), not the short LEGACY_HOOK name —
// nation.modifiers[] entries are read directly by sources.js's staticSources with no LEGACY_HOOK
// translation (unlike government/law/trait effect tables, which use the short hook names).
export const BANKRUPTCY_MODIFIER_MODS = {
  'national.goldMult': -0.33,
  'national.stabilityBonus': -2
};

// Unit recruitment strategic-resource cost (plan §M11 resource sink: "bronze-age units cost
// copper, iron-age units cost iron, modern units cost oil" — adapted onto this game's own 5 ages,
// since it has no literal "Iron Age"; kingdoms/gunpowder read as the iron-tool/iron-weapon era).
// "Missing resources give +50% gold cost instead of blocking" (plan, verbatim) — see
// src/engine/economy.js's getRecruitUnitCost for the fallback.
export const RECRUIT_STRATEGIC_RESOURCE_BY_AGE = {
  stone: null, // Stone units need no metal
  bronze: { key: 'copper', amount: 5 },
  classical: { key: 'copper', amount: 5 },
  kingdoms: { key: 'iron', amount: 8 },
  gunpowder: { key: 'iron', amount: 8 },
  modern: { key: 'oil', amount: 10 },
  // A list: every entry is needed, else the gold penalty (U56: every Information recruit is a vehicle or a drone).
  information: [{ key: 'oil', amount: 8 }, { key: 'rareMetals', amount: 2 }],
  future: { key: 'rareMetals', amount: 4 } // Appendix B: no oil past Fusion
};
export const RECRUIT_MISSING_RESOURCE_GOLD_PENALTY_MULT = 0.5;

// Sue for Peace's gold cost floors here regardless of how war-weary the target is — ending a war
// is never entirely free.
export const SUE_FOR_PEACE_MIN_GOLD = 20;
export const SUE_FOR_PEACE_BASE_GOLD = 200;
// A gift/bribe's flat hostility reduction.
export const GIFT_HOSTILITY_REDUCTION = 15;
// An unjustified war's flat hostility bump applied to every OTHER nation's view of the player —
// the plan's "unjustified wars cost... global relations".
export const UNJUSTIFIED_WAR_GLOBAL_HOSTILITY = 5;
// An unjustified war's flat unrest bump to the aggressor's home region — the plan's "unjustified
// wars cost stability".
export const UNJUSTIFIED_WAR_HOME_UNREST = 20;
// Above this hostility (or an existing trade agreement), a nation is calm enough to ally with.
export const ALLIANCE_HOSTILITY_CEILING = 30;

// Fund Scholars' fixed gold -> techPoints exchange rate.
export const FUND_SCHOLARS_TECHPOINTS = 20;

// Espionage/Counter-Intelligence (see types.js's header comment on the pair). A coin-flip-ish
// success rate keeps espionage a real gamble rather than a guaranteed techPoints purchase; failure
// costs real relations, matching how a botched covert op should sting.
export const ESPIONAGE_SUCCESS_CHANCE = 0.6;
export const ESPIONAGE_TECH_POINTS_STOLEN = 15;
export const ESPIONAGE_FAILURE_HOSTILITY_INCREASE = 15;
// How long a successful espionage op keeps the target's provinces visible (src/engine/intel.js).
export const INTEL_DURATION_TURNS = 10;
// Counter-Intelligence auto-targets whoever is currently most hostile toward the player (no chosen
// target) and calms them down.
export const COUNTER_INTEL_HOSTILITY_REDUCTION = 20;

// Fraction of a disbanded unit's HR cost recovered — never the full amount, or disband/recruit
// would be a free way to reshuffle composition every turn.
export const DISBAND_HR_REFUND_RATIO = 0.5;

// Settle/Colonize only targets a bordering region whose own control has collapsed below this —
// the "minimally-held adjacent land" the plan describes, in a one-region-per-nation world with no
// literal unowned territory. Above this threshold the nation still has a real grip on its own
// homeland and can only be taken by Launch Invasion.
export const SETTLE_COLONIZE_CONTROL_THRESHOLD = 20;
// Control/unrest a settled region starts at under its new owner — deliberately identical to a won
// Launch Invasion's own numbers (GameContext.jsx), since both are "you now hold contested land".
export const SETTLE_COLONIZE_START_CONTROL = 25;
export const SETTLE_COLONIZE_START_UNREST = 50;
// Hostility a living owner gains toward you when you settle a province it lost to rebels.
export const SETTLE_COLONIZE_OWNER_HOSTILITY = 15;

// Population Policy's flat per-use growth rate — compounds each time it's used, so early
// investment pays off more over a long game (guns vs. butter, per the plan).
export const POPULATION_POLICY_GROWTH_RATE = 0.1;

// Diplomacy overhaul (plan §M12). Every nation gets these fields (rivals/diplomats/ae/truces/
// vassals) the same "generic reader, player-only writer today" way government/laws/taxRate
// already do — see gameReducer.js's createInitialState comment on that pattern.

// Rivals (plan: "Pick up to 3 from nations of similar strength that border you"). The plan's own
// "+10% prestige gain/turn" and "Humiliate CB" effects have no substrate yet (there's no per-turn
// prestige-GAIN hook — nationalPower.js's prestige is pure decay outside of great-project/event
// one-shots — and casus belli TYPES are M13 work), so the one real, present-day effect ships
// instead: a modest prestige reward when a rival is eliminated (elimination.js already exists).
export const MAX_RIVALS = 3;
export const RIVAL_ELIMINATED_PRESTIGE_REWARD = 5;

// Royal Marriage (plan: "both monarchies... +25 opinion"). This game has one
// hostility scalar per nation (not pairwise opinion), so "+25 opinion" becomes "-25 hostility
// toward the player" — the real, existing axis a marriage can actually move.
export const MARRIAGE_HOSTILITY_REDUCTION = 25;

export const BREAK_ALLIANCE_HOSTILITY_INCREASE = 25;
export const INSULT_HOSTILITY_INCREASE = 50;

// Diplomats (plan §M12): the player starts with 2, each can run one ongoing task. Only Improve
// Relations is wired for real this milestone — Fabricate Claim/Build Spy Network already have
// standalone real actions (FABRICATE_CLAIM; ESPIONAGE's steal_tech IS the spy-network payoff), so
// giving diplomats a competing implementation of the same effects would just fork the mechanic
// rather than add a new one.
export const STARTING_DIPLOMATS = 2;
// On top of aiLogic.js's own passive hostility decay toward hostilityFloor — an actively assigned
// diplomat measurably outpaces simply waiting.
export const DIPLOMAT_IMPROVE_RELATIONS_HOSTILITY_DECAY_PER_TURN = 3;

// Trade Pact capacity (plan §M8.3/§M12: "Globalism > 40 gives +1 trade pact capacity... Isolationism
// > 40 gives... -1 trade pact capacity"). Base 1 (not the plan's abstract "capacity" default,
// chosen so a fresh nation can still form its first pact before ever touching identity) plus/minus
// the identity swing, floored at 0 so a committed isolationist can be locked out entirely.
export const TRADE_PACT_BASE_CAPACITY = 1;
// Plan: "+5% x pact count" trade income. Now the calibration target only: a pact is worth the gravity
// model's share (src/engine/tradeValue.js), about this for an equal partner 1,000 km away.
export const TRADE_PACT_GOLD_MULT_PER_PACT = 0.05;

// Truces (plan §M13's own truce rules, pulled forward since M12 is where wars first get a
// redeclare-cooldown at all): 10 turns, mirrored on both former belligerents. The player MAY break
// one (at a real cost); the AI never does (diplomacy.js/aiLogic.js enforce this asymmetrically).
export const TRUCE_DURATION_TURNS = 10;
export const TRUCE_BREAK_STABILITY_PENALTY = 2;
export const TRUCE_BREAK_PRESTIGE_PENALTY = 30;
export const TRUCE_BREAK_AE_AGAINST_NEIGHBORS = 25;

// Aggressive Expansion (plan §M12): accrued by EVERY nation bordering a captured region (and that
// region's previous owner) against whoever captured it, proportional to the region's own total
// development (M5's real per-region dev.tax+production+manpower) so a rich province taken sparks
// more outrage than a poor one. Isolationist identity discounts a nation's OWN AE generation (plan:
// "Isolationism... -25% AE impact on you").
export const AE_PER_DEV_POINT = 1;
export const AE_DECAY_PER_TURN = 2;
export const AE_PRUNE_BELOW = 1; // sparse-map hygiene — drop near-zero entries rather than let them linger forever
export const AE_ISOLATIONIST_DISCOUNT = 0.75;
// Coalition war-roll scaling (aiLogic.js): how much a coalition member's real AE against the
// runaway leader further multiplies its already-large coalition roll bonus, capped so one
// maxed-out relationship can't make the roll a certainty.
export const AE_COALITION_ROLL_SCALE = 100;
export const AE_COALITION_ROLL_CAP = 2;

// Vassals (plan §M12; nation.vassals was scaffolded back in M4 but never had a real writer until
// now). Vassalize requires the target's hostility already low and the player overwhelmingly
// stronger — the plan's own "opinion >= +150... >= 3x their strength" translated onto this
// codebase's real axes (hostility, militaryStrength). Annex opens up after a cooldown, for one decree.
export const VASSALIZE_HOSTILITY_CEILING = 20;
export const VASSALIZE_STRENGTH_RATIO = 3;
export const VASSAL_ANNEX_COOLDOWN_TURNS = 10;
// Plan: "Vassals pay 10% of their income as tribute" — real and computable for an AI vassal too,
// since every nation has real per-region dev (M5), not just the player.
export const VASSAL_TRIBUTE_RATE = 0.10;
export const VASSAL_TRIBUTE_GOLD_PER_DEV_POINT = 1;

// Crises & defeat (plan §M15). Dynamic capital: Move Capital's own -1 stability ("if the new capital
// is outside the original start regions") reuses REGIONS_DATA[id].startOwner, the same field
// getFormerOwnerOnConquest (rebellion.js) already uses for "is this the nation's own native soil".
// Capital-occupied and capital-lost-in-peace penalties are separate, smaller stability hits, matching
// the plan's own distinct table entries for each of the three capital events.
export const MOVE_CAPITAL_FOREIGN_STABILITY_PENALTY = 1;
export const CAPITAL_OCCUPIED_STABILITY_PENALTY = 1;
export const CAPITAL_LOST_IN_PEACE_STABILITY_PENALTY = 2;

// Civil war (plan §M15). Insurgent rebels reuse REBEL_OWNER_ID (src/data/rebellion.js) for combat —
// an insurgent army is just a rebel army with a cause — but mark the regions they seize with
// `occupiedBy` (the same "someone else holds this militarily, ownership hasn't changed" field M13
// wars use) so "holds >= 50% of your regions" is a plain count, not a second tracking structure.
export const CIVIL_WAR_STABILITY_STREAK_TURNS = 5; // five consecutive turns at the floor (plans/playtest-1.md P4; was 3)
export const CIVIL_WAR_INSURGENT_REGION_SHARE = 0.15;
export const CIVIL_WAR_INSURGENT_STRENGTH_SHARE = 0.15; // vs. the nation's own real fielded strength
export const CIVIL_WAR_HOLD_SHARE_TO_LOSE = 0.5;
export const CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS = 5;
export const CIVIL_WAR_LOSE_PRESTIGE_PENALTY = 20;
export const CIVIL_WAR_CRUSH_STABILITY_REWARD = 1;
export const CIVIL_WAR_CRUSH_LEGITIMACY_REWARD = 10;

// Disasters (plan §M15): two independent 0-100 progress meters, each growing 10/turn while its
// trigger condition holds and decaying 10/turn otherwise (a flat, symmetric rate — the plan gives
// concrete thresholds for the endpoints, not a described curve in between).
export const DISASTER_PROGRESS_STEP = 10;
export const DISASTER_MAX_PROGRESS = 100;
export const ECONOMIC_COLLAPSE_MIN_LOANS = 3;
export const ECONOMIC_COLLAPSE_STABILITY_PENALTY = 2; // on top of applyBankruptcy's own -3
export const REVOLUTION_LEGITIMACY_THRESHOLD = 30; // a Modern-age regime this discredited, at stability -2 or worse, faces revolution

// Forced vassalage (plan §M15: "An AI peace deal can vassalize the player") — buildAITerms only
// reaches for a vassalize term once its cede/reparations options can't fully use a truly overwhelming
// war-score budget, so this only fires against a recipient already crushed almost totally.
export const FORCED_VASSALIZE_MIN_MAX_PEACE_COST = 90;

// Vassal independence (plan §M12/§M15: "libertyDesire... at >= 50 they may declare an independence
// war"). Liberty desire has no substrate before M15 (see the M12 survey), so its drift here is a
// simple, honest first cut: it rises when the vassal is comparatively strong next to its overlord and
// decays otherwise, exactly the plan's own "rises with your weakness and their strength" framing.
export const LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD = 50;
export const LIBERTY_DESIRE_RISE_PER_TURN = 2;
export const LIBERTY_DESIRE_DECAY_PER_TURN = 1;
export const INDEPENDENCE_WAR_WIN_SCORE = 60;

// Espionage variants (plan §M12: "Steal Tech, Sabotage Reputation, Support Rebels"). Steal Tech is
// the existing ESPIONAGE behavior (kept as the default `type`). Sabotage Reputation needs pairwise
// AI-AI opinion (damaging how OTHERS see the target) which this codebase doesn't have any
// substrate for — deferred. Support Rebels is real: it directly raises unrest in one of the
// target's own regions, using the same unrest/rebellion mechanic resolveTurn.js already runs.
export const ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE = 25;
