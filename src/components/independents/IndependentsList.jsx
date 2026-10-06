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
    className={`min-h-[36px] pl:min-h-[44px] px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap border ${on ? 'bg-slate-700 text-white border-transparent outline outline-2 outline-[#ECE5D3]' : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'}`}>
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
        <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#9C8FD0]">Independents ({m.total})</div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter">
        {LIST_FILTERS.filter((f) => f.id === 'all' || m.counts[f.id] > 0).map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)} testId={`indep-filter-${f.id}`}>{f.label} {m.counts[f.id]}</Chip>
        ))}
      </div>
      <div className="flex gap-1.5 items-center overflow-x-auto pb-1" role="group" aria-label="Sort">
        <span className="text-[11px] text-slate-500 shrink-0">Sort</span>
        {LIST_SORTS.map((s) => <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)} testId={`indep-sort-${s.id}`}>{s.label}</Chip>)}
      </div>
      {!m.rows.length && <div className="text-[11px] text-slate-500">None here.</div>}
      <ul className="space-y-1">
        {shown.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => openIndependent(r.id)} className="w-full min-h-[44px] flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 border border-dashed border-[#9C8FD0]/40 text-left" data-testid="indep-row" data-indep={r.id}>
              <ShieldMark personality={r.personality} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-white truncate">{r.name}</span>
                <span className="block text-[10px] text-slate-400 truncate">{r.personalityName} · {r.cityName} {r.size} · {kmLabel(r.km)}</span>
              </span>
              <span className="text-right shrink-0">
                <span className={`block text-[11px] ${TONE_TEXT[r.attitudeTone]}`}>{r.attitudeWord} {r.attitude > 0 ? '+' : ''}{r.attitude}</span>
                <span className={`block text-[10px] ${r.deal ? TONE_TEXT[r.deal.tone] : r.grudge ? TONE_TEXT[r.grudgeTone] : 'text-slate-500'}`}>{r.deal ? r.deal.label : r.grudge ? `grudge ${r.grudge}` : 'no deal'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {m.rows.length > shown.length && <button type="button" onClick={() => setMore(true)} className="w-full min-h-[44px] rounded-lg bg-slate-800/60 hover:bg-slate-700 text-[12px] text-slate-200" data-testid="indep-more">Show all {m.rows.length}</button>}
    </div>
  );
};

export default IndependentsList;
