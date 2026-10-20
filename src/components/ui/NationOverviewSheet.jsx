// src/components/ui/NationOverviewSheet.jsx
// The nation overview (W17, plans/UI-DESIGN.md), opened from the name on the top bar: the ruler
// (no heirs), the government and title with the next title, stability, legitimacy and authority
// with its reasons (rule 4), how far each victory is and the score rank, the era goals with the
// closest one's way forward, and the age strip with when the next age begins at this pace. Three
// columns on the desktop, two on a phone held sideways (a wide sheet over the rail), one upright.
// nationOverviewModel.js is the pure model.
import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { OPEN_NATION_OVERVIEW, setMapLens } from './uiEvents';
import { openPanelTab } from '../panels/panelEvents';
import { nationOverviewModel } from './nationOverviewModel';
import { Button, Label, Meter, SheetHeader, Shield, signed } from './atlas';
import MapCard from './MapCard';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import GovernmentChangeDialog from '../panels/GovernmentChangeDialog';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { rich } from '../../i18n/rich';

const Card = ({ children, className = '', testId }) => <section className={`fa-card p-3 space-y-2 ${className}`} data-testid={testId}>{children}</section>;

// The way forward for the closest unmet era goal (where to act), if there is one to point at.
const GOAL_ACTION = {
  expand: { label: 'p1.no.showSites', go: () => setMapLens('settle') },
  wealth: { label: 'p1.no.openPeoples', go: () => openPanelTab('diplomacy') },
  science: { label: 'p1.no.openResearch', go: () => openPanelTab('tech') }
};

