// src/data/actionCosts.js
// Single source of truth for player-action costs, shared by the reducer (enforcement) and the
// panels (display). Keeping one copy prevents the UI and the rules from drifting.
//
// Calibrated against the new economy: a fresh nation starts with 500 gold and 100 HR, and a
// mid-size nation earns roughly 100-600 gold/turn (see build-world-regions.mjs's log-scaled
// gdp/population -> gold/hr formulas) — costs in the tens-to-low-hundreds keep every action
// affordable within a few turns without being free.
//
// Plan §M2: the single shared `actionPoints` pool is replaced by three EU4-style power pools —
// `adm` (domestic/economy/government), `dip` (diplomacy/research-that-isn't-military/space), and
// `mil` (military) — so a turn's priorities compete only against other actions of the SAME kind,
// not against everything else in the game. Every entry below keeps its old quantity, just
// recategorized onto whichever pool that action actually belongs to; `diplomacyPoints` (the old
// separate diplomacy currency) folds into `dip` 1:1 rather than staying a fourth currency.

export const ACTION_COSTS = {
  gainControl: { gold: 40, adm: 1 },
  buildInfrastructure: { gold: 80, adm: 1 },
  buildDefenses: { gold: 60, adm: 1 },
  constructBuilding: { gold: 100, adm: 1 },
  developResourceSite: { gold: 120, adm: 1 },
  quellUnrest: { gold: 50, adm: 1 },
  // Peacefully absorbing a bordering nation whose own grip on its territory has collapsed — no
  // military required, unlike Launch Invasion, so it costs more gold and ADM than any other
  // single-region domestic action to compensate.
  settleColonize: { gold: 150, adm: 2 },
  populationPolicy: { gold: 100, adm: 1 },
  // A slider flip, not a strategic decision competing with the rest of the ADM budget — free.
  setTaxRate: { adm: 0 },
  // Great Projects (plan §M10): cost scales by tier (500/1000/2000 gold + 100/150/200 ADM, 4/6/8
  // turns) via src/data/greatProjects.js's getGreatProjectCost — no flat ACTION_COSTS entry here,
  // matching the RESEARCH_TECH/CHANGE_LAW pattern for dynamically-priced actions.

  recruitUnit: { gold: 60, hr: 100, mil: 1 },
  moveArmy: { mil: 1 },
  launchInvasion: { mil: 2 },
  // Bookkeeping, not a strategic decision — free, like setTaxRate/appointGeneral.
  promoteUnit: { mil: 0 },
  hireGeneral: { gold: 150, mil: 1 },
  appointGeneral: { mil: 0 },

  embarkUnit: { mil: 1 },
  disembarkUnit: { mil: 1 },
  amphibiousAssault: { mil: 3 },
  navalEngagement: { mil: 2 },
  suppressRebellion: { mil: 2 },

  // Plan §M7: a tech's own techPoints cost, and its power cost (src/data/techTree.js's own
  // getTechPowerCost, scaled by age), both draw from the tech's own line — no flat action cost
  // here for research itself (unlike every other action's ACTION_COSTS entry).
  setResearchFocus: { adm: 1 },
  fundScholars: { gold: 100, dip: 1 },

  // Plan §M8.1: changing government TYPE is the big, rare decision (300 ADM, plus -2 stability
  // applied directly in the reducer); enacting a reform for the current age tier is the smaller,
  // routine one. A law's own cost is computed dynamically (src/data/laws.js's getLawChangeCost:
  // 50 x the law's tier, discounted by reforms/identity) rather than a flat entry here.
  changeGovernmentType: { adm: 300 },
  enactGovernmentReform: { adm: 100 },
  // Plan §M15: relocating the capital is a rare, deliberate decision — priced like changing
  // government type (the other "big ADM decision"), plus a real gold cost the plan itself specifies.
  moveCapital: { adm: 200, gold: 300 },
  // Declaring independence costs nothing beyond the war itself (like every other DECLARE_WAR variant
  // in this codebase) — a vassal already pays 10% tribute every turn just for existing as a subject.
  declareIndependence: {},

  // Estates (plan §M9). Seize/Sell Land are the crown asserting or ceding authority — priced like a
  // reform and a lesser bureaucratic action respectively. Granting a privilege is a real concession,
  // priced like a reform; revoking one costs no resource at all because the plan's own described
  // cost IS the -1 stability/-30 loyalty penalty (gameReducer.js's REVOKE_ESTATE_PRIVILEGE case).
  // The two estate "asks" are free like every other bookkeeping action (setTaxRate/appointGeneral) —
  // their real cost is the -10 loyalty they charge that estate.
  seizeLand: { adm: 100 },
  sellLand: { adm: 30 },
  grantEstatePrivilege: { adm: 100 },
  revokeEstatePrivilege: { adm: 0 },
  clergyTithe: { adm: 0 },
  nobilityLevies: { adm: 0 },

  // Space Race (plan §10.4) — a satellite is a permanent, ongoing asset, priced well above any
  // single-turn action; an ASAT strike is cheaper than launching a satellite outright (destroying
  // is easier than building) but still a real commitment, on top of the shared debris-level cost.
  // Satellites/missions are DIP (the plan's Science-line pool); ASAT is a military strike on an
  // orbital asset, so it's MIL like Missile Strike.
  launchSatellite: { gold: 400, techPoints: 30, dip: 2 },
  asatStrike: { gold: 250, mil: 2 },

  // Missiles (plan §10.4 Layer 2) — cost scales steeply with range/power; a nuclear warhead is
  // priced well above even an ICBM, matching how consequential building one actually is. The gold
  // is paid up front at build time; MISSILE_STRIKE itself only spends the stockpiled missile and
  // MIL, since the ordnance was already bought.
  // Plan §M11 resource sink: ICBM/nuclear tiers add a rareMetals cost on top of their existing
  // iron/oil (tactical/theatre stay as they were — rareMetals is a Modern-age strategic resource,
  // per resources.js's own header, with no earlier-age source to draw it from).
  buildMissile: {
    tactical: { gold: 150, iron: 20, mil: 1 },
    theatre: { gold: 350, iron: 40, mil: 1 },
    icbm: { gold: 700, iron: 60, oil: 30, rareMetals: 10, mil: 2 },
    nuclear: { gold: 2000, iron: 100, oil: 60, rareMetals: 25, mil: 2 }
  },
  missileStrike: { mil: 2 },
  buildAbmDefense: { gold: 500, mil: 2 },
  // A mission's own gold/techPoints cost (src/data/spaceMissions.js) varies per mission; this is
  // just the flat DIP cost every launch shares, matching researchTech's own pattern.
  launchMission: { dip: 2 },

  // Declaring war with a real casus belli (a fabricated claim or organic hostility) costs only
  // DIP; without one it costs a real gold premium on top — see GameContext.jsx's DECLARE_WAR for
  // the rest of an unjustified war's cost (global relations, home unrest).
  declareWarJustified: { dip: 2 },
  declareWarUnjustified: { gold: 300, dip: 2 },
  // The old { diplomacyPoints: 10, actionPoints: 1 } collapses into one dip cost (10 + 1) now that
  // diplomacyPoints and the diplomatic AP draw from the same pool.
  fabricateClaim: { gold: 150, dip: 11 },
  tradeAgreement: { gold: 100, dip: 1 },
  militaryAlliance: { gold: 150, dip: 16 },
  giftBribe: { gold: 100, dip: 1 },
  // Espionage risks the gold on a coin-flip-ish roll (see ESPIONAGE_SUCCESS_CHANCE, gameReducer.js)
  // — priced like a real covert operation, not a guaranteed purchase of techPoints.
  espionage: { gold: 200, dip: 2 },
  // Counter-Intelligence auto-targets whoever is currently most hostile toward you rather than
  // needing a chosen target, so it's priced like Gift/Bribe (a direct relations action) rather than
  // Espionage's riskier, pricier covert-ops tier.
  counterIntelligence: { gold: 120, dip: 1 },

  // Diplomacy overhaul (plan §M12).
  // Rivals/Insult/Break Alliance are free relationship declarations, like Gift/Bribe's flavor
  // sibling — their real cost is the relationship consequence itself, not a resource.
  rivalNation: { dip: 0 },
  proposeMarriage: { gold: 100, dip: 10 },
  breakAlliance: { dip: 0 },
  insult: { dip: 0 },
  assignDiplomat: { dip: 5 },
  // Vassalize is a major diplomatic commitment, priced well above Military Alliance; Annex scales
  // with the vassal's own development (getAnnexVassalCost, below) so a large vassal costs more to
  // absorb than a small one, matching the plan's own "8 DIP x total dev" shape.
  vassalize: { gold: 300, dip: 20 },
  releaseVassal: { dip: 0 },

  // Plan §M2/§M8.3: identity shifts cost ADM only (gold is gone) — a real decision, priced
  // between a reform and a law change, with its own 5-turn cooldown (IDENTITY_SHIFT_COOLDOWN_TURNS).
  shiftIdentity: { adm: 50 },
  // Priced like Build Defenses — a persistent, steadily-improving region investment of the same shape.
  buildClimateResilience: { gold: 90, adm: 1 },
  // Priced like Gift/Bribe — a direct relations action, but empire-wide rather than one target.
  culturalExport: { gold: 130, dip: 1 }
};

