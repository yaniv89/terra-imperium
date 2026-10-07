// src/components/ui/promptActions.js
// Jump to the thing a "needs you" prompt is about (nextPromptModel.js): a city card, an army sheet,
// the tile of idle settlers, the Research or Peoples tab. Shared by the chips under the top bar and
// the End Turn dock's warning list.
import { openPanelTab, OPEN_SECTION } from '../panels/panelEvents';
import { selectArmy, selectTile, selectRegion } from '../map/marchEvents';

export const goToPrompt = (state, p) => {
  if (!p) return;
  if (p.kind === 'guide') {
    const me = state.playerNationId;
    if (p.target === 'tech' || p.target === 'diplomacy') { openPanelTab(p.target); return; }
    if (p.target === 'settler') { const s = Object.values(state.units).find((u) => u.ownerId === me && u.classId === 'settler'); if (s?.tile != null) { selectTile(s.tile); return; } }
    if (p.target === 'army') { const a = Object.values(state.units).find((u) => u.ownerId === me && u.domain === 'land' && u.classId !== 'settler'); if (a?.tile != null) { selectArmy(a.tile); return; } }
    const cap = state.nations[me]?.capitalRegionId;
    if (cap) selectRegion(cap);
    return;
  }
  if (p.tab) { openPanelTab(p.tab); if (p.section) window.dispatchEvent(new CustomEvent(OPEN_SECTION, { detail: p.section })); return; }
  if (p.kind === 'army' || p.kind === 'supply') { selectArmy(p.tile); return; }
  if (p.kind === 'settler') { selectTile(p.tile); return; }
  if (p.regionId) selectRegion(p.regionId);
};

/** A short chip label for a prompt (the chips are 32 px tall and narrow on a phone). */
export const chipLabel = (state, p) => {
  if (p.kind === 'city') return `${state.regions[p.regionId]?.name || 'A city'} can build`;
  if (p.kind === 'army') return 'Army idle';
  if (p.kind === 'settler') return 'Settlers wait';
  if (p.kind === 'research') return 'Choose research';
  if (p.kind === 'peace') return 'Peace offer';
  if (p.kind === 'unrest') return `${state.regions[p.regionId]?.name || 'A city'} is restless`;
  if (p.kind === 'supply') return 'Army low on supply';
  if (p.kind === 'demand') return `${state.nations[state.pendingDemand?.from]?.name || 'A people'} demands`;
  return p.label;
};
