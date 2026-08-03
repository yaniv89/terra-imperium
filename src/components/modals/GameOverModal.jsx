// src/components/modals/GameOverModal.jsx
// Terminal screen for VICTORY / DEFEAT. Previously the game had no way to end at all — both
// outcomes were single log lines the player could keep playing straight through.

import React from 'react';
import { Trophy, Skull, RotateCcw } from 'lucide-react';
import { GameStatus } from '../../data/types';
import { formatNumber, formatMoney, getAvgCoreControl, getPlayerRegions } from '../../utils/helpers';

const GameOverModal = ({ status, state, onReset }) => {
  if (status !== GameStatus.VICTORY && status !== GameStatus.DEFEAT) return null;

  const isVictory = status === GameStatus.VICTORY;
  const regionsHeld = getPlayerRegions(state.regions).length;
  const techResearched = Object.values(state.techTree).filter(t => t.researched).length;
  const warsFought = state.wars.length;
  const peaceTreaties = Object.values(state.nations).filter(n => n.hasPeaceTreaty).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div
        className={`bg-slate-900 rounded-xl border-2 max-w-md w-full shadow-2xl p-6 text-center ${
          isVictory ? 'border-green-500' : 'border-red-500'
        }`}
      >
        {isVictory ? (
          <Trophy className="w-14 h-14 mx-auto mb-3 text-green-400" />
        ) : (
          <Skull className="w-14 h-14 mx-auto mb-3 text-red-400" />
        )}

        <h2 className={`text-2xl font-bold mb-1 ${isVictory ? 'text-green-400' : 'text-red-400'}`}>
          {isVictory ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {isVictory
            ? 'Israel has endured and thrived across nearly three centuries.'
            : 'Israel\'s core territories have fallen. The State could not be saved.'}
        </p>

        <div className="grid grid-cols-2 gap-3 text-left mb-6">
          <Stat label="Final Year" value={state.year} />
          <Stat label="Turns Played" value={formatNumber(state.turnNumber)} />
          <Stat label="Regions Held" value={regionsHeld} />
          <Stat label="Core Control" value={`${getAvgCoreControl(state)}%`} />
          <Stat label="Tech Researched" value={`${techResearched}/${Object.keys(state.techTree).length}`} />
          <Stat label="Wars Fought" value={warsFought} />
          <Stat label="Peace Treaties" value={peaceTreaties} />
          <Stat label="Treasury" value={formatMoney(state.resources.money)} />
        </div>

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                     bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                     text-white shadow-lg transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          Start New Game
        </button>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700">
    <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    <div className="font-mono font-bold text-slate-200">{value}</div>
  </div>
);

export default GameOverModal;
