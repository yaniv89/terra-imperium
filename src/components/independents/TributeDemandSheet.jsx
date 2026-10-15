// src/components/independents/TributeDemandSheet.jsx
// W15 Raiders and tribute (plans/UI-DESIGN.md; phase W4, tributeSheetModel.js): an independent
// demands tribute. A panel on the right over the map, so the raid party and its target stay in
// view on the left: the grudge meter with what a refusal adds, three choices as cards (Pay;
// Refuse and prepare, with the expected loss; Refuse and hire mercenaries) and one brass button
// that does the chosen one. The chosen card is a raised fill with a light outline (never brass).
// Closing it decides nothing: the demand stays in Peoples and on the independent's sheet until it
// lapses (silence is a refusal). Also: the join offer sheet (W3's offer, Accept or Decline).
import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { focusRegion } from '../map/marchEvents';
import { Button, CloseButton } from '../ui/atlas';
import { tributeDemandModel, joinOfferModel } from './tributeSheetModel';
import { subjectVerb } from '../../engine/grammar';
import { openIndependent } from './independentEvents';
import { ShieldMark, GrudgeMeter, CardLabel } from './IndependentBits';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { agreed } from '../battle/battleText';

// The independents' panel: dashed violet border (UI-DESIGN 2: independent = dashed), right side.
// A decision card: nothing behind it catches taps, so a tap on the map (or on another card's
// button under it) never closes it; only its own buttons do (playtest audit X18). The map stays
// live around it.
const Frame = ({ testId, label, children }) => (
  <div className="fixed inset-0 z-[68] pointer-events-none" data-testid={testId}>
    <div role="dialog" aria-label={label}
      className="pointer-events-auto absolute end-[calc(var(--rail-inset,0px)+0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] max-h-[calc(100dvh-var(--header-height,2.5rem)-0.375rem-max(env(safe-area-inset-bottom),0.5rem))] w-[min(27rem,calc(100vw-1rem-var(--rail-inset,0px)))] flex flex-col fa-panel !bg-fa-panel !border-dashed !border-fa-indep/80 shadow-2xl">
      {children}
    </div>
  </div>
);

const Header = ({ m, title, onClose }) => {
  const { t } = useT();
  return (
  <div className="flex items-start gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
    <button type="button" onClick={() => openIndependent(m.indepId)} aria-label={t('td.openSheet', { name: m.name })} className="min-w-[44px] min-h-[44px] -ms-1 flex items-center justify-center rounded-lg hover:bg-fa-raised"><ShieldMark personality={m.personality.id} size={32} /></button>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-fa-indep">{t('td.independent', { kind: m.personality.name })}</div>
      <h2 className="fa-heading text-[15px] leading-tight">{title}</h2>
    </div>
    <CloseButton onClick={onClose} label={t('td.decideLater')} className="-me-1" />
  </div>
  );
};

