// src/engine/rulers.js
// One ruler per major for the whole game (plans/RULER-PLAN.md 2.1, differentiation plan U5): no
// reign, death, heir or house, nothing rolled. The name comes from the people (src/data/peoples.js);
// a legacy-world nation picks one from its culture's pool by a hash of its id. Attributes start
// equal for everyone (src/data/rulers.js) and are capped by the nation's own research age.
// Advisors (plan §M3) follow below.
import { AGE_ORDER } from '../data/ages';
import { RULER_START, attributeCapAt, attributeCost, rulerLevel } from '../data/rulers';
import { VIRTUES, BRANCHES, CAPSTONE_TIER, DOCTRINE_RULER_PLAN, virtueAt, tierAgeIndex } from '../data/rulerVirtues';
import { PEOPLES } from '../data/peoples';
import { generateGivenName, givenNamePool } from '../data/names';
import { hashRoll } from './aftermath';
import { ageIndexOf, ageOf } from './nationState';
import { canSpendDecree, spendDecree } from './decrees';
import { clampStability } from './nationalPower';

export const createRuler = (nationId) => {
  const pool = givenNamePool(nationId);
  const name = PEOPLES[nationId]?.ruler?.name || pool[Math.floor(hashRoll(nationId) * pool.length)];
  return { id: `ruler_${nationId}`, name, ...RULER_START, renown: 0, traits: [] };
};

/** The highest value any attribute of this nation's ruler may reach in its own research age. */
export const attributeCap = (state, nationId) => attributeCapAt(ageIndexOf(state, nationId), AGE_ORDER.length);

// Growth (RULER-PLAN 4.2 to 4.6, differentiation plan U11). Renown (renown.js) fills levels; each
// level past 1 gives an attribute point, every even level and every era legacy a virtue point, plus
// the founding one. Points are derived (earned minus spent), never stored, so they cannot drift.
export const ATTRIBUTES = Object.keys(RULER_START);

export { rulerLevel, VIRTUES };

const attributePointsSpent = (ruler) => ATTRIBUTES.reduce((sum, a) => {
  let s = 0;
  for (let x = RULER_START[a] + 1; x <= (ruler[a] ?? RULER_START[a]); x++) s += attributeCost(x);
  return sum + s;
}, 0);

/** { level, attribute, virtue }: the level and the points waiting to be spent. */
export const rulerPoints = (ruler) => {
  if (!ruler) return { level: 0, attribute: 0, virtue: 0 };
  const level = rulerLevel(ruler.renown);
  const virtueSpent = (ruler.traits || []).reduce((s, id) => s + (VIRTUES[id]?.cost || 0), 0);
  return {
    level,
    attribute: level - 1 - attributePointsSpent(ruler),
    virtue: 1 + Math.floor(level / 2) + (ruler.bonusVirtuePoints || 0) - virtueSpent
  };
};

const rulerOf = (state, nationId) => state.nations?.[nationId]?.ruler;
const withRuler = (state, nationId, ruler) => ({ ...state, nations: { ...state.nations, [nationId]: { ...state.nations[nationId], ruler } } });

/** Why `attr` cannot be raised now (null when it can). */
export const raiseBlock = (state, nationId, attr) => {
  const ruler = rulerOf(state, nationId);
  if (!ruler || !ATTRIBUTES.includes(attr)) return 'No such attribute';
  const next = (ruler[attr] ?? RULER_START[attr]) + 1;
  if (next > attributeCap(state, nationId)) return 'At the cap of this age';
  if (rulerPoints(ruler).attribute < attributeCost(next)) return 'Not enough attribute points';
  return null;
};
export const raiseAttribute = (state, nationId, attr) => (raiseBlock(state, nationId, attr) ? state
  : withRuler(state, nationId, { ...rulerOf(state, nationId), [attr]: (rulerOf(state, nationId)[attr] ?? RULER_START[attr]) + 1 }));

/** Why the virtue cannot be taken now (null when it can). */
export const virtueBlock = (state, nationId, virtueId) => {
  const ruler = rulerOf(state, nationId);
  const virtue = VIRTUES[virtueId];
  if (!ruler || !virtue) return 'No such virtue';
  const taken = ruler.traits || [];
  if (taken.includes(virtueId)) return 'Already taken';
  // Virtue tiers spread over the historical ages; the Future opens no new tier.
  if (ageIndexOf(state, nationId) < tierAgeIndex(virtue.tier, AGE_ORDER.length - 1)) return 'Opens in a later age';
  if (virtue.tier > 1 && !taken.includes(virtueAt(virtue.branch, virtue.tier - 1)?.id)) return 'Needs the tier before it';
  if (virtue.tier === CAPSTONE_TIER && taken.some((id) => VIRTUES[id]?.tier === CAPSTONE_TIER)) return 'One capstone only';
  if (rulerPoints(ruler).virtue < virtue.cost) return 'Not enough virtue points';
  return null;
};
export const takeVirtue = (state, nationId, virtueId) => (virtueBlock(state, nationId, virtueId) ? state
  : withRuler(state, nationId, { ...rulerOf(state, nationId), traits: [...(rulerOf(state, nationId).traits || []), virtueId] }));

/** Is this age's free reshape still unused? */
export const freeReshape = (state, nationId) => !!rulerOf(state, nationId) && rulerOf(state, nationId).reshapeAge !== ageOf(state, nationId);
/** Reshape (RULER-PLAN 4.6, KTD5): attributes back to the start and every virtue returned, to be
 * spent again. Free once an age, else one decree and -1 stability; refused (same state) otherwise. */
