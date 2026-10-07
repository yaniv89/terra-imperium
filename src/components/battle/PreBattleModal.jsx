// src/components/battle/PreBattleModal.jsx
// W11 Pre-battle (plans/UI-DESIGN.md; Tactical Battles plan 2 and 10.2). EVERY attack you launch,
// on a garrisoned city or an empty one, stops here first; a remembered setting never skips it.
// Three columns at 844x390 and on the desktop (stacked on a phone held upright):
//   yours   your army by kind with its men and generals
//   middle  the odds with where they come from (exact: a spy report or both armies in sight;
//           otherwise the scouts' guess, a band), the walls and the houses (battle housing and the
//           50% rule), and 300 a side with the waves
//   theirs  their garrison or army (a range of men and "?" without intel)
// Then the way to fight as two cards (Command, Auto), what it means, and the one brass button.
// Call off is the close button: nothing is spent and the army keeps its move. With `navalUnitId`
// it is a landing by the troops aboard that fleet; with `tile` a field battle; with `fromTile`
// too a sea battle. All the numbers come from preBattleModel.js.
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Castle, Home, Users, Mountain } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { Button, CloseButton, Switch } from '../ui/atlas';
import { openSettings } from '../ui/uiEvents';
import { ForceCard, GeneralsLine, ModeCards, ModeExplain, OddsBar } from './warAtlas';
import { preBattleModel } from './preBattleModel';

const pct = (v) => `${Math.round(v * 100)}%`;

const Tile = ({ icon: Icon, label, title, children, testId }) => (
  <div className="fa-card px-2.5 py-1.5 min-w-0" data-testid={testId}>
    <div className="fa-label flex items-center gap-1">{Icon && <Icon className="w-3 h-3" aria-hidden="true" />}{label}</div>
    <div className="text-[12.5px] font-semibold leading-tight mt-0.5">{title}</div>
    {children && <div className="text-[11px] text-fa-muted leading-snug mt-0.5">{children}</div>}
  </div>
);

