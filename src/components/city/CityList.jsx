// src/components/city/CityList.jsx
// The list of the player's cities (cityRailModel.js), one 44 px row each: the size in the owner's
// colour, the name, what it builds with a thin production bar and its turns, growth, and the marks
// that want a look (nothing queued, besieged, starving, restless). Tapping a row opens the city.
// Used by the desktop city rail and the Cities tab of the side panel.
import React, { useMemo } from 'react';
import { Castle, Flame, AlertTriangle, Hourglass } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { cityRailModel } from './cityRailModel';
import { useT } from '../../i18n/useT';

const CityList = ({ onSelect, compact = false }) => {
  const { state } = useGame();
  const { t, n, name: nm, lang } = useT();
  // The model reads the current language through t(): recompute when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => cityRailModel(state), [state, lang]);
  const colour = state.nations?.[state.playerNationId]?.color || 'var(--fa-you)';
  if (!rows.length) return <p className="text-[12px] text-fa-muted p-3">{t('cities.none')}</p>;
  return (
    <ul className="divide-y divide-fa-line" data-testid="city-list">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onSelect?.(r.id)} data-testid="city-rail-row" data-city-id={r.id}
            className={`w-full text-start ${compact ? 'px-3' : 'px-2'} py-1.5 min-h-[48px] hover:bg-fa-raised flex items-center gap-2.5`}>
            <span className="w-7 h-7 rounded-full fa-num text-[12px] font-semibold text-fa-ink flex items-center justify-center shrink-0" style={{ background: colour }}>{r.size}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="fa-heading text-[14px] truncate">{nm('city', null, r.name)}</span>
                {r.capital && <span className="text-[11px] text-fa-muted">{t('cities.capital')}</span>}
                {r.outpost && <span className="text-[11px] text-fa-muted">{t('cities.outpost')}</span>}
              </span>
              <span className="block text-[11px] text-fa-muted truncate">
                {r.outpost ? t('cities.growing') : r.idle ? t('cities.nothingQueued') : `${r.building}${r.buildTurns ? t('cities.inTurns', { n: n(r.buildTurns) }) : ''}`}
                {r.growthTurns ? t('cities.growsIn', { n: n(r.growthTurns) }) : ''}
              </span>
              {!r.idle && !r.outpost && r.buildShare != null && (
                <span className="fa-bar mt-1 w-full max-w-[9rem]" style={{ height: 3 }} aria-hidden="true"><span style={{ width: `${Math.round(r.buildShare * 100)}%`, background: '#CDB27A' }} /></span>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {r.idle && <Hourglass className="w-4 h-4 text-fa-brass" aria-label={t('cities.nothingQueued')} />}
              {r.besieged && <Castle className="w-4 h-4 text-fa-danger-text" aria-label={t('cities.siege')} />}
              {r.starving && <Flame className="w-4 h-4 text-fa-enemy" aria-label={t('cities.starving')} />}
              {r.restless && <AlertTriangle className="w-4 h-4 text-fa-danger-text" aria-label={t('cities.unrest', { n: r.unrest })} />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default CityList;