const NationOverviewSheet = () => {
  const { lang } = useT(); // the model is rebuilt when the language changes
  const { state } = useGame();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NATION_OVERVIEW, onOpen);
    return () => window.removeEventListener(OPEN_NATION_OVERVIEW, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => (open ? nationOverviewModel(state) : null), [open, state, lang]);
  // A sheet the player opened: it takes the screen, and a decision card it covers waits as a chip.
  const turn = useInteraction('nation-overview', open && !!m, { priority: PRIORITY.sheet, user: true, label: tNow('wait.nation') });
  useDismissOverlays(() => setOpen(false), open);
  // The government change card lives here because this sheet stays mounted (see GovernmentChangeDialog.jsx).
  if (!open || !m || !turn.shown) return <GovernmentChangeDialog />;
  const close = () => setOpen(false);
  const s = m.stability;
  const closest = m.era.goals.filter((g) => !g.done).sort((a, b) => (b.value / b.target) - (a.value / a.target))[0];
  const action = closest && GOAL_ACTION[closest.id];
  const ageLabelNode = lang === 'he' ? null : <span className="fa-label">{tNow('p1.no.ageLabel')}</span>;
  const ageNameNode = <span className="font-semibold">{m.ageName}</span>;
  const turnNode = <span className="fa-num">{m.turn}</span>;
  const ageNodes = { label: ageLabelNode, age: ageNameNode, turn: turnNode };

  return (
    <>
    <GovernmentChangeDialog />
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3 sheet-backdrop" onClick={close} data-testid="nation-overview">
      <div role="dialog" aria-modal="true" aria-labelledby="nation-overview-title" onClick={(e) => e.stopPropagation()}
        className="sheet-panel sheet-wide fa-sheet w-full max-w-5xl max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <div className="flex items-start gap-1">
          <div className="ps-4 pt-4"><Shield color={m.color} size={22} /></div>
          <SheetHeader className="flex-1 !ps-2.5" title={m.name} titleId="nation-overview-title" onClose={close}
            subtitle={tNow('p1.no.sub', { cities: tNow('empire.cities', { count: m.cities }), capital: m.capital ? tNow('p1.no.subCapital', { name: m.capital }) : '', age: m.ageName })} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
          <div className="space-y-3">
            {m.ruler && (
              <Card testId="nation-ruler">
                <Label>{tNow('p1.no.ruler')}</Label>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="fa-heading text-[17px] leading-tight">{m.ruler.name}</span>
                  {m.ruler.dynasty && <span className="text-[12px] text-fa-muted">{tNow('p1.no.ofHouse', { dynasty: m.ruler.dynasty })}</span>}
                  <span className="text-[12px] text-fa-muted">{m.ruler.reignTurns ? tNow('p1.no.reign', { count: m.ruler.reignTurns }) : tNow('p1.no.reignBegins')}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {m.ruler.skills.map((k) => (
                    <div key={k.id} className="rounded-md border border-fa-line bg-fa-ink/40 px-2 py-1.5" title={tNow('p1.no.skillTip', { label: k.label, value: k.value, hint: k.hint })}>
                      <div className="flex items-baseline justify-between"><span className="fa-label">{k.label}</span><span className="fa-num text-[16px] font-semibold">{k.value}</span></div>
                      <div className="text-[11px] text-fa-muted leading-tight">{k.hint}</div>
                    </div>
                  ))}
                </div>
                {m.ruler.traits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.ruler.traits.map((t) => <span key={t.id} className={`fa-chip !min-h-[28px] ${t.bad ? 'text-fa-danger-text border-fa-danger' : ''}`} title={t.description}>{t.name}</span>)}
                  </div>
                )}
                <div className="text-[11px] text-fa-muted">{tNow('p1.no.noHeirs')}</div>
              </Card>
            )}
            <Card testId="nation-government">
              <Label>{tNow('p1.no.govTitle')}</Label>
              <div className="text-[14px] font-semibold">{m.government.name}{m.government.reforms.length > 0 ? <span className="text-fa-muted font-normal">, {m.government.reforms.map((x) => x.name).join(', ')}</span> : null}</div>
              {m.government.reforms.slice(-1).map((x) => <div key={x.id} className="text-[12px] text-fa-muted leading-snug">{x.description}</div>)}
              {m.government.nextTitle && (
                <div>
                  <div className="flex items-baseline justify-between gap-2 text-[12px]"><span>{rich(tNow('p1.no.nextTitle'), { title: <span className="font-semibold">{m.government.nextTitle.title}</span> })}</span><span className="fa-num text-fa-muted shrink-0">{tNow('p1.no.citiesOf', { a: m.government.nextTitle.cities, b: m.government.nextTitle.needed })}</span></div>
                  <Meter value={m.government.nextTitle.cities} max={m.government.nextTitle.needed} color="var(--fa-you)" height={4} className="mt-1" />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-3">
            <Card testId="nation-stability">
              <div className="flex items-baseline justify-between"><Label>{tNow('p1.auth.stability')}</Label><span className={`fa-num text-[15px] font-semibold ${s.value > 0 ? 'text-fa-good' : s.value < 0 ? 'text-fa-danger-text' : ''}`}>{signed(s.value)}</span></div>
              <div className="flex gap-0.5" role="meter" aria-label={tNow('p1.no.stabilityAria', { value: s.value, min: s.min, max: s.max })} aria-valuenow={s.value} aria-valuemin={s.min} aria-valuemax={s.max}>
                {Array.from({ length: s.max - s.min + 1 }, (_, i) => s.min + i).map((v) => (
                  <span key={v} className={`h-2 flex-1 rounded-sm ${v === 0 ? (s.value === 0 ? 'bg-fa-text' : 'bg-fa-line') : v < 0 ? (s.value <= v ? 'bg-fa-danger' : 'bg-fa-danger/20') : (s.value >= v ? 'bg-fa-good' : 'bg-fa-good/20')}`} />
                ))}
              </div>
              <div className="flex items-baseline justify-between pt-1"><Label>{tNow('p1.auth.legitimacy')}</Label><span className="fa-num text-[15px] font-semibold text-fa-brass">{s.legitimacy}</span></div>
              <Meter value={s.legitimacy} max={100} color="var(--fa-good)" height={5} />
              <div className="text-[11px] text-fa-muted">{tNow('p1.no.legitHelp')}</div>
              <details className="pt-1 group">
                <summary className="list-none cursor-pointer flex items-baseline justify-between min-h-[32px] items-center">
                  <span className="fa-label">{tNow('p1.dom.authority')} <span className="normal-case tracking-normal font-normal text-fa-muted">{tNow('p1.no.tapWhy')}</span></span>
                  <span className="fa-num text-[15px] font-semibold">{s.authority}</span>
                </summary>
                <ul className="space-y-0.5 pt-1" data-testid="nation-authority-reasons">
                  <li className="flex justify-between text-[12px]"><span className="text-fa-muted">{tNow('p1.auth.base')}</span><span className="fa-num">{s.base}</span></li>
                  {s.parts.map((p) => <li key={p.id} className="flex justify-between text-[12px]"><span className="text-fa-muted truncate">{p.label}</span><span className={`fa-num ${p.value < 0 ? 'text-fa-danger-text' : ''}`}>{signed(p.value)}</span></li>)}
                </ul>
              </details>
            </Card>
            <Card testId="nation-victory">
              <Label>{tNow('p1.no.victory')}</Label>
              {m.victory.map((v) => (
                <div key={v.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]"><span>{v.label}</span><span className="fa-num text-[11px] text-fa-muted text-end">{v.text}</span></div>
                  <Meter value={v.value} max={v.target} color="var(--fa-you)" height={4} className="mt-1" />
                </div>
              ))}
              <div className="flex items-baseline justify-between text-[13px] pt-0.5"><span>{tNow('p1.no.score')}</span><span className="fa-num text-[12px]">{rich(tNow('p1.no.rankOf', { of: m.score.of }), { rank: <span className="text-fa-brass">{m.score.rank}</span> })}</span></div>
            </Card>
          </div>

          <Card testId="nation-era-goals" className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-baseline justify-between gap-2"><Label>{tNow('p1.no.eraGoals', { age: m.era.ageName })}</Label><span className="text-[12px] text-fa-muted">{rich(tNow('p1.no.met', { needed: m.era.needed }), { met: <span className="fa-num text-fa-text">{m.era.met}</span> })}</span></div>
            <div className="text-[11px] text-fa-muted -mt-1">{tNow('p1.no.legacyFor', { turns: m.era.legacyTurns })}</div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {m.era.goals.map((g) => (
                <div key={g.id} className={`rounded-md border px-2.5 py-1.5 ${g.id === closest?.id ? 'fa-selected' : 'border-fa-line'}`}>
                  <div className="flex items-baseline justify-between gap-2"><span className="text-[13px] font-semibold">{g.label}</span><span className={`fa-num text-[12px] ${g.done ? 'text-fa-good' : ''}`}>{Math.min(g.value, g.target)} / {g.target}</span></div>
                  <Meter value={g.value} max={g.target} color={g.done ? 'var(--fa-good)' : 'var(--fa-you)'} height={4} className="mt-1" />
                  <div className="text-[11px] text-fa-muted leading-tight mt-0.5">{tNow('p1.no.unitLegacy', { unit: g.unit, bonus: g.bonus })}</div>
                </div>
              ))}
            </div>
            {action && <Button className="w-full" onClick={() => { close(); action.go(); }}>{tNow(action.label)}</Button>}
          </Card>
          <Card testId="nation-map"><MapCard map={state.scenario?.map} /></Card>
        </div>
        <div className="px-4 py-2.5 border-t border-fa-line shrink-0" data-testid="nation-age-strip">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[12px]">{rich(tNow('p1.no.ageStrip'), ageNodes)}</span>
            {m.nextAge && <span className="text-[12px] text-fa-muted">{rich(tNow('p1.no.nextAge', { name: m.nextAge.name }), { techs: <span className="fa-num text-fa-text">{m.nextAge.techs}</span> })}</span>}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {m.ages.map((a) => (
              <div key={a.id} className="min-w-0" aria-current={a.current ? 'step' : undefined}>
                <span className={`block h-1.5 rounded-full ${a.past ? 'bg-fa-text/70' : a.current ? 'bg-fa-brass' : 'bg-fa-line'}`} />
                <span className={`block text-[11px] mt-0.5 truncate ${a.current ? 'font-semibold text-fa-text' : 'text-fa-muted'}`}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default NationOverviewSheet;
