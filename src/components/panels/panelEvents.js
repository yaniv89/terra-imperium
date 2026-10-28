// src/components/panels/panelEvents.js
// Open a tab of the action panel from anywhere (the research choice sheet, the top bar's science)
// without threading callbacks through the tree. PanelDrawer.jsx listens.
export const OPEN_TAB = 'ti:open-tab';
// The Military tab folded into the Empire sheet (plans/civ-map-rework.md E4): an ask for it opens
// the Empire tab and expands its War section. Diplomacy is its own tab again ("Peoples", W07).
export const TAB_ALIAS = { military: 'domestic' };
export const SECTION_OF_TAB = { military: 'war' };
export const OPEN_SECTION = 'ti:open-section';
// Pick a people on the Peoples tab (a first-contact card, the next-step chip). DiplomacyPanel listens.
export const OPEN_PEOPLE = 'ti:open-people';
// An ask made while its panel is still opening (the tab mounts after the event): the section or
// panel takes it when it mounts (newcomer playtest: the governor prompt lost its section). UI time only.
const pending = {};
const ask = (event, id) => { pending[event] = { id, at: Date.now() }; window.dispatchEvent(new CustomEvent(event, { detail: id })); };
/** The id asked for `event` in the last two seconds (and, with `match`, only one it accepts), else
 *  null. Not consumed: a dev StrictMode remount reads it twice; it lapses on its own. */
export const takePending = (event, match) => {
  const p = pending[event];
  return !p || Date.now() - p.at > 2000 || (match && !match(p.id)) ? null : p.id;
};
/** Open and scroll to a CollapsibleSection by its id; 'court.governors' scrolls to its data-testid="governors" block. */
export const openSection = (id) => ask(OPEN_SECTION, id);
// Tuck the tab dock / phone sheet away so the map is clear (Research's Map button). PanelDrawer listens.
export const CLOSE_PANELS = 'ti:close-panels';
export const closePanels = () => window.dispatchEvent(new CustomEvent(CLOSE_PANELS));
export const openPanelTab =(tabId) => {
  window.dispatchEvent(new CustomEvent(OPEN_TAB, { detail: TAB_ALIAS[tabId] || tabId }));
  if (SECTION_OF_TAB[tabId]) openSection(SECTION_OF_TAB[tabId]);
};
/** The Peoples tab on one people. */
export const openPeople = (nationId) => { openPanelTab('diplomacy'); ask(OPEN_PEOPLE, nationId); };
