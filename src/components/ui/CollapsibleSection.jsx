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
        type="button"
        aria-expanded={open}
        data-testid="section-toggle"
        className="w-full flex items-center justify-between gap-2 min-h-[44px] text-start px-2.5 rounded-lg border border-fa-line bg-fa-raised/60 hover:bg-fa-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-fa-text"
      >
        {/* It reads as a button (a bordered, filled row with a 16 px chevron), not as a heading:
            players took these for plain text (playtest audit, Empire headers). */}
        <span className="flex items-center gap-2 fa-heading text-[15px] min-w-0">
          {open ? <ChevronDown size={16} className="text-fa-text shrink-0" aria-hidden="true" /> : <ChevronRight size={16} className="rtl:-scale-x-100 text-fa-text shrink-0" aria-hidden="true" />}
          {Icon && <Icon size={14} className="text-fa-muted shrink-0" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </span>
        {summary && <span className="text-[12px] text-fa-muted truncate ms-2">{summary}</span>}
      </button>
      {open && <div className="space-y-2 pt-1">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
