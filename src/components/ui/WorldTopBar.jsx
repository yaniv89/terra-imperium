// src/components/ui/WorldTopBar.jsx
// The ONE world top bar (plans/UI-DESIGN.md section 2, plans/ui/SPEC-REVISION.md rule 2), the same
// on every layout: the nation shield and name, gold, food, science with the current tech and its
// turns, culture, a war pill when at war, the year and the turn. 36 px tall (plus the notch inset).
// Every number has its reasons on tap (rule 4): gold, food and culture open a small sheet of lines;
// science opens Research; the name opens the nation overview; the war pill opens Diplomacy.
// End Turn lives bottom right (TurnDock.jsx), the menu on the tab rail (PanelDrawer.jsx).
//
// Publishes its real height as --header-height on <html> and reports it as the map's top inset,
// as GameHeader did, so sheets and map controls sit below it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useReportInset } from '../../context/MapInsetsContext';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { openPanelTab } from '../panels/panelEvents';
import { openNationOverview } from './uiEvents';
import { topBarModel } from './topBarModel';
import { Shield, signed } from './atlas';
import ResourceBar from './ResourceBar';

const GoldIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-brass)" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h5" /></svg>;
const FoodIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-food)" strokeWidth="1.8" aria-hidden="true"><path d="M12 21V8M12 8c0-3 2-5 5-5 0 3-2 5-5 5zM12 12c0-3-2-5-5-5 0 3 2 5 5 5zM12 16c0-3 2-5 5-5 0 3-2 5-5 5z" /></svg>;
const ScienceIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-science)" strokeWidth="1.8" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></svg>;
const CultureIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-indep)" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" /></svg>;

const delta = (v) => <span className={`fa-num text-[11px] ${v < 0 ? 'text-fa-danger-text' : 'text-fa-good'}`}>{signed(v)}</span>;

// One item of the bar: a 32 px tall button with an icon, the number and its per-turn change.
const BarItem = ({ label, onClick, expanded, children, testId }) => (
  <button type="button" onClick={onClick} aria-label={label} aria-expanded={expanded} title={label} data-testid={testId}
    className={`shrink-0 flex items-center gap-1 h-8 px-1.5 -mx-0.5 rounded-md text-fa-text hover:bg-fa-raised ${expanded ? 'bg-fa-raised' : ''}`}>
    {children}
  </button>
);

// The reasons behind a number (rule 4), anchored under the bar.
const Reasons = ({ title, rows, total, unit, footer, onClose }) => (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
    <div role="dialog" aria-label={title} className="absolute left-2 top-full mt-1 z-40 w-[min(320px,calc(100vw-1rem))] fa-panel shadow-2xl p-3 max-h-[70dvh] overflow-y-auto" data-testid="top-bar-reasons">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="fa-heading text-[15px]">{title}</span>
        {total != null && <span className="fa-num text-[13px]">{signed(total)}{unit}</span>}
      </div>
      {rows.length === 0 && <div className="text-[12px] text-fa-muted">Nothing yet.</div>}
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-3 text-[12px]">
            <span className="text-fa-muted truncate">{r.label}</span>
            <span className={`fa-num ${r.value < 0 ? 'text-fa-danger-text' : 'text-fa-text'}`}>{signed(r.value)}</span>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  </>
);

