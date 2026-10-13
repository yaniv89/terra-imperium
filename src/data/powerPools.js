// src/data/powerPools.js
// One plain line each for what the three power pools and culture are for (playtest audit CB12,
// "explain ADM / DIP / MIL and culture points where they are shown"). Read by the resource bar
// tooltips, the ruler card and the culture sheet, so the wording lives in one place.
export const POWER_POOL_HELP = {
  adm: {
    name: 'Administrative power',
    earns: 'Earned every turn from a base amount, your ruler\'s ADM skill, an ADM advisor, your government and techs.',
    spends: 'Spent on laws, government changes and reforms, stability, research focus and settling.'
  },
  dip: {
    name: 'Diplomatic power',
    earns: 'Earned every turn from a base amount, your ruler\'s DIP skill, a DIP advisor, your government and techs.',
    spends: 'Spent on treaties, alliances, demands, claims, declaring war and funding scholars.'
  },
  mil: {
    name: 'Military power',
    earns: 'Earned every turn from a base amount, your ruler\'s MIL skill, a MIL advisor, your government and techs.',
    spends: 'Spent on recruiting, hiring generals, launching invasions and naval engagements.'
  }
};

export const POWER_POOLS_SHORT = 'ADM, DIP and MIL bank up each turn (up to a cap) and pay for actions of their kind.';

export const CULTURE_HELP = {
  earns: 'Earned each turn by temple quarters, wonders and governors in your cities.',
  spends: 'Spent automatically to claim the next tile around a city, and it keeps their people loyal.'
};
