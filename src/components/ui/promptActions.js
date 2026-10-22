// src/components/ui/promptActions.js
// Jump to the thing a "needs you" prompt is about (nextPromptModel.js): a city card, an army sheet,
// the tile of idle settlers, the Research or Peoples tab. Shared by the chips under the top bar and
// the End Turn dock's warning list.
import { openPanelTab, OPEN_SECTION } from '../panels/panelEvents';
import { selectArmy, selectTile, selectRegion, manageCity, focusRegion } from '../map/marchEvents';
import { openTributeDemand, openJoinOffer } from '../independents/independentEvents';
import { showCapture } from '../capture/captureEvents';
import { openResearchChoice, showPeaceOffer, showDefense } from './uiEvents';
import { interactions } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';

const cityName = (state, id) => { const n = state.regions[id]?.name; return n ? nameNow('city', null, n) : tNow('prompt.aCityCap'); };
const peopleName = (state, id) => { const n = state.nations[id]?.name; return n ? nameNow('people', id, n) : tNow('prompt.aPeopleCap'); };

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
  if (p.kind === 'city') { manageCity(p.regionId, 'build'); return; }
  if (p.regionId) selectRegion(p.regionId);
};

/** A short chip label for a prompt (the chips are 32 px tall and narrow on a phone). */
export const chipLabel = (state, p) => {
  if (p.kind === 'city') return tNow('chip.canBuild', { city: cityName(state, p.regionId) });
  if (p.kind === 'army') return tNow('chip.armyIdle');
  if (p.kind === 'settler') return tNow('chip.settlers');
  if (p.kind === 'research') return tNow('chip.research');
  if (p.kind === 'landmark') return tNow('chip.landmark');
  if (p.kind === 'peace') return tNow('chip.peace');
  if (p.kind === 'unrest') return tNow('chip.restless', { city: cityName(state, p.regionId) });
  if (p.kind === 'supply') return tNow('chip.lowSupply');
  if (p.kind === 'war') return tNow('chip.war', { name: peopleName(state, p.nationId) });
  if (p.kind === 'maps') return tNow('chip.mapOffer');
  if (p.kind === 'ruler') return tNow('chip.ruler');
  if (p.kind === 'governor') return tNow('chip.governor', { count: p.count });
  if (p.kind === 'decrees') return tNow('chip.decrees');
  if (p.kind === 'demand') return tNow('chip.demands', { name: peopleName(state, state.pendingDemand?.from) });
  return p.label;
};

/**
 * Open the thing an End Turn blocker (src/engine/turnBlockers.js) is about: the city's Build tab
 * (the map centred on it), the research choice sheet, the Peoples tab on a major's demand, the
 * tribute or join sheet, the peace offer or attack interrupt (untucked). An event and a battle
 * are already on screen; an event about a city centres the map on it.
 */
export const goToBlocker = (state, b) => {
  if (!b) return;
  const t = b.target || {};
  switch (b.action) {
    case 'city': manageCity(t.regionId, 'build'); return;
    case 'research': openResearchChoice(); return;
    case 'diplomacy': openPanelTab('diplomacy'); return;
    case 'tribute': openTributeDemand(t.demandId); return;
    case 'join': openJoinOffer(t.offerId); return;
    case 'peace': showPeaceOffer(); return;
    case 'defense': showDefense(); return;
    case 'capture': showCapture(); return;
    case 'event': interactions.promote('event'); if (t.cityId) focusRegion(t.cityId); return;
    default:
  }
};
