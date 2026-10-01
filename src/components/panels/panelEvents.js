// src/components/panels/panelEvents.js
// Open a tab of the action panel from anywhere (the research choice sheet, the top bar's research
// pill) without threading callbacks through the tree. PanelDrawer.jsx listens.
export const OPEN_TAB = 'ti:open-tab';
export const openPanelTab = (tabId) => window.dispatchEvent(new CustomEvent(OPEN_TAB, { detail: tabId }));
