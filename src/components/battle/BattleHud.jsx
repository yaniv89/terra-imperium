// src/components/battle/BattleHud.jsx
// Thumb-zone HUD for a commanded battle (Tactical Battles plan §11.1): a slim top bar (pause,
// clock, supply, keep status), class chips bottom-left (tap = select that class), the command bar
// bottom-right, and a reserves drawer. Every control is ≥ 44 px; nothing needs precision.
import React, { useState } from 'react';
import { Play, Pause, Swords, Crosshair, Hand, Square, Rows, Columns, Flag, Users, LogOut, Castle, X } from 'lucide-react';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { RESERVE_COST } from '../../battle/sim/orders';
import { ASSIMILATION_TICKS } from '../../battle/sim/objectives';
import { getRankForXp } from '../../data/promotions';

const CLASS_LABEL = { infantry: 'Inf', cavalry: 'Cav', ranged: 'Rng', siege: 'Sge', air: 'Air', support: 'Sup' };
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const HudButton = ({ icon: Icon, label, onClick, active, danger, disabled, testId }) => (
  <button
    type="button" onClick={onClick} disabled={disabled} data-testid={testId}
    className={`min-w-[48px] h-12 px-2.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold border shadow-lg transition-colors disabled:opacity-40
      ${active ? 'bg-lime-500/25 border-lime-400 text-lime-200' : danger ? 'bg-red-900/60 border-red-500/60 text-red-200' : 'bg-slate-900/85 border-slate-600/70 text-slate-100'}`}
  >
    {Icon && <Icon className="w-4 h-4" />}
    <span className="leading-none">{label}</span>
  </button>
);