export const reshapeRuler = (state, nationId, turn = state.turnNumber) => {
  const nation = state.nations?.[nationId];
  if (!nation?.ruler) return state;
  const free = freeReshape(state, nationId);
  if (!free && !canSpendDecree(nation, 'reshapeRuler')) return state;
  const paid = free ? nation : { ...spendDecree(nation, 'reshapeRuler', turn), stability: clampStability((nation.stability || 0) - 1) };
  const ruler = { ...paid.ruler, ...RULER_START, traits: [], reshapeAge: free ? ageOf(state, nationId) : paid.ruler.reshapeAge };
  return { ...state, nations: { ...state.nations, [nationId]: { ...paid, ruler } } };
};

/** An AI ruler spends every point it can (RULER-PLAN 5), by its doctrine's plan: the next open
 * virtue of the first branch that has one, then the first attribute below the cap. No rng. */
export const aiDevelopRuler = (state, nationId) => {
  const ruler = rulerOf(state, nationId);
  if (!ruler) return state;
  const pts = rulerPoints(ruler);
  if (pts.attribute <= 0 && pts.virtue <= 0) return state;
  const plan = DOCTRINE_RULER_PLAN[state.nations[nationId].doctrine] || DOCTRINE_RULER_PLAN.attrition;
  const branches = [...plan.branches, ...BRANCHES.filter((b) => !plan.branches.includes(b))];
  const attrs = [...plan.attributes, ...ATTRIBUTES.filter((a) => !plan.attributes.includes(a))];
  let s = state;
  for (let guard = 0; guard < 40; guard++) {
    const before = s;
    const taken = rulerOf(s, nationId).traits || [];
    const virtue = branches.map((b) => virtueAt(b, taken.filter((id) => VIRTUES[id]?.branch === b).length + 1)).find((x) => x && !virtueBlock(s, nationId, x.id));
    if (virtue) s = takeVirtue(s, nationId, virtue.id);
    const attr = attrs.find((a) => !raiseBlock(s, nationId, a));
    if (attr) s = raiseAttribute(s, nationId, attr);
    if (s === before) break;
  }
  return s;
};

// Advisors (plan §M3). A hired advisor's only effect is +level to their own power pool
// (src/engine/modifiers/sources.js).
export const ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED = 50;
export const ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED = 2;
export const getAdvisorHireCost = (level) => ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED * level * level;
export const getAdvisorSalary = (level) => ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED * level * level;
/** Why one advisor costs more than another (playtest audits I033): the price and the salary grow
 * with the square of the level, the gain only with the level. One line under each Hire button. */
export const advisorQuoteText = (level, pool, current = null) => {
  const p = String(pool).toUpperCase();
  const replaces = current ? ` Replaces ${current.name} (level ${current.level}, +${current.level} ${p}): no refund.` : '';
  return `+${level} ${p} a turn for ${getAdvisorHireCost(level)} gold now and ${getAdvisorSalary(level)} gold a turn. Price and salary grow with the level squared (${ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED} x level x level).${replaces}`;
};

const ADVISOR_LEVEL_WEIGHTS = [1, 1, 2, 2, 2, 3]; // level 1-3, weighted toward the middle

// A name nobody at court already has (I145: two advisors, or an advisor and the ruler, with one name
// could not be told apart). A few rolls first, so the rng is unchanged whenever the first roll is
// free; if they all repeat, scan the culture's list from the last roll for the first free name, and
// only when the whole list is taken add a numeral. Always unique, always deterministic.
const freshName = (nationId, rng, taken) => {
  let name = generateGivenName(nationId, rng);
  for (let i = 0; i < 8 && taken.has(name); i++) name = generateGivenName(nationId, rng);
  if (taken.has(name)) {
    const pool = givenNamePool(nationId);
    const start = Math.max(0, pool.indexOf(name));
    let free = null;
    for (let k = 0; k < pool.length && free === null; k++) if (!taken.has(pool[(start + k) % pool.length])) free = pool[(start + k) % pool.length];
    if (free !== null) name = free;
    else { let n = 2; while (taken.has(`${name} ${n}`)) n++; name = `${name} ${n}`; }
  }
  taken.add(name);
  return name;
};

const generateOneAdvisor = (nationId, rng, idSuffix, taken = new Set()) => ({
  id: idSuffix,
  name: freshName(nationId, rng, taken),
  level: ADVISOR_LEVEL_WEIGHTS[Math.floor(rng.next() * ADVISOR_LEVEL_WEIGHTS.length)]
});

// Three hire-able candidates per pool, refreshed every ADVISOR_REFRESH_TURNS turns or whenever the
// current one is hired (gameReducer.js's HIRE_ADVISOR).
// `avoid`: names already at court (the ruler, hired advisors), so a new face never shares one.
export const generateAdvisorCandidates = (nationId, rng, avoid = []) => {
  const taken = new Set(avoid.filter(Boolean));
  const make = (pool) => [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_${pool}_${i}`, taken));
  return { adm: make('adm'), dip: make('dip'), mil: make('mil') };
};

/** The names at a nation's court: its ruler, hired advisors and every waiting candidate. */
export const courtNames = (nation, pool = null) => [
  nation?.ruler?.name,
  ...Object.values(nation?.advisors || {}).map((a) => a?.name),
  ...Object.values(pool || {}).flat().map((a) => a?.name)
].filter(Boolean);

export const ADVISOR_REFRESH_TURNS = 5;
