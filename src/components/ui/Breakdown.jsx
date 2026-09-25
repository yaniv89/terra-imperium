// src/components/ui/Breakdown.jsx
// Plan §M20: renders a [{label, value}] breakdown (as returned by getModifier(...).breakdown or a
// helper like getPowerBreakdown) as signed, colour-coded rows plus a total line — the generic
// building block behind "every number explains itself". Deliberately takes plain rows rather than a
// {scope, modKey} pair (the plan's own sketch): callers like getPowerBreakdown already compose
// several modifier keys plus non-modifier lines (satellites, missions) into one row list, so asking
// this component to re-derive that from a single modKey would be less capable, not more generic.
import React from 'react';

const formatSigned = (value) => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}`;
};

const Breakdown = ({ rows, total = null, unit = '' }) => {
  const computedTotal = total !== null ? total : rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="min-w-[10rem]">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex justify-between gap-3">
          <span className="text-slate-300">{row.label}</span>
          <span className={row.value > 0 ? 'text-emerald-400' : row.value < 0 ? 'text-red-400' : 'text-slate-400'}>
            {formatSigned(row.value)}{unit}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-3 mt-1 pt-1 border-t border-slate-600 font-bold">
        <span>Total</span>
        <span>{formatSigned(computedTotal)}{unit}</span>
      </div>
    </div>
  );
};

export default Breakdown;
