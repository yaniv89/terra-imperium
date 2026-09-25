// src/engine/score.js
// Plan §M18: "Score = development + regions + tech + prestige + great projects + wars won. The
// same formula applies to the AI." Used both for the END_YEAR final ranking (resolveTurn.js) and
// for the Final Score / Age Summary UI. A pure, cheap-enough-to-run-for-every-nation function —
// no O(nations x regions) blowup, since getOwnedRegionIds is already the memoized index
// src/data/regions.js's own header describes.
import { getOwnedRegionIds } from '../data/regions';
import { getTotalDev } from './development';
import { getResearched } from './nationState';
import { GREAT_PROJECTS, getGreatProjectOwner } from '../data/greatProjects';

// A war counts as "won" for `nationId` once it's closed (not `active`) and the final war-score
// (aggressor POV, set by peace.js/resolveTurn.js's own war-progress rolls and frozen once a war
// closes) favored that side. A white peace or an ongoing war contributes to neither side.
export const getWarsWonCount = (state, nationId) =>
  (state.wars || []).filter((w) => !w.active && (
    (w.aggressor === nationId && (w.score || 0) > 0) ||
    (w.enemy === nationId && (w.score || 0) < 0)
  )).length;

const GREAT_PROJECT_IDS = Object.keys(GREAT_PROJECTS);

export const calcNationScore = (state, nationId) => {
  const ownedRegionIds = getOwnedRegionIds(state.regions, nationId);
  const development = ownedRegionIds.reduce((sum, id) => sum + getTotalDev(state.regions[id]), 0);
  const regions = ownedRegionIds.length;
  const techResearched = getResearched(state, nationId).length;
  const prestige = state.nations[nationId]?.prestige || 0;
  const greatProjects = GREAT_PROJECT_IDS.filter((id) => getGreatProjectOwner(state, id) === nationId).length;
  const warsWon = getWarsWonCount(state, nationId);
  const total = development + regions * 10 + techResearched * 15 + prestige + greatProjects * 50 + warsWon * 100;
  return { nationId, total, development, regions, techResearched, prestige, greatProjects, warsWon };
};

// Every nation in the world, ranked highest score first — ties broken by nation id for a stable,
// deterministic order (matters for the edge-bundle/replay parity tests, which need byte-identical
// results across two independent runs of the same seed).
export const rankNations = (state) =>
  Object.keys(state.nations)
    .map((id) => calcNationScore(state, id))
    .sort((a, b) => (b.total - a.total) || a.nationId.localeCompare(b.nationId));

// 1-indexed: 1 means the player leads the world. Always found, since the player is always a key
// in state.nations.
export const getPlayerRank = (state) => rankNations(state).findIndex((r) => r.nationId === state.playerNationId) + 1;
