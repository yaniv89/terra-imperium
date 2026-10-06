// src/components/independents/TributeDemandSheet.jsx
// An independent demands tribute (phase W4, the W15 sketch, tributeSheetModel.js): the grudge
// meter with what a refusal adds, three choices as cards (Pay; Refuse and prepare, with the
// expected loss; Refuse and hire mercenaries) and one brass button that does the chosen one.
// The chosen card is a raised fill with a light outline (uidesign SPEC-REVISION 3). Closing it
// decides nothing: the demand stays in Relations and on the independent's sheet until it lapses
// (silence is a refusal). Also: the join offer sheet (W3's offer, Accept or Decline).
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { focusRegion } from '../map/marchEvents';
import { tributeDemandModel, joinOfferModel } from './tributeSheetModel';
import { openIndependent } from './independentEvents';
import { ShieldMark, GrudgeMeter, CardLabel } from './IndependentBits';

const Frame = ({ testId, label, onClose, children }) => (
  <div className="fixed inset-0 z-[68] bg-black/40 flex items-end sm:items-center justify-center sheet-backdrop" onClick={onClose} data-testid={testId}>
    <div onClick={(e) => e.stopPropagation()} className="sheet-panel w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-slate-900 border border-dashed border-[#9C8FD0]/70 rounded-t-2xl sm:rounded-2xl shadow-2xl text-slate-200" role="dialog" aria-label={label}>
      {children}
    </div>
  </div>
);

const Header = ({ m, title, onClose }) => (
  <div className="flex items-start gap-2.5 px-3 pt-3 pb-2 border-b border-slate-700">
    <button type="button" onClick={() => openIndependent(m.indepId)} aria-label={`Open the sheet of ${m.name}`} className="min-w-[44px] min-h-[44px] -ml-1 flex items-center justify-center rounded-lg hover:bg-slate-800"><ShieldMark personality={m.personality.id} size={34} /></button>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#9C8FD0]">Independent · {m.personality.name}</div>
      <div className="text-[15px] font-bold text-white leading-snug">{title}</div>
    </div>
    <button type="button" onClick={onClose} aria-label="Decide later" className="min-w-[44px] min-h-[44px] -mr-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-[12px]">
        <section className="space-y-1" data-testid="tribute-grudge">
          <CardLabel right={<span className="font-mono normal-case tracking-normal text-[12px] text-slate-200">{m.grudge.value} {m.grudge.word}{chosen.id !== 'pay' ? <span className="text-red-300"> +{m.grudge.after - m.grudge.value} to {m.grudge.after}</span> : null}</span>}>Grudge toward you</CardLabel>
          <GrudgeMeter value={m.grudge.value} max={m.grudge.max} after={chosen.id !== 'pay' ? m.grudge.after : null} />
          <div className="flex justify-between text-[10px] text-slate-400">{m.grudge.bands.map((b) => <span key={b.from}>{b.word}</span>)}</div>
        </section>
        <div className="space-y-2" role="radiogroup" aria-label="Your answer">
          {m.choices.map((c) => {
            const on = c.id === chosen.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(c.id)} data-testid={`tribute-choice-${c.id}`}
                className={`w-full min-h-[44px] text-left rounded-lg p-2 border ${on ? 'bg-slate-700 border-transparent outline outline-2 outline-[#ECE5D3]' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-white">{c.title}</span>
                  <span className="font-mono text-[11px] text-slate-300 shrink-0">{c.figure}</span>
                </div>
                <div className="text-slate-300 mt-0.5">{c.text}</div>
                {c.warn && <div className="text-amber-200 mt-0.5">{c.warn}</div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-700 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex-1 min-w-0 text-[11px] text-slate-400">
          {m.footnote || `Answer within ${m.turnsLeft} turn${m.turnsLeft === 1 ? '' : 's'}; silence is a refusal.`}
          {m.loss && <button type="button" onClick={() => { onClose(); focusRegion(m.loss.cityId); }} className="ml-1 underline text-slate-300 min-h-[32px]" disabled={m.loss.cityId == null}>Show {m.loss.where}</button>}
        </div>
        <button type="button" onClick={go} disabled={!chosen.ok} className="min-h-[48px] px-5 rounded-lg font-bold bg-[#D8A444] hover:bg-[#e3b45a] text-slate-950 disabled:opacity-50 shrink-0" data-testid="tribute-go">{verb}</button>
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[12px]">
        <div>Their people chose your rule. You gain:</div>
        <ul className="list-disc pl-5 space-y-0.5 text-slate-200">{m.gains.map((g) => <li key={g}>{g}</li>)}</ul>
        <div className="text-slate-400">The offer stands {m.turnsLeft} more turn{m.turnsLeft === 1 ? '' : 's'}.</div>
      </div>
      <div className="flex gap-2 px-3 py-2 border-t border-slate-700 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => { dispatch(m.decline); onClose(); }} className="flex-1 min-h-[48px] rounded-lg border border-slate-500 bg-slate-800 hover:bg-slate-700 font-semibold" data-testid="join-decline">Decline</button>
        <button type="button" onClick={() => { dispatch(m.accept); onClose(); }} className="flex-1 min-h-[48px] rounded-lg font-bold bg-[#D8A444] hover:bg-[#e3b45a] text-slate-950" data-testid="join-accept">Accept {m.city.name}</button>
      </div>
    </Frame>
  );
};

export default TributeDemandSheet;