const BattleHud = ({
  title, hud, setup, playerSide, timeLeft, paused, started, speed, armed, formation, selectedSquads,
  onTogglePause, onSpeed, onArm, onFormation, onSelectClass, onCallReserve, onCommand, onRetreatAll, onFocusKeep, onAbandon
}) => {
  const [showReserves, setShowReserves] = useState(false);
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  if (!hud) return null;
  const mine = hud.squads.filter((q) => q.side === playerSide && q.alive && !q.fled);
  const onField = mine.filter((q) => q.onField);
  const reserves = mine.filter((q) => q.reserve);
  const classCounts = onField.reduce((acc, q) => { acc[q.classId] = (acc[q.classId] || 0) + 1; return acc; }, {});
  const keep = hud.structures[0];
  const supply = hud.supply[playerSide];
  const enemyLeft = hud.squads.filter((q) => q.side !== playerSide && q.alive && !q.fled).length;
  const ageId = setup.sides[playerSide].ageId;

  return (
    <>
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-2 pt-[calc(0.5rem+env(safe-area-inset-top))] flex items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <HudButton icon={paused ? Play : Pause} label={!started ? 'Start' : paused ? 'Play' : 'Pause'} onClick={onTogglePause} active={!started} testId="battle-pause" />
          <button type="button" onClick={() => onSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)} className="min-w-[48px] h-12 rounded-xl bg-slate-900/85 border border-slate-600/70 text-slate-100 text-xs font-bold shadow-lg">{speed}×</button>
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
          <div className="px-3 py-1 rounded-full bg-slate-900/85 border border-slate-600/70 text-slate-100 text-xs font-semibold shadow-lg flex items-center gap-3">
            <span className="truncate max-w-[40vw] hidden min-[420px]:inline">{title || 'Battle'}</span>
            <span className="font-mono">{fmtTime(timeLeft)}</span>
            <span className="text-amber-300 font-mono" title="Battle Supply">⛁ {Math.floor(supply)}</span>
            <span className="text-orange-300 font-mono" title="Enemy squads left">⚔ {enemyLeft}</span>
          </div>
          {keep && (
            <button type="button" onClick={onFocusKeep} className="pointer-events-auto px-2 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] text-slate-200 flex items-center gap-1.5">
              <Castle className="w-3 h-3" />
              {keep.alive
                ? <span className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden"><span className="block h-full bg-orange-400" style={{ width: `${(keep.hp / keep.maxHp) * 100}%` }} /></span>
                : <span className="text-lime-300">Breached{hud.assimilation > 0 ? ` · taking ${Math.round((hud.assimilation / ASSIMILATION_TICKS) * 100)}%` : ''}</span>}
            </button>
          )}
        </div>
        <div className="pointer-events-auto">
          <HudButton icon={LogOut} label="Leave" onClick={() => setConfirmRetreat(true)} danger testId="battle-leave" />
        </div>
      </div>

      {!started && (
        <div className="absolute top-24 inset-x-0 flex justify-center pointer-events-none px-4">
          <div className="max-w-md text-center px-3 py-2 rounded-2xl bg-slate-900/85 border border-slate-600 text-slate-200 text-xs shadow-xl">
            <div className="font-bold text-sm text-white mb-1">Deploy your army</div>
            Tap a squad (or a class chip) to select it, tap the ground to move, tap an enemy to attack, drag from a selected squad to draw a battle line. Orders given now start when you press <b>Start</b>.
          </div>
        </div>
      )}

      {/* Selected squads */}
      {selectedSquads.length > 0 && (
        <div className="absolute left-2 top-[calc(7rem+env(safe-area-inset-top))] max-w-[70vw] px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-600 text-slate-200 text-[11px] shadow-xl pointer-events-none">
          {selectedSquads.length === 1 ? (() => {
            const q = selectedSquads[0];
            return (
              <div>
                <div className="font-bold text-white text-xs">{getSquadDisplayName(q.classId, q.ageId)} <span className="text-slate-400 font-normal capitalize">· {getRankForXp(q.xp)}</span></div>
                <div className="font-mono">STR {q.strength}/{q.maxStrength} · MOR {q.morale}{q.routed ? ' · ROUTED' : ''}</div>
              </div>
            );
          })() : <div className="font-semibold">{selectedSquads.length} squads · {selectedSquads.reduce((s, q) => s + q.strength, 0)} strength</div>}
        </div>
      )}

      {/* Bottom: chips (left) + command bar (right) */}
      <div className="absolute bottom-0 inset-x-0 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex flex-wrap items-end justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap gap-1.5 max-w-[60%]">
          <HudButton icon={Users} label={`All ${onField.length}`} onClick={() => onSelectClass('all')} testId="battle-select-all" />
          {Object.entries(classCounts).map(([cls, n]) => (
            <HudButton key={cls} label={`${CLASS_LABEL[cls] || cls} ${n}`} onClick={() => onSelectClass(cls)} />
          ))}
          <HudButton icon={Flag} label={`Reserve ${reserves.length}`} onClick={() => setShowReserves((v) => !v)} active={showReserves} disabled={!reserves.length} testId="battle-reserves" />
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          <HudButton icon={Crosshair} label="Atk-move" onClick={() => onArm('attackMove')} active={armed === 'attackMove'} disabled={!selectedSquads.length} testId="battle-attack-move" />
          <HudButton icon={Hand} label="Hold" onClick={() => onCommand('hold')} disabled={!selectedSquads.length} />
          <HudButton icon={Square} label="Stop" onClick={() => onCommand('stop')} disabled={!selectedSquads.length} />
          <HudButton icon={formation === 'line' ? Rows : Columns} label={formation === 'line' ? 'Line' : 'Column'} onClick={onFormation} />
          <HudButton icon={Swords} label="Retreat" onClick={() => onCommand('retreat')} disabled={!selectedSquads.length} danger />
        </div>
      </div>

      {showReserves && (
        <div className="absolute left-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] w-64 max-w-[calc(100vw-1rem)] p-2 rounded-xl bg-slate-900/95 border border-slate-600 shadow-2xl text-xs text-slate-200 space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-white"><span>Reserves (⛁ {RESERVE_COST} each)</span><button onClick={() => setShowReserves(false)} className="p-1"><X className="w-4 h-4" /></button></div>
          {reserves.map((q) => (
            <button key={q.idx} type="button" disabled={q.enterTick >= 0 || supply < RESERVE_COST}
              onClick={() => onCallReserve(q.idx)}
              className="w-full h-11 px-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between disabled:opacity-50">
              <span>{getSquadDisplayName(q.classId, ageId)} · {q.strength}</span>
              <span className="text-amber-300">{q.enterTick >= 0 ? 'Marching…' : 'Call in'}</span>
            </button>
          ))}
        </div>
      )}

      {confirmRetreat && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-600 p-4 text-slate-200 text-sm space-y-3">
            <div className="font-bold text-white">Leave the battle?</div>
            <p className="text-xs text-slate-400">Sound the retreat: your squads march off the field and survive with the strength they have left. The invasion counts as repelled.</p>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => { setConfirmRetreat(false); onRetreatAll(); }} className="h-11 rounded-lg bg-red-700 text-white font-semibold">Sound the retreat</button>
              {onAbandon && <button type="button" onClick={() => { setConfirmRetreat(false); onAbandon(); }} className="h-11 rounded-lg bg-slate-700 text-white font-semibold">Auto-resolve instead</button>}
              <button type="button" onClick={() => setConfirmRetreat(false)} className="h-11 rounded-lg bg-slate-800 text-slate-200">Keep fighting</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BattleHud;
