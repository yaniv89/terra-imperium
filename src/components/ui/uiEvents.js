// src/components/ui/uiEvents.js
// Open the world's own sheets from anywhere (the top bar, the tab rail, a prompt) without threading
// callbacks through the tree, as panelEvents.js does for the tabs. App.jsx listens.
export const OPEN_NATION_OVERVIEW = 'ti:open-nation-overview';
export const OPEN_SETTINGS = 'ti:open-settings';
export const OPEN_TURN_REPORT = 'ti:open-turn-report';
export const SET_MAP_LENS = 'ti:set-map-lens';

const fire = (name, detail) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })); };

/** The nation overview (W17). */
export const openNationOverview = () => fire(OPEN_NATION_OVERVIEW);
/** The settings sheet (W12). */
export const openSettings = () => fire(OPEN_SETTINGS);
/** The last turn's report (W10). */
export const openTurnReport = () => fire(OPEN_TURN_REPORT);
/** Switch the map lens (lenses.js id), e.g. Research's Map button on a boost. */
export const setMapLens = (lensId) => fire(SET_MAP_LENS, lensId);
// The End Turn button's blockers (src/engine/turnBlockers.js) bring back a sheet the player closed
// or tucked away: the research choice, the peace offer, the attack interrupt.
export const OPEN_RESEARCH_CHOICE = 'ti:open-research-choice';
export const SHOW_PEACE_OFFER = 'ti:show-peace-offer';
export const SHOW_DEFENSE = 'ti:show-defense';
/** The research choice sheet, even after "Later". */
export const openResearchChoice = () => fire(OPEN_RESEARCH_CHOICE);
/** Untuck the peace offer sheet. */
export const showPeaceOffer = () => fire(SHOW_PEACE_OFFER);
/** Untuck the attack interrupt (W14). */
export const showDefense = () => fire(SHOW_DEFENSE);
// Whether the turn report is on screen: prompts that would open over it (the march arrival) wait.
export const TURN_REPORT_SHOWN = 'ti:turn-report-shown';
let reportShown = false;
/** TurnReportSheet tells the rest of the UI when it opens and closes. */
export const setTurnReportShown = (shown) => { reportShown = !!shown; fire(TURN_REPORT_SHOWN, reportShown); };
export const isTurnReportShown = () => reportShown;
