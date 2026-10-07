// src/components/panels/panelEvents.js
// Open a tab of the action panel from anywhere (the research choice sheet, the top bar's science)
// without threading callbacks through the tree. PanelDrawer.jsx listens.
export const OPEN_TAB = 'ti:open-tab';
// The Military tab folded into the Empire sheet (plans/civ-map-rework.md E4): an ask for it opens
// the Empire tab and expands its War section. Diplomacy is its own tab again ("Peoples", W07).
export const TAB_ALIAS = { military: 'domestic' };
export const SECTION_OF_TAB = { military: 'war' };
export const OPEN_SECTION = 'ti:open-section';
export const openPanelTab = (tabId) => {
  window.dispatchEvent(new CustomEvent(OPEN_TAB, { detail: TAB_ALIAS[tabId] || tabId }));
  if (SECTION_OF_TAB[tabId]) window.dispatchEvent(new CustomEvent(OPEN_SECTION, { detail: SECTION_OF_TAB[tabId] }));
};
