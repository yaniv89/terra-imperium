// src/components/modals/GameOverModal.jsx
// Terminal screen for VICTORY / DEFEAT / COMPLETE (plan §M18).

import React, { useState } from 'react';
import { Trophy, Skull, FlagOff, RotateCcw, PlayCircle, Copy, Check } from 'lucide-react';
import { GameStatus } from '../../data/types';
import { VICTORY_CONDITIONS } from '../../data/victoryConditions';
import { END_YEAR } from '../../data/ages';
import { calcNationScore, rankNations } from '../../engine/score';
import { formatNumber, formatMoney, getPlayerControl, getPlayerRegions } from '../../utils/helpers';

const GameOverModal = ({ status, state, onReset, onContinue }) => {
  const [copied, setCopied] = useState(false);
  if (status !== GameStatus.VICTORY && status !== GameStatus.DEFEAT && status !== GameStatus.COMPLETE) return null;

  const isVictory = status === GameStatus.VICTORY;
  const isComplete = status === GameStatus.COMPLETE;
  // Plan §M18: "Victory if the player ranks #1; otherwise Game Complete — Rank N" — an ambition
  // win (domination/conqueror/economicHegemony/diplomatic/spaceAscendancy) can still land before
  // END_YEAR, and offers a real choice to keep playing rather than a forced stop.
  const canContinue = isVictory && state.year < END_YEAR;
  const playerNation = state.nations[state.playerNationId];
  const regionsHeld = getPlayerRegions(state.regions, state.playerNationId).length;
  const techResearched = Object.values(state.techTree).filter(t => t.researched).length;
  const warsFought = state.wars.length;
  const peaceTreaties = Object.values(state.nations).filter(n => n.hasPeaceTreaty).length;
  const victoryCondition = isVictory ? VICTORY_CONDITIONS[state.victoryConditionId] : null;
  // Plan §M18: "Score = development + regions + tech + prestige + great projects + wars won. The
  // same formula applies to the AI." — a real, comparative score against the rest of the world,
  // not the old single-run "one number that goes up" tally.
  const ranked = rankNations(state);
  const playerScore = calcNationScore(state, state.playerNationId);
  const rank = isComplete ? (state.finalRank || ranked.findIndex(r => r.nationId === state.playerNationId) + 1) : null;

  const handleCopySummary = () => {
    const lines = [
      `Terra Imperium (${playerNation?.name}) — ${isVictory ? `Victory (${victoryCondition?.name || 'Score Victory'})` : isComplete ? `Game Complete — Rank #${rank} of ${ranked.length}` : 'Defeat'}`,
      `Score: ${formatNumber(playerScore.total)}`,
      `Final Year: ${state.year} · Turns Played: ${formatNumber(state.turnNumber)}`,
      `Regions Held: ${regionsHeld} · Home Control: ${getPlayerControl(state)}%`,
      `Tech Researched: ${techResearched}/${Object.keys(state.techTree).length}`,
      `Wars Fought: ${warsFought} · Peace Treaties: ${peaceTreaties}`,
      `Treasury: ${formatMoney(state.resources.gold)}`
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
          isVictory ? 'border-green-500' : isComplete ? 'border-amber-500' : 'border-red-500'
        }`}
      >
        {isVictory ? (
          <Trophy className="w-14 h-14 mx-auto mb-3 text-green-400" />
        ) : isComplete ? (
          <FlagOff className="w-14 h-14 mx-auto mb-3 text-amber-400" />
        ) : (
          <Skull className="w-14 h-14 mx-auto mb-3 text-red-400" />
        )}

        <h2 className={`text-2xl font-bold mb-1 ${isVictory ? 'text-green-400' : isComplete ? 'text-amber-400' : 'text-red-400'}`}>
          {isVictory ? (victoryCondition?.name || 'Victory') : isComplete ? `Game Complete — Rank #${rank}` : 'Defeat'}
        </h2>
        <p className="text-slate-400 text-sm mb-1">
          {isVictory
            ? (victoryCondition?.description || `${playerNation?.name} has endured across the ages.`)
            : isComplete
              ? `${playerNation?.name} finished #${rank} of ${ranked.length} nations in the world by ${state.year}.`
              : `${playerNation?.name}'s home territory has fallen. The nation could not be saved.`}
        </p>
        <p className="text-amber-400 font-mono text-sm mb-6">Score: {formatNumber(playerScore.total)}</p>

        <div className="grid grid-cols-2 gap-3 text-left mb-6">
          <Stat label="Final Year" value={state.year} />
          <Stat label="Turns Played" value={formatNumber(state.turnNumber)} />
          <Stat label="Regions Held" value={regionsHeld} />
          <Stat label="Home Control" value={`${getPlayerControl(state)}%`} />
          <Stat label="Tech Researched" value={`${techResearched}/${Object.keys(state.techTree).length}`} />
          <Stat label="Wars Fought" value={warsFought} />
          <Stat label="Peace Treaties" value={peaceTreaties} />
          <Stat label="Treasury" value={formatMoney(state.resources.gold)} />
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
          {canContinue ? (
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
                         text-white shadow-lg transition-all active:scale-95"
            >
              <PlayCircle className="w-4 h-4" />
              Continue Playing
            </button>
          ) : (
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                         text-white shadow-lg transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Game
            </button>
          )}
        </div>
        {canContinue && (
          <button onClick={onReset} className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline transition-colors">
            Start a New Game instead
          </button>
        )}
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