const PreBattleModal = ({ fromRegionId, targetRegionId = null, navalUnitId = null, tile = null, fromTile = null, onClose }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const m = useMemo(() => preBattleModel(state, { fromRegionId, targetRegionId, navalUnitId, tile, fromTile }),
    [state, fromRegionId, targetRegionId, navalUnitId, tile, fromTile]);
  const preferred = state.battleSettings?.defaultMode === 'auto' ? 'auto' : 'command';
  const [mode, setMode] = useState(preferred);
  const [prefer, setPrefer] = useState(false);
  const { landing, fleet, field, blockedReason, affordable, blockedAtSea, knownEmpty } = m;
  const chosen = knownEmpty || blockedAtSea ? 'auto' : mode;

  const remember = (choice) => { if (prefer) dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: { defaultMode: choice } }); };
  const auto = () => {
    if (blockedReason) return addLog(blockedReason, 'action');
    if (!affordable) return addLog('Not enough resources', 'action');
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
    if (blockedReason || blockedAtSea) return addLog(blockedReason || 'Defeat the defending fleet first.', 'action');
    if (!affordable) return addLog('Not enough resources', 'action');
    remember('command');
    dispatch(landing
      ? { type: ActionTypes.BEGIN_AMPHIBIOUS_BATTLE, payload: { navalUnitId, targetRegionId } }
      : { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: fleet ? { fromTile, tile, naval: true } : field ? { fromRegionId, tile } : { fromRegionId, targetRegionId } });
    return onClose();
  };
  const disabled = !!blockedReason || !affordable;
  const options = knownEmpty ? [] : [
    { id: 'command', sub: 'Play the battle in real time', disabled: disabled || blockedAtSea, testId: 'battle-choice-command', title: blockedAtSea ? 'An enemy fleet guards the coast: fight it at sea first' : undefined },
    { id: 'auto', sub: 'Instant result, same rules', disabled, testId: 'battle-choice-auto' }
  ];
  const c = m.chance;
  const w = m.walls;

  // On the body: opened from the map (the march arrival), a transformed parent would clip it.
  const card = (
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-end sm:items-center justify-center pr-[var(--rail-inset,0px)]" onClick={onClose} data-testid="battle-choice">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="pre-battle-title" data-testid="pre-battle"
        className="fa-panel !bg-fa-panel shadow-2xl w-full sm:w-[min(56rem,calc(100vw-1rem-var(--rail-inset,0px)))] max-h-[94dvh] sm:max-h-[calc(100dvh-1rem)] flex flex-col rounded-b-none sm:rounded-[10px]">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-fa-line">
          <Castle className="w-5 h-5 text-fa-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 flex items-baseline gap-x-3 flex-wrap">
            <h2 id="pre-battle-title" className="fa-heading text-[19px] pl:text-[17px] leading-tight" data-testid="battle-name">{m.name}</h2>
            <span className="text-[12px] text-fa-muted truncate">{m.subtitle} · T{m.turn}</span>
          </div>
          <CloseButton onClick={onClose} label="Call off the attack: nothing is spent, your army keeps its move" className="shrink-0" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 pl:p-2 grid gap-2 grid-cols-1 sm:grid-cols-[1fr_1.35fr_1fr]">
          <ForceCard tone="you" tag="YOURS" name={m.yours.title} total={m.yours.men} lines={m.yours.lines.slice(0, 5)} testId="pre-battle-yours"
            footer={<>
              <GeneralsLine generals={m.yours.generals} />
              <span className="flex items-center gap-1.5 mt-1 text-[12px] text-fa-text" data-testid="pre-battle-size">
                <Users className="w-3.5 h-3.5 text-fa-muted shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0"><b className="fa-num">{m.size.cap} a side</b>{m.size.waves ? ` · ${m.size.waves} more join in a second wave` : ` · all ${m.yours.regiments} at once`}</span>
                <button type="button" onClick={openSettings} className="underline text-fa-muted hover:text-fa-text shrink-0 min-h-[32px]">Settings</button>
              </span>
            </>} />

          <div className="space-y-2 min-w-0 order-last sm:order-none">
            {c && c.exact && (
              <div className="fa-card px-2.5 py-1.5" data-testid="battle-odds">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="fa-label truncate">{c.source}</span>
                  <span className={`text-[13px] font-bold ${c.win >= 0.5 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{c.verdict}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-0.5 text-center">
                  <div><div className="fa-num text-[15px] font-semibold text-fa-you">{pct(c.win)}</div><div className="text-[10.5px] text-fa-muted leading-tight">you win</div></div>
                  <div><div className="fa-num text-[15px] font-semibold text-fa-good" data-testid="battle-odds-capture">{pct(c.take)}</div><div className="text-[10.5px] text-fa-muted leading-tight">{field || fleet ? 'drive them off' : 'take it'}</div></div>
                  <div><div className="fa-num text-[15px] font-semibold text-fa-enemy">{pct(c.lose)}</div><div className="text-[10.5px] text-fa-muted leading-tight">they hold</div></div>
                </div>
                <div className="mt-1"><OddsBar mine={c.win} compact /></div>
                <div className="text-[11px] text-fa-muted leading-snug pl:hidden">{c.losses}{m.v?.ok && !c.take && !field ? ' You need infantry or cavalry to take a city.' : ''}</div>
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
                  <span className="fa-label">Scouts&apos; guess</span>
                  <span className={`text-[13px] font-bold ${c.bandId === 'likely' ? 'text-fa-good' : c.bandId === 'unlikely' ? 'text-fa-danger-text' : 'text-fa-brass'}`}>{c.verdict}</span>
                </div>
                <div className="mt-1"><OddsBar band={c.band} bandColor={c.bandId === 'likely' ? 'var(--fa-good)' : c.bandId === 'unlikely' ? 'var(--fa-enemy)' : 'var(--fa-brass)'} compact /></div>
                <div className="text-[11px] text-fa-muted leading-snug">{c.hint}<span className="pl:hidden"> A range, not a number: a spy report gives exact odds.</span></div>
              </div>
            )}
            {knownEmpty && (
              <div className="fa-card px-2.5 py-1.5 text-[12.5px] text-fa-good" data-testid="pre-battle-undefended">No garrison: the city falls as soon as your army marches in.</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {w ? (
                <>
                  <Tile icon={Castle} label="Walls" title={w.level ? w.name : 'No walls'} testId="pre-battle-fort">{w.level ? w.hpText : 'An open town'}{m.fortTier > 0 ? ` · fort level ${m.fortTier}` : ''}</Tile>
                  <Tile icon={Home} label="Houses" title={`${w.houses} houses, housing ${w.housing}`} testId="pre-battle-houses">At most {w.maxLost} can be lost (the 50% rule).</Tile>
                </>
              ) : (
                <>
                  <Tile icon={Mountain} label="Ground" title={<span className="capitalize">{m.terrain === 'sea' ? 'Open water' : m.terrain}</span>} testId="pre-battle-fort">{fleet ? 'Ships against ships' : 'No walls on open ground'}</Tile>
                  <Tile icon={Castle} label="After it" title={field ? 'Decisive' : 'At sea'}>{field ? 'Units still on the field at the end are lost; those that leave by an exit survive.' : 'Sunk ships are gone for good.'}</Tile>
                </>
              )}
            </div>
            {landing && <div className="text-[11.5px] text-fa-muted">{m.v?.hasBeachhead ? 'A beachhead next door: no landing penalty.' : 'No foothold: your troops land under the landing penalty.'}</div>}
          </div>

          <ForceCard tone="enemy" tag="THEIRS" name={m.hasIntel ? m.theirs.title : ''} total={m.theirs.total} lines={m.theirs.lines.slice(0, 5)} unknownLines={!m.hasIntel} testId="pre-battle-theirs"
            footer={m.theirs.note} />
        </div>

        {blockedReason && <div role="status" className="mx-2.5 mb-1.5 text-[12.5px] text-fa-brass rounded-[8px] border border-fa-brass/50 px-2.5 py-1.5" data-testid="battle-blocked-reason">{blockedReason}</div>}
        {!blockedReason && !affordable && <div role="status" className="mx-2.5 mb-1.5 text-[12.5px] text-fa-danger-text">Not enough resources to launch this attack.</div>}
        {landing && blockedAtSea && <div className="mx-2.5 mb-1.5 text-[11.5px] text-fa-muted">An enemy fleet guards the coast: it has to be fought at sea first, so this landing can only be fought on Auto.</div>}

        <div className="px-2.5 pt-2 pb-[max(env(safe-area-inset-bottom),0.625rem)] border-t border-fa-line grid gap-2 grid-cols-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto] items-stretch">
          {options.length > 0 ? <ModeCards options={options} value={chosen} onChange={setMode} compact /> : <div />}
          <ModeExplain title={chosen === 'command' ? 'Command' : knownEmpty ? 'March in' : 'Auto'} compact>{chosen === 'command' ? m.command : m.auto}</ModeExplain>
          <div className="flex flex-col gap-1 justify-center">
            <Button variant="primary" hero disabled={disabled || (chosen === 'command' && blockedAtSea)} onClick={chosen === 'command' ? command : auto} data-testid="battle-go" className="!min-h-[52px] !px-6 w-full">
              {knownEmpty ? 'March in' : chosen === 'command' ? 'Begin battle' : 'Fight on Auto'}
            </Button>
            <button type="button" onClick={onClose} className="sr-only" data-testid="battle-choice-calloff">Call off the attack</button>
          </div>
        </div>
        {!knownEmpty && (
          <div className="px-3 pb-2 -mt-1 pl:hidden">
            <Switch label="Highlight my choice next time" hint="You will still be asked every time." checked={prefer} onChange={setPrefer} />
          </div>
        )}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? card : createPortal(card, document.body);
};

export default PreBattleModal;
