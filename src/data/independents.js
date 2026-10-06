// src/data/independents.js
// Independent cities, the data (plans/independent-cities.md sections 3 and 14.2, phase W1;
// plans/MASTER-PLAN.md sections 2, 3 and 7 row 6).
//
// An independent is a nation record with `kind: 'independent'`: one city of a people that is not
// one of the world's major nations. It holds its city and a small border, grows up to a size cap,
// keeps a garrison, and never settles, expands, declares wars or joins pacts. Anyone may attack it
// without a war (src/engine/hostility.js canFight). Phase W2 gives it its own AI: raids, sacks,
// grudges, tribute and mercenaries (src/engine/raids.js, mercenaries.js, grudges.js; numbers below).
//
// Pure data and small pure functions: no engine imports, so diplomacy.js, aiLogic.js and the map
// can all read `isIndependent` without an import cycle.
import { AGE_ORDER } from './ages';

export const INDEPENDENT_KIND = 'independent';

/** True for an independent's nation record (or for an id, given the nations map). */
export const isIndependentNation = (nation) => nation?.kind === INDEPENDENT_KIND;
export const isIndependent = (nations, id) => !!id && isIndependentNation(nations?.[id]);

/** A world of majors and independents (the peoples world of phase W0, or any world that holds an
 * independent): every major is Tier 1 there (independents 5, master plan section 3 "AI tiers"),
 * since 24 to 42 thinking nations are affordable once the rest are independents. */
export const everyMajorThinks = (state) => state?.scenario?.mode === 'peoples' || !!state?.scenario?.independents;

// ---------------------------------------------------------------------------------------------
// Size, border, garrison (independents 3.2, 3.4)

/** An independent's city grows to 4 + the age's rank (Bronze 4 ... Modern 8), never past 9. */
export const INDEPENDENT_SIZE_BASE = 4;
export const INDEPENDENT_SIZE_MAX = 9;
export const independentSizeCap = (ageId = 'bronze') => Math.min(INDEPENDENT_SIZE_MAX, INDEPENDENT_SIZE_BASE + Math.max(0, AGE_ORDER.indexOf(ageId)));

/** Its border reaches this far from the city (the plan's 2 rings at frequency 75, in km: master plan
 * section 3, "Distances"); about 3 rings at frequency 100. */
export const INDEPENDENT_BORDER_KM = 204;

/** Garrison target: 1 + floor(size / 2) land units, x1.5 for a Fortress (rounded down). */
export const FORTRESS_GARRISON_MULT = 1.5;
export const garrisonTarget = (size = 1, personality = 'tribal') => {
  const base = 1 + Math.floor(Math.max(1, size) / 2);
  return personality === 'fortress' ? Math.floor(base * FORTRESS_GARRISON_MULT) : base;
};

/** Taking an independent's city costs half the usual aggressive expansion (independents 5, 6). */
export const INDEPENDENT_CONQUEST_AE_MULT = 0.5;

// ---------------------------------------------------------------------------------------------
// Personalities (independents 3.3). Assigned once, from the land around the city: W1 stores and
// shows them; W2 reads them (raid reach, chance, reserve, tribute, mercenaries); trade comes with W3.

export const PERSONALITY_IDS = ['raiders', 'mercantile', 'fortress', 'tribal'];
export const PERSONALITIES = {
  raiders: { id: 'raiders', name: 'Raiders', badge: '#c2410c', where: 'steppe, desert, cold coasts' },
  mercantile: { id: 'mercantile', name: 'Mercantile', badge: '#ca8a04', where: 'river mouths, coasts, oases' },
  fortress: { id: 'fortress', name: 'Fortress', badge: '#57534e', where: 'mountains, hills, forest highlands' },
  tribal: { id: 'tribal', name: 'Tribal', badge: '#15803d', where: 'everywhere else' }
};
/** The mix the plan aims for at Dawn (checked by a test over the peoples pool, loosely). */
export const PERSONALITY_MIX_TARGET = { raiders: 0.25, mercantile: 0.2, fortress: 0.15, tribal: 0.4 };

