// src/components/battle/PreBattleModal.jsx
// W11 Pre-battle (plans/UI-DESIGN.md; Tactical Battles plan 2 and 10.2). EVERY attack you launch,
// on a garrisoned city or an empty one, stops here first; a remembered setting never skips it.
// Three columns at 844x390 and on the desktop (stacked on a phone held upright):
//   yours   your army by kind with its men and generals
//   middle  the odds with where they come from (exact: a spy report or both armies in sight;
//           otherwise the scouts' guess, a band), the walls and the houses (battle housing), and
//           300 a side with the waves
//   theirs  their garrison or army (a range of men and "?" without intel)
// Then the way to fight as two cards (Command, Auto), what it means, and the one brass button.
// Call off is the close button: nothing is spent and the army keeps its move. With `navalUnitId`
// it is a landing by the troops aboard that fleet; with `tile` a field battle; with `fromTile`
// too a sea battle. All the numbers come from preBattleModel.js.
//
// A decision card (playtest audit X18, I153, I154): a tap on the dimmed map never closes it. Only
// its own buttons do: Call off (the explicit choice), Begin battle or Fight on Auto. `arrival`: the
// game opened it (an army that marched to attack has arrived, MarchAttackPrompt.jsx); then it
// waits its turn behind a more pressing card (useExclusivePanel.js), and "Decide later" sets it
// aside as a chip that brings it back, without cancelling the march.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Castle, Home, Users, Mountain, ChevronDown } from 'lucide-react';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { terrainWord } from '../../i18n/gameText';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { Button, CloseButton, IconButton, Switch } from '../ui/atlas';
import GameIcon from '../ui/GameIcon';
import { openSettings } from '../ui/uiEvents';
import { ForceCard, GeneralsLine, ModeCards, ModeExplain, OddsBar } from './warAtlas';
import { preBattleModel } from './preBattleModel';
import { battleRequired } from '../../engine/battleThreshold';
import { prewarmBattleWorker } from '../../battle/worker/warmWorker';

const pct = (v) => `${Math.round(v * 100)}%`;

const Tile = ({ icon: Icon, label, title, children, testId }) => (
  <div className="fa-card px-2.5 py-1.5 min-w-0" data-testid={testId}>
    <div className="fa-label flex items-center gap-1">{Icon && <Icon className="w-3 h-3" aria-hidden="true" />}{label}</div>
    <div className="text-[12.5px] font-semibold leading-tight mt-0.5">{title}</div>
    {children && <div className="text-[11px] text-fa-muted leading-snug mt-0.5">{children}</div>}
  </div>
);

