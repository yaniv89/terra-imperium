// src/hooks/useIsMobile.js
// "Use the phone/tablet layout": true for the bottom-tab-bar layout ('tablet', which also covers a
// phone in portrait when the player chose to play that way), false for desktop AND for a phone in
// landscape. Landscape phones use the desktop-style side panels (see useLayoutMode.js), because a
// bottom sheet on a 390 px tall screen would cover most of the map. CSS alone (Tailwind's `lg:`
// classes) handles most size changes; this hook is for components whose DEFAULT STATE or structure
// changes (e.g. a bottom sheet instead of a side panel).
import { useLayoutMode } from './useLayoutMode';

export const useIsMobile = () => {
  const mode = useLayoutMode();
  return mode === 'tablet' || mode === 'phone-portrait';
};
