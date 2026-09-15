// src/components/modals/GameOverModal.jsx
// Terminal screen for VICTORY / DEFEAT. Previously the game had no way to end at all — both
// outcomes were single log lines the player could keep playing straight through.

import React, { useState } from 'react';
import { Trophy, Skull, RotateCcw, Copy, Check } from 'lucide-react';
import { GameStatus } from '../../data/types';
import { VICTORY_CONDITIONS } from '../../data/victoryConditions';
import { formatNumber, formatMoney, getAvgCoreControl, getPlayerRegions } from '../../utils/helpers';

// A simple, transparent score — not meant to be perfectly balanced, just a single number that
// rewards the same things the stat grid already shows, so a run-end summary has something to
// compare across playthroughs (Phase 10: shareable summary).
const computeScore = (state, isVictory) => {
  const techResearched = Object.values(state.techTree).filter(t => t.researched).length;
  const peaceTreaties = Object.values(state.nations).filter(n => n.hasPeaceTreaty).length;
  const regionsHeld = getPlayerRegions(state.regions).length;
  return (
    (isVictory ? 5000 : 0) +
    Math.max(0, state.year - 1870) * 2 +
    techResearched * 50 +
    peaceTreaties * 30 +
    regionsHeld * 20
  );
};

const GameOverModal = ({ status, state, onReset }) => {
  const [copied, setCopied] = useState(false);
  if (status !== GameStatus.VICTORY && status !== GameStatus.DEFEAT) return null;

  const isVictory = status === GameStatus.VICTORY;
  const regionsHeld = getPlayerRegions(state.regions).length;
  const techResearched = Object.values(state.techTree).filter(t => t.researched).length;
  const warsFought = state.wars.length;
  const peaceTreaties = Object.values(state.nations).filter(n => n.hasPeaceTreaty).length;
  const victoryCondition = isVictory ? VICTORY_CONDITIONS[state.victoryConditionId] : null;
  const score = computeScore(state, isVictory);

  const handleCopySummary = () => {
    const lines = [
      `Rise of Zion — ${isVictory ? `Victory (${victoryCondition?.name || 'Galactic Age'})` : 'Defeat'}`,
      `Score: ${formatNumber(score)}`,
      `Final Year: ${state.year} · Turns Played: ${formatNumber(state.turnNumber)}`,
      `Regions Held: ${regionsHeld} · Core Control: ${getAvgCoreControl(state)}%`,
      `Tech Researched: ${techResearched}/${Object.keys(state.techTree).length}`,
      `Wars Fought: ${warsFought} · Peace Treaties: ${peaceTreaties}`,
      `Treasury: ${formatMoney(state.resources.money)}`
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          {isVictory ? (victoryCondition?.name || 'Victory') : 'Defeat'}
        </h2>
        <p className="text-slate-400 text-sm mb-1">
          {isVictory
            ? (victoryCondition?.description || 'Israel has endured and thrived across nearly three centuries.')
            : 'Israel\'s core territories have fallen. The State could not be saved.'}
        </p>
        <p className="text-amber-400 font-mono text-sm mb-6">Score: {formatNumber(score)}</p>

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

        <div className="flex gap-2">
          <button
            onClick={handleCopySummary}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                       bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                       bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                       text-white shadow-lg transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Start New Game
          </button>
        </div>
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
