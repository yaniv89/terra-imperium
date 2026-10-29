// src/components/panels/PanelDrawer.jsx
// The side panel over the full-bleed map (plan feedback: "combine the map and the play panel into
// one surface"). Field Atlas layout (plans/UI-DESIGN.md rules 1 and 2): a slim tab rail on the
// right edge, 52 px wide, an icon over a 10 px label per tab, with Log and Menu at its foot;
// tapping a tab docks that tab's content beside the rail (the map stays usable on the left),
// tapping the open tab again closes it. The same rail on a phone or a tablet held sideways and on
// the desktop (the desktop dock is wider). A phone held upright keeps a bottom tab bar and a
// sheet (useIsMobile).
//
// Publishes how much of the right edge it covers as --rail-inset on <html> (cards keep clear of
// it), the rail alone as --rail-w (End Turn is anchored to it, so it never moves when the dock
// opens: playtest audit X17, I156; the dock leaves a strip at its foot for it; Research fills that strip with its age tabs), and the bottom
// bar's height as --panel-bar-height on a phone held upright, so map corner controls stay clear.
// The dock is one entry of the interaction registry (useExclusivePanel.js): a decision card that
// arrives on a narrow screen tucks it, and it comes back when the card is answered.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText, Menu, X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLayoutMode, isLandscapeShell } from '../../hooks/useLayoutMode';
import { useInteraction, interactions, PRIORITY } from '../../hooks/useExclusivePanel';
import { useGame } from '../../context/GameContext';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useReportInset } from '../../context/MapInsetsContext';
import ActionPanelTabs, { TABS, getTabBadge } from './ActionPanelTabs';
import { OPEN_TAB, CLOSE_PANELS } from './panelEvents';
import ActionPanel from './ActionPanel';
import { openMenu } from '../ui/uiEvents';
import { useT } from '../../i18n/useT';

// Research and Peoples need two columns, so their dock is wider (plans/UI-DESIGN.md section 5:
// wider sheets for Research); the map keeps at least 12rem on a phone held sideways.
const WIDE_TABS = new Set(['tech', 'diplomacy', 'ruler']);

// One rail button: icon over a tiny label; a dot when something there waits for you. The open
// tab is a raised fill with a light outline (selection is never brass).
const RailButton = ({ icon: Icon, label, active, badge, onClick, ariaLabel, help }) => (
  <button
    type="button"
    onClick={onClick}
    data-help={help && `term:${help}`}
    aria-label={ariaLabel || label}
    aria-pressed={active}
    className={`relative w-full flex-1 min-h-[44px] max-h-[64px] flex flex-col items-center justify-center gap-0.5 border-b border-fa-line transition-colors
                ${active ? 'bg-fa-raised text-fa-text shadow-[inset_0_0_0_2px_#ECE5D3]' : 'text-fa-muted hover:text-fa-text hover:bg-fa-raised'}`}
  >
    <Icon className="w-5 h-5" aria-hidden="true" />
    <span className="text-[10px] leading-none font-semibold">{label}</span>
    {badge > 0 && <span className="absolute top-1.5 end-2 w-2 h-2 rounded-full bg-fa-danger" aria-hidden="true" />}
  </button>
);

// The first panel a touch player opens says once that a hold explains things (round 3b: no player
// found hold-for-help on their own). Remembered per browser only: a convenience, not game state.
const HOLD_HINT_KEY = 'terra-imperium.holdHintSeen';
const HoldHint = () => {
  const { t } = useT();
  const [show, setShow] = useState(() => { try { return window.matchMedia('(pointer: coarse)').matches && !localStorage.getItem(HOLD_HINT_KEY); } catch { return false; } });
  useEffect(() => { if (show) try { localStorage.setItem(HOLD_HINT_KEY, '1'); } catch { /* storage blocked */ } }, [show]);
  if (!show) return null;
  return (
    <div data-testid="hold-hint" className="flex items-center gap-2 ps-3 pe-1 py-1 text-[12px] text-fa-text bg-fa-raised border-b border-fa-line shrink-0">
      <span className="flex-1 min-w-0">{t('rail.holdHint')}</span>
      <button type="button" onClick={() => setShow(false)} aria-label={t('p1.dismiss')} className="w-9 h-9 flex items-center justify-center rounded text-fa-muted hover:text-fa-text"><X className="w-4 h-4" aria-hidden="true" /></button>
    </div>
  );
};

