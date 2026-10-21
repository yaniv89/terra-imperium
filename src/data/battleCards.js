// src/data/battleCards.js
// U23: campaign battle cards. A won event can grant the player a card (`effects.battleCard` in
// applyEventEffects.js): an input modifier that battleInputs.js applies to the next battle, so the
// commanded battle and Auto read the same change (master plan 6.1). A card lives on the nation as
// `battleCards: [{ id, expires }]`, lasts `refTurns` reference turns (speedTurns, never a fixed
// count) and is spent by the first battle that nation fights (battleOutcome.js).
//   own   changes the card holder's units: `supply` (0..100) is raised to at least that value
//   foe   changes the units that fight the holder: `moraleLoss` morale off their start
// Morale still floors at MIN_START_MORALE (battleInputs.js), so a card alone never routs a unit.
import { speedTurns } from './ages';

export const BATTLE_CARDS = {
  supplyDepot: { id: 'supplyDepot', refTurns: 12, own: { supply: 100 } },
  traitor: { id: 'traitor', refTurns: 12, foe: { moraleLoss: 15 } },
  scouted: { id: 'scouted', refTurns: 20, foe: { moraleLoss: 8 } }
};

export const cardsOf = (nation) => nation?.battleCards || [];

/** The cards `nation` can use on `turn`. */
export const activeCards = (nation, turn) => cardsOf(nation).filter((c) => BATTLE_CARDS[c.id] && c.expires >= turn);

/** The nation with `cardId` added (one of each kind: a second grant renews it). `age`: the age waits run at. */
export const grantBattleCard = (nation, cardId, { turn, speed, age }) => {
  const def = BATTLE_CARDS[cardId];
  if (!nation || !def) return nation;
  const card = { id: cardId, expires: turn + speedTurns(def.refTurns, speed, age) };
  return { ...nation, battleCards: [...cardsOf(nation).filter((c) => c.id !== cardId), card] };
};

/** The nation after a battle: its cards are spent (and any that ran out go too). */
export const spendBattleCards = (nation) => {
  if (!cardsOf(nation).length) return nation;
  return { ...nation, battleCards: [] };
};