const PreBattleModal = ({ fromRegionId, targetRegionId = null, navalUnitId = null, tile = null, fromTile = null, onClose, arrival = false }) => {
  const { state, dispatch, addLog } = useGame();
  const { t } = useT();
  const { triggerEffect } = useEffects();
  const m = useMemo(() => preBattleModel(state, { fromRegionId, targetRegionId, navalUnitId, tile, fromTile }),
    [state, fromRegionId, targetRegionId, navalUnitId, tile, fromTile]);
  const turn = useInteraction(arrival ? 'pre-battle-arrival' : 'pre-battle', true, { priority: PRIORITY.preBattle, label: tNow('wait.commandOrAuto', { name: m.name }), testId: 'pre-battle-chip', tone: 'danger', user: !arrival });
  useEffect(() => { prewarmBattleWorker(); }, []); // the battle's worker loads while the player decides
  const preferred = state.battleSettings?.defaultMode === 'auto' ? 'auto' : 'command';
  const [mode, setMode] = useState(preferred);
  const [prefer, setPrefer] = useState(false);
  const { landing, fleet, field, blockedReason, affordable, blockedAtSea, knownEmpty, noMansLand, commandBlocked } = m;
  const autoOnly = blockedAtSea || !!noMansLand || !!commandBlocked;
  const chosen = autoOnly ? 'auto' : mode;

  const remember = (choice) => { if (prefer) dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { defaultMode: choice } }); };
  const auto = () => {
    if (blockedReason) return addLog(blockedReason, 'action');
    if (!affordable) return addLog(t('bt.pre.notEnough'), 'action');
    remember('auto');
    if (landing) {
      triggerEffect('amphibious_assault', { from: m.origin, to: targetRegionId });
      dispatch({ type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId } });
    } else if (fleet) {
      dispatch({ type: ActionTypes.ATTACK_FLEET, payload: { fromTile, tile } });
    } else if (field) {
      dispatch({ type: ActionTypes.ATTACK_ARMY, payload: { fromRegionId, tile } });
    } else {
      triggerEffect('ground_invasion', { from: fromRegionId, to: targetRegionId });
      dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } });
    }
    return onClose();
  };
  const command = () => {
    if (blockedReason || autoOnly) return addLog(blockedReason || noMansLand || commandBlocked || t('bt.pre.defeatFleet'), 'action');
    if (!affordable) return addLog(t('bt.pre.notEnough'), 'action');
    remember('command');
    dispatch(landing
      ? { type: ActionTypes.BEGIN_AMPHIBIOUS_BATTLE, payload: { navalUnitId, targetRegionId } }
      : { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: fleet ? { fromTile, tile, naval: true } : field ? { fromRegionId, tile } : { fromRegionId, targetRegionId } });
    return onClose();
  };
  const disabled = !!blockedReason || !affordable;
  // U18: a small open town falls on Auto without this card; its report opens and says why.
  const skip = !landing && !fleet && !field && !blockedReason && affordable && !battleRequired(state, targetRegionId);
  useEffect(() => {
    if (!skip) return;
    dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId, smallTown: true } });
    onClose();
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps
  if (skip) return null;
  const options = [
    { id: 'command', sub: noMansLand ? t('bt.pre.optNoMans') : commandBlocked ? t('bt.pre.optNobody') : t('bt.pre.optRealTime'), disabled: disabled || autoOnly, testId: 'battle-choice-command', title: blockedAtSea ? t('bt.pre.optFleetGuards') : noMansLand ? t('bt.pre.optNoMansTitle') : commandBlocked || undefined },
    { id: 'auto', sub: t('bt.pre.optInstant'), disabled, testId: 'battle-choice-auto' }
  ];
  const c = m.chance;
  const w = m.walls;

  // Another card is on screen first: this one waits as a chip (WaitingChips.jsx).
  if (!turn.shown) return null;

  // On the body: opened from the map (the march arrival), a transformed parent would clip it.
  // The backdrop only dims: it has no click handler, so a tap aimed at something under it cannot
  // close the card and lose the attack.
  const card = (
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-end sm:items-center justify-center pe-[var(--rail-inset,0px)]" data-testid="battle-choice">
      <div role="dialog" aria-modal="true" aria-labelledby="pre-battle-title" data-testid="pre-battle"
        className="fa-panel !bg-fa-panel shadow-2xl w-full sm:w-[min(56rem,calc(100vw-1rem-var(--rail-inset,0px)))] max-h-[94dvh] sm:max-h-[calc(100dvh-1rem)] flex flex-col rounded-b-none sm:rounded-[10px]">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
          <Castle className="w-5 h-5 text-fa-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 flex items-baseline gap-x-3 flex-wrap">
            <h2 id="pre-battle-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight" data-testid="battle-name">{m.name}</h2>
            <span className="text-[12px] text-fa-muted truncate">{m.subtitle} · {t('bt.pre.turnShort', { n: m.turn })}</span>
          </div>
          {arrival ? (
            <>
              <Button size="sm" onClick={onClose} data-testid="battle-choice-calloff" title={t('bt.pre.callOffTitle')} className="shrink-0">{t('bt.pre.callOff')}</Button>
              <IconButton label={t('bt.pre.decideLater')} icon={ChevronDown} onClick={turn.tuck} className="shrink-0 !w-9 !h-9" data-testid="battle-choice-later" />
            </>
          ) : <CloseButton onClick={onClose} label={t('bt.pre.callOffClose')} className="shrink-0" />}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 pl:p-2 grid gap-2 grid-cols-1 sm:grid-cols-[1fr_1.35fr_1fr]">
          <ForceCard tone="you" tag={t('bt.pre.tagYours')} name={m.yours.title} total={m.yours.men} lines={m.yours.lines.slice(0, 5)} testId="pre-battle-yours"
            footer={<>
              <GeneralsLine generals={m.yours.generals} />
              <span className="flex items-center gap-1.5 mt-1 text-[12px] text-fa-text" data-testid="pre-battle-size">
                <Users className="w-3.5 h-3.5 text-fa-muted shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0"><b className="fa-num">{t('bt.pre.capASide', { cap: m.size.cap })}</b>{m.size.heldBack ? t('bt.pre.stayOut', { n: m.size.heldBack }) : t('bt.pre.allAtOnce', { n: m.yours.regiments })}</span>
                <button type="button" onClick={openSettings} className="underline text-fa-muted hover:text-fa-text shrink-0 min-h-[32px]">{t('bt.pre.settings')}</button>
              </span>
            </>} />

          <div className="space-y-2 min-w-0 order-last sm:order-none">
            {c && c.exact && (
              <div className="fa-card px-2.5 py-1.5" data-testid="battle-odds">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="fa-label truncate" title={t('bt.pre.autoOddsTitle')}>{t('bt.pre.autoOdds', { src: c.source })}</span>
                  <span className={`text-[13px] font-bold ${c.win >= 0.5 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{c.verdict}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-0.5 text-center">
                  <div><div className="fa-num text-[15px] font-semibold text-fa-you">{pct(c.win)}</div><div className="text-[10.5px] text-fa-muted leading-tight">{t('bt.pre.youWin')}</div></div>
                  <div><div className="fa-num text-[15px] font-semibold text-fa-good" data-testid="battle-odds-capture">{pct(c.take)}</div><div className="text-[10.5px] text-fa-muted leading-tight">{field || fleet ? t('bt.pre.driveOff') : t('bt.pre.takeIt')}</div></div>
                  <div><div className="fa-num text-[15px] font-semibold text-fa-enemy">{pct(c.lose)}</div><div className="text-[10.5px] text-fa-muted leading-tight">{t('bt.pre.theyHold')}</div></div>
                </div>
                <div className="mt-1"><OddsBar mine={c.win} compact /></div>
                <div className="text-[11px] text-fa-muted leading-snug pl:hidden">{c.losses}{m.v?.ok && !c.take && !field && m.cityRule !== 'garrison' ? t('bt.pre.needInfantry') : ''}</div>
                {c.factors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="battle-odds-factors">
                    {c.factors.map((f) => (
                      <span key={f.id} title={f.detail || ''} className={`fa-chip !min-h-[22px] !px-1.5 !text-[10.5px] ${f.value > 1 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{f.label} x{f.value.toFixed(2)}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {c && !c.exact && (
              <div className="fa-card px-2.5 py-1.5" data-testid="battle-odds-scouts">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="fa-label" title={t('bt.pre.scoutsGuessTitle')}>{t('bt.pre.scoutsGuessLabel')}</span>
                  <span className={`text-[13px] font-bold ${c.bandId === 'likely' ? 'text-fa-good' : c.bandId === 'unlikely' ? 'text-fa-danger-text' : 'text-fa-brass'}`}>{c.verdict}</span>
                </div>
                <div className="mt-1"><OddsBar band={c.band} bandColor={c.bandId === 'likely' ? 'var(--fa-good)' : c.bandId === 'unlikely' ? 'var(--fa-enemy)' : 'var(--fa-brass)'} compact /></div>
                <div className="text-[11px] text-fa-muted leading-snug">{c.hint}<span className="pl:hidden">{t('bt.pre.rangeNotNumber')}</span></div>
              </div>
            )}
            {knownEmpty && (
              <div className="fa-card px-2.5 py-1.5 text-[12.5px] text-fa-good" data-testid="pre-battle-undefended">{commandBlocked || t('bt.pre.undefended')}</div>
            )}
            {m.cityRule && (
              <div className="text-[11.5px] leading-snug text-fa-muted px-0.5" data-testid="pre-battle-city-rule">
                <b className="text-fa-text">{t('bt.pre.ruleAutoB')}</b>{t('bt.pre.ruleAuto')}{' '}
                <b className="text-fa-text">{t('bt.pre.ruleCommandB')}</b>{t('bt.pre.ruleCommand')}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {w ? (
                <>
                  <Tile icon={Castle} label={t('bt.pre.walls')} title={w.level ? w.name : t('bt.war.noWalls')} testId="pre-battle-fort">{w.level ? w.hpText : t('bt.war.openTown')}{m.fortTier > 0 ? t('bt.pre.fortLevel', { n: m.fortTier }) : ''}</Tile>
                  <Tile icon={Home} label={t('bt.pre.houses')} title={t('bt.pre.housesTitle', { n: w.houses, h: w.housing })} testId="pre-battle-houses">{t('bt.pre.housesRepaired')}</Tile>
                </>
              ) : (
                <>
                  <Tile icon={Mountain} label={t('bt.pre.ground')} title={<span className="capitalize">{m.terrain === 'sea' ? t('bt.pre.openWater') : terrainWord(m.terrain)}</span>} testId="pre-battle-fort">{fleet ? t('bt.pre.shipsVsShips') : t('bt.pre.noWallsOpen')}</Tile>
                  <Tile icon={Castle} label={t('bt.pre.afterIt')} title={field ? t('bt.pre.decisive') : t('bt.pre.atSea')}>{field ? t('bt.pre.afterField') : t('bt.pre.afterSea')}</Tile>
                </>
              )}
            </div>
            {landing && <div className="text-[11.5px] text-fa-muted">{m.v?.hasBeachhead ? t('bt.pre.beachhead') : t('bt.pre.noFoothold')}</div>}
          </div>

          <ForceCard tone="enemy" tag={t('bt.pre.tagTheirs')} name={m.hasIntel ? m.theirs.title : ''} total={m.theirs.total} lines={m.theirs.lines.slice(0, 5)} unknownLines={!m.hasIntel} testId="pre-battle-theirs"
            footer={m.theirs.note} />
        </div>

        {blockedReason && <div role="status" className="mx-2.5 mb-1.5 text-[12.5px] text-fa-brass rounded-[8px] border border-fa-brass/50 px-2.5 py-1.5" data-testid="battle-blocked-reason">{blockedReason}</div>}
        {!blockedReason && m.siegeAdvice && <div role="status" className="mx-2.5 mb-1.5 text-[12px] leading-snug text-fa-brass" data-testid="pre-battle-siege-advice">{m.siegeAdvice}</div>}
        {!blockedReason && !affordable && <div role="status" className="mx-2.5 mb-1.5 text-[12.5px] text-fa-danger-text">{t('bt.pre.notEnoughLaunch')}</div>}
        {landing && blockedAtSea && <div className="mx-2.5 mb-1.5 text-[11.5px] text-fa-muted">{t('bt.pre.fleetGuardsLanding')}</div>}
        {noMansLand && (
          <div role="status" className="mx-2.5 mb-1.5 flex items-center gap-2 text-[12px] text-fa-muted" data-testid="pre-battle-no-mans-land">
            <GameIcon group="ui" id="no-mans-land" size={22} halo={false} fallback={<Mountain className="w-4 h-4 shrink-0" aria-hidden="true" />} />
            <span><b className="text-fa-text">{noMansLand}.</b>{t('bt.pre.noMansBorders')}</span>
          </div>
        )}

        <div className="px-2.5 pt-2 pb-[max(env(safe-area-inset-bottom),0.625rem)] border-t border-fa-line grid gap-2 grid-cols-1 sm:grid-cols-[minmax(14.5rem,1.2fr)_minmax(0,1.6fr)_auto] items-stretch" data-testid="pre-battle-footer">
          {options.length > 0 ? <ModeCards options={options} value={chosen} onChange={setMode} compact /> : <div />}
          <ModeExplain title={chosen === 'command' ? t('bt.pre.modeCommand') : t('bt.pre.modeAuto')} compact className="min-w-0 pl:max-h-[4.75rem] pl:overflow-y-auto">{chosen === 'command' ? m.command : m.auto}</ModeExplain>
          <div className="flex flex-col gap-1 justify-center">
            <Button variant="primary" hero disabled={disabled || (chosen === 'command' && autoOnly)} onClick={chosen === 'command' ? command : auto} data-testid="battle-go" className="!min-h-[52px] !px-6 pl:!px-3 w-full">
              {chosen === 'command' ? t('bt.pre.beginBattle') : t('bt.pre.fightAuto')}
            </Button>
            {!arrival && <button type="button" onClick={onClose} className="sr-only" data-testid="battle-choice-calloff">{t('bt.pre.callOffPlain')}</button>}
          </div>
        </div>
        <div className="px-3 pb-2 -mt-1 pl:hidden">
          <Switch label={t('bt.pre.highlight')} hint={t('bt.pre.highlightHint')} checked={prefer} onChange={setPrefer} />
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? card : createPortal(card, document.body);
};

export default PreBattleModal;
