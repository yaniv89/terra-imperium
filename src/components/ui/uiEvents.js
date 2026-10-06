// src/components/ui/uiEvents.js
// Open the world's own sheets from anywhere (the top bar, the tab rail, a prompt) without threading
// callbacks through the tree, as panelEvents.js does for the tabs. App.jsx listens.
export const OPEN_NATION_OVERVIEW = 'ti:open-nation-overview';
export const OPEN_SETTINGS = 'ti:open-settings';
export const OPEN_TURN_REPORT = 'ti:open-turn-report';

const fire = (name, detail) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })); };

/** The nation overview (W17). */
export const openNationOverview = () => fire(OPEN_NATION_OVERVIEW);
/** The settings sheet (W12). */
export const openSettings = () => fire(OPEN_SETTINGS);
/** The last turn's report (W10). */
export const openTurnReport = () => fire(OPEN_TURN_REPORT);
