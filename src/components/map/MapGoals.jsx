// src/components/map/MapGoals.jsx
// Two small things in the map's top-left corner, under the "needs you" chips (playtest audit I149
// and the Research Map button):
//   the hint    "what to do here", set by showMapHint (uiEvents.js) when a Research boost sends you
//               to the map, with a way back to Research and a Done button
//   the tracker the era goals as one chip ("Goals 1/2"); open, each goal has its bar, the legacy it
//               gives and what to do next (data/eraGoals.js). Closed by default so the map stays clear.
import React, { useEffect, useMemo, useState } from 'react';
import { Target, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { eraGoalProgress } from '../../engine/eraGoals';
import { GOAL_NEXT_ACTION, ERA_LEGACY_TURNS } from '../../data/eraGoals';
import { AGES } from '../../data/ages';
import { MAP_HINT } from '../ui/uiEvents';
import { openPanelTab } from '../panels/panelEvents';
import { Meter } from '../ui/atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow, ageName } from '../../i18n';
import { useT } from '../../i18n/useT';
import { playstyleName, goalUnit, goalNext, goalBonus } from '../../i18n/gameText';

const MapGoals = () => {
  const { state } = useGame();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(null);
  useEffect(() => {
    const on = (e) => setHint(e.detail || null);
    window.addEventListener(MAP_HINT, on);
    return () => window.removeEventListener(MAP_HINT, on);
  }, []);
  const era = useMemo(() => eraGoalProgress(state), [state]);
  // The hint is a notice (useExclusivePanel.js): on a phone it waits as a chip while a card or a
  // panel has the screen.
  const { shown: hintShown } = useInteraction('map-hint', !!hint, { priority: PRIORITY.notice, kind: 'notice', label: hint ? tNow('wait.mapHint', { title: hint.title }) : null, testId: 'map-hint-chip' });
  const wide = 'w-[min(19rem,calc(100vw-1.5rem-var(--rail-inset,0px)))]';
  // Under the "needs you" chips (App.jsx), so never under them. While a march or a site is being
  // chosen on a phone held sideways the bar has the top of the screen: the goals step aside
  // (index.css, html[data-map-tool], I083).
  return (
    <div className="map-goals flex flex-col items-start gap-1.5 pointer-events-none" data-testid="map-goals">
      {hint && hintShown && (
        <div role="status" className={`pointer-events-auto fa-panel !bg-fa-panel shadow-xl p-2 ${wide} text-[12px] space-y-1.5`} data-testid="map-hint">
          <div className="font-semibold leading-tight">{hint.title}</div>
          <div className="text-fa-muted leading-snug">{hint.text}</div>
          <div className="flex gap-2">
            {hint.back && <button type="button" onClick={() => { setHint(null); openPanelTab(hint.back); }} className="min-h-[44px] px-2 rounded bg-fa-hover hover:bg-fa-line text-fa-text" data-testid="map-hint-back">{t('goals.backResearch')}</button>}
            <button type="button" onClick={() => setHint(null)} className="min-h-[44px] px-2 rounded bg-fa-hover hover:bg-fa-line text-fa-text" data-testid="map-hint-done">{t('goals.done')}</button>
          </div>
        </div>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="goal-tracker-chip"
        className="relative before:content-[''] before:absolute before:-inset-y-1 before:inset-x-0 pointer-events-auto min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-full bg-fa-panel/90 border border-fa-line text-[12px] text-fa-text">
        <Target size={14} aria-hidden="true" />{t('goals.title')} <span className="fa-num">{era.met}/{era.needed}</span>
      </button>
      {open && (
        <div className={`pointer-events-auto fa-panel !bg-fa-panel shadow-xl p-2 ${wide} max-h-[calc(100dvh-8rem)] overflow-y-auto space-y-1.5`} data-testid="goal-tracker">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] text-fa-muted leading-snug">{t('goals.intro', { age: ageName(era.ageId, AGES[era.ageId]?.name), needed: era.needed, turns: ERA_LEGACY_TURNS })}</div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('goals.close')} className="w-8 h-8 shrink-0 flex items-center justify-center rounded hover:bg-fa-raised"><X size={14} aria-hidden="true" /></button>
          </div>
          {era.goals.map((g) => (
            <div key={g.id} data-testid={`goal-${g.id}`}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-semibold">{playstyleName(g.id, g.label)} <span className="font-normal text-fa-muted">{goalUnit(g.id, g.unit)}</span></span>
                <span className={`fa-num ${g.done ? 'text-fa-good' : 'text-fa-muted'}`}>{Math.min(g.value, g.target)} / {g.target}</span>
              </div>
              <Meter value={g.value} max={g.target} color={g.done ? 'var(--fa-good)' : 'var(--fa-you)'} height={4} />
              <div className="text-[11px] text-fa-muted leading-snug">{g.done ? t('goals.doneDot') : goalNext(g.id, GOAL_NEXT_ACTION[g.id])} {t('goals.legacy', { bonus: goalBonus(g.id, g.bonus, g.n) })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapGoals;
