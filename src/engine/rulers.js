// src/engine/rulers.js
// Plan §M3: rulers and advisors. Every nation has one ruler (adm/dip/mil 0-6, 0-2 traits) who
// reigns for a rolled number of real years. When the reign ends a new ruler simply takes over:
// there are no heirs, claims, succession crises or pretenders (master plan decision 37 removed
// succession). A monarchy keeps its royal house's name; any other government gets a new one.
// The government type only biases the new ruler's skills: a Theocracy favours ADM (rolls twice,
// keeps the higher), a Dictatorship floors MIL at 3.
import { getYearsPerTurn } from '../data/ages';
import { generateGivenName, generateDynastyName } from '../data/names';
import { POSITIVE_TRAIT_IDS, NEGATIVE_TRAIT_IDS, TRAITS } from '../data/traits';

/** The skill bias a government type gives a newly rolled ruler ('theocratic', 'autocratic' or null). */
export const rulerStyleFor = (government) => {
  switch (government?.type) {
    case 'theocracy': return 'theocratic';
    case 'dictatorship': return 'autocratic';
    default: return null;
  }
};

// Two dice summed, so most rulers are unremarkable (mean about 3) and a 6 is genuinely rare.
const rollSkill = (rng) => Math.min(6, Math.floor(rng.next() * 4) + Math.floor(rng.next() * 4));

const rollTraits = (rng) => {
  const traits = [];
  const count = Math.floor(rng.next() * 3); // 0-2 traits
  for (let i = 0; i < count; i++) {
    const pool = rng.next() < 0.2 ? NEGATIVE_TRAIT_IDS : POSITIVE_TRAIT_IDS; // 20% chance of a negative trait
    const candidate = pool[Math.floor(rng.next() * pool.length)];
    if (!traits.includes(candidate)) traits.push(candidate);
  }
  return traits;
};

// Turns span fewer real years the further into the game you are (src/data/ages.js): a reign of
// 15-40 real years becomes however many TURNS that is at the current age and speed, clamped to 3-25.
export const reignLengthTurns = (rng, age, gameSpeed) => {
  const years = 15 + Math.floor(rng.next() * 26); // 15-40 real years
  const yearsPerTurn = getYearsPerTurn(age, gameSpeed) || 1;
  return Math.max(3, Math.min(25, Math.round(years / yearsPerTurn)));
};

// The id comes from (nationId, turnNumber), never a mutable counter, so a replay reproduces it.
export const generateRuler = (nationId, rng, { dynasty, turnNumber, age, gameSpeed, style } = {}) => {
  const adm = style === 'theocratic' ? Math.max(rollSkill(rng), rollSkill(rng)) : rollSkill(rng);
  const dip = rollSkill(rng);
  const milRoll = rollSkill(rng);
  const mil = style === 'autocratic' ? Math.max(3, milRoll) : milRoll;
  return {
    id: `ruler_${nationId}_${turnNumber}`,
    name: generateGivenName(nationId, rng),
    dynasty: dynasty || generateDynastyName(nationId, rng),
    adm,
    dip,
    mil,
    traits: rollTraits(rng),
    reignStartTurn: turnNumber,
    reignEndsTurn: turnNumber + reignLengthTurns(rng, age, gameSpeed)
  };
};

// Runs once per nation per turn (resolveTurn.js) and only does anything the turn a reign ends.
// Returns the new ruler, or null. The caller writes it back and logs it.
export const processReignEnd = (nation, rng, { turnNumber, age, gameSpeed }) => {
  if (!nation.ruler || turnNumber < nation.ruler.reignEndsTurn) return null;
  const dynasty = nation.government?.type === 'monarchy' ? nation.ruler.dynasty : generateDynastyName(nation.id, rng);
  return generateRuler(nation.id, rng, { dynasty, turnNumber, age, gameSpeed, style: rulerStyleFor(nation.government) });
};

/** The Log line for a succession (I147): who the reign ended for, how long it lasted, the new
 *  ruler's house, skills and traits. One line per succession; phase RU owns the full history. */
export const successionLine = (prev, next) => {
  const traits = (next.traits || []).map((id) => TRAITS[id]?.name || id);
  const skills = `ADM ${next.adm}, DIP ${next.dip}, MIL ${next.mil}${traits.length ? `; ${traits.join(', ')}` : ''}`;
  const ended = prev ? `${prev.name} of House ${prev.dynasty} reigned ${Math.max(1, next.reignStartTurn - prev.reignStartTurn)} turns. ` : '';
  return `${ended}${next.name} of House ${next.dynasty} now rules (${skills}).`;
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
// could not be told apart). A few tries; the pool is large, so a repeat is rare and the rng stays
// unchanged whenever the first roll is free.
const freshName = (nationId, rng, taken) => {
  let name = generateGivenName(nationId, rng);
  for (let i = 0; i < 8 && taken.has(name); i++) name = generateGivenName(nationId, rng);
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
