// src/components/independents/IndependentCityCard.jsx
// An independent on the city card (RegionInfoModal, phase W4): shield, attitude and grudge at a
// glance, what is going on (a raid, a demand, an offer, the deals), and the full sheet behind one
// 44 px button. Replaces the W2/W3 placeholder IndependentStatus.
import React, { useMemo } from 'react';
import { independentSummary } from './independentSheetModel';
import { openIndependent } from './independentEvents';
import { ShieldMark, TONE_TEXT } from './IndependentBits';

const IndependentCityCard = ({ state, nationId }) => {
  const s = useMemo(() => independentSummary(state, nationId), [state, nationId]);
  if (!s) return null;
  return (
    <div className="mt-1.5 p-2 rounded-lg bg-fa-raised/60 border border-dashed border-fa-indep/60 text-[11px] text-fa-text space-y-1.5" data-testid="independent-status">
      <div className="flex items-center gap-2">
        <ShieldMark personality={s.personality.id} size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-fa-indep">Independent · {s.personality.name}</div>
          <div className="flex gap-3">
            <span data-testid="independent-attitude">Attitude <span className={TONE_TEXT[s.attitude.tone]}>{s.attitude.word} {s.attitude.value > 0 ? '+' : ''}{s.attitude.value}</span></span>
            <span>Grudge <span className={TONE_TEXT[s.grudge.tone]}>{s.grudge.value}</span></span>
          </div>
        </div>
      </div>
      {s.lines.map((l, i) => <div key={i} className={TONE_TEXT[l.tone]}>{l.text}</div>)}
      <button type="button" onClick={() => openIndependent(s.id)} className="w-full min-h-[44px] rounded-lg bg-fa-hover hover:bg-fa-line border border-fa-line text-[12px] font-semibold text-fa-text" data-testid="open-independent-sheet">
        Open their sheet: deals, mercenaries, actions
      </button>
    </div>
  );
};

export default IndependentCityCard;
