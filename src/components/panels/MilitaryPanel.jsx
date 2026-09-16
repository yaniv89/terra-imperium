// src/components/panels/MilitaryPanel.jsx
// Military tab — nation overview. The full army sim described in the plan (unit classes with
// hard counters, per-region armies, promotions, generals, supply, phased battle resolution) is
// Phase C work, built fresh against the new age/resource model rather than adapted from the old
// infantry/armor/air system this replaced.

import React from 'react';
import { Swords } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { formatNumber } from '../../utils/helpers';

const MilitaryPanel = () => {
  const { state } = useGame();
  const playerNation = state.nations[state.playerNationId];
  const atWarWith = Object.values(state.nations).filter(n => n.isAtWar && !n.isPlayer);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Swords size={20} className="text-red-400" />
        {playerNation?.name}
      </div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Military Strength</div>
        <div className="text-white font-semibold text-xl">{formatNumber(playerNation?.militaryStrength || 0)}</div>
      </div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400 mb-1">Active Wars</div>
        {atWarWith.length === 0 ? (
          <div className="text-slate-500">At peace with the world.</div>
        ) : (
          <ul className="space-y-1">
            {atWarWith.map(n => (
              <li key={n.id} className="text-red-400">War with {n.name}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
        Unit recruitment, armies and combat are coming in a future update.
      </div>
    </div>
  );
};

export default MilitaryPanel;
