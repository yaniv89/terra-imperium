// src/engine/rulers.js
// Plan §M3: rulers and advisors. Every nation has one ruler (adm/dip/mil 0-6, 0-2 traits) who
// reigns for a rolled number of real years. When the reign ends a new ruler simply takes over:
// there are no heirs, claims, succession crises or pretenders (master plan decision 37 removed
// succession). A monarchy keeps its royal house's name; any other government gets a new one.
// The government type only biases the new ruler's skills: a Theocracy favours ADM (rolls twice,
// keeps the higher), a Dictatorship floors MIL at 3.
import { getYearsPerTurn } from '../data/ages';
import { generateGivenName, generateDynastyName } from '../data/names';
import { POSITIVE_TRAIT_IDS, NEGATIVE_TRAIT_IDS } from '../data/traits';

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

// Advisors (plan §M3). A hired advisor's only effect is +level to their own power pool
// (src/engine/modifiers/sources.js).
export const ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED = 50;
export const ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED = 2;
export const getAdvisorHireCost = (level) => ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED * level * level;
export const getAdvisorSalary = (level) => ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED * level * level;

const ADVISOR_LEVEL_WEIGHTS = [1, 1, 2, 2, 2, 3]; // level 1-3, weighted toward the middle

const generateOneAdvisor = (nationId, rng, idSuffix) => ({
  id: idSuffix,
  name: generateGivenName(nationId, rng),
  level: ADVISOR_LEVEL_WEIGHTS[Math.floor(rng.next() * ADVISOR_LEVEL_WEIGHTS.length)]
});

// Three hire-able candidates per pool, refreshed every ADVISOR_REFRESH_TURNS turns or whenever the
// current one is hired (gameReducer.js's HIRE_ADVISOR).
export const generateAdvisorCandidates = (nationId, rng) => ({
  adm: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_adm_${i}`)),
  dip: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_dip_${i}`)),
  mil: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_mil_${i}`))
});

export const ADVISOR_REFRESH_TURNS = 5;
