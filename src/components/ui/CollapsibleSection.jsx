// src/components/ui/CollapsibleSection.jsx
// A collapsible header+body block used to declutter the always-visible empire-wide tab content
// (plan feedback: the Domestic/Tech tabs rendered everything at once, all the time). Purely local
// UI state — nothing here reads game state — so any panel can wrap a section in this without
// touching its own data flow. `summary` renders next to the title even while collapsed, so
// collapsing a section never hides the one fact someone might be scanning for (current government
// type, techs researched, etc).
import React, { useEffect, useRef, useState } from 'react';
import { OPEN_SECTION } from '../panels/panelEvents';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CollapsibleSection = ({ title, icon: Icon, summary, defaultOpen = false, id = null, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);
  // `id`: an ask from elsewhere (panelEvents openPanelTab('diplomacy')) opens this section and scrolls to it.
  useEffect(() => {
    if (!id) return undefined;
    const onOpen = (e) => { if (e.detail !== id) return; setOpen(true); setTimeout(() => ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 0); };
    window.addEventListener(OPEN_SECTION, onOpen);
    return () => window.removeEventListener(OPEN_SECTION, onOpen);
  }, [id]);

  return (
    <div ref={ref} data-section={id || undefined}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 py-1 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          {open ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
          {Icon && <Icon size={13} className="text-slate-400 shrink-0" />}
          {title}
        </span>
        {summary && <span className="text-[10px] text-slate-500 truncate ml-2">{summary}</span>}
      </button>
      {open && <div className="space-y-2 pt-1">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
