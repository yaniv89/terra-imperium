// src/engine/rulers.js
// One ruler per major for the whole game (plans/RULER-PLAN.md 2.1, differentiation plan U5): no
// reign, death, heir or house, nothing rolled. The name comes from the people (src/data/peoples.js);
// a legacy-world nation picks one from its culture's pool by a hash of its id. Attributes start
// equal for everyone (src/data/rulers.js) and are capped by the nation's own research age.
// Advisors (plan §M3) follow below.
import { AGE_ORDER } from '../data/ages';
import { RULER_START, attributeCapAt } from '../data/rulers';
import { PEOPLES } from '../data/peoples';
import { generateGivenName, givenNamePool } from '../data/names';
import { hashRoll } from './aftermath';
import { ageIndexOf } from './nationState';

export const createRuler = (nationId) => {
  const pool = givenNamePool(nationId);
  const name = PEOPLES[nationId]?.ruler?.name || pool[Math.floor(hashRoll(nationId) * pool.length)];
  return { id: `ruler_${nationId}`, name, ...RULER_START };
};

/** The highest value any attribute of this nation's ruler may reach in its own research age. */
export const attributeCap = (state, nationId) => attributeCapAt(ageIndexOf(state, nationId), AGE_ORDER.length);

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
