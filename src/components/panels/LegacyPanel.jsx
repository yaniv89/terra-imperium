// src/components/panels/LegacyPanel.jsx
// Meta-progression panel (Phase 6): achievements earned across playthroughs, and the starting
// doctrine bonus they unlock for the NEXT game. This is the only panel that reads/writes
// cross-game state (via useGame()'s `meta`/`selectDoctrine`) rather than the current save.

import React from 'react';
import { Trophy, Lock, Check, Gauge } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ACHIEVEMENTS, checkAchievements } from '../../data/achievements';
import { STARTING_DOCTRINES } from '../../data/startingDoctrines';
import { DIFFICULTIES } from '../../data/difficulty';

const LegacyPanel = () => {
  const { state, meta, selectDoctrine, selectDifficulty } = useGame();
  const satisfiedNow = checkAchievements(state);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Trophy className="w-4 h-4" />
          <span>Legacy</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Achievements persist across every game on this device. Unlocking one permanently adds a
          starting doctrine you can pick for your next run.
        </p>
      </div>

      {/* Achievements */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Achievements</div>
        {Object.values(ACHIEVEMENTS).map(a => {
          const unlocked = meta.unlockedAchievements.includes(a.id);
          const inProgress = !unlocked && satisfiedNow.includes(a.id);
          return (
            <div
              key={a.id}
              className={`p-2 rounded border text-xs ${
                unlocked ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-white">
                {unlocked ? <Check className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-slate-500" />}
                {a.name}
                {inProgress && <span className="text-[9px] text-amber-400 font-normal">(earned this run — unlocks on save)</span>}
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">{a.description}</div>
            </div>
          );
        })}
      </div>

      {/* Difficulty select (Phase 10) — a scenario-level choice, separate from starting doctrines */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5" />
          Difficulty (takes effect on your next game)
        </div>
        {Object.values(DIFFICULTIES).map(d => {
          const selected = (meta.difficulty || 'normal') === d.id;
          return (
            <button
              key={d.id}
              onClick={() => selectDifficulty(d.id)}
              className={`w-full p-2 rounded text-left text-xs border transition-all ${
                selected ? 'bg-blue-500/20 border-blue-500/50' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-white">
                {d.name}
                {selected && <span className="text-[9px] text-blue-400 font-normal">(active)</span>}
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">{d.description}</div>
            </button>
          );
        })}
      </div>

      {/* Starting doctrine picker */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Starting Doctrine (takes effect on your next game)</div>
        {Object.values(STARTING_DOCTRINES).map(d => {
          const unlocked = !d.requiresAchievement || meta.unlockedAchievements.includes(d.requiresAchievement);
          const selected = meta.selectedDoctrine === d.id;
          return (
            <button
              key={d.id}
              disabled={!unlocked}
              onClick={() => selectDoctrine(d.id)}
              className={`w-full p-2 rounded text-left text-xs border transition-all ${
                selected
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : unlocked
                    ? 'bg-slate-700 hover:bg-slate-600 border-slate-600 cursor-pointer'
                    : 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-white">
                {!unlocked && <Lock className="w-3 h-3 text-slate-500" />}
                {d.name}
                {selected && <span className="text-[9px] text-amber-400 font-normal">(active)</span>}
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">{d.description}</div>
              {!unlocked && (
                <div className="text-[9px] text-red-400 mt-1">
                  Requires: {ACHIEVEMENTS[d.requiresAchievement]?.name}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LegacyPanel;
