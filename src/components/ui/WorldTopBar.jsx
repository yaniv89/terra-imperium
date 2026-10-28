// src/components/ui/WorldTopBar.jsx
// The ONE world top bar (plans/UI-DESIGN.md section 2, plans/ui/SPEC-REVISION.md rule 2), the same
// on every layout: the nation shield and name, gold, food, science with the current tech and its
// turns, culture, a war pill when at war, the year and the turn. 36 px tall (plus the notch inset).
// Every number has its reasons on tap (rule 4): gold, food and culture open a small sheet of lines;
// science opens Research; the name opens the nation overview; the war pill with one enemy opens its
// card and flies to the nearest place of it you know (peopleWhere.js front), with several Diplomacy.
// End Turn lives bottom right (TurnDock.jsx), the menu on the tab rail (PanelDrawer.jsx).
//
// Publishes its real height as --header-height on <html> and reports it as the map's top inset,
// as GameHeader did, so sheets and map controls sit below it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useOnInteractionOpen } from '../../hooks/useExclusivePanel';
import { useReportInset } from '../../context/MapInsetsContext';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useAgeTheme } from '../../hooks/useAgeTheme';
import { ageOf } from '../../engine/nationState';
import { openPanelTab } from '../panels/panelEvents';
import { peopleWhere } from '../panels/peopleWhere';
import { selectNation, focusPlace } from '../map/marchEvents';
import { openNationOverview, openTurnReport, openMenu } from './uiEvents';
import { topBarModel } from './topBarModel';
import { Shield, signed } from './atlas';
import ResourceBar from './ResourceBar';
import { CULTURE_HELP } from '../../data/cultureHelp';
import { useT } from '../../i18n/useT';

const GoldIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-brass)" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h5" /></svg>;
const FoodIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-food)" strokeWidth="1.8" aria-hidden="true"><path d="M12 21V8M12 8c0-3 2-5 5-5 0 3-2 5-5 5zM12 12c0-3-2-5-5-5 0 3 2 5 5 5zM12 16c0-3 2-5 5-5 0 3-2 5-5 5z" /></svg>;
const ScienceIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-science)" strokeWidth="1.8" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></svg>;
const DecreeIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-brass)" strokeWidth="1.8" aria-hidden="true"><path d="M8 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8M8 4a2 2 0 0 0-2 2v10a4 4 0 0 0 4 4M8 4v12M11 9h5M11 13h5" /></svg>;
const CultureIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fa-indep)" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" /></svg>;

// the change a turn; nothing for none (a 0 reads as noise beside the number)
const delta = (v) => (v ? <span className={`fa-num text-[11px] ${v < 0 ? 'text-fa-danger-text' : 'text-fa-good'}`}>{signed(v)}</span> : null);

// One item of the bar: a 32 px tall button with an icon, the number and its per-turn change.
const BarItem = ({ label, onClick, expanded, children, testId }) => (
  <button type="button" onClick={onClick} aria-label={label} aria-expanded={expanded} title={label} data-testid={testId}
    className={`shrink-0 flex items-center gap-1 h-8 px-1.5 -mx-0.5 rounded-md text-fa-text hover:bg-fa-raised ${expanded ? 'bg-fa-raised' : ''}`}>
    {children}
  </button>
);

