// src/components/panels/LogTrigger.jsx
// A small floating button that opens the full log in LogDrawer.jsx (an overlay that takes zero
// layout space while closed), replacing the old always-embedded LogConsole panel. Now that the map
// is the app's full-bleed base layer with no sidebar column left for this to sit at the bottom of
// (plan feedback: "combine the map and the play panel"), it floats over the map instead.
//
// Bug fix (plan feedback: "event logs are floating on place that hid map buttons"): this used to
// sit top-right on mobile (colliding with MapModeToggle + the flat map's zoom controls, both also
// top-right) and bottom-left on desktop (colliding with the MiniMap/MapLegend corner cluster,
// also bottom-left). Every corner of the map is already claimed by something else — top-right
// (mode toggle, zoom), bottom-left (minimap, legend), the whole right edge (PanelDrawer), the
// bottom edge on mobile (PanelDrawer's tab bar) — so this now docks top-CENTER, just under
// GameHeader via the --header-height custom property it publishes, the one spot nothing else uses.
import React from 'react';
import { ScrollText } from 'lucide-react';

const LogTrigger = ({ onClick, unreadCount = 0 }) => (
  <button
    onClick={onClick}
    className="fixed z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/90 backdrop-blur-md
               border border-slate-700 shadow-xl text-slate-300 hover:bg-slate-800 transition-colors
               left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+var(--header-height,4.5rem)+0.5rem)]"
    aria-label="Open event log"
  >
    <ScrollText className="w-4 h-4 text-slate-400 shrink-0" />
    <span className="hidden sm:inline text-xs font-semibold">Event Log</span>
    {unreadCount > 0 && (
      <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </button>
);

export default LogTrigger;
