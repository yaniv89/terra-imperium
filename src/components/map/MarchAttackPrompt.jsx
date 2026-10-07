// src/components/map/MarchAttackPrompt.jsx
// A march to attack has arrived (marchAttack.js readyAttacks): the army stands before its target
// city (and besieges it) or before an enemy army on its way. The normal battle choice opens: the
// pre-battle card, Command or Auto. Calling it off drops the attack intent; the army stays where it
// stands (still besieging) and its sheet keeps the Assault button.
import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { readyAttacks } from '../../engine/marchAttack';
import PreBattleModal from '../battle/PreBattleModal';
import { TURN_REPORT_SHOWN, isTurnReportShown } from '../ui/uiEvents';

const MarchAttackPrompt = () => {
  const { state, dispatch } = useGame();
  // The turn report first: the arrival opens once the player closes it.
  const [reportShown, setReportShown] = useState(isTurnReportShown);
  useEffect(() => {
    const on = (e) => setReportShown(!!e.detail);
    window.addEventListener(TURN_REPORT_SHOWN, on);
    return () => window.removeEventListener(TURN_REPORT_SHOWN, on);
  }, []);
  // Not over another decision the turn is waiting for.
  const busy = reportShown || !!state.pendingBattle || (state.pendingDefenses || []).length > 0 || !!state.pendingPeaceOffer || !!state.activeEventId || !!state.activeProceduralEvent;
  const ready = useMemo(() => (busy ? [] : readyAttacks(state)), [state, busy]);
  const next = ready[0];
  if (!next) return null;
  const close = () => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: next.unitIds } });
  return next.kind === 'city'
    ? <PreBattleModal key={next.key} fromRegionId={next.fromRegionId} targetRegionId={next.targetRegionId} onClose={close} />
    : <PreBattleModal key={next.key} fromRegionId={next.fromRegionId} tile={next.tile} onClose={close} />;
};

export default MarchAttackPrompt;
