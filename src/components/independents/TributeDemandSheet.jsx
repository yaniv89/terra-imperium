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
import { focusRegion } from '../map/marchEvents';
import { Button, CloseButton } from '../ui/atlas';
import { tributeDemandModel, joinOfferModel } from './tributeSheetModel';
import { openIndependent } from './independentEvents';
import { ShieldMark, GrudgeMeter, CardLabel } from './IndependentBits';

// The independents' panel: dashed violet border (UI-DESIGN 2: independent = dashed), right side.
const Frame = ({ testId, label, onClose, children }) => (
  <div className="fixed inset-0 z-[68] pointer-events-none" data-testid={testId}>
    <button type="button" aria-label="Decide later" onClick={onClose} className="absolute inset-0 bg-black/25 pointer-events-auto cursor-default sm:bg-transparent" tabIndex={-1} />
    <div role="dialog" aria-label={label}
      className="pointer-events-auto absolute right-[calc(var(--rail-inset,0px)+0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] max-h-[calc(100dvh-var(--header-height,2.5rem)-0.375rem-max(env(safe-area-inset-bottom),0.5rem))] w-[min(27rem,calc(100vw-1rem-var(--rail-inset,0px)))] flex flex-col fa-panel !bg-fa-panel !border-dashed !border-fa-indep/80 shadow-2xl">
      {children}
    </div>
  </div>
);

const Header = ({ m, title, onClose }) => (
  <div className="flex items-start gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
    <button type="button" onClick={() => openIndependent(m.indepId)} aria-label={`Open the sheet of ${m.name}`} className="min-w-[44px] min-h-[44px] -ml-1 flex items-center justify-center rounded-lg hover:bg-fa-raised"><ShieldMark personality={m.personality.id} size={32} /></button>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-fa-indep">Independent · {m.personality.name}</div>
      <h2 className="fa-heading text-[15px] leading-tight">{title}</h2>
    </div>
    <CloseButton onClick={onClose} label="Decide later" className="-mr-1" />
  </div>
);

export const TributeDemandSheet = ({ demandId, onClose }) => {
  const { state, dispatch } = useGame();
  const m = useMemo(() => tributeDemandModel(state, demandId), [state, demandId]);
  const [pick, setPick] = useState(null);
  if (!m) return null;
  const chosen = m.choices.find((c) => c.id === (pick || m.preferred)) || m.choices[0];
  const go = () => {
    if (!chosen.ok) return;
    chosen.actions.forEach((a) => dispatch(a));
    onClose();
  };
  const verb = chosen.id === 'pay' ? 'Pay' : chosen.id === 'hire' ? 'Hire and refuse' : 'Refuse';
  return (
    <Frame testId="tribute-demand-sheet" label={`${m.name} demand tribute`} onClose={onClose}>
      <Header m={m} title={`${m.name} demand ${m.gold} gold a turn for ${m.turns} turns, or they raid`} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-[12px]">
        <section className="space-y-1" data-testid="tribute-grudge">
          <CardLabel right={<span className="fa-num normal-case tracking-normal text-[12px] text-fa-text">{m.grudge.value} {m.grudge.word}{chosen.id !== 'pay' ? <span className="text-fa-danger-text"> +{m.grudge.after - m.grudge.value} to {m.grudge.after}</span> : null}</span>}>Grudge toward you</CardLabel>
          <GrudgeMeter value={m.grudge.value} max={m.grudge.max} after={chosen.id !== 'pay' ? m.grudge.after : null} />
          <div className="flex justify-between text-[10px] text-fa-muted">{m.grudge.bands.map((b) => <span key={b.from}>{b.word}</span>)}</div>
        </section>
        <div className="space-y-1.5" role="radiogroup" aria-label="Your answer">
          {m.choices.map((c) => {
            const on = c.id === chosen.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(c.id)} data-testid={`tribute-choice-${c.id}`}
                className={`w-full min-h-[44px] text-left fa-option px-2.5 py-1.5 ${on ? 'fa-selected' : ''}`}>
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
          {m.footnote || `Answer within ${m.turnsLeft} turn${m.turnsLeft === 1 ? '' : 's'}; silence is a refusal.`}
          {m.loss && <button type="button" onClick={() => { onClose(); focusRegion(m.loss.cityId); }} className="ml-1 underline text-fa-text min-h-[32px]" disabled={m.loss.cityId == null}>Show {m.loss.where}</button>}
        </div>
        <Button variant="primary" hero onClick={go} disabled={!chosen.ok} className="!min-h-[48px] !px-5 shrink-0" data-testid="tribute-go">{verb}</Button>
      </div>
    </Frame>
  );
};

export const JoinOfferSheet = ({ offerId, onClose }) => {
  const { state, dispatch } = useGame();
  const m = useMemo(() => joinOfferModel(state, offerId), [state, offerId]);
  if (!m) return null;
  return (
    <Frame testId="join-offer-sheet" label={`${m.name} offer to join you`} onClose={onClose}>
      <Header m={m} title={`${m.name} offer to join you`} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 text-[12.5px]">
        <div>Their people chose your rule. You gain:</div>
        <ul className="space-y-0.5">{m.gains.map((g) => <li key={g} className="flex gap-2"><span className="text-fa-indep">•</span>{g}</li>)}</ul>
        <div className="text-fa-muted">The offer stands {m.turnsLeft} more turn{m.turnsLeft === 1 ? '' : 's'}.</div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-t border-fa-line">
        <Button onClick={() => { dispatch(m.decline); onClose(); }} data-testid="join-decline">Decline</Button>
        <Button variant="primary" hero onClick={() => { dispatch(m.accept); onClose(); }} data-testid="join-accept">Accept {m.city.name}</Button>
      </div>
    </Frame>
  );
};

export default TributeDemandSheet;
