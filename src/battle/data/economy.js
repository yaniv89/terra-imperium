// src/battle/data/economy.js
// The battle economy's catalog (phase R1; plans/MASTER-PLAN.md 6.3, 6.4; RTS plan 6): four
// resources, the resource nodes, the buildings workers raise and the units buildings train. Pure
// data and a few pure helpers; the sim (src/battle/sim/economy.js) and the setup
// (src/battle/setup/economySetup.js) read it.
//
// Four resources (the user's Q1 of 13 October 2026, replacing decision 35's three; U01): food
// (farms, fishing, herds, berries), wood (every tree on the field, W12), stone (stone outcrops) and gold (veins, trade, loot).
// "Materials" and metal ore are retired: every ore spot is a stone node, in every age (X29). Stone
// is its own stock with its own prices: towers, the trade post and the siege workshop, and the
// repair of the city's walls, gates, towers and keep. Amounts in the sim are integer milli-units
// (1 food = 1000), so a worker's small per-tick gain never rounds away (RTS plan 6.1); the UI shows
// whole units.
//
// Barrows (X32, a drawing rule only, the sim's load is CARRY for every resource): a laborer wheels
// food and stone home in a barrow (bulky and heavy) and carries wood and gold on the back
// (src/battle/art/workerLoads.js usesBarrow).
//
// One functional set for every age (RTS plan 7.1, master 6.6): the roles and rules are the same in
// every age; only names (and later the art) change. Names are keyed by the age registry
// (src/data/ages.js); an age without its own names uses the default (Bronze, the pilot age).
//
// Art (plans/ART-MODELS-PLAN.md 5 and 7, D8): a building's `art` is its role, the object in the
// age's src/assets/battle/rts/rts-<age>.glb (S5); buildingArt() resolves it per age, falling back
// to the nearest earlier age with a file, then a later one, then the greybox (ages.js artAgeFor). A node's `art` is its file
// src/assets/battle/nature/<id>.glb (S9); a grove's 'vegetation' is the battle's vegetation kit.
// Until those files exist the renderer draws greybox placeholders with the right footprint.
import { secondsToTicks, Q } from '../sim/constants';
import { artAgeFor } from '../../data/ages';
import { getAvailableClasses } from '../../data/unitClasses';

export const RESOURCES = ['food', 'wood', 'stone', 'gold'];
/** A resource's index in a stock array (`w.eco.stock[side][RES_INDEX.stone]`). */
export const RES_INDEX = Object.fromEntries(RESOURCES.map((r, i) => [r, i]));
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
// How a side spreads its laborers when it puts one to work by itself (a new laborer, an emptied node).
export const WORKER_MIX = { food: 0.4, wood: 0.3, stone: 0.15, gold: 0.15 };
// U24: the shares a side can choose by one tap (balanced is the default mix above).
export const WORKER_PRESETS = {
  balanced: WORKER_MIX,
  food: { food: 0.6, wood: 0.2, stone: 0.1, gold: 0.1 },
  wood: { food: 0.2, wood: 0.6, stone: 0.1, gold: 0.1 },
  stone: { food: 0.2, wood: 0.2, stone: 0.5, gold: 0.1 },
  gold: { food: 0.2, wood: 0.2, stone: 0.1, gold: 0.5 }
};
export const GATHER_PER_SEC = { food: 0.65, wood: 0.6, stone: 0.5, gold: 0.4 };
export const FARM_RATE_MULT = 0.7;   // a farm is renewable but slower (RTS plan 6.1)
export const MINE_RATE_MULT = 1.25;  // a mine on its vein: faster, and no walk
export const WORK_REACH = Math.round(1.1 * Q); // a worker works a node or a site from this close (plus its radius)

// Construction (RTS plan 6.2): more builders help with diminishing returns, at most five useful:
// rate(n) = 1 + 0.5 * min(n - 1, 4), counted in halves so it stays integer.
export const buildRateHalves = (n) => (n <= 0 ? 0 : 2 + Math.min(n - 1, 4));
export const CANCEL_REFUND = 0.75;
// Repairs cost in proportion to the HP restored: a building of the economy its wood and stone price
// per its full HP, a work of the city (wall, gate, tower, keep) stone, a tenth of a stone per HP
// (CITY_REPAIR_STONE_PER_HP); at a quarter speed while it was hit in the last few seconds.
export const REPAIR_HP_PER_SEC = 12;
export const REPAIR_RECENT_TICKS = secondsToTicks(5);
export const REPAIR_RECENT_MULT_QUARTERS = 1; // of 4
export const CITY_REPAIR_STONE_PER_HP = 0.1;

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

