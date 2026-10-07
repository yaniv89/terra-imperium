// src/components/battle/DefenseSheet.jsx
// W14 "You are attacked" (plans/UI-DESIGN.md; master plan 6.1 and 6.10): the interrupt. The
// battle queue (src/engine/battleQueue.js) holds every battle another nation started against you
// this turn, in the order its armies moved: an assault on a city, an attack on an army in the
// field, an attack on a fleet. The first one is shown: who attacks what, both forces (theirs in
// plain sight, so exact), your garrison with the militia, houses, battle housing and walls, and
// three ways to fight it: Command (the real-time battle), Auto (instant, the same rules) or, for a
// city, Withdraw (fall back and give it up). The brass button does the chosen one. "Always Auto
// for defences" (battleSettings.autoDefend) fights every later one on Auto. While an event or a
// peace offer is open the queue waits (the sheet hides). It can be tucked away to look at the map,
// leaving a pill to bring it back. A panel on the left over the map, phone and desktop alike.
import React, { useMemo, useState } from 'react';
import { Shield as ShieldIcon, ChevronDown } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { queuedBattleView, battleQueueBlocked, queuedKind } from '../../engine/battleQueue';
import { battleNameOf } from '../../engine/battleName';
import { Button, IconButton } from '../ui/atlas';
import { ForceCard, GeneralsLine, ModeCards, ModeExplain, OddsBar } from './warAtlas';
import { defenseSheetModel } from './defenseSheetModel';

