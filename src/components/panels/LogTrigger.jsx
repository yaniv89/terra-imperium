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
// bottom edge on mobile (PanelDrawer's tab bar). On desktop this docks top-center, under
// GameHeader — the one spot nothing else uses there. Plan feedback asked for it on the LEFT side
// specifically on mobile, so below `lg` it docks top-left instead (also clear of everything —
// mobile never shows a top-left RegionInfoModal corner card, only a bottom sheet).
import React from 'react';
import { ScrollText } from 'lucide-react';

// Hidden on a phone held sideways: the log opens from the tab rail there (PanelDrawer.jsx).
const LogTrigger = ({ onClick, unreadCount = 0 }) => (
  <button
    onClick={onClick}
    className="fixed z-20 flex items-center gap-2 px-3 min-h-[40px] rounded-full bg-fa-panel/95
               border border-fa-line shadow-xl text-fa-text hover:bg-fa-raised transition-colors
               right-3 top-[calc(var(--header-height,2.25rem)+0.5rem)]
               lg:hidden pl:hidden"
    aria-label="Open event log"
  >
    <ScrollText className="w-4 h-4 text-fa-muted shrink-0" />
    <span className="hidden sm:inline text-xs font-semibold">Event Log</span>
    {unreadCount > 0 && (
      <span className="text-[10px] font-bold text-fa-ink bg-fa-text px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </button>
);

export default LogTrigger;
