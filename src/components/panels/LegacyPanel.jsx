// src/components/panels/LegacyPanel.jsx
// Meta-progression panel (Phase 6): achievements earned across playthroughs, and the starting
// doctrine bonus they unlock for the NEXT game. This is the only panel that reads/writes
// cross-game state (via useGame()'s `meta`/`selectDoctrine`) rather than the current save.

import { t as tNow } from '../../i18n';
import { ageName } from '../../i18n';
import { useT } from '../../i18n/useT';
import { playstyleName, goalUnit, goalBonus, achievementName, achievementDescription, difficultyName, difficultyDescription, doctrineName, doctrineDescription } from '../../i18n/gameText';
import React from 'react';
import { Trophy, Lock, Check, Gauge } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ACHIEVEMENTS, checkAchievements } from '../../data/achievements';
import { STARTING_DOCTRINES } from '../../data/startingDoctrines';
import { DIFFICULTIES } from '../../data/difficulty';
import { AGES } from '../../data/ages';
import { eraGoalProgress } from '../../engine/eraGoals';
import { achievementProgress } from '../../data/achievementProgress';
import { Meter } from '../ui/atlas';
import { PLAYSTYLES } from '../../data/eraGoals';
import { LEGACY_PARTS } from '../../data/legacy';
import { legacyModel } from './legacyModel';
import ChronicleSheet from '../chronicle/ChronicleSheet';
import { nameNow } from '../../i18n/names';