// Starting stockpiles (RTS plan 6.1; U01: the old materials split into wood and stone, the same
// total), scaled once at setup by the campaign: low supply means a smaller stockpile. Every side
// starts with stone and has stone nodes in its starter cluster, so a stone-poor map still builds.
export const START_STOCK = {
  attacker: { food: 250, wood: 250, stone: 100, gold: 150 },
  defender: { food: 300, wood: 300, stone: 150, gold: 200 }
};
/** The setup's stockpile multiplier from campaign supply (0..1) and development (0..1): 0.75 to 1.5. */
export const stockMult = (supply = 1, development = 0) => Math.max(0.75, Math.min(1.5, 0.75 + 0.5 * clamp01(supply) + 0.25 * clamp01(development)));
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// ---- resource nodes (S9) ------------------------------------------------------------------------
// amount in whole units; slots = how many workers can work it at once; rate = gather multiplier.
// No `ore`: metal ore is not a resource (Q1, X29); the setup places stone where ore stood.
// Every tree is wood (W12, the user's ruling of 16 October 2026): the forest tiles of a WOOD_CELL
// square are one `tree` node (economySetup.js woodNodes) holding TREE_WOOD a tree, its `trees` (the
// forest tiles, in the order they are felled) and `cut` (how many are down: drawn as stumps). The
// `amount` below is one tree's.
export const TREE_WOOD = 80;
export const WOOD_CELL = 5;
/** How many laborers a wood of `trees` trees takes at once. */
export const woodSlots = (trees) => Math.min(6, Math.max(2, Math.ceil(trees / 3)));
export const NODE_KINDS = {
  tree: { res: 'wood', amount: TREE_WOOD, slots: 2, rate: 1, label: 'Woods', art: 'vegetation' },
  berries: { res: 'food', amount: 200, slots: 3, rate: 0.9, label: 'Berry bushes', art: 'berry-bushes' },
  stone: { res: 'stone', amount: 500, slots: 4, rate: 1, label: 'Stone', art: 'stone-outcrop' },
  gold: { res: 'gold', amount: 400, slots: 4, rate: 1, label: 'Gold vein', art: 'gold-vein' },
  herd: { res: 'food', amount: 300, slots: 3, rate: 1, label: 'Herd', art: 'herd-sheep-goat' },
  cattle: { res: 'food', amount: 450, slots: 3, rate: 1, label: 'Cattle', art: 'herd-cattle' },
  fish: { res: 'food', amount: 350, slots: 3, rate: 0.9, label: 'Fish', art: 'fish-shoal' }
};

// ---- buildings (S5) -----------------------------------------------------------------------------
// cost { food, wood, stone, gold }, time (one-builder seconds), hp, size (footprint in tiles, square),
// what it does: housing, dropoff (resources it takes), trains (unit roles), and the art object.
// The `materialsYard` id stays (its art object and icon are `materials-yard`); it is the yard that
// takes wood and stone.
export const BUILDINGS = {
  camp: { size: 4, hp: 2500, cost: null, time: 0, dropoff: RESOURCES, trains: ['worker'], art: 'expedition-camp', icon: 'build-expedition-camp', hq: true },
  hall: { size: 3, hp: 0, cost: null, time: 0, dropoff: RESOURCES, trains: ['worker'], art: 'town-hall', icon: 'build-town-hall', hq: true }, // the keep is the town hall (its HP)
  house: { size: 2, hp: 400, cost: { wood: 30 }, time: 15, housing: HOUSE_HOUSING, art: 'house', icon: 'build-house' },
  foodDepot: { size: 2, hp: 600, cost: { wood: 60 }, time: 20, dropoff: ['food'], art: 'food-depot', icon: 'build-food-depot' },
  materialsYard: { size: 2, hp: 600, cost: { wood: 60 }, time: 20, dropoff: ['wood', 'stone'], art: 'materials-yard', icon: 'build-materials-yard' },
  tradePost: { size: 3, hp: 700, cost: { wood: 60, stone: 20, gold: 20 }, time: 30, dropoff: ['gold'], trade: true, art: 'trade-post', icon: 'build-trade-post' },
  farm: { size: 3, hp: 300, cost: { wood: 50 }, time: 15, farm: true, slots: 2, art: 'farm-plot', icon: 'build-farm-plot' },
  mine: { size: 2, hp: 700, cost: { wood: 80 }, time: 25, mine: true, art: 'mine', icon: 'build-mine' },
  barracks: { size: 3, hp: 1200, cost: { wood: 150 }, time: 40, trains: ['infantry'], art: 'barracks', icon: 'build-barracks' },
  range: { size: 3, hp: 1100, cost: { wood: 150, gold: 30 }, time: 40, trains: ['ranged'], art: 'range', icon: 'build-range' },
  stable: { size: 4, hp: 1300, cost: { wood: 200, gold: 60 }, time: 50, trains: ['cavalry'], art: 'stable', icon: 'build-stable' },
  siegeWorkshop: { size: 4, hp: 1300, cost: { wood: 180, stone: 40, gold: 100 }, time: 60, trains: ['siege'], art: 'siege-workshop', icon: 'build-siege-workshop' },
  aidPost: { size: 3, hp: 900, cost: { wood: 120, gold: 40 }, time: 35, trains: ['support'], aid: true, art: 'aid-post', icon: 'build-aid-post' },
  tower: { size: 2, hp: 1000, cost: { wood: 30, stone: 90, gold: 20 }, time: 45, tower: { range: 7 * Q, damage: 14, attackTicks: secondsToTicks(1.5) }, art: 'tower', icon: 'build-tower' }
};
/**
 * A building's art in an age: { ageId, file, object, id } with the file of `ageId` or the nearest
 * earlier age for which `hasFile(age)` says a rts-<age>.glb exists, or null (the greybox).
 */