// Tuned on the 150-people pool to the plan's mix: 60 tribal, 38 raiders, 30 mercantile, 22 fortress.
const FORTRESS_MOUNTAINS_NEAR = 5; // a high city with this many mountain neighbours is a stronghold (the grid marks much of the uplands as mountains)
const MERCANTILE_HARBOUR_SHARE = 0.25; // the share of plain coasts and rivers that trade
const DRY = new Set(['BSh', 'BSk', 'BWh', 'BWk']);
const COLD = new Set(['Dfc', 'Dfd', 'Dsc', 'Dsd', 'Dwc', 'Dwd', 'ET', 'EF']);

// Deterministic 0..1 from a string (FNV-1a), the same roll as aftermath.js hashRoll.
const roll = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};

/**
 * The personality of an independent whose city stands on `tile` (`tiles`: the grid, data/geo/tiles.js).
 * Reads the city tile and its neighbours, first match wins:
 *   fortress    the city on hills or mountains with FORTRESS_MOUNTAINS_NEAR mountain neighbours,
 *               or on forested high ground ringed by hills and mountains
 *   raiders     a dry climate (steppe or desert: B climates), or a cold coast
 *   mercantile  an oasis, or a coast or river (a river mouth: both) with a seeded roll for a plain
 *               coast or a plain river, so not every harbour is a trading city
 *   tribal      everything else
 * `key` (the people id) seeds the roll.
 */
