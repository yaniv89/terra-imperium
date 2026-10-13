// src/components/map/MarchAttackPrompt.jsx
// A march to attack has arrived (marchAttack.js readyAttacks): the army stands before its target
// city (and besieges it) or before an enemy army on its way. The normal battle choice opens: the
// pre-battle card, Command or Auto. It is one entry of the interaction registry
// (src/hooks/useExclusivePanel.js), so it waits behind the turn report, an attack on you, a peace
// offer or an event and comes back when they are answered; no list of "busy" states of its own.
// Only "Call off" drops the attack intent (the army stays where it stands, still besieging, and
// its sheet keeps the Assault button); "Decide later" sets the card aside as a chip and keeps the
// march (playtest audit X18).
import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { readyAttacks } from '../../engine/marchAttack';
import PreBattleModal from '../battle/PreBattleModal';

const NONE = [];

const MarchAttackPrompt = () => {
  const { state, dispatch } = useGame();
  // A battle under way owns the screen (and the attacking army).
  const ready = useMemo(() => (state.pendingBattle ? NONE : readyAttacks(state)), [state]);
  const next = ready[0];
  if (!next) return null;
  const callOff = () => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: next.unitIds } });
  return next.kind === 'city'
    ? <PreBattleModal key={next.key} arrival fromRegionId={next.fromRegionId} targetRegionId={next.targetRegionId} onClose={callOff} />
    : <PreBattleModal key={next.key} arrival fromRegionId={next.fromRegionId} tile={next.tile} onClose={callOff} />;
};

export default MarchAttackPrompt;
