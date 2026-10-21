// src/components/modals/GameOverModal.jsx
// Terminal screen for VICTORY / DEFEAT / COMPLETE (plan §M18).

import React, { useState } from 'react';
import { Trophy, Skull, FlagOff, RotateCcw, PlayCircle, Copy, Check } from 'lucide-react';
import { GameStatus } from '../../data/types';
import { VICTORY_CONDITIONS } from '../../data/victoryConditions';
import { endingSignal } from '../../engine/ending';
import { rankNations } from '../../engine/score';
import { formatNumber, getPlayerControl, getPlayerRegions } from '../../utils/helpers';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { victoryName, victoryDescription } from '../../i18n/gameText';
import { nameNow } from '../../i18n/names';
import { legacyModel } from '../panels/legacyModel';

const GameOverModal = ({ status, state, onReset, onContinue }) => {
  const { lang, year: yearText } = useT();
  const [copied, setCopied] = useState(false);
  if (status !== GameStatus.VICTORY && status !== GameStatus.DEFEAT && status !== GameStatus.COMPLETE) return null;

  const isVictory = status === GameStatus.VICTORY;
  const isComplete = status === GameStatus.COMPLETE;
  // Plan §M18: "Victory if the player ranks #1; otherwise Game Complete — Rank N" — an ambition
  // win (domination) can still land before
  // the ending signal (ending.js), and offers a real choice to keep playing rather than a forced stop.
  const canContinue = isVictory && !state.ending && !endingSignal(state);
  const playerNation = state.nations[state.playerNationId];
  const nationText = playerNation?.name ? nameNow('people', state.playerNationId, playerNation.name) : playerNation?.name;
  const yearValue = lang === 'he' ? yearText(state.year) : state.year;
  const money = `${formatNumber(state.resources.gold)}${tNow('empire.g')}`;
  const regionsHeld = getPlayerRegions(state.regions, state.playerNationId).length;
  const techResearched = Object.values(state.techTree).filter(t => t.researched).length;
  const warsFought = state.wars.length;
  const peaceTreaties = Object.values(state.nations).filter(n => n.hasPeaceTreaty).length;
  const victoryCondition = isVictory ? VICTORY_CONDITIONS[state.victoryConditionId] : null;
  const victoryTitle = victoryCondition ? victoryName(state.victoryConditionId, victoryCondition.name) : null;
  // Plan §M18: "Score = development + regions + tech + prestige + great projects + wars won. The
  // same formula applies to the AI." — a real, comparative score against the rest of the world,
  // not the old single-run "one number that goes up" tally.
  const ranked = rankNations(state);
  const legacy = legacyModel(state);
  const endingText = state.ending?.reason === 'futureGoal' ? tNow('legacy.end.futureGoal', { name: nameNow('people', state.ending.nationId, state.nations[state.ending.nationId]?.name) }) : state.ending?.reason === 'turnLimit' ? tNow('legacy.end.turnLimit') : null;
  const rank = isComplete ? (state.finalRank || ranked.findIndex(r => r.nationId === state.playerNationId) + 1) : null;

  const handleCopySummary = () => {
    const lines = [
      tNow('p1.go.copyHead', { game: tNow('title.name'), name: nationText, result: isVictory ? tNow('p1.go.copyVictory', { name: victoryTitle || victoryName('finalScore', 'Score Victory') }) : isComplete ? tNow('p1.go.copyComplete', { rank, total: ranked.length }) : tNow('p1.go.defeat') }),
      tNow('p1.go.copyScore', { n: formatNumber(legacy.total) }),
      tNow('p1.go.copyYears', { year: yearValue, turns: formatNumber(state.turnNumber) }),
      tNow('p1.go.copyRegions', { regions: regionsHeld, control: getPlayerControl(state) }),
      tNow('p1.go.copyTech', { a: techResearched, b: Object.keys(state.techTree).length }),
      tNow('p1.go.copyWars', { wars: warsFought, peace: peaceTreaties }),
      tNow('p1.go.copyTreasury', { n: money })
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div
        className={`bg-fa-panel rounded-xl border-2 max-w-md w-full max-h-full overflow-y-auto shadow-2xl p-6 pl:p-3 text-center ${
          isVictory ? 'border-green-500' : isComplete ? 'border-amber-500' : 'border-red-500'
        }`}
      >
        {isVictory ? (
          <Trophy className="w-14 h-14 mx-auto mb-3 text-fa-good" />
        ) : isComplete ? (
          <FlagOff className="w-14 h-14 mx-auto mb-3 text-amber-400" />
        ) : (
          <Skull className="w-14 h-14 mx-auto mb-3 text-fa-danger-text" />
        )}

        <h2 className={`text-2xl font-bold mb-1 ${isVictory ? 'text-fa-good' : isComplete ? 'text-amber-400' : 'text-fa-danger-text'}`}>
          {isVictory ? (victoryTitle || tNow('p1.go.victory')) : isComplete ? tNow('p1.go.complete', { rank }) : tNow('p1.go.defeat')}
        </h2>
        <p className="text-fa-muted text-sm mb-1">
          {isVictory
            ? (victoryCondition ? victoryDescription(state.victoryConditionId, victoryCondition.description) : tNow('p1.go.endured', { name: nationText }))
            : isComplete
              ? tNow('p1.go.finished', { name: nationText, rank, total: ranked.length, year: yearValue })
              : tNow('p1.go.fallen', { name: nationText })}
        </p>
        <p className="text-amber-400 font-mono text-sm mb-1">{tNow('legacy.score')}: {formatNumber(legacy.total)} · {tNow('legacy.rank', { rank: legacy.rank, of: legacy.of })}</p>
        {endingText && <p className="text-fa-muted text-xs mb-1">{endingText}</p>}
        {legacy.top.length > 0 && <p className="text-fa-muted text-[11px] mb-4" data-testid="go-rivals">{tNow('legacy.rivals')}: {legacy.top.map((r) => `${nameNow('people', r.nationId, state.nations[r.nationId]?.name)} ${formatNumber(r.legacy)}`).join(' · ')}</p>}

        <div className="grid grid-cols-2 gap-3 text-start mb-6">
          <Stat label={tNow('p1.go.finalYear')} value={yearValue} />
          <Stat label={tNow('p1.go.turns')} value={formatNumber(state.turnNumber)} />
          <Stat label={tNow('p1.go.regions')} value={regionsHeld} />
          <Stat label={tNow('p1.go.control')} value={`${getPlayerControl(state)}%`} />
          <Stat label={tNow('p1.go.tech')} value={`${techResearched}/${Object.keys(state.techTree).length}`} />
          <Stat label={tNow('p1.go.wars')} value={warsFought} />
          <Stat label={tNow('p1.go.peace')} value={peaceTreaties} />
          <Stat label={tNow('p1.go.treasury')} value={money} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopySummary}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                       bg-fa-hover hover:bg-fa-line text-fa-text transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-fa-good" /> : <Copy className="w-4 h-4" />}
            {copied ? tNow('p1.go.copied') : tNow('p1.go.copy')}
          </button>
          {canContinue ? (
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
                         text-fa-text shadow-lg transition-all active:scale-95"
            >
              <PlayCircle className="w-4 h-4" />
              {tNow('p1.go.continue')}
            </button>
          ) : (
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                         bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                         text-fa-text shadow-lg transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              {tNow('p1.go.newGame')}
            </button>
          )}
        </div>
        {canContinue && (
          <button onClick={onReset} className="mt-3 text-xs text-fa-muted hover:text-fa-text underline transition-colors">
            {tNow('p1.go.newInstead')}
          </button>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-fa-raised/60 rounded-lg px-3 py-2 border border-fa-line">
    <div className="text-[10px] text-fa-muted uppercase tracking-wide">{label}</div>
    <div className="font-mono font-bold text-fa-text">{value}</div>
  </div>
);

export default GameOverModal;
