// src/engine/succession.js
// Plan §M3: ruler/heir generation and succession. Government in this codebase is still the flat
// 10-type model (src/data/government.js) — M8's reform-tier rework (Monarchy/Republic/Theocracy/
// Dictatorship, each with its own succession flavor) hasn't happened yet, so succession style here
// is bucketed from today's real government ids instead of the plan's eventual government TYPE:
// hereditary (monarchy/feudal/empire/absolutist/constitutional — the heir succeeds), elective
// (republic/democracy/federation — a fresh "elected" ruler, no heir carried), autocratic
// (autocracy — the next ruler is rerolled favoring a high MIL stat), and tribal/none (no government
// adopted yet — a fresh ruler, no heir, no dynasty continuity). Revisit this bucketing once M8
// actually ships government TYPES rather than 10 flat ids.
import { getYearsPerTurn } from '../data/ages';
import { generateGivenName, generateDynastyName } from '../data/names';
import { POSITIVE_TRAIT_IDS, NEGATIVE_TRAIT_IDS } from '../data/traits';

const HEREDITARY_GOVERNMENTS = ['monarchy', 'feudal', 'empire', 'absolutist', 'constitutional'];
const AUTOCRATIC_GOVERNMENTS = ['autocracy'];

export const getSuccessionStyle = (governmentId) => {
  if (HEREDITARY_GOVERNMENTS.includes(governmentId)) return 'hereditary';
  if (AUTOCRATIC_GOVERNMENTS.includes(governmentId)) return 'autocratic';
  if (governmentId) return 'elective'; // republic, democracy, federation
  return 'tribal'; // null/tribal: no government adopted yet
};

// A triangular-ish distribution centered on 2-3 (roll two dice, keep the lower-weighted sum) so
// most rulers are unremarkable and a 5-6 is genuinely rare, matching the plan's "mean ~2.5" spec
// without needing a real triangular-distribution sampler.
const rollSkill = (rng) => Math.min(6, Math.floor(rng.next() * 4) + Math.floor(rng.next() * 4));

const rollTraits = (rng) => {
  const traits = [];
  const count = Math.floor(rng.next() * 3); // 0-2, matching the plan's "roll 0-2 traits"
  for (let i = 0; i < count; i++) {
    const pool = rng.next() < 0.2 ? NEGATIVE_TRAIT_IDS : POSITIVE_TRAIT_IDS; // 20% chance of a negative trait
    const candidate = pool[Math.floor(rng.next() * pool.length)];
    if (!traits.includes(candidate)) traits.push(candidate);
  }
  return traits;
};

// Turns span fewer real years the further into the game you are (src/data/ages.js) — a reign
// rolled in real years is converted to however many TURNS that spans at the nation's current age/
// speed, clamped so a reign is never a single blink nor an implausible multi-age marathon.
export const reignLengthTurns = (rng, age, gameSpeed) => {
  const years = 15 + Math.floor(rng.next() * 26); // 15-40 real years
  const yearsPerTurn = getYearsPerTurn(age, gameSpeed) || 1;
  return Math.max(3, Math.min(25, Math.round(years / yearsPerTurn)));
};

// Deterministic from (nationId, turnNumber) rather than a mutable module counter — this codebase's
// replay-determinism guarantee (resolveTurn.test.js's "byte-identical results" test) requires every
// generated id to be reproducible from state alone, the same way rebel unit ids already are
// (elimination.js's `rebel_${regionId}_${turnNumber}` pattern). Only one ruler AND one heir are
// ever generated for a given nation on a given turn, so this pairing is always unique.
export const generateRuler = (nationId, rng, { dynasty, turnNumber, age, gameSpeed } = {}) => ({
  id: `ruler_${nationId}_${turnNumber}`,
  name: generateGivenName(nationId, rng),
  dynasty: dynasty || generateDynastyName(nationId, rng),
  adm: rollSkill(rng),
  dip: rollSkill(rng),
  mil: rollSkill(rng),
  traits: rollTraits(rng),
  reignStartTurn: turnNumber,
  reignEndsTurn: turnNumber + reignLengthTurns(rng, age, gameSpeed),
  isRegency: false
});

