// src/battle/data/economy.js
// The battle economy's catalog (phase R1; plans/MASTER-PLAN.md 6.3, 6.4; RTS plan 6): three
// resources, the resource nodes, the buildings workers raise and the units buildings train. Pure
// data and a few pure helpers; the sim (src/battle/sim/economy.js) and the setup
// (src/battle/setup/economySetup.js) read it.
//
// Three resources (decision 35): food (farms, fishing, herds), materials (wood, stone, metal ore)
// and gold (mines, trade, loot). Amounts in the sim are integer milli-units (1 food = 1000), so a
// worker's small per-tick gain never rounds away (RTS plan 6.1); the UI shows whole units.
//
// One functional set for every age (RTS plan 7.1, master 6.6): the roles and rules are the same in
// every age; only names (and later the art) change. Names are keyed by the age registry
// (src/data/ages.js); an age without its own names uses the default (Bronze, the pilot age).
//
// Art: every building and node names the art-plan item that will replace its placeholder
// (plans/ART-PRODUCTION-PLAN.md batches 04 and 05): `art` is the object in
// src/assets/battle/rts/rts-<age>.glb (S5), `node` art is src/assets/battle/nature/<id>.glb (S9).
// Until those files exist the renderer draws greybox placeholders with the right footprint.
import { secondsToTicks, Q } from '../sim/constants';
import { getAvailableClasses } from '../../data/unitClasses';

export const RESOURCES = ['food', 'materials', 'gold'];
export const MILLI = 1000;
export const toMilli = (n) => Math.round(n * MILLI);

// The population limit of a side, whatever its houses (decision 25: 300 a side).
export const POP_LIMIT = 300;
// Housing (master 6.3): the attacker's expedition camp houses 20 plus 10 per regiment brought (its
// supply train); a village house adds 10; the defender's town hall 20 plus the real city's houses.
export const CAMP_HOUSING = 20;
export const CAMP_HOUSING_PER_REGIMENT = 10;
export const HALL_HOUSING = 20;
export const HOUSE_HOUSING = 10;
// One population per sim entity (squad), the brought regiments included (decision 30). R2's
// regiment-to-representatives mapping (RTS plan 5.1) changes how many entities a regiment is, not
// this rule.
export const POP_PER_SQUAD = 1;

// Workers: gather rates per worker-second before walking (RTS plan 6.1), carry 10.
export const CARRY = toMilli(10);
export const GATHER_PER_SEC = { food: 0.65, materials: 0.6, gold: 0.4 };
export const ORE_RATE_MULT = 0.75;   // metal ore is slower to work than wood or stone
export const FARM_RATE_MULT = 0.7;   // a farm is renewable but slower (RTS plan 6.1)
export const MINE_RATE_MULT = 1.25;  // a mine on its vein: faster, and no walk
export const WORK_REACH = Math.round(1.1 * Q); // a worker works a node or a site from this close (plus its radius)

// Construction (RTS plan 6.2): more builders help with diminishing returns, at most five useful:
// rate(n) = 1 + 0.5 * min(n - 1, 4), counted in halves so it stays integer.
export const buildRateHalves = (n) => (n <= 0 ? 0 : 2 + Math.min(n - 1, 4));
export const CANCEL_REFUND = 0.75;
// Repairs cost materials in proportion to the HP restored (here: a building's materials price per
// its full HP), at a quarter speed while it was hit in the last few seconds.
export const REPAIR_HP_PER_SEC = 12;
export const REPAIR_RECENT_TICKS = secondsToTicks(5);
export const REPAIR_RECENT_MULT_QUARTERS = 1; // of 4

// Where a side may build: near its headquarters, or near a building of its own already standing.
export const BUILD_RADIUS_HQ = 20;    // tiles
export const BUILD_RADIUS_OWN = 10;   // tiles
export const QUEUE_MAX = 20;          // RTS plan 6.4

// Loot (decision 35: gold from loot): a side that destroys an enemy building takes a quarter of
// its price as gold; a razed city building (the region's own) gives the attacker this much.
export const LOOT_SHARE = 0.25;
export const CITY_BUILDING_LOOT = 60;
// Trade: a trade post brings in gold while it stands, up to a fixed amount (no free endless loop).
export const TRADE_GOLD_PER_SEC = 0.5;
export const TRADE_GOLD_MAX = 300;
// The aid post heals friendly squads resting near it.
export const AID_RADIUS = 6 * Q;
export const AID_HEAL_PER_SEC = 0.004;

