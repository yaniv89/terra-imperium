// src/engine/peopleNames.js
// Keeps the names of a peoples world current (phase W0, master plan section 4), run after every
// action by gameReducer:
//   - a nation's `name` is its title by government and size (src/data/nationTitles.js), so every
//     screen and log line that prints `nation.name` shows "Kingdom of Akkad" once Akkad crowns a
//     king, and "the Akkadian Empire" at 15 cities;
//   - every new military unit of a people gets its regiment number (`unit.regiment`, numbered per
//     nation and unit kind in `nation.regiments`), so it reads "3rd Akkadian Spearmen" for life.
// Names only: no rule reads them. Legacy worlds (mode 'full' or 'emergent') are left alone.
// Returns the same state when nothing changed (the reducer's no-op checks stay valid).
import { titleFor } from '../data/nationTitles';
import { PEOPLES } from '../data/peoples';
import { regimentKind } from '../data/regimentNames';
import { isSettler } from './settlers';

export const refreshPeopleNames = (state, prev = null) => {
  if (state?.scenario?.mode !== 'peoples') return state;
  let nations = null;
  if (!prev || state.nations !== prev.nations || state.regions !== prev.regions) {
    const cities = {};
    Object.values(state.regions || {}).forEach((c) => { if (c?.owner) cities[c.owner] = (cities[c.owner] || 0) + 1; });
    Object.entries(state.nations).forEach(([id, n]) => {
      const people = PEOPLES[n.people];
      if (!people) return;
      const title = titleFor(people, n.government?.type || 'tribal', cities[id] || 0);
      if (title !== n.name) { nations ||= { ...state.nations }; nations[id] = { ...n, name: title }; }
    });
  }
  let units = null;
  if (!prev || state.units !== prev.units) {
    Object.values(state.units || {}).forEach((u) => {
      if (u.regiment || isSettler(u) || u.ownerId == null) return;
      const nation = (nations || state.nations)[u.ownerId];
      if (!nation?.people) return;
      const kind = regimentKind(u);
      const n = (nation.regiments?.[kind] || 0) + 1;
      nations ||= { ...state.nations };
      nations[u.ownerId] = { ...nation, regiments: { ...(nation.regiments || {}), [kind]: n } };
      units ||= { ...state.units };
      units[u.id] = { ...u, regiment: n };
    });
  }
  if (!nations && !units) return state;
  return { ...state, ...(nations ? { nations } : {}), ...(units ? { units } : {}) };
};