const DefenseSheet = () => {
  const { state, dispatch } = useGame();
  const [tucked, setTucked] = useState(false);
  const [mode, setMode] = useState(state.battleSettings?.defaultMode === 'auto' ? 'auto' : 'command');
  const defenses = state.pendingDefenses || [];
  const def = defenses[0] || null;
  const blocked = !def || !!state.pendingBattle || battleQueueBlocked(state);
  const view = useMemo(() => (blocked ? null : queuedBattleView(state, def, 30)), [blocked, def, state.units, state.regions]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => (view ? defenseSheetModel(state, def, { view }) : null), [view]); // eslint-disable-line react-hooks/exhaustive-deps
  // The queue waits while a battle is under way or an event or a peace offer is open.
  if (blocked || !m) return null;

  if (tucked) {
    return (
      <button type="button" onClick={() => setTucked(false)} data-testid="defense-pill"
        className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] pl:bottom-3 fa-btn fa-btn-danger !bg-fa-panel shadow-2xl gap-2">
        <ShieldIcon className="w-4 h-4" aria-hidden="true" /> {defenses.length} under attack: back to the battle
      </button>
    );
  }

  const chosen = mode === 'withdraw' && !m.withdraw?.ok ? 'command' : mode;
  const act = () => {
    if (chosen === 'auto') dispatch({ type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    else if (chosen === 'withdraw') dispatch({ type: ActionTypes.WITHDRAW_FROM_DEFENSE, payload: { defenseId: def.id } });
    else dispatch({ type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
  };
  const options = [
    { id: 'command', sub: m.city ? 'Play the defence from the walls' : 'Play it in real time', testId: 'defense-command' },
    { id: 'auto', sub: 'Instant result, same rules', testId: 'defense-auto' },
    ...(m.withdraw ? [{ id: 'withdraw', sub: m.withdraw.ok ? `Give up ${m.place}, keep the men` : 'Nowhere to go', disabled: !m.withdraw.ok, title: m.withdraw.text, testId: 'defense-withdraw' }] : [])
  ];
  const explain = chosen === 'auto' ? m.auto : chosen === 'withdraw' ? m.withdraw.text : m.command;
  const action = chosen === 'auto' ? 'Fight on Auto' : chosen === 'withdraw' ? 'Withdraw' : m.attacking ? 'Begin battle' : 'Begin defence';
  const w = m.walls;
  const autoDefend = state.battleSettings?.autoDefend === true;

  return (
    <div role="dialog" aria-labelledby="defense-title" data-testid="defense-sheet"
      className="fixed z-[60] left-[max(env(safe-area-inset-left),0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] max-h-[calc(100dvh-var(--header-height,2.5rem)-0.375rem-max(env(safe-area-inset-bottom),0.5rem))] w-[min(30rem,calc(100vw-1rem-var(--rail-inset,0px)))] lg:w-[32rem] flex flex-col fa-panel !bg-fa-panel shadow-2xl">
      <div className="flex items-start gap-2 px-3 pt-2 pb-1 border-b border-fa-line">
        <ShieldIcon className="w-5 h-5 mt-1 text-fa-danger-text shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-fa-danger-text truncate">{m.eyebrow}</div>
          <h2 id="defense-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight truncate">{m.name}</h2>
        </div>
        <div className="text-right text-[11px] leading-tight shrink-0 pt-0.5">
          <div className="font-semibold">End of turn paused</div>
          <div className="text-fa-muted fa-num">{defenses.length > 1 ? `1 of ${defenses.length}` : 'one battle'}</div>
        </div>
        <IconButton label="Look at the map first" icon={ChevronDown} onClick={() => setTucked(true)} className="!w-9 !h-9 -mr-1" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 pl:space-y-1.5" data-testid="defense-row">
        <div className="grid grid-cols-2 gap-2">
          <ForceCard tone="enemy" tag="THEIRS" name={m.theirs.title} total={m.theirs.men} lines={m.theirs.lines.slice(0, 3)} footer={<span className="pl:hidden">{m.theirs.note}</span>} testId="defense-theirs" />
          <ForceCard tone="you" tag="YOURS" name={m.yours.title} total={m.yours.men} lines={m.yours.lines.slice(0, 3)} testId="defense-yours"
            footer={<>
              {w && <span className="block pl:hidden">{w.houses} houses and the town hall: battle housing <b className="fa-num text-fa-text">{w.housing}</b>. {w.level ? `${w.name}, ${w.hpText}.` : 'No walls.'}</span>}
              <span className="pl:hidden"><GeneralsLine generals={m.yours.generals} /></span>
            </>} />
        </div>
        {!m.odds.undefended && (
          <div className="flex items-center gap-3 px-0.5" data-testid="defense-odds" title={m.auto}>
            <div className="shrink-0 text-[12px] leading-tight"><span className="text-fa-muted">Auto {m.attacking ? 'wins' : 'holds'} </span><span className={m.odds.hold >= 0.5 ? 'text-fa-good font-semibold' : 'text-fa-danger-text font-semibold'}><span className="fa-num">{Math.round(m.odds.hold * 100)}%</span> · {m.odds.verdict}</span></div>
            <div className="flex-1 min-w-0"><OddsBar compact mine={m.odds.hold} labelLeft={m.attacking ? 'they hold' : 'they take it'} labelRight={m.attacking ? 'you win' : 'you hold'} /></div>
          </div>
        )}
        <ModeCards options={options} value={chosen} onChange={setMode} compact />
        <ModeExplain title={chosen === 'command' ? 'Command' : chosen === 'auto' ? 'Auto' : 'Withdraw'} right={chosen === 'command' ? 'Your call' : null} compact>{explain}</ModeExplain>
        {defenses.length > 1 && (
          <div className="text-[11px] text-fa-muted">Next: {defenses.slice(1, 3).map((d) => battleNameOf(state, { kind: queuedKind(d), regionId: d.regionId, tile: d.tile })).join(', ')}{defenses.length > 3 ? ` and ${defenses.length - 3} more` : ''}.</div>
        )}
      </div>

      <div className="px-3 pt-1.5 pb-2 border-t border-fa-line flex items-center gap-2">
        <label className="flex-1 min-w-0 flex items-center gap-2 min-h-[44px] cursor-pointer">
          <button type="button" role="switch" aria-checked={autoDefend} aria-label="Always Auto for defences" data-testid="defense-always-auto" className="fa-switch shrink-0"
            onClick={() => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { autoDefend: !autoDefend } })} />
          <span className="text-[12.5px] leading-tight">Always Auto for defences</span>
        </label>
        {defenses.length > 1 && <Button size="sm" className="!min-h-[44px]" onClick={() => dispatch({ type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO })} data-testid="defense-auto-all">Auto all {defenses.length}</Button>}
        <Button variant="primary" hero onClick={act} data-testid="defense-go" className="!min-h-[48px] !px-4">{action}</Button>
      </div>
    </div>
  );
};

export default DefenseSheet;
