// src/data/powerPools.js
// One plain explanation each for the three power pools and for culture (playtest audit I018 / I034,
// "explain ADM / DIP / MIL and culture points where they are shown"). Read by the resource bar
// tooltips, the ruler card, the advisor cards and the culture sheet, so the wording lives in one
// place. No number is typed here: every figure comes from the same constants the engine reads.
import { BASE_POWER_PER_TURN } from '../utils/helpers';
import { CULTURE_BASE, CULTURE_PER_SIZE, CULTURE_PER_TIER } from '../engine/world/cities';

export const POWER_POOL_HELP = {
  adm: {
    name: 'Administrative power',
    earns: `Every turn: ${BASE_POWER_PER_TURN} base, plus your ruler's ADM skill, an ADM advisor, your government and techs.`,
    short: 'pays for laws, reforms, stability and city actions',
    spends: 'Pays for laws, government changes and reforms, Increase Stability, research focus, moving the capital, founding cities, city upkeep actions (quell unrest, gain control, policies) and Develop Tax.'
  },
  dip: {
    name: 'Diplomatic power',
    earns: `Every turn: ${BASE_POWER_PER_TURN} base, plus your ruler's DIP skill, a DIP advisor, your government, techs, satellites and space missions. Some events give a lump sum.`,
    short: 'pays for treaties, claims, war declarations and spies',
    spends: 'Pays for treaties, alliances, marriages, demands, claims, declaring war, vassals, spies, funding scholars, space launches and Develop Production.'
  },
  mil: {
    name: 'Military power',
    earns: `Every turn: ${BASE_POWER_PER_TURN} base, plus your ruler's MIL skill, a MIL advisor, your government and techs.`,
    short: 'pays for recruiting, generals, invasions and battles at sea',
    spends: 'Pays for recruiting, hiring generals, invasions, naval engagements, putting down rebellions, missiles and Develop Manpower.'
  }
};

export const POWER_POOLS_SHORT = 'ADM, DIP and MIL are saved from turn to turn, so you can save up for a big reform or spend them as they come. Each pays for actions of its kind.';

// Culture is not a power point: it is a per-city bank that buys border tiles.
export const CULTURE_HELP = {
  earns: `Each city makes ${CULTURE_BASE} a turn, plus ${CULTURE_PER_SIZE} per size, ${CULTURE_PER_TIER} per level of its Culture buildings, and more from the capital, Temple Quarters and a governor.`,
  spends: 'Each city saves its own culture and spends it by itself to claim the cheapest tile next to its border. It never buys anything else.'
};
