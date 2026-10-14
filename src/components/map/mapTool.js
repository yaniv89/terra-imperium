// src/components/map/mapTool.js
// Which map tool has its bar up (the march bar, the settle bar): written on <html> as
// data-map-tool while it shows, so the rest of the screen can make room for it (index.css: the
// map's hint and goals step aside on a phone held sideways, playtest audit I083).
import { useEffect } from 'react';

export const useMapToolFlag = (name, on) => {
  useEffect(() => {
    if (!on || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    root.dataset.mapTool = name;
    return () => { if (root.dataset.mapTool === name) delete root.dataset.mapTool; };
  }, [name, on]);
};
