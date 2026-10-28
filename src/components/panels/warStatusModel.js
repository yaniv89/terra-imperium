// src/components/panels/warStatusModel.js
// A war with the player in two lines for the enemy's card (lane wars-8: "wars with no clear goal or
// end" in the round 2 playtests): what the war is for (its goal, from the war record) and where the
// score stands against the lines the peace engine uses (diplomacy.js: the AI offers peace from
// PEACE_SCORE_OFFER_THRESHOLD, warns at PEACE_WARN_SCORE and dictates it at PEACE_SCORE_ENFORCE_THRESHOLD).
// Pure; returns i18n keys and vars (keys ws.*).
import { isWarBetween, PEACE_SCORE_OFFER_THRESHOLD, PEACE_SCORE_ENFORCE_THRESHOLD, PEACE_WARN_SCORE } from '../../engine/diplomacy';

export const warStatus = (state, nationId) => {
  const me = state.playerNationId;
  const war = (state.wars || []).find((w) => w.active && isWarBetween(w, me, nationId));
  if (!war) return null;
  const score = war.aggressor === me ? (war.score || 0) : -(war.score || 0);
  const side = war.aggressor === me ? 'You' : 'Them';
  const city = war.goal?.type === 'capture_region' ? state.regions?.[war.goal.regionId] : null;
  const goal = war.goal?.type === 'independence' ? { key: `ws.goalFree${side}` }
    : city ? { key: `ws.goalCity${side}`, vars: { city: city.name } }
      : war.goal?.type === 'destroy_military' ? { key: `ws.goalArmy${side}` } : null;
  const outlook = score <= -PEACE_WARN_SCORE ? { key: 'ws.danger', tone: 'danger' }
    : score <= -PEACE_SCORE_OFFER_THRESHOLD ? { key: 'ws.losing', tone: 'danger' }
      : score >= PEACE_SCORE_OFFER_THRESHOLD ? { key: 'ws.winning', tone: 'good' }
        : { key: 'ws.even', tone: 'muted' };
  return {
    score,
    goal: goal && { ...goal, done: !!war.goalAchieved },
    outlook: { ...outlook, vars: { at: PEACE_SCORE_ENFORCE_THRESHOLD, offer: PEACE_SCORE_OFFER_THRESHOLD } }
  };
};