// Plan §M7's line-to-pool mapping, used now (ahead of the fuller M7 tech rework) so a research
// action's flat `power` quantity (ACTION_COSTS.researchTech above) draws from the right one of the
// three pools depending on the tech's own TechCategories value.
export const TECH_RESEARCH_POOL = {
  military: 'mil',
  economy: 'dip',
  science: 'dip',
  infrastructure: 'adm',
  governance: 'adm'
};

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
export const BANKRUPTCY_ESTATE_LOYALTY_PENALTY = 20;
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
  bronze: { key: 'copper', amount: 5 },
  classical: { key: 'copper', amount: 5 },
  kingdoms: { key: 'iron', amount: 8 },
  gunpowder: { key: 'iron', amount: 8 },
  modern: { key: 'oil', amount: 10 }
};
export const RECRUIT_MISSING_RESOURCE_GOLD_PENALTY_MULT = 0.5;

// Fusion Grid (plan §M11 resource sink): "50 helium3 once, then 2/turn upkeep, for +20% production
// nationwide while supplied". This game folds tax/production/trade income into one goldMult hook
// (techTree.js's own header comment on the same trim), so the bonus applies there rather than to a
// production-only multiplier that doesn't exist yet.
export const FUSION_GRID_ACTIVATION_HELIUM3 = 50;
export const FUSION_GRID_UPKEEP_HELIUM3_PER_TURN = 2;
export const FUSION_GRID_GOLD_MULT_BONUS = 0.20;

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
// Counter-Intelligence auto-targets whoever is currently most hostile toward the player (no chosen
// target) and both calms them down and rewards the player for catching the plot.
export const COUNTER_INTEL_HOSTILITY_REDUCTION = 20;
export const COUNTER_INTEL_DIPLOMACY_POINTS_REWARD = 10;

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