// A hereditary heir's claim (0-100) governs how smooth their eventual succession is (see
// processSuccession below) — a low-claim or missing heir is what the plan's succession crisis
// framing is about; the crisis EVENT itself is M17's job (event content), this only produces the
// raw claim number that content would react to.
export const generateHeir = (nationId, rng, dynasty, turnNumber) => ({
  id: `heir_${nationId}_${turnNumber}`,
  name: generateGivenName(nationId, rng),
  dynasty,
  adm: rollSkill(rng),
  dip: rollSkill(rng),
  mil: rollSkill(rng),
  traits: rollTraits(rng),
  claim: 40 + Math.floor(rng.next() * 61) // 40-100: a generated heir is never a near-certain crisis
});

// Advisors (plan §M3). A hired advisor's ONLY mechanical effect here is +level to their own power
// pool (src/engine/modifiers/sources.js) — the plan's own per-advisor flavor bonus table (e.g. "-10%
// building cost", "+1 diplomat") names systems M6/M12 haven't built yet; faking those onto hooks
// that don't exist would be worse than the honest, working +level-only version this ships instead.
export const ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED = 50;
export const ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED = 2;
export const getAdvisorHireCost = (level) => ADVISOR_HIRE_GOLD_PER_LEVEL_SQUARED * level * level;
export const getAdvisorSalary = (level) => ADVISOR_SALARY_GOLD_PER_LEVEL_SQUARED * level * level;

const ADVISOR_LEVEL_WEIGHTS = [1, 1, 2, 2, 2, 3]; // level 1-3, weighted toward the middle

// Three hire-able candidates per pool, refreshed every ADVISOR_REFRESH_TURNS turns or whenever the
// current one is hired (gameReducer.js's HIRE_ADVISOR). `pool` is purely which power pool this
// candidate would boost if hired — the name/level generation itself doesn't depend on it.
export const generateAdvisorCandidates = (nationId, rng) => ({
  adm: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_adm_${i}`)),
  dip: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_dip_${i}`)),
  mil: [0, 1, 2].map((i) => generateOneAdvisor(nationId, rng, `adv_mil_${i}`))
});

const generateOneAdvisor = (nationId, rng, idSuffix) => ({
  id: idSuffix,
  name: generateGivenName(nationId, rng),
  level: ADVISOR_LEVEL_WEIGHTS[Math.floor(rng.next() * ADVISOR_LEVEL_WEIGHTS.length)]
});

export const ADVISOR_REFRESH_TURNS = 5;

// Runs once per nation per turn (resolveTurn.js), and only does anything the turn a reign actually
// ends. Returns { ruler, heir } — the caller (resolveTurn.js) is what actually writes these back
// onto the nation and appends the log line, keeping this module a pure generator with no state
// dependency beyond what's passed in.
export const processSuccession = (nation, rng, { turnNumber, age, gameSpeed }) => {
  if (!nation.ruler || turnNumber < nation.ruler.reignEndsTurn) return null;

  const style = getSuccessionStyle(nation.government);
  const dynasty = nation.ruler.dynasty;

  if (style === 'hereditary' && nation.heir) {
    const newRuler = {
      ...nation.heir,
      reignStartTurn: turnNumber,
      reignEndsTurn: turnNumber + reignLengthTurns(rng, age, gameSpeed),
      isRegency: false
    };
    return { ruler: newRuler, heir: generateHeir(nation.id, rng, dynasty, turnNumber), crisis: newRuler.claim < 20 };
  }

  // Elective/autocratic/tribal, or hereditary with no heir (a real succession crisis per the
  // plan) — either way, a fresh ruler with no continuing claim to carry over. A hereditary
  // government keeps its OWN dynasty name rather than rolling a new one (the line continues, even
  // if this particular heir failed); every other style gets a new dynasty entirely.
  const nextDynasty = style === 'hereditary' ? dynasty : generateDynastyName(nation.id, rng);
  const ruler = generateRuler(nation.id, rng, { dynasty: nextDynasty, turnNumber, age, gameSpeed });
  return { ruler, heir: style === 'hereditary' ? generateHeir(nation.id, rng, nextDynasty, turnNumber) : null, crisis: style === 'hereditary' };
};