// Starting stockpiles (RTS plan 6.1, the four accounts folded into three: metal into materials,
// credits into gold), scaled once at setup by the campaign: low supply means a smaller stockpile.
export const START_STOCK = {
  attacker: { food: 250, materials: 350, gold: 150 },
  defender: { food: 300, materials: 450, gold: 200 }
};
/** The setup's stockpile multiplier from campaign supply (0..1) and development (0..1): 0.75 to 1.5. */
export const stockMult = (supply = 1, development = 0) => Math.max(0.75, Math.min(1.5, 0.75 + 0.5 * clamp01(supply) + 0.25 * clamp01(development)));
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// ---- resource nodes (S9) ------------------------------------------------------------------------
// amount in whole units; slots = how many workers can work it at once; rate = gather multiplier.
export const NODE_KINDS = {
  tree: { res: 'materials', amount: 250, slots: 3, rate: 1, label: 'Grove', art: 'nature/vegetation-temperate' },
  stone: { res: 'materials', amount: 500, slots: 4, rate: 1, label: 'Stone', art: 'nature/stone-outcrop' },
  ore: { res: 'materials', amount: 400, slots: 4, rate: ORE_RATE_MULT, label: 'Metal ore', art: 'nature/ore-outcrop' },
  gold: { res: 'gold', amount: 400, slots: 4, rate: 1, label: 'Gold vein', art: 'nature/gold-vein' },
  herd: { res: 'food', amount: 300, slots: 3, rate: 1, label: 'Herd', art: 'nature/herd-sheep-goat' },
  cattle: { res: 'food', amount: 450, slots: 3, rate: 1, label: 'Cattle', art: 'nature/herd-cattle' },
  fish: { res: 'food', amount: 350, slots: 3, rate: 0.9, label: 'Fish', art: 'nature/fish-shoal' }
};

// ---- buildings (S5) -----------------------------------------------------------------------------
// cost { food, materials, gold }, time (one-builder seconds), hp, size (footprint in tiles, square),
// what it does: housing, dropoff (resources it takes), trains (unit roles), and the art object.
export const BUILDINGS = {
  camp: { size: 4, hp: 2500, cost: null, time: 0, dropoff: RESOURCES, trains: ['worker'], art: 'rts/bronze/expedition-camp', icon: 'build-expedition-camp', hq: true },
  hall: { size: 3, hp: 0, cost: null, time: 0, dropoff: RESOURCES, trains: ['worker'], art: 'rts/bronze/town-hall', icon: 'build-town-hall', hq: true }, // the keep is the town hall (its HP)
  house: { size: 2, hp: 400, cost: { materials: 30 }, time: 15, housing: HOUSE_HOUSING, art: 'battle-city/<age>/<theme>/houses (kit houses)', icon: 'build-house' },
  foodDepot: { size: 2, hp: 600, cost: { materials: 60 }, time: 20, dropoff: ['food'], art: 'rts/bronze/food-depot', icon: 'build-food-depot' },
  materialsYard: { size: 2, hp: 600, cost: { materials: 60 }, time: 20, dropoff: ['materials'], art: 'rts/bronze/materials-yard', icon: 'build-materials-yard' },
  tradePost: { size: 3, hp: 700, cost: { materials: 80, gold: 20 }, time: 30, dropoff: ['gold'], trade: true, art: 'rts/bronze/trade-post', icon: 'build-trade-post' },
  farm: { size: 3, hp: 300, cost: { materials: 50 }, time: 15, farm: true, slots: 2, art: 'rts/bronze/farm-plot', icon: 'build-farm-plot' },
  mine: { size: 2, hp: 700, cost: { materials: 80 }, time: 25, mine: true, art: 'rts/bronze/mine', icon: 'build-mine' },
  barracks: { size: 3, hp: 1200, cost: { materials: 150 }, time: 40, trains: ['infantry'], art: 'rts/bronze/barracks', icon: 'build-barracks' },
  range: { size: 3, hp: 1100, cost: { materials: 150, gold: 30 }, time: 40, trains: ['ranged'], art: 'rts/bronze/range', icon: 'build-range' },
  stable: { size: 4, hp: 1300, cost: { materials: 200, gold: 60 }, time: 50, trains: ['cavalry'], art: 'rts/bronze/stable', icon: 'build-stable' },
  siegeWorkshop: { size: 4, hp: 1300, cost: { materials: 220, gold: 100 }, time: 60, trains: ['siege'], art: 'rts/bronze/siege-workshop', icon: 'build-siege-workshop' },
  aidPost: { size: 3, hp: 900, cost: { materials: 120, gold: 40 }, time: 35, trains: ['support'], aid: true, art: 'rts/bronze/aid-post', icon: 'build-aid-post' },
  tower: { size: 2, hp: 1000, cost: { materials: 120, gold: 40 }, time: 45, tower: { range: 7 * Q, damage: 14, attackTicks: secondsToTicks(1.5) }, art: 'rts/bronze/tower', icon: 'build-tower' }
};
// The build menu's order (what a worker may raise).
export const BUILDABLE = ['house', 'foodDepot', 'materialsYard', 'farm', 'mine', 'tradePost', 'barracks', 'range', 'stable', 'siegeWorkshop', 'aidPost', 'tower'];