// Population Policy's flat per-use growth rate — compounds each time it's used, so early
// investment pays off more over a long game (guns vs. butter, per the plan).
export const POPULATION_POLICY_GROWTH_RATE = 0.1;

// Every ASAT strike raises the shared world orbital debris level by this much; it decays this
// much per turn at rest (resolveTurn.js) — roughly 8 peaceful turns to fully clear one strike's
// worth of debris, so repeated ASAT use compounds if not given time to settle.
export const ASAT_DEBRIS_RISE = 15;
export const ORBITAL_DEBRIS_DECAY_PER_TURN = 2;

// Diplomacy overhaul (plan §M12). Every nation gets these fields (rivals/diplomats/ae/truces/
// vassals) the same "generic reader, player-only writer today" way government/laws/taxRate/estates
// already do — see gameReducer.js's createInitialState comment on that pattern.

// Rivals (plan: "Pick up to 3 from nations of similar strength that border you"). The plan's own
// "+10% prestige gain/turn" and "Humiliate CB" effects have no substrate yet (there's no per-turn
// prestige-GAIN hook — nationalPower.js's prestige is pure decay outside of great-project/event
// one-shots — and casus belli TYPES are M13 work), so the one real, present-day effect ships
// instead: a modest prestige reward when a rival is eliminated (elimination.js already exists).
export const MAX_RIVALS = 3;
export const RIVAL_ELIMINATED_PRESTIGE_REWARD = 5;

