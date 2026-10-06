// src/components/independents/IndependentsList.jsx
// The independents in Relations (phase W4, independentsListModel.js): every independent you have
// met with its personality, distance, attitude, grudge and the current deal; sort and filter
// chips (the chosen chip is a raised fill with a light outline); a row opens the sheet. Rows and
// chips are 44 px tall on a phone.
import React, { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { independentsListModel, LIST_SORTS, LIST_FILTERS, kmLabel } from './independentsListModel';
import { openIndependent } from './independentEvents';
import { ShieldMark, TONE_TEXT } from './IndependentBits';

const Chip = ({ on, onClick, children, testId }) => (
  <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId}
    className={`min-h-[36px] pl:min-h-[44px] px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap border ${on ? 'bg-fa-raised text-fa-text border-transparent outline outline-2 outline-fa-text' : 'bg-fa-raised/60 text-fa-muted border-fa-line hover:bg-fa-hover hover:text-fa-text'}`}>
    {children}
  </button>
);

const IndependentsList = () => {
  const { state } = useGame();
  const [sort, setSort] = useState('distance');
  const [filter, setFilter] = useState('all');
  const [more, setMore] = useState(false);
  const m = useMemo(() => independentsListModel(state, { sort, filter }), [state, sort, filter]);
  if (!m.total) return null;
  const shown = more ? m.rows : m.rows.slice(0, 12);
  return (
    <div className="space-y-2" data-testid="independents-list">
      <div className="flex items-center justify-between">
        <h3 className="fa-heading text-[16px]">Independents <span className="fa-num text-[12px] text-fa-indep">{m.total}</span></h3>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter">
        {LIST_FILTERS.filter((f) => f.id === 'all' || m.counts[f.id] > 0).map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)} testId={`indep-filter-${f.id}`}>{f.label} {m.counts[f.id]}</Chip>
        ))}
      </div>
      <div className="flex gap-1.5 items-center overflow-x-auto pb-1" role="group" aria-label="Sort">
        <span className="text-[11px] text-fa-muted shrink-0">Sort</span>
        {LIST_SORTS.map((s) => <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)} testId={`indep-sort-${s.id}`}>{s.label}</Chip>)}
      </div>
      {!m.rows.length && <div className="text-[11px] text-fa-muted">None here.</div>}
      <ul className="space-y-1">
        {shown.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => openIndependent(r.id)} className="w-full min-h-[48px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-fa-raised hover:bg-fa-hover border border-dashed border-fa-indep/50 text-left" data-testid="indep-row" data-indep={r.id}>
              <ShieldMark personality={r.personality} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-fa-text truncate">{r.name}</span>
                <span className="block text-[11px] text-fa-muted truncate">{r.personalityName} · {r.cityName} {r.size} · {kmLabel(r.km)}</span>
              </span>
              <span className="text-right shrink-0">
                <span className={`block text-[11px] ${TONE_TEXT[r.attitudeTone]}`}>{r.attitudeWord} {r.attitude > 0 ? '+' : ''}{r.attitude}</span>
                <span className={`block text-[10px] ${r.deal ? TONE_TEXT[r.deal.tone] : r.grudge ? TONE_TEXT[r.grudgeTone] : 'text-fa-muted'}`}>{r.deal ? r.deal.label : r.grudge ? `grudge ${r.grudge}` : 'no deal'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {m.rows.length > shown.length && <button type="button" onClick={() => setMore(true)} className="fa-btn fa-btn-secondary w-full" data-testid="indep-more">Show all {m.rows.length}</button>}
    </div>
  );
};

export default IndependentsList;