const PanelDrawer = ({ activeTab, onTabChange, onOpenLog, unreadLogs = 0 }) => {
  const { state } = useGame();
  const { t } = useT();
  const isMobile = useIsMobile();
  const layout = useLayoutMode();
  const railLayout = isLandscapeShell(layout) || layout === 'desktop';
  const [dockOpen, setDockOpen] = useState(false);
  const railRef = useRef(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const mobileBarRef = useRef(null);
  const mobileSheetRef = useRef(null);
  // Plan §5.1/§5.2: every piece of this drawer reports the screen it covers so the map centres its
  // camera/animations in what's left visible; the mobile sheet also drops to a short peek while an
  // action's animation plays.
  useReportInset('panel-bar', 'bottom', mobileBarRef, isMobile);
  useReportInset('panel-sheet', 'bottom', mobileSheetRef, isMobile && mobileSheetOpen);
  // The rail plus the open dock, measured as one block on the right edge.
  useReportInset('panel-rail', 'right', railRef, railLayout && !isMobile);
  const [peeking, cancelPeek] = useAutoPeek(isMobile && mobileSheetOpen);

  // The city panel or a decision card tucks the dock away when both would not leave room, and
  // closing them brings it back (useExclusivePanel.js).
  const dock = useInteraction('tabs', railLayout && !isMobile && dockOpen, { kind: 'panel', priority: PRIORITY.panel, user: true });
  const dockShown = dockOpen && dock.shown;
  const navRef = useRef(null);

  // Another part of the UI asked for a tab (panelEvents.js): switch to it and make sure it shows.
  useEffect(() => {
    const onOpen = (e) => {
      onTabChange(e.detail);
      if (isMobile) setMobileSheetOpen(true);
      else { setDockOpen(true); interactions.promote('tabs'); }
    };
    window.addEventListener(OPEN_TAB, onOpen);
    return () => window.removeEventListener(OPEN_TAB, onOpen);
  }, [onTabChange, isMobile]);

  // The Map button of a Research boost asks for a clear map.
  useEffect(() => {
    const onClose = () => { setDockOpen(false); setMobileSheetOpen(false); };
    window.addEventListener(CLOSE_PANELS, onClose);
    return () => window.removeEventListener(CLOSE_PANELS, onClose);
  }, []);

  // --rail-inset: the width of the rail and its dock (0 without a rail).
  useEffect(() => {
    const el = railRef.current;
    const root = document.documentElement;
    if (!railLayout || isMobile || !el) { root.style.setProperty('--rail-inset', '0px'); return undefined; }
    const measure = () => {
      const box = el.getBoundingClientRect();
      root.style.setProperty('--rail-inset', `${Math.round(box.width)}px`);
      const nav = navRef.current;
      root.style.setProperty('--rail-w', `${Math.round(nav ? (document.documentElement.dir === 'rtl' ? nav.getBoundingClientRect().right - box.left : box.right - nav.getBoundingClientRect().left) : box.width)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { observer.disconnect(); root.style.setProperty('--rail-inset', '0px'); root.style.setProperty('--rail-w', '0px'); };
  }, [railLayout, isMobile]);

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

  // Tapping the already-active tab toggles the sheet open/closed; another tab opens it on that tab.
  const handleMobileTabChange = useCallback((tabId) => {
    if (tabId === activeTab) {
      setMobileSheetOpen((open) => !open);
    } else {
      onTabChange(tabId);
      setMobileSheetOpen(true);
    }
  }, [activeTab, onTabChange]);

  if (railLayout && !isMobile) {
    const handleRailTab = (tabId) => {
      // The open tab closes on a second tap; a tab whose dock waits behind a card comes back up.
      if (tabId === activeTab && dockShown) { setDockOpen(false); return; }
      onTabChange(tabId);
      setDockOpen(true);
      dock.promote();
    };
    return (
      <div
        ref={railRef}
        data-testid="landscape-rail"
        data-map-hud=""
        className="fixed end-0 bottom-0 top-[var(--header-height,2.25rem)] z-20 flex pe-[var(--safe-end)] bg-fa-panel/95 border-s border-fa-line text-fa-text"
      >
        {dockShown && (
          <div data-testid="landscape-dock" data-tab={activeTab} className={`${WIDE_TABS.has(activeTab) ? 'w-[min(600px,calc(100vw-52px-12rem))] lg:w-[640px]' : 'w-[clamp(300px,40vw,380px)] tb:w-[420px] lg:w-[420px]'} flex flex-col border-e border-fa-line shadow-2xl bg-fa-panel ${activeTab === 'tech' ? '' : 'pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+58px)] pl:pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+50px)]'}`}>
            <HoldHint />
            <ActionPanel activeTab={activeTab} />
          </div>
        )}
        <nav ref={navRef} aria-label={t('rail.panels')} className="w-[52px] shrink-0 flex flex-col overflow-y-auto scrollbar-none pb-[env(safe-area-inset-bottom)]">
          {TABS.map((tab) => (
            <RailButton
              key={tab.id}
              icon={tab.icon}
              label={t(`rail.${tab.id}`)}
              active={dockShown && activeTab === tab.id}
              badge={getTabBadge(state, tab.id)}
              onClick={() => handleRailTab(tab.id)}
              help={tab.help}
            />
          ))}
          <RailButton icon={ScrollText} label={t('rail.log')} ariaLabel={t('rail.openLog')} help="log" badge={unreadLogs > 0 ? 1 : 0} onClick={onOpenLog} />
          <RailButton icon={Menu} label={t('rail.menu')} ariaLabel={t('rail.openMenu')} help="help" onClick={() => openMenu()} />
        </nav>
      </div>
    );
  }

  return (
    <>
      {mobileSheetOpen && (
        <div
          ref={mobileSheetRef}
          className={`fixed inset-x-0 bottom-0 ${peeking ? 'top-[80vh]' : 'top-[var(--header-height,2.25rem)]'} transition-[top] duration-300 ease-out z-20 rounded-t-2xl bg-fa-panel border-t border-fa-line shadow-2xl flex flex-col text-fa-text`}
        >
          <div onClick={peeking ? cancelPeek : undefined} className="flex items-center justify-center relative px-3 py-2 border-b border-fa-line shrink-0">
            <div className="w-10 h-1 rounded-full bg-fa-line" />
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              className="absolute end-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded text-fa-muted hover:text-fa-text"
              aria-label={t('rail.closePanel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <HoldHint />
          <ActionPanel activeTab={activeTab} />
        </div>
      )}
      <div
        ref={mobileBarRef}
        className="fixed bottom-0 inset-x-0 z-20 bg-fa-panel/95 border-t border-fa-line pb-[env(safe-area-inset-bottom)] flex"
      >
        <div className="flex-1 min-w-0"><ActionPanelTabs activeTab={mobileSheetOpen ? activeTab : null} onTabChange={handleMobileTabChange} /></div>
        <button type="button" onClick={() => openMenu()} aria-label={t('rail.openMenu')} className="fa-tab flex-col !gap-0.5 !px-2 !text-[10px] shrink-0 border-s border-fa-line">
          <Menu className="w-[18px] h-[18px]" aria-hidden="true" />{t('rail.menu')}
        </button>
      </div>
    </>
  );
};

export default PanelDrawer;
