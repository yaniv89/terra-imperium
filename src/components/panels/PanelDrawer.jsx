// src/components/panels/PanelDrawer.jsx
// Wraps ActionPanelTabs + ActionPanel as a floating overlay over the full-bleed map (plan
// feedback: "combine the map and the play panel into one surface" instead of a permanent flex
// sidebar next to it). Mirrors LogDrawer.jsx's own desktop/mobile split: a right-docked
// translucent panel on desktop that collapses off-screen via a pull-tab (remembered per browser,
// same localStorage pattern as MapContainer.jsx's map-mode toggle); on mobile, ActionPanelTabs
// itself becomes a slim always-visible bottom bar, and tapping a tab opens a bottom-sheet with
// that tab's content, styled like ProvinceModal's own mobile sheet. Neither ActionPanelTabs nor
// ActionPanel are modified — this component only owns positioning/open state, not tab content.
//
// Also publishes the mobile tab bar's real on-screen height as the --panel-bar-height CSS custom
// property (set on <html>, mirroring GameHeader's --header-height), so map corner controls
// (MiniMap/MapLegend) can offset themselves above it without needing to know anything about this
// component's own markup.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useReportInset } from '../../context/MapInsetsContext';
import ActionPanelTabs from './ActionPanelTabs';
import ActionPanel from './ActionPanel';

const COLLAPSED_STORAGE_KEY = 'terra-imperium-panel-drawer-collapsed';
const readStoredCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const PanelDrawer = ({ activeTab, onTabChange }) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const mobileBarRef = useRef(null);
  const mobileSheetRef = useRef(null);
  const desktopPanelRef = useRef(null);
  // Plan §5.1/§5.2: every piece of this drawer reports the screen it covers so the map centres its
  // camera/animations in what's left visible; the mobile sheet (92% of the screen tall) also drops
  // to a short peek while an action's animation plays — e.g. an empire-wide action pulsing on the
  // capital from the Domestic tab.
  useReportInset('panel-bar', 'bottom', mobileBarRef, isMobile);
  useReportInset('panel-sheet', 'bottom', mobileSheetRef, isMobile && mobileSheetOpen);
  useReportInset('panel-drawer', 'right', desktopPanelRef, !isMobile && !collapsed);
  const [peeking, cancelPeek] = useAutoPeek(isMobile && mobileSheetOpen);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0'); } catch { /* private browsing / storage disabled — just won't persist */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    const el = mobileBarRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--panel-bar-height', `${Math.round(el.getBoundingClientRect().height)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--panel-bar-height');
    };
  }, [isMobile]);

  // Tapping the already-active tab toggles the sheet open/closed (a way to dismiss it without a
  // separate close button); tapping a different tab always opens the sheet on that tab's content.
  const handleMobileTabChange = useCallback((tabId) => {
    if (tabId === activeTab) {
      setMobileSheetOpen((open) => !open);
    } else {
      onTabChange(tabId);
      setMobileSheetOpen(true);
    }
  }, [activeTab, onTabChange]);

  if (isMobile) {
    return (
      <>
        {mobileSheetOpen && (
          <div
            ref={mobileSheetRef}
            className={`fixed inset-x-0 bottom-0 ${peeking ? 'top-[80vh]' : 'top-[var(--header-height,4.5rem)]'} transition-[top] duration-300 ease-out z-20 rounded-t-2xl bg-slate-900/98 backdrop-blur-sm border-t border-slate-700 shadow-2xl flex flex-col`}
          >
            <div onClick={peeking ? cancelPeek : undefined} className="flex items-center justify-center relative px-3 py-2 border-b border-slate-800 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
              <button
                onClick={() => setMobileSheetOpen(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ActionPanel activeTab={activeTab} />
          </div>
        )}
        <div
          ref={mobileBarRef}
          className="fixed bottom-0 inset-x-0 z-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-700/70 pb-[env(safe-area-inset-bottom)]"
        >
          <ActionPanelTabs activeTab={activeTab} onTabChange={handleMobileTabChange} />
        </div>
      </>
    );
  }

  return (
    <div
      ref={desktopPanelRef}
      className={`fixed top-[var(--header-height,4.5rem)] right-0 bottom-0 z-20 w-96 xl:w-[420px] flex flex-col
                  bg-slate-900/90 backdrop-blur-md border-l border-slate-700/70 shadow-2xl
                  transition-transform duration-200
                  ${collapsed ? 'translate-x-full' : 'translate-x-0'}`}
    >
      <button
        onClick={toggleCollapsed}
        className="absolute -left-9 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5
                   bg-slate-900/90 backdrop-blur-md border border-slate-700 border-r-0 rounded-l-lg
                   text-slate-400 hover:text-white hover:bg-slate-800"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-180' : ''}`} />
      </button>
      <div className="shrink-0">
        <ActionPanelTabs activeTab={activeTab} onTabChange={onTabChange} />
      </div>
      <ActionPanel activeTab={activeTab} />
    </div>
  );
};

export default PanelDrawer;
