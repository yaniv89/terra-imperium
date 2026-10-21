// src/components/panels/legacyModel.js
// What the Legacy panel and the game-over screen show of the legacy score (differentiation plan U17):
// the player's parts grouped by age, the rank among majors and the top rivals. Pure.
import { AGE_ORDER } from '../../data/ages';
import { legacyScore } from '../../engine/legacy';
import { rankNations } from '../../engine/score';

export const legacyModel = (state, rivals = 3) => {
  const me = state.playerNationId;
  const { total, parts } = legacyScore(state, me);
  const byAge = new Map();
  parts.forEach((p) => {
    const row = byAge.get(p.ageId) || { ageId: p.ageId, points: 0, counts: {} };
    row.points += p.points;
    row.counts[p.reason] = (row.counts[p.reason] || 0) + 1;
    byAge.set(p.ageId, row);
  });
  const ages = [...byAge.values()].sort((a, b) => AGE_ORDER.indexOf(a.ageId) - AGE_ORDER.indexOf(b.ageId));
  const ranked = rankNations(state);
  const top = ranked.filter((r) => r.nationId !== me).slice(0, rivals).map((r) => ({ nationId: r.nationId, legacy: r.legacy }));
  return { total, ages, rank: ranked.findIndex((r) => r.nationId === me) + 1, of: ranked.length, top };
};