// Units a building trains (RTS plan 6.4, at this sim's scale: a trained squad is a company of
// TRAIN_STRENGTH, a fifth of a full regiment; a worker is one squad of WORKER_STRENGTH that does
// not fight). Trained squads are local auxiliaries in R1 (RTS plan 6.5): they fight for this battle
// and demobilise after it; R2 adds campaign-authorized recruits through escrow.
export const TRAIN_STRENGTH = 200;
export const WORKER_STRENGTH = 25;
export const UNITS = {
  worker: { cost: { food: 50 }, time: 12, strength: WORKER_STRENGTH },
  infantry: { cost: { food: 60, materials: 30 }, time: 20, strength: TRAIN_STRENGTH },
  ranged: { cost: { food: 50, materials: 40, gold: 10 }, time: 22, strength: TRAIN_STRENGTH },
  cavalry: { cost: { food: 80, materials: 40, gold: 40 }, time: 28, strength: TRAIN_STRENGTH },
  siege: { cost: { materials: 120, gold: 60 }, time: 40, strength: TRAIN_STRENGTH },
  support: { cost: { food: 60, materials: 60 }, time: 25, strength: TRAIN_STRENGTH }
};

// Names by age (the age registry's ids); `default` is the Bronze set.
const NAMES = {
  default: {
    camp: 'Expedition camp', hall: 'Town hall', house: 'Village house', foodDepot: 'Food depot', materialsYard: 'Materials yard',
    tradePost: 'Trade post', farm: 'Farm', mine: 'Mine', barracks: 'Barracks', range: 'Archery range', stable: 'Chariot yard',
    siegeWorkshop: 'Siege workshop', aidPost: 'Aid post', tower: 'Tower', worker: 'Laborer'
  },
  kingdoms: { stable: 'Stable', worker: 'Villager' },
  classical: { stable: 'Stable' },
  gunpowder: { range: 'Musketry yard', stable: 'Stable', siegeWorkshop: 'Gun foundry', camp: 'Headquarters tent' },
  modern: { range: 'Firing range', stable: 'Vehicle works', siegeWorkshop: 'Artillery park', camp: 'Command camp', hall: 'Headquarters', worker: 'Engineer', aidPost: 'Field hospital' }
};
export const ecoName = (id, ageId) => NAMES[ageId]?.[id] || NAMES.default[id] || id;

/** Cost as an integer milli map { food, materials, gold }. */
export const costMilli = (cost) => Object.fromEntries(RESOURCES.map((r) => [r, toMilli(cost?.[r] || 0)]));
export const costTotal = (cost) => RESOURCES.reduce((s, r) => s + (cost?.[r] || 0), 0);
export const buildTicks = (id) => secondsToTicks(BUILDINGS[id].time);
export const trainTicks = (role) => secondsToTicks(UNITS[role].time);

/** Which unit roles a side of this age can train in battle (the campaign's own age gates). */
export const trainableRoles = (ageId) => {
  const classes = getAvailableClasses(ageId);
  return ['worker', ...['infantry', 'ranged', 'cavalry', 'siege', 'support'].filter((c) => classes.includes(c))];
};
/** Which buildings a side of this age can raise (one that trains nothing it may train is left out). */
export const buildableFor = (ageId) => {
  const roles = trainableRoles(ageId);
  return BUILDABLE.filter((id) => !BUILDINGS[id].trains || BUILDINGS[id].trains.some((r) => roles.includes(r)));
};