// `asked`: the player opened it (End Turn's blocker, Peoples); otherwise it arrived and takes its
// turn behind a more pressing card (useExclusivePanel.js), waiting as a chip.
export const TributeDemandSheet = ({ demandId, onClose, asked = false }) => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const turnsOf = (n) => t('ind.turns', { count: n });
  const m = useMemo(() => tributeDemandModel(state, demandId), [state, demandId]);
  const [pick, setPick] = useState(null);
  const turn = useInteraction('tribute', !!m, { priority: PRIORITY.tribute, label: m ? tNow('wait.tribute', { name: m.name }) : null, testId: 'tribute-chip', user: asked });
  if (!m || !turn.shown) return null;
  const chosen = m.choices.find((c) => c.id === (pick || m.preferred)) || m.choices[0];
  const go = () => {
    if (!chosen.ok) return;
    chosen.actions.forEach((a) => dispatch(a));
    onClose();
  };
  const verb = chosen.id === 'pay' ? t('td.pay') : chosen.id === 'hire' ? t('td.hireRefuse') : t('td.refuse');
  return (
    <Frame testId="tribute-demand-sheet" label={t('td.ariaDemand', { name: m.name })} onClose={onClose}>
      <Header m={m} title={agreed('td.title', { name: m.name, gold: m.gold, turns: m.turns }, () => `${subjectVerb(m.nameEn, 'demand')} ${m.gold} gold a turn for ${m.turns} turns, or they raid`)} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-[12px]">
        <section className="space-y-1" data-testid="tribute-grudge">
          <CardLabel right={<span className="fa-num normal-case tracking-normal text-[12px] text-fa-text">{m.grudge.value} {m.grudge.word}{chosen.id !== 'pay' ? <span className="text-fa-danger-text">{t('td.grudgeAfter', { a: m.grudge.after - m.grudge.value, b: m.grudge.after })}</span> : null}</span>}>{t('td.grudgeToward')}</CardLabel>
          <GrudgeMeter value={m.grudge.value} max={m.grudge.max} after={chosen.id !== 'pay' ? m.grudge.after : null} />
          <div className="flex justify-between text-[10px] text-fa-muted">{m.grudge.bands.map((b) => <span key={b.from}>{b.word}</span>)}</div>
        </section>
        <div className="space-y-1.5" role="radiogroup" aria-label={t('td.yourAnswer')}>
          {m.choices.map((c) => {
            const on = c.id === chosen.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(c.id)} data-testid={`tribute-choice-${c.id}`}
                className={`w-full min-h-[44px] text-start fa-option px-2.5 py-1.5 ${on ? 'fa-selected' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{c.title}</span>
                  <span className="fa-num text-[11px] text-fa-muted shrink-0">{c.figure}</span>
                </div>
                <div className="text-fa-muted leading-snug mt-0.5">{c.text}</div>
                {c.warn && <div className="text-fa-enemy mt-0.5">{c.warn}</div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-fa-line">
        <div className="flex-1 min-w-0 text-[11px] text-fa-muted leading-snug">
          {m.footnote || t('td.answerWithin', { turns: turnsOf(m.turnsLeft) })}
          {m.loss && <button type="button" onClick={() => { onClose(); focusRegion(m.loss.cityId); }} className="ms-1 underline text-fa-text min-h-[32px]" disabled={m.loss.cityId == null}>{t('td.show', { where: m.loss.where })}</button>}
        </div>
        <Button variant="primary" hero onClick={go} disabled={!chosen.ok} className="!min-h-[48px] !px-5 shrink-0" data-testid="tribute-go">{verb}</Button>
      </div>
    </Frame>
  );
};

export const JoinOfferSheet = ({ offerId, onClose, asked = false }) => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const m = useMemo(() => joinOfferModel(state, offerId), [state, offerId]);
  const turn = useInteraction('join-offer', !!m, { priority: PRIORITY.join, label: m ? tNow('wait.join', { name: m.name }) : null, testId: 'join-chip', user: asked });
  if (!m || !turn.shown) return null;
  return (
    <Frame testId="join-offer-sheet" label={t('td.joinAria', { name: m.name })} onClose={onClose}>
      <Header m={m} title={t('td.joinTitle', { name: m.name })} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-[12.5px]">
        <div>{t('td.chose')}</div>
        <ul className="space-y-0.5">{m.gains.map((g) => <li key={g} className="flex gap-2"><span className="text-fa-indep">•</span>{g}</li>)}</ul>
        <div className="text-fa-muted">{t('td.offerStands', { turns: t('ind.turns', { count: m.turnsLeft }) })}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-t border-fa-line">
        <Button onClick={() => { dispatch(m.decline); onClose(); }} data-testid="join-decline">{t('td.decline')}</Button>
        <Button variant="primary" hero onClick={() => { dispatch(m.accept); onClose(); }} data-testid="join-accept">{t('td.accept', { city: m.city.name })}</Button>
      </div>
    </Frame>
  );
};

export default TributeDemandSheet;