// The reasons behind a number (rule 4), anchored under the bar.
const Reasons = ({ title, rows, total, unit, footer, onClose }) => {
  const { t } = useT();
  return (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
    <div role="dialog" aria-label={title} className="absolute start-2 top-full mt-1 z-40 w-[min(320px,calc(100vw-1rem))] fa-panel !bg-fa-panel shadow-2xl p-3 max-h-[70dvh] overflow-y-auto" data-testid="top-bar-reasons">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="fa-heading text-[15px]">{title}</span>
        {total != null && <span className="fa-num text-[13px]">{signed(total)}{unit}</span>}
      </div>
      {rows.length === 0 && <div className="text-[12px] text-fa-muted">{t('topbar.nothingYet')}</div>}
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
};

const WorldTopBar = () => {
  const { state } = useGame();
  const { t, lang } = useT();
  const layoutMode = useLayoutMode();
  const ref = useRef(null);
  const [open, setOpen] = useState(null);
  // The model reads the current language through t(): recompute when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => topBarModel(state), [state, lang]);

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
  useAgeTheme(state.playerNationId ? ageOf(state, state.playerNationId) : null);
  const toggle = (id) => setOpen((v) => (v === id ? null : id));
  const close = useCallback(() => setOpen(null), []);
  // A card, sheet or dock that opens closes the reasons popover: it used to stay open over them
  // (playtest audit I162).
  useOnInteractionOpen(close);
  const portrait = layoutMode === 'phone-portrait' || layoutMode === 'tablet-portrait';
  // One war: the enemy's card (Show on map, March to) and the map at the nearest place of theirs
  // you know (playtest 40550092795: at war 90 turns, the front never found); several: Diplomacy.
  const showWar = () => {
    if (m.wars.length !== 1) { openPanelTab('diplomacy'); return; }
    const front = peopleWhere(state, m.wars[0].id).front;
    selectNation(m.wars[0].id);
    if (front.length) focusPlace(front);
  };

  return (
    <header ref={ref} data-testid="world-top-bar" data-map-hud=""
      className="age-strip fixed top-0 inset-x-0 z-20 bg-fa-panel/95 border-b border-fa-line text-fa-text
                 pt-[env(safe-area-inset-top)] ps-[max(var(--safe-start),0.75rem)] pe-[max(var(--safe-end),0.75rem)]">
      <div className="h-9 flex items-center gap-3 sm:gap-3.5">
        <button type="button" onClick={() => openNationOverview()} className="shrink-0 min-w-0 flex items-center gap-1.5 h-8 px-1 -ms-1 rounded-md hover:bg-fa-raised" aria-label={t('topbar.nationAria', { title: m.nation.title })} title={t('topbar.nationAria', { title: m.nation.title })} data-testid="top-bar-nation">
          <Shield color={m.nation.color} size={16} />
          <span className={`fa-heading text-[14px] truncate ${portrait ? 'max-w-[5.5rem]' : 'max-w-[9rem]'}`}>{m.nation.name}</span>
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 overflow-x-auto scrollbar-none">
          <BarItem label={t('topbar.goldAria', { value: m.gold.value, delta: signed(m.gold.perTurn) })} onClick={() => toggle('gold')} expanded={open === 'gold'} testId="top-bar-gold">
            <GoldIcon /><span className="fa-num text-[12px]">{m.gold.value}</span>{delta(m.gold.perTurn)}
          </BarItem>
          <BarItem label={t('topbar.foodAria', { value: m.food.value, delta: signed(m.food.perTurn) })} onClick={() => toggle('food')} expanded={open === 'food'} testId="top-bar-food">
            <FoodIcon /><span className="fa-num text-[12px]">{m.food.value}</span>{delta(m.food.perTurn)}
          </BarItem>
          <BarItem label={m.science.current ? t('topbar.scienceAria', { n: m.science.perTurn, name: m.science.current.name, turns: t('research.turnsCount', { count: m.science.current.turns }) }) : t('topbar.scienceNone', { n: m.science.perTurn })} onClick={() => openPanelTab('tech')} testId="research-pill">
            <ScienceIcon /><span className="fa-num text-[12px]">{m.science.perTurn}</span>
            <span className={`[unicode-bidi:isolate] text-[11px] truncate max-w-[10rem] ${m.science.current ? 'text-fa-muted' : 'text-fa-brass font-semibold'}`}>{m.science.label}</span>
          </BarItem>
          <BarItem label={t('topbar.decreeAria', { value: m.decrees.value, cap: m.decrees.cap })} onClick={() => toggle('decrees')} expanded={open === 'decrees'} testId="top-bar-decrees">
            <DecreeIcon /><span className="fa-num text-[12px]">{m.decrees.value}/{m.decrees.cap}</span>
          </BarItem>
          <BarItem label={t('topbar.cultureAria', { n: m.culture.perTurn })} onClick={() => toggle('culture')} expanded={open === 'culture'} testId="top-bar-culture">
            <CultureIcon /><span className="fa-num text-[12px]">{m.culture.perTurn}</span>
          </BarItem>
        </div>
        {m.warLabel && (
          <button type="button" onClick={showWar} className="fa-war-pill shrink-0 max-w-[11rem] truncate" title={t('topbar.warTip', { names: m.wars.map((w) => w.name).join(t('chip.listSep')) })} data-testid="war-pill">
            {m.warLabel}
          </button>
        )}
        <span className="text-[11px] text-fa-muted shrink-0 max-w-[5.5rem] truncate" title={m.age.nextName ? t('topbar.ageTip', { age: m.age.name, next: m.age.nextName, n: m.age.techsLeft }) : t('topbar.ageLast', { age: m.age.name })} data-testid="top-bar-age">{m.age.name}</span>
        <span className="fa-num text-[12px] shrink-0 [unicode-bidi:isolate]" title={t('topbar.year')}>{m.year}</span>
        {!portrait && (
          <button type="button" onClick={() => openTurnReport()} className="[unicode-bidi:isolate] fa-label shrink-0 !text-[11px] h-8 px-1 -me-1 rounded-md hover:bg-fa-raised" title={t('topbar.reportTip')} aria-label={t('topbar.turnAria', { turn: m.turn })} data-testid="top-bar-turn">
            {t('topbar.turn')} <span className="fa-num text-[12px] text-fa-text tracking-normal">{m.turn}</span>
          </button>
        )}
        <button type="button" onClick={() => openMenu('help')} className="shrink-0 w-8 h-8 -me-1 rounded-full border border-fa-line text-[14px] font-bold text-fa-muted hover:text-fa-text hover:bg-fa-raised" aria-label={t('hub.helpAria')} title={t('hub.helpAria')} data-testid="top-bar-help">?</button>
      </div>
      {open === 'gold' && (
        <Reasons title={t('topbar.goldTitle')} rows={m.gold.reasons} total={m.gold.perTurn} unit="" onClose={close}
          footer={(
            <div className="mt-2 pt-2 border-t border-fa-line">
              <div className="fa-label mb-1.5">{t('topbar.stores')}</div>
              <div className="flex flex-wrap gap-1.5"><ResourceBar wrap /></div>
            </div>
          )} />
      )}
      {open === 'food' && <Reasons title={t('topbar.foodTitle')} rows={m.food.reasons} total={m.food.perTurn} unit="" onClose={close}
        footer={<p className="mt-2 text-[11px] text-fa-muted">{t('topbar.foodNote', { value: m.food.value })}</p>} />}
      {open === 'decrees' && <Reasons title={t('topbar.decreeTitle', { value: m.decrees.value, cap: m.decrees.cap })} rows={m.decrees.reasons} total={null} unit="" onClose={close}
        footer={(
          <div className="mt-2 pt-2 border-t border-fa-line space-y-1 text-[11px] text-fa-muted">
            {m.decrees.costs.map((c) => <p key={c.n}>{t('topbar.decreeCost', { n: c.n, list: c.labels.join(t('chip.listSep')) })}</p>)}
            <p>{t('topbar.decreeHow', { below: m.decrees.below, cap: m.decrees.cap })}</p>
          </div>
        )} />}
      {open === 'culture' && <Reasons title={t('topbar.cultureTitle')} rows={m.culture.reasons} total={m.culture.perTurn} unit="" onClose={close}
        footer={<p className="mt-2 text-[11px] text-fa-muted">{CULTURE_HELP.earns} {CULTURE_HELP.spends}</p>} />}
    </header>
  );
};

export default WorldTopBar;
