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
import { AGES } from '../../data/ages';
import { eraGoalProgress } from '../../engine/eraGoals';
import { PLAYSTYLES } from '../../data/eraGoals';

const LegacyPanel = () => {
  const { state, meta, selectDoctrine, selectDifficulty } = useGame();
  const satisfiedNow = checkAchievements(state);
  const era = eraGoalProgress(state);
  const pastEras = Object.entries(state.nations?.[state.playerNationId]?.eraGoals || {});

  return (
    <div className="space-y-4">
      {/* This era's goals (plans/civ-map-rework.md C9.3): meet two before the age ends for a legacy. */}
      <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5" data-testid="era-goals">
        <div className="flex items-center justify-between text-sm font-semibold text-fa-you">
          <span>Goals of the {AGES[era.ageId]?.name || era.ageId}</span>
          <span className="text-[11px] font-mono">{era.met}/{era.needed} for a legacy</span>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {era.goals.map((g) => (
            <div key={g.id} className={`rounded-md px-1 py-1 text-center border ${g.done ? 'border-emerald-500/60 bg-emerald-900/30 text-emerald-200' : 'border-fa-line bg-fa-raised/50 text-fa-text'}`} title={`${g.label}: ${g.value}/${g.target} ${g.unit}. Legacy: ${PLAYSTYLES[g.id].bonusLabel}`}>
              <div className="text-[10px] font-semibold">{g.label}</div>
              <div className="text-[10px] font-mono">{Math.min(g.value, g.target)}/{g.target}</div>
            </div>
          ))}
        </div>
        {pastEras.length > 0 && <div className="text-[10px] text-fa-muted mt-1.5">{pastEras.map(([age, r]) => `${AGES[age]?.name || age}: ${r.legacy ? 'legacy earned' : 'no legacy'}`).join(' · ')}</div>}
      </div>
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Trophy className="w-4 h-4" />
          <span>Legacy</span>
        </div>
        <p className="text-[11px] text-fa-muted mt-1">
          Achievements persist across every game on this device. Unlocking one permanently adds a
          starting doctrine you can pick for your next run.
        </p>
      </div>

      {/* Achievements */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text">Achievements</div>
        {Object.values(ACHIEVEMENTS).map(a => {
          const unlocked = meta.unlockedAchievements.includes(a.id);
          const inProgress = !unlocked && satisfiedNow.includes(a.id);
          return (
            <div
              key={a.id}
              className={`p-2 rounded border text-xs ${
                unlocked ? 'bg-green-500/10 border-green-500/30' : 'bg-fa-raised/50 border-fa-line'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-fa-text">
                {unlocked ? <Check className="w-3 h-3 text-fa-good" /> : <Lock className="w-3 h-3 text-fa-muted" />}
                {a.name}
                {inProgress && <span className="text-[9px] text-amber-400 font-normal">(earned this run — unlocks on save)</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{a.description}</div>
            </div>
          );
        })}
      </div>

      {/* Difficulty select (Phase 10) — a scenario-level choice, separate from starting doctrines */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5" />
          Difficulty (takes effect on your next game)
        </div>
        {Object.values(DIFFICULTIES).map(d => {
          const selected = (meta.difficulty || 'prince') === d.id;
          return (
            <button
              key={d.id}
              onClick={() => selectDifficulty(d.id)}
              className={`w-full p-2 rounded text-left text-xs border transition-all ${
                selected ? 'bg-blue-500/20 border-blue-500/50' : 'bg-fa-hover hover:bg-fa-line border-fa-line cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-fa-text">
                {d.name}
                {selected && <span className="text-[9px] text-fa-you font-normal">(active)</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{d.description}</div>
            </button>
          );
        })}
      </div>

      {/* Starting doctrine picker */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text">Starting Doctrine (takes effect on your next game)</div>
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
                    ? 'bg-fa-hover hover:bg-fa-line border-fa-line cursor-pointer'
                    : 'bg-fa-raised/50 border-fa-line opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-fa-text">
                {!unlocked && <Lock className="w-3 h-3 text-fa-muted" />}
                {d.name}
                {selected && <span className="text-[9px] text-amber-400 font-normal">(active)</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{d.description}</div>
              {!unlocked && (
                <div className="text-[9px] text-fa-danger-text mt-1">
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