const WorldTopBar = () => {
  const { state } = useGame();
  const layoutMode = useLayoutMode();
  const ref = useRef(null);
  const [open, setOpen] = useState(null);
  const m = useMemo(() => topBarModel(state), [state]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-height', `${Math.round(el.getBoundingClientRect().height)}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useReportInset(`game-header-${layoutMode}`, 'top', ref);
  const toggle = (id) => setOpen((v) => (v === id ? null : id));
  const close = () => setOpen(null);
  const portrait = layoutMode === 'phone-portrait' || layoutMode === 'tablet-portrait';

  return (
    <header ref={ref} data-testid="world-top-bar"
      className="fixed top-0 inset-x-0 z-20 bg-fa-panel/95 border-b border-fa-line text-fa-text
                 pt-[env(safe-area-inset-top)] pl-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
      <div className="h-9 flex items-center gap-3 sm:gap-3.5">
        <button type="button" onClick={() => openNationOverview()} className="shrink-0 min-w-0 flex items-center gap-1.5 h-8 px-1 -ml-1 rounded-md hover:bg-fa-raised" aria-label={`${m.nation.title}: the nation overview`} title={`${m.nation.title}: the nation overview`} data-testid="top-bar-nation">
          <Shield color={m.nation.color} size={16} />
          <span className={`fa-heading text-[14px] truncate ${portrait ? 'max-w-[5.5rem]' : 'max-w-[9rem]'}`}>{m.nation.name}</span>
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 overflow-x-auto scrollbar-none">
          <BarItem label={`Gold ${m.gold.value}, ${signed(m.gold.perTurn)} a turn. Tap for the reasons`} onClick={() => toggle('gold')} expanded={open === 'gold'} testId="top-bar-gold">
            <GoldIcon /><span className="fa-num text-[12px]">{m.gold.value}</span>{delta(m.gold.perTurn)}
          </BarItem>
          <BarItem label={`Food ${m.food.value} banked, ${signed(m.food.perTurn)} a turn. Tap for each city`} onClick={() => toggle('food')} expanded={open === 'food'} testId="top-bar-food">
            <FoodIcon /><span className="fa-num text-[12px]">{m.food.value}</span>{delta(m.food.perTurn)}
          </BarItem>
          <BarItem label={m.science.current ? `Science ${m.science.perTurn} a turn: ${m.science.current.name} in ${m.science.current.turns} turns. Open Research` : `Science ${m.science.perTurn} a turn: nothing researched. Open Research`} onClick={() => openPanelTab('tech')} testId="research-pill">
            <ScienceIcon /><span className="fa-num text-[12px]">{m.science.perTurn}</span>
            <span className={`text-[11px] truncate max-w-[10rem] ${m.science.current ? 'text-fa-muted' : 'text-fa-brass font-semibold'}`}>{m.science.label}</span>
          </BarItem>
          <BarItem label={`Culture ${m.culture.perTurn} a turn. Tap for each city`} onClick={() => toggle('culture')} expanded={open === 'culture'} testId="top-bar-culture">
            <CultureIcon /><span className="fa-num text-[12px]">{m.culture.perTurn}</span>
          </BarItem>
        </div>
        {m.warLabel && (
          <button type="button" onClick={() => openPanelTab('diplomacy')} className="fa-war-pill shrink-0 max-w-[11rem] truncate" title={`At war with ${m.wars.map((w) => w.name).join(', ')}`} data-testid="war-pill">
            {m.warLabel}
          </button>
        )}
        <span className="fa-num text-[12px] shrink-0" title="The year">{m.year}</span>
        {!portrait && <span className="fa-label shrink-0 !text-[11px]">Turn <span className="fa-num text-[12px] text-fa-text tracking-normal">{m.turn}</span></span>}
      </div>
      {open === 'gold' && (
        <Reasons title="Gold a turn" rows={m.gold.reasons} total={m.gold.perTurn} unit="" onClose={close}
          footer={(
            <div className="mt-2 pt-2 border-t border-fa-line">
              <div className="fa-label mb-1.5">All your stores</div>
              <div className="flex flex-wrap gap-1.5"><ResourceBar wrap /></div>
            </div>
          )} />
      )}
      {open === 'food' && <Reasons title="Food a turn, by city" rows={m.food.reasons} total={m.food.perTurn} unit="" onClose={close}
        footer={<p className="mt-2 text-[11px] text-fa-muted">The surplus after the people eat. It fills each city&apos;s bank ({m.food.value} in all) until the city grows.</p>} />}
      {open === 'culture' && <Reasons title="Culture a turn, by city" rows={m.culture.reasons} total={m.culture.perTurn} unit="" onClose={close}
        footer={<p className="mt-2 text-[11px] text-fa-muted">Culture claims new tiles for each city and holds its people loyal.</p>} />}
    </header>
  );
};

export default WorldTopBar;
