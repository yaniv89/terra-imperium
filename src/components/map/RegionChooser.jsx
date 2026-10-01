// src/components/map/RegionChooser.jsx
// "Which one?" for a tap that covered several provinces (plan §3, regionClickAssist.js
// tapCandidates): a small list beside the finger, one row per province with its owner's colour.
import React, { useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { getRegionFillColor } from '../../utils/mapRegionStyle';

const RegionChooser = ({ choice, onPick, onClose }) => {
  const { state } = useGame();
  useEffect(() => {
    if (!choice) return undefined;
    const close = (e) => { if (!e.target.closest?.('[data-testid="region-chooser"]')) onClose(); };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [choice, onClose]);
  if (!choice) return null;
  const left = Math.min(Math.max(8, choice.x + 14), window.innerWidth - 200);
  const top = Math.min(Math.max(8, choice.y - 20), window.innerHeight - 44 * choice.ids.length - 16);
  return (
    <div data-testid="region-chooser" style={{ left, top }} className="fixed z-[45] w-[184px] rounded-xl border border-slate-600 bg-slate-900/97 shadow-2xl overflow-hidden">
      {choice.ids.map((id) => (
        <button key={id} onClick={() => onPick(id)} className="w-full flex items-center gap-2 px-3 min-h-[44px] text-left text-[13px] text-slate-100 hover:bg-slate-800 border-b border-slate-800 last:border-b-0">
          <span className="w-3 h-3 rounded-sm shrink-0 border border-black/40" style={{ background: getRegionFillColor(state.regions, state.playerNationId, id) }} />
          <span className="truncate">{REGIONS_DATA[id]?.name || id}</span>
        </button>
      ))}
    </div>
  );
};

export default RegionChooser;
