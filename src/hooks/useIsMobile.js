// src/hooks/useIsMobile.js
// "Use the bottom-bar layout": true for a phone or a tablet held upright, false for desktop AND
// for a phone or tablet held sideways. Those use the landscape shell (see useLayoutMode.js), because
// a bottom sheet on a 390 px tall screen would cover most of the map. CSS alone (Tailwind's `lg:`
// classes) handles most size changes; this hook is for components whose DEFAULT STATE or structure
// changes (e.g. a bottom sheet instead of a side panel).
import { useLayoutMode } from './useLayoutMode';

export const useIsMobile = () => {
  const mode = useLayoutMode();
  return mode === 'tablet-portrait' || mode === 'phone-portrait';
};
