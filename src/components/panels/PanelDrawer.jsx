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
// On a phone held sideways (useLayoutMode 'phone-landscape') it is a slim tab rail on the right
// edge instead, with the Event Log at its foot; tapping a tab docks that tab's content beside the
// rail (the map stays usable on the left), tapping the open tab again closes it.
//
// Also publishes the mobile tab bar's real on-screen height as the --panel-bar-height CSS custom
// property (set on <html>, mirroring GameHeader's --header-height), so map corner controls
// (MiniMap/MapLegend) can offset themselves above it without needing to know anything about this
// component's own markup.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ScrollText, X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useExclusivePanel } from '../../hooks/useExclusivePanel';
import { useGame } from '../../context/GameContext';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useReportInset } from '../../context/MapInsetsContext';
import ActionPanelTabs, { TABS, getTabBadge } from './ActionPanelTabs';
import { OPEN_TAB } from './panelEvents';
import ActionPanel from './ActionPanel';

const COLLAPSED_STORAGE_KEY = 'terra-imperium-panel-drawer-collapsed';
const readStoredCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

// One rail button: icon over a tiny label, with the same red badge as the tab bar.
const RailButton = ({ icon: Icon, label, active, badge, onClick, ariaLabel }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel || label}
    aria-pressed={active}
    className={`relative w-full flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors
                ${active ? 'bg-blue-600/25 text-blue-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
  >
    <Icon className="w-[18px] h-[18px]" />
    <span className="text-[9px] leading-none font-semibold">{label}</span>
    {badge > 0 && (
      <span className="absolute top-0.5 right-1 min-w-[1rem] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </button>
);

const PanelDrawer = ({ activeTab, onTabChange, onOpenLog, unreadLogs = 0 }) => {
  const { state } = useGame();
  const isMobile = useIsMobile();
  const isLandscapePhone = useLayoutMode() === 'phone-landscape';
  const [dockOpen, setDockOpen] = useState(false);
  const landscapeRef = useRef(null);
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
  useReportInset('panel-drawer', 'right', desktopPanelRef, !isMobile && !isLandscapePhone && !collapsed);
  // The rail plus the open dock, measured as one block on the right edge.
  useReportInset('panel-rail', 'right', landscapeRef, isLandscapePhone);
  const [peeking, cancelPeek] = useAutoPeek(isMobile && mobileSheetOpen);

  // Opening a province tucks this panel away when both wouldn't leave room for the map, and closing
  // the province brings it back (useExclusivePanel.js). Not persisted: the player's own choice stays.
  useExclusivePanel('tabs', isLandscapePhone ? dockOpen : !isMobile && !collapsed, (tucked) => {
    if (isLandscapePhone) setDockOpen(!tucked);
    else setCollapsed(tucked);
  });

  // Another part of the UI asked for a tab (panelEvents.js): switch to it and make sure it shows.
  useEffect(() => {
    const onOpen = (e) => {
      onTabChange(e.detail);
      if (isLandscapePhone) setDockOpen(true);
      else if (isMobile) setMobileSheetOpen(true);
      else setCollapsed(false);
    };
    window.addEventListener(OPEN_TAB, onOpen);
    return () => window.removeEventListener(OPEN_TAB, onOpen);
  }, [onTabChange, isLandscapePhone, isMobile]);

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

  if (isLandscapePhone) {
    const handleRailTab = (tabId) => {
      if (tabId === activeTab) setDockOpen((open) => !open);
      else { onTabChange(tabId); setDockOpen(true); }
    };
    return (
      <div
        ref={landscapeRef}
        data-testid="landscape-rail"
        className="fixed right-0 bottom-0 top-[var(--header-height,2.75rem)] z-20 flex pr-[env(safe-area-inset-right)] bg-slate-900/95 backdrop-blur-md border-l border-slate-700/70"
      >
        {dockOpen && (
          <div data-testid="landscape-dock" className="w-[clamp(300px,40vw,380px)] flex flex-col border-r border-slate-800 shadow-2xl">
            <ActionPanel activeTab={activeTab} />
          </div>
        )}
        <nav className="w-[3.75rem] shrink-0 flex flex-col gap-0.5 p-1 overflow-y-auto scrollbar-none pb-[max(env(safe-area-inset-bottom),0.25rem)]">
          {TABS.map((tab) => (
            <RailButton
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              active={dockOpen && activeTab === tab.id}
              badge={getTabBadge(state, tab.id)}
              onClick={() => handleRailTab(tab.id)}
            />
          ))}
          <div className="mt-auto" />
          <RailButton icon={ScrollText} label="Log" ariaLabel="Open event log" badge={unreadLogs} onClick={onOpenLog} />
        </nav>
      </div>
    );
  }

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
