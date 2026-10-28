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
import React, { useEffect, useMemo, useState } from 'react';
import { Shield as ShieldIcon, ChevronDown } from 'lucide-react';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { queuedBattleView, battleQueueBlocked, queuedKind } from '../../engine/battleQueue';
import { battleNameOf } from '../../engine/battleName';
import { Button, IconButton, Switch } from '../ui/atlas';
import { autoSiegeOn } from '../../engine/battleThreshold';
import GameIcon from '../ui/GameIcon';
import { ForceCard, GeneralsLine, ModeCards, ModeExplain, OddsBar } from './warAtlas';
import { defenseSheetModel } from './defenseSheetModel';
import { SHOW_DEFENSE } from '../ui/uiEvents';
import { prewarmBattleWorker } from '../../battle/worker/warmWorker';
import { useInteraction, interactions, PRIORITY } from '../../hooks/useExclusivePanel';

const DefenseSheet = () => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  // End Turn's "Defend <city>: Command or Auto" (turnBlockers.js) brings it back up.
  useEffect(() => {
    const onShow = () => interactions.promote('defense');
    window.addEventListener(SHOW_DEFENSE, onShow);
    return () => window.removeEventListener(SHOW_DEFENSE, onShow);
  }, []);
  // null until the player picks: then the card's own suggestion (defenseSheetModel `suggested`).
  const [mode, setMode] = useState(null);
  const defenses = state.pendingDefenses || [];
  const def = defenses[0] || null;
  const blocked = !def || !!state.pendingBattle || battleQueueBlocked(state);
  const view = useMemo(() => (blocked ? null : queuedBattleView(state, def, 30)), [blocked, def, state.units, state.regions]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMemo(() => (view ? defenseSheetModel(state, def, { view }) : null), [view]); // eslint-disable-line react-hooks/exhaustive-deps
  // One entry of the interaction registry (useExclusivePanel.js): set aside ("Look at the map
  // first") or behind a card the player opened, it waits as the "N under attack" chip.
  const up = !blocked && !!m;
  useEffect(() => { if (up) prewarmBattleWorker(); }, [up]); // the battle's worker loads while the player decides
  const turn = useInteraction('defense', !blocked && !!m, { priority: PRIORITY.defense, label: tNow('wait.defense', { n: defenses.length }), testId: 'defense-pill', tone: 'danger' });
  // The queue waits while a battle is under way or an event or a peace offer is open (the engine's
  // own rule, battleQueue.js battleQueueBlocked).
  if (blocked || !m || !turn.shown) return null;

  const picked = mode || m.suggested || 'command';
  const noCommand = !!(m.noMansLand || m.commandBlocked);
  const chosen = noCommand && picked === 'command' ? 'auto' : picked === 'withdraw' && !m.withdraw?.ok ? (noCommand ? 'auto' : 'command') : picked;
  const act = () => {
    if (chosen === 'auto') dispatch({ type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    else if (chosen === 'withdraw') dispatch({ type: ActionTypes.WITHDRAW_FROM_DEFENSE, payload: { defenseId: def.id } });
    else dispatch({ type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
  };
  const options = [
    { id: 'command', sub: m.noMansLand ? t('bt.def.optNoMans') : m.commandBlocked ? t('bt.def.optSeeWhy') : m.city ? t('bt.def.optCity') : t('bt.def.optRealTime'), disabled: noCommand, title: m.noMansLand ? t('bt.def.optNoMansTitle') : m.commandBlocked || undefined, testId: 'defense-command' },
    { id: 'auto', sub: t('bt.def.optInstant'), testId: 'defense-auto' },
    ...(m.withdraw ? [{ id: 'withdraw', sub: m.withdraw.ok ? t('bt.def.optGiveUp', { place: m.place }) : t('bt.def.optNowhere'), disabled: !m.withdraw.ok, title: m.withdraw.text, testId: 'defense-withdraw' }] : [])
  ];
  const explain = chosen === 'auto' ? m.auto : chosen === 'withdraw' ? m.withdraw.text : m.command;
  const action = chosen === 'auto' ? t('bt.def.fightAuto') : chosen === 'withdraw' ? t('bt.def.withdraw') : m.attacking ? t('bt.def.beginBattle') : t('bt.def.beginDefence');
  const w = m.walls;
  const autoDefend = state.battleSettings?.autoDefend === true;

  return (
    <div role="dialog" aria-labelledby="defense-title" data-testid="defense-sheet"
      className="fixed z-[71] start-[max(var(--safe-start),0.5rem)] top-[calc(var(--header-height,2.5rem)+0.375rem)] max-h-[calc(100dvh-var(--header-height,2.5rem)-0.375rem-max(env(safe-area-inset-bottom),0.5rem))] w-[min(30rem,calc(100vw-1rem-var(--rail-inset,0px)))] min-w-[min(22rem,calc(100vw-1rem))] lg:w-[32rem] flex flex-col fa-panel !bg-fa-panel shadow-2xl">
      <div className="flex items-start gap-2 px-3 pt-2 pb-1 border-b border-fa-line">
        <ShieldIcon className="w-5 h-5 mt-1 text-fa-danger-text shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-fa-danger-text truncate">{m.eyebrow}</div>
          <h2 id="defense-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight truncate">{m.name}</h2>
        </div>
        <div className="text-end text-[11px] leading-tight shrink-0 pt-0.5">
          <div className="font-semibold">{t('bt.def.endTurnPaused')}</div>
          <div className="text-fa-muted fa-num">{defenses.length > 1 ? t('bt.def.nOfM', { a: 1, b: defenses.length }) : t('bt.def.oneBattle')}</div>
        </div>
        <IconButton label={t('bt.def.lookMap')} icon={ChevronDown} onClick={turn.tuck} className="!w-9 !h-9 -me-1" data-testid="defense-later" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2 pl:space-y-1.5" data-testid="defense-row">
        <div className="grid grid-cols-2 gap-2">
          <ForceCard tone="enemy" tag={t('bt.def.tagTheirs')} name={m.theirs.title} total={m.theirs.men} lines={m.theirs.lines.slice(0, 3)} footer={<span className="pl:hidden">{m.theirs.note}</span>} testId="defense-theirs" />
          <ForceCard tone="you" tag={t('bt.def.tagYours')} name={m.yours.title} total={m.yours.men} lines={m.yours.lines.slice(0, 3)} testId="defense-yours"
            footer={<>
              {w && <span className="block pl:hidden">{t('bt.def.housesHall', { houses: w.houses })}<b className="fa-num text-fa-text">{w.housing}</b>. {w.level ? t('bt.def.wallsHp', { name: w.name, hp: w.hpText }) : t('bt.def.noWallsDot')}</span>}
              <span className="pl:hidden"><GeneralsLine generals={m.yours.generals} /></span>
            </>} />
        </div>
        {(!m.odds.undefended || m.yours.militia > 0) && ( /* militia alone still fights: its odds show (playtest 40550092795) */
          <div className="flex items-center gap-3 px-0.5" data-testid="defense-odds" title={m.auto}>
            <div className="shrink-0 text-[12px] leading-tight"><span className="text-fa-muted">{m.attacking ? t('bt.def.autoWinsLabel') : t('bt.def.autoHoldsLabel')}</span><span className={m.odds.hold >= 0.5 ? 'text-fa-good font-semibold' : 'text-fa-danger-text font-semibold'}><span className="fa-num">{Math.round(m.odds.hold * 100)}%</span> · {m.odds.verdict}</span></div>
            <div className="flex-1 min-w-0"><OddsBar compact mine={m.odds.hold} labelLeft={m.attacking ? t('bt.def.theyHold') : t('bt.def.theyTakeIt')} labelRight={m.attacking ? t('bt.def.youWin') : t('bt.def.youHold')} /></div>
          </div>
        )}
        {/* the choice right under the odds: a long warning pushed it off a phone's sheet (playtest 40650973042 step 129) */}
        <ModeCards options={options} value={chosen} onChange={setMode} compact />
        {m.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 px-0.5" data-testid="defense-odds-factors">
            {m.reasons.map((f) => (
              <span key={f.id} title={f.detail || ''} className={`fa-chip !min-h-[22px] !px-1.5 !text-[10.5px] ${f.value > 1 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{f.label} x{f.value.toFixed(2)}</span>
            ))}
          </div>
        )}
        {m.aux && <div className="text-[11px] text-fa-muted leading-snug px-0.5" data-testid="defense-odds-aux">{m.aux}</div>}
        {m.warning && <div role="status" className="text-[12px] leading-snug text-fa-danger-text rounded-[8px] border border-fa-danger/60 px-2 py-1" data-testid="defense-hopeless">{m.warning}</div>}
        {m.commandBlocked && (
          <div role="status" className="text-[12px] leading-snug text-fa-muted" data-testid="defense-no-command"><b className="text-fa-text">{t('bt.def.cmdNotPossible')}</b> {m.commandBlocked}</div>
        )}
        {m.noMansLand && (
          <div role="status" className="flex items-center gap-2 text-[12px] text-fa-muted" data-testid="defense-no-mans-land">
            <GameIcon group="ui" id="no-mans-land" size={22} halo={false} />
            <span><b className="text-fa-text">{m.noMansLand}.</b>{t('bt.def.noMansBorders')}</span>
          </div>
        )}
        <ModeExplain title={t(`bt.atlas.${chosen}`)} right={chosen === 'command' ? t('bt.def.yourCall') : null} compact>{explain}</ModeExplain>
        {queuedKind(def) === 'defense' && state.regions?.[def.regionId]?.siege && (
          <Switch label={t('bt.siege.auto')} checked={autoSiegeOn(state, def.regionId)} testId="defense-auto-siege"
            onChange={(on) => dispatch({ type: ActionTypes.SET_AUTO_SIEGE, payload: { regionId: def.regionId, on } })} />
        )}
        {defenses.length > 1 && (
          <div className="text-[11px] text-fa-muted">{t('bt.def.next', { list: defenses.slice(1, 3).map((d) => nameNow('battle', null, battleNameOf(state, { kind: queuedKind(d), regionId: d.regionId, tile: d.tile }))).join(', '), more: defenses.length > 3 ? t('bt.def.andMore', { n: defenses.length - 3 }) : '' })}</div>
        )}
      </div>

      <div className="px-3 pt-1.5 pb-2 border-t border-fa-line flex items-center gap-2">
        <label className="flex-1 min-w-0 flex items-center gap-2 min-h-[44px] cursor-pointer">
          <button type="button" role="switch" aria-checked={autoDefend} aria-label={t('bt.def.alwaysAuto')} data-testid="defense-always-auto" className="fa-switch shrink-0"
            onClick={() => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { autoDefend: !autoDefend } })} />
          <span className="text-[12.5px] leading-tight">{t('bt.def.alwaysAuto')}</span>
        </label>
        {defenses.length > 1 && <Button size="sm" className="!min-h-[44px]" onClick={() => dispatch({ type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO })} data-testid="defense-auto-all">{t('bt.def.autoAll', { n: defenses.length })}</Button>}
        <Button variant="primary" hero onClick={act} data-testid="defense-go" className="!min-h-[48px] !px-4">{action}</Button>
      </div>
    </div>
  );
};

export default DefenseSheet;