// Royal Marriage (plan: "both monarchies... +25 opinion, +10 heir claim"). This game has one
// hostility scalar per nation (not pairwise opinion), so "+25 opinion" becomes "-25 hostility
// toward the player" — the real, existing axis a marriage can actually move.
export const MARRIAGE_HOSTILITY_REDUCTION = 25;
export const MARRIAGE_HEIR_CLAIM_BONUS = 10;

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
// Plan: "+5% x pact count" trade income, replacing the old flat +20 gold/partner (helpers.js).
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
// codebase's real axes (hostility, militaryStrength). Annex opens up after a cooldown, at a DIP
// cost scaling with the vassal's own total development — cheap early, a real commitment for a
// large one.
export const VASSALIZE_HOSTILITY_CEILING = 20;
export const VASSALIZE_STRENGTH_RATIO = 3;
export const VASSAL_ANNEX_COOLDOWN_TURNS = 10;
export const VASSAL_ANNEX_DIP_PER_DEV = 8;
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
export const CAPITAL_OCCUPIED_POOL_PENALTY = 1; // -1 ADM/DIP/MIL per turn while occupied (player only, see resolveTurn.js)
export const CAPITAL_LOST_IN_PEACE_STABILITY_PENALTY = 2;

// Civil war (plan §M15). Pretender rebels reuse REBEL_OWNER_ID (src/data/rebellion.js) for combat —
// a pretender army is just a rebel army with a cause — but mark the regions they seize with
// `occupiedBy` (the same "someone else holds this militarily, ownership hasn't changed" field M13
// wars use) so "holds >= 50% of your regions" is a plain count, not a second tracking structure.
export const CIVIL_WAR_STABILITY_STREAK_TURNS = 3; // plan: "3 consecutive turns at stability -3"
export const CIVIL_WAR_SUCCESSION_CRISIS_CHANCE = 0.4; // plan §M3's own "40% chance" pretender spawn, finally wired
export const CIVIL_WAR_PRETENDER_REGION_SHARE = 0.15;
export const CIVIL_WAR_PRETENDER_STRENGTH_SHARE = 0.15; // vs. the nation's own real fielded strength
export const CIVIL_WAR_HOLD_SHARE_TO_LOSE = 0.5;
export const CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS = 5;
export const CIVIL_WAR_LOSE_PRESTIGE_PENALTY = 20;
export const CIVIL_WAR_CRUSH_STABILITY_REWARD = 1;
export const CIVIL_WAR_CRUSH_LEGITIMACY_REWARD = 10;

// Disasters (plan §M15): four independent 0-100 progress meters, each growing 10/turn while its
// trigger condition holds and decaying 10/turn otherwise (a flat, symmetric rate — the plan gives
// concrete thresholds for the endpoints, not a described curve in between).
export const DISASTER_PROGRESS_STEP = 10;
export const DISASTER_MAX_PROGRESS = 100;
export const ESTATE_TAKEOVER_ADM_DIP_MIL_PENALTY = 2;
export const ESTATE_TAKEOVER_MODIFIER_DURATION_TURNS = 20;
export const ECONOMIC_COLLAPSE_MIN_LOANS = 3;
export const ECONOMIC_COLLAPSE_STABILITY_PENALTY = 2; // on top of applyBankruptcy's own -3
export const SUCCESSION_WAR_LEGITIMACY_THRESHOLD = 30;
export const REVOLUTION_LABOR_LOYALTY_THRESHOLD = 30;

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