export const personalityFor = (tiles, tile, key = '') => {
  if (tile == null || tile < 0) return 'tribal';
  const relief = tiles.reliefOf(tile);
  const ring = tiles.neighbors[tile] || [];
  const mountainRing = ring.filter((n) => tiles.reliefOf(n) === 'mountains').length;
  const highRing = mountainRing + ring.filter((n) => tiles.reliefOf(n) === 'hills').length;
  if ((relief === 'mountains' || relief === 'hills') && (mountainRing >= FORTRESS_MOUNTAINS_NEAR || (highRing === ring.length && tiles.featureOf(tile) === 'forest'))) return 'fortress';
  const climate = tiles.climateNames?.[tiles.climate?.[tile]];
  const coastal = tiles.coastal?.[tile] === 1 || ring.some((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake');
  if (DRY.has(climate) || (coastal && COLD.has(climate))) return 'raiders';
  const river = ring.some((n) => tiles.riverBetween(tile, n));
  if (tiles.featureOf(tile) === 'oasis') return 'mercantile';
  if (coastal && river) return 'mercantile';
  if ((coastal || river) && roll(`${key}|mercantile`) < MERCANTILE_HARBOUR_SHARE) return 'mercantile';
  return 'tribal';
};

// ---------------------------------------------------------------------------------------------
// Names (independents 14.2): the people's name plus a form by personality and age band.
// "{people}" is the adjective ("the Colchian tribes"), "{city}" the city's name.

export const AGE_BAND = { bronze: 'early', classical: 'early', kingdoms: 'early', gunpowder: 'middle', modern: 'modern' };
export const INDEPENDENT_TITLE_FORMS = {
  tribal: { early: 'the {people} tribes', middle: 'the {people} confederacy', modern: 'the {people} autonomous region' },
  raiders: { early: 'the {people} horde', middle: 'the {people} horde', modern: '{people} militias' },
  seaRaiders: { early: '{people} sea raiders', middle: 'the {people} corsairs', modern: '{people} pirates' },
  mercantile: { early: 'the free city of {city}', middle: 'the merchant republic of {city}', modern: 'the city-state of {city}' },
  fortress: { early: '{city} stronghold', middle: 'the {people} free state', modern: 'the {people} free state' }
};
/** Free cities (breakaway cities, independents 14.4) by age band. */
export const FREE_CITY_FORMS = { early: 'the free city of {city}', middle: 'the republic of {city}', modern: 'the free state of {city}' };

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** An independent's shown name. `adjective`: the people's adjective ("Colchian"); `seaRaiders`: a
 * raiders people on a cold coast. */
export const independentTitle = ({ adjective, cityName, personality = 'tribal', ageId = 'bronze', seaRaiders = false, freeCity = false }) => {
  const band = AGE_BAND[ageId] || 'early';
  const form = freeCity ? FREE_CITY_FORMS[band] : (INDEPENDENT_TITLE_FORMS[personality === 'raiders' && seaRaiders ? 'seaRaiders' : personality] || INDEPENDENT_TITLE_FORMS.tribal)[band];
  return capitalise(form.replaceAll('{people}', adjective || cityName || 'Free').replaceAll('{city}', cityName || adjective || 'the city'));
};

// ---------------------------------------------------------------------------------------------
// Art (plans/ART-PRODUCTION-PLAN.md on claude/bronze-towns, phase W1 rows). Until the art lands
// the map draws the placeholder the plan allows: a plain dot in the personality's badge colour,
// and no town dressing (the land theme's town alone). These are the paths the real art will use.

/** How the map draws an independent's land: its colour muted toward slate, its border band dashed
 * (the placeholder for the plan's hatched border, independents 7, until W4). */
export const INDEPENDENT_MUTE = 0.55;
export const INDEPENDENT_MUTE_TO = '#64748b';
export const INDEPENDENT_BAND_DASH = '3 2';
export const mutedIndependentColour = (hex) => {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return INDEPENDENT_MUTE_TO;
  const a = parseInt(hex.slice(1), 16); const b = parseInt(INDEPENDENT_MUTE_TO.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - INDEPENDENT_MUTE) + ((b >> s) & 255) * INDEPENDENT_MUTE);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};

export const INDEPENDENT_ART = {
  /** Personality shields, S1 icons: `icons/independents/<personality>`. */
  shieldIcon: (personality) => `src/assets/icons/independents/${personality}.svg`,
  /** Town dressings, S13 map attachments: `independents/<band>/<personality>-dressing`. */
  townDressing: (personality, band = 'early') => `src/assets/map/independents/${band}/${personality}-dressing.glb`
};

// ---------------------------------------------------------------------------------------------
// Phase W2: the independents' own AI (independents 4, master plan 6.5 and decision 38).
// The engine is src/engine/raids.js (the AI, raids, sacks, tribute), src/engine/mercenaries.js
// and src/engine/grudges.js. Every number here is one table to tune with the balance-sim.

/** Each independent thinks every THINK_PERIOD turns, staggered by its id (independents 4.1). */
export const THINK_PERIOD = 3;

/** How far it raids, in km (the plan's rings at frequency 75: raiders 6 to 8, tribal 4 to 5,
 * fortress 3; a mercantile city never raids). */
export const RAID_KM = { raiders: 714, tribal: 459, fortress: 306, mercantile: 0 };
/** Turns between two raids (fortress: only in revenge, a grudge of FORTRESS_REVENGE_GRUDGE). */
export const RAID_COOLDOWN = { raiders: 6, tribal: 10, fortress: 10, mercantile: Infinity };
/** The chance a raid starts once a target clears RAID_THRESHOLD (x the difficulty against the
 * player, x (1 + grudge / 100)). */
export const RAID_CHANCE = { raiders: 0.6, tribal: 0.35, fortress: 0.5, mercantile: 0 };
export const FORTRESS_REVENGE_GRUDGE = 40;
/** Land units it keeps above its garrison target for raiding (the raid party). */
export const RAID_RESERVE = { raiders: 2, tribal: 1, fortress: 1, mercantile: 0 };
/** score = loot x (1 + grudge / 50) x era / (1 + defenders near / party) - RAID_RING_PENALTY per
 * RAID_RING_PENALTY_KM of distance; a raid needs RAID_THRESHOLD. */
export const RAID_THRESHOLD = 6;
export const RAID_RING_PENALTY = 2;
export const RAID_RING_PENALTY_KM = 102;
/** A raid that has not reached its target in this many turns goes home. */
export const RAID_MAX_TURNS = 8;
/** After a lost battle or a raid gone wrong: no raids for this long (mood 'recovering'). */
export const RAID_RECOVER_TURNS = 5;
/** A party that meets an enemy army on its way fights it only when this much stronger, else goes home. */
export const RAID_FIGHT_RATIO = 1.2;
/** Late ages raid less (independents 3.4): insurgents and militias. */
export const RAID_ERA_FACTOR = { bronze: 1, classical: 1, kingdoms: 1, gunpowder: 0.8, modern: 0.5 };

/** Loot, in gold (independents 4.3). An improvement: the threat.js RAID_GOLD of a pillage. A trade
 * route tile: PLUNDER_GOLD x 2 (plunder.js), taken from the victim, and the route is cut while the
 * party stands on it. A settler is killed (no captives, decision 37). An outpost is burned (it
 * loses OUTPOST_BURN_LOSS of its progress). */
export const ROUTE_LOOT = 30;
export const SETTLER_LOOT = 20;
export const OUTPOST_LOOT = 20;
/** Sack (independents 4.4, master plan 6.5 and 6.8): raiders that beat a city whose garrison is
 * under SACK_GARRISON_RATIO x the party take SACK_INCOME_TURNS turns of its gold (at least
 * SACK_MIN_GOLD), and the city loses one size and one building tier, never more than half of
 * either (the 50% rule). The city is never captured. */
export const SACK_GARRISON_RATIO = 0.5;
export const SACK_INCOME_TURNS = 3;
export const SACK_MIN_GOLD = 15;
/** A sacked city or a burned outpost is left alone this many turns (no raid twice on the same ashes). */
export const RAID_SPARE_TURNS = 20;
/** A burned outpost loses this share of its progress (it is set back, not wiped out). */
export const OUTPOST_BURN_LOSS = 0.5;

/** Its treasury: its city's gold yield a turn (x MERCANTILE_GOLD_MULT for a mercantile city),
 * capped. Loot, tribute and mercenary pay go in; the mercenaries it hires come out. */
export const INDEPENDENT_GOLD_CAP = 400;
export const MERCANTILE_GOLD_MULT = 2;

/** Grudges (independents 4.5): 0..GRUDGE_MAX per nation, -GRUDGE_DECAY a turn. */
export const GRUDGE_MAX = 100;
export const GRUDGE_DECAY = 2;
export const GRUDGE_ATTACKED = 20;      // they killed its units or pillaged its land
export const GRUDGE_KIN_CITY = 40;      // they took the city of an independent of the same art theme (its kin)
export const GRUDGE_REFUSED = 20;       // they refused its tribute, or stopped paying

/** Tribute (independents 4.5): raiders and tribal demand gold from a neighbour they outweigh or
 * hate: tributeGold a turn (2 + the age's rank) for TRIBUTE_TURNS turns; the payer is never raided
 * meanwhile (a truce both ways, hostility.js). */
export const TRIBUTE_TURNS = 20;
export const TRIBUTE_DEMAND_GRUDGE = 40;
export const TRIBUTE_STRENGTH_RATIO = 1.5;
export const TRIBUTE_DEMAND_CHANCE = 0.15;
export const TRIBUTE_DEMAND_COOLDOWN = 20;  // turns between two demands to the same nation
export const TRIBUTE_ANSWER_TURNS = 3;      // the player's answer; silence is a refusal
export const tributeGold = (ageId = 'bronze') => 2 + Math.max(0, AGE_ORDER.indexOf(ageId));

/** Mercenaries (independents 5, master plan 6.7): mercantile and raiders independents sell bands
 * of one unit, MERC_STOCK at most, one more every MERC_RESTOCK_TURNS. A band costs mercPrice at
 * once and mercUpkeep every turn (paid to the seller), and leaves after MERC_CONTRACT_TURNS, or at
 * once when the upkeep goes unpaid. A buyer needs a city within MERC_KM of the seller and a grudge
 * under MERC_MAX_GRUDGE. */
export const MERC_SELLERS = ['mercantile', 'raiders'];
export const MERC_STOCK = 2;
export const MERC_RESTOCK_TURNS = 10;
export const MERC_CONTRACT_TURNS = 20;
export const MERC_KM = 1224;
export const MERC_MAX_GRUDGE = 50;
export const mercPrice = (ageId = 'bronze') => 60 + 25 * Math.max(0, AGE_ORDER.indexOf(ageId));
export const mercUpkeep = (ageId = 'bronze') => 3 + Math.max(0, AGE_ORDER.indexOf(ageId));
/** The AI: a major at war (or raided in the last MERC_AI_RAIDED_TURNS turns) with MERC_AI_GOLD_MULT x
 * the price in gold hires a band, at most
 * MERC_AI_MAX at once, thinking every MERC_AI_PERIOD turns. */
export const MERC_AI_GOLD_MULT = 2;
export const MERC_AI_RAIDED_TURNS = 10; // a major raided this recently hires too, at peace
export const MERC_AI_MAX = 2;
export const MERC_AI_PERIOD = 5;