export const buildingArt = (id, ageId, hasFile = () => false) => {
  const role = BUILDINGS[id]?.art;
  const a = role ? artAgeFor(hasFile, ageId) : null;
  return a ? { ageId: a, file: `rts-${a}`, object: role, id: `rts/${a}/${role}` } : null;
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
  infantry: { cost: { food: 60, wood: 30 }, time: 20, strength: TRAIN_STRENGTH },
  ranged: { cost: { food: 50, wood: 40, gold: 10 }, time: 22, strength: TRAIN_STRENGTH },
  cavalry: { cost: { food: 80, wood: 40, gold: 40 }, time: 28, strength: TRAIN_STRENGTH },
  siege: { cost: { wood: 120, gold: 60 }, time: 40, strength: TRAIN_STRENGTH },
  support: { cost: { food: 60, wood: 60 }, time: 25, strength: TRAIN_STRENGTH }
};

// Names by age (the age registry's ids); `default` is the Bronze set.
const NAMES = {
  default: {
    camp: 'Expedition camp', hall: 'Town hall', house: 'Village house', foodDepot: 'Food depot', materialsYard: 'Wood and stone yard',
    tradePost: 'Trade post', farm: 'Farm', mine: 'Mine', barracks: 'Barracks', range: 'Archery range', stable: 'Chariot yard',
    siegeWorkshop: 'Siege workshop', aidPost: 'Aid post', tower: 'Tower', worker: 'Laborer'
  },
  // Stone (eight ages plan, Appendix C); no stable: Stone has no cavalry to train.
  stone: {
    camp: 'Fire Circle', hall: 'Longhouse', house: 'Hut', foodDepot: 'Storage Pit', materialsYard: 'Stone Pile', tradePost: 'Barter Ground',
    farm: 'Garden Plot', mine: 'Flint Pit', barracks: 'Warrior Lodge', range: "Hunters' Camp", siegeWorkshop: 'Ladder Yard', aidPost: "Healer's Hut", tower: 'Lookout'
  },
  kingdoms: { stable: 'Stable', worker: 'Villager' },
  classical: { stable: 'Stable' },
  gunpowder: { range: 'Musketry yard', stable: 'Stable', siegeWorkshop: 'Gun foundry', camp: 'Headquarters tent' },
  modern: { range: 'Firing range', stable: 'Vehicle works', siegeWorkshop: 'Artillery park', camp: 'Command camp', hall: 'Headquarters', worker: 'Engineer', aidPost: 'Field hospital' },
  // Information (eight-ages plan Appendix C, U58)
  information: {
    camp: 'Headquarters', hall: 'Command Post', house: 'Housing Block', foodDepot: 'Supply Depot', materialsYard: 'Logistics Yard', tradePost: 'Market',
    farm: 'Agri-Plant', mine: 'Mine', barracks: 'Barracks', range: 'Firing Range', stable: 'Motor Pool', siegeWorkshop: 'Artillery Park',
    aidPost: 'Field Hospital', tower: 'Radar Tower', worker: 'Engineer'
  }
};
export const ecoName = (id, ageId) => NAMES[ageId]?.[id] || NAMES.default[id] || id;

/** Cost as an integer milli map { food, wood, stone, gold }. */
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