const LegacyPanel = () => {
  useT(); // redraw when the language changes
  const { state, meta, selectDoctrine, selectDifficulty } = useGame();
  const satisfiedNow = checkAchievements(state);
  const era = eraGoalProgress(state);
  const score = legacyModel(state);
  const pastEras = Object.entries(state.nations?.[state.playerNationId]?.eraGoals || {});

  return (
    <div className="space-y-4">
      {/* The legacy score (differentiation plan U17): what ranks every major at the ending. */}
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5" data-testid="legacy-score">
        <div className="flex items-baseline justify-between text-sm font-semibold text-amber-400">
          <span>{tNow('legacy.score')}: <span className="font-mono">{score.total}</span></span>
          <span className="text-[11px] font-mono">{tNow('legacy.rank', { rank: score.rank, of: score.of })}</span>
        </div>
        {score.ages.length ? (
          <ul className="mt-1.5 space-y-0.5 text-[11px]">
            {score.ages.map((a) => (
              <li key={a.ageId}>
                <span className="font-semibold">{tNow('legacy.ageLine', { age: ageName(a.ageId, AGES[a.ageId]?.name), n: a.points })}</span>
                <span className="text-fa-muted"> · {LEGACY_PARTS.filter((p) => a.counts[`legacy.${p}`]).map((p) => `${tNow(`legacy.${p}`)} ×${a.counts[`legacy.${p}`]}`).join(' · ')}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-[11px] text-fa-muted">{tNow('legacy.noParts')}</p>}
        {score.top.length > 0 && <div className="mt-1.5 text-[10px] text-fa-muted">{tNow('legacy.rivals')}: {score.top.map((r) => `${nameNow('people', r.nationId, state.nations[r.nationId]?.name)} ${r.legacy}`).join(' · ')}</div>}
      </div>
      <ChronicleSheet state={state} />
      {/* This era's goals (plans/civ-map-rework.md C9.3): meet two before the age ends for a legacy. */}
      <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5" data-testid="era-goals">
        <div className="flex items-center justify-between text-sm font-semibold text-fa-you">
          <span>{tNow('legacy.goalsOf', { age: ageName(era.ageId, AGES[era.ageId]?.name) })}</span>
          <span className="text-[11px] font-mono">{tNow('empire.forLegacy', { met: era.met, needed: era.needed })}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {era.goals.map((g) => (
            <div key={g.id} className={`rounded-md px-1 py-1 text-center border ${g.done ? 'border-emerald-500/60 bg-emerald-900/30 text-emerald-200' : 'border-fa-line bg-fa-raised/50 text-fa-text'}`} title={tNow('p1.leg.goalTip', { label: playstyleName(g.id, g.label), value: g.value, target: g.target, unit: goalUnit(g.id, g.unit), bonus: goalBonus(g.id, PLAYSTYLES[g.id].bonusLabel) })}>
              <div className="text-[10px] font-semibold">{playstyleName(g.id, g.label)}</div>
              <div className="text-[10px] font-mono">{Math.min(g.value, g.target)}/{g.target}</div>
            </div>
          ))}
        </div>
        {pastEras.length > 0 && <div className="text-[10px] text-fa-muted mt-1.5">{pastEras.map(([age, r]) => tNow(r.legacy ? 'legacy.earned' : 'legacy.none', { age: ageName(age, AGES[age]?.name) })).join(' · ')}</div>}
      </div>
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Trophy className="w-4 h-4" />
          <span>{tNow('rail.legacy')}</span>
        </div>
        <p className="text-[11px] text-fa-muted mt-1">
          {tNow('legacy.intro')}
        </p>
      </div>

      {/* Achievements */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text">{tNow('legacy.achievements')}</div>
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
                {achievementName(a.id, a.name)}
                {inProgress && <span className="text-[9px] text-amber-400 font-normal">{tNow('legacy.earnedRun')}</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{achievementDescription(a.id, a.description)}</div>
              {(() => {
                const p = unlocked ? null : achievementProgress(state, a.id);
                if (!p) return <div className="text-[10px] mt-0.5 text-fa-muted" data-testid={`ach-status-${a.id}`}>{unlocked ? tNow('legacy.earnedShort') : tNow('legacy.notYet')}</div>;
                return (
                  <div className="mt-1" data-testid={`ach-progress-${a.id}`}>
                    <div className="flex justify-between text-[10px] text-fa-muted"><span>{tNow(`p1.achunit.${a.id}`)}</span><span className="font-mono">{p.value} / {p.target}</span></div>
                    <Meter value={p.value} max={p.target} height={4} />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Difficulty select (Phase 10) — a scenario-level choice, separate from starting doctrines */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5" />
          {tNow('legacy.difficulty')}
        </div>
        {Object.values(DIFFICULTIES).map(d => {
          const selected = (meta.difficulty || 'prince') === d.id;
          return (
            <button
              key={d.id}
              onClick={() => selectDifficulty(d.id)}
              className={`w-full p-2 rounded text-start text-xs border transition-all ${
                selected ? 'bg-blue-500/20 border-blue-500/50' : 'bg-fa-hover hover:bg-fa-line border-fa-line cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-fa-text">
                {difficultyName(d.id, d.name)}
                {selected && <span className="text-[9px] text-fa-you font-normal">{tNow('legacy.active')}</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{difficultyDescription(d.id, d.description)}</div>
            </button>
          );
        })}
      </div>

      {/* Starting doctrine picker */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-fa-text">{tNow('legacy.doctrine')}</div>
        {Object.values(STARTING_DOCTRINES).map(d => {
          const unlocked = !d.requiresAchievement || meta.unlockedAchievements.includes(d.requiresAchievement);
          const selected = meta.selectedDoctrine === d.id;
          return (
            <button
              key={d.id}
              disabled={!unlocked}
              onClick={() => selectDoctrine(d.id)}
              className={`w-full p-2 rounded text-start text-xs border transition-all ${
                selected
                  ? 'bg-amber-500/20 border-amber-500/50'
                  : unlocked
                    ? 'bg-fa-hover hover:bg-fa-line border-fa-line cursor-pointer'
                    : 'bg-fa-raised/50 border-fa-line opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-fa-text">
                {!unlocked && <Lock className="w-3 h-3 text-fa-muted" />}
                {doctrineName(d.id, d.name)}
                {selected && <span className="text-[9px] text-amber-400 font-normal">{tNow('legacy.active')}</span>}
              </div>
              <div className="text-fa-muted text-[10px] mt-0.5">{doctrineDescription(d.id, d.description)}</div>
              {!unlocked && (
                <div className="text-[9px] text-fa-danger-text mt-1">
                  {tNow('legacy.requires', { name: achievementName(d.requiresAchievement, ACHIEVEMENTS[d.requiresAchievement]?.name) })}
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
