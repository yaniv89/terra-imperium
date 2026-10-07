// src/components/battle/TacticalBattleHost.jsx
// Opens the commanded battle whenever the campaign has one pending (state.pendingBattle), resuming
// from its last checkpoint if the app was closed mid-battle, and hands the result back to the
// reducer (RESOLVE_TACTICAL_BATTLE) — or auto-resolves it on request (ABANDON_TACTICAL_BATTLE).
// Guards (the frozen empty battle of the phone playtest): a battle that can no longer be set up,
// or that has no troops on one side, is never opened: it is settled on Auto through the outcome
// service with a log line saying why. An error while setting it up, starting it or drawing it shows
// BattleFailure (a readable message, Auto or Try again) instead of a frozen field. A checkpoint is
// resumed only into the battle it was saved from (setupKeyOf): battle ids repeat between games.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { battleName } from '../../engine/battleNames';
import { setupKeyOf, SETUP_VERSION } from '../../battle/setup/buildBattleSetup';
import { saveBattleCheckpoint, loadBattleCheckpoint, clearBattleCheckpoint } from '../../battle/worker/battleStore';
import TacticalBattleScreen from './TacticalBattleScreen';
import BattleFailure, { BattleErrorBoundary } from './BattleFailure';
import { autoOddsForPendingBattle } from './autoCompare';
import { battleOpenProblem, checkpointFits, safeBattleSetup } from './battleOpenGuard';

const TacticalBattleHost = () => {
  const { state, dispatch } = useGame();
  const pb = state.pendingBattle;
  const [resume, setResume] = useState(undefined); // undefined = still looking for a checkpoint
  const [attempt, setAttempt] = useState(0); // Try again remounts the battle from the start

  // The setup is fixed for the life of the battle (its units are locked), so build it once per id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => safeBattleSetup(state, pb), [pb?.id, attempt]);
  const setup = built.setup;
  const problem = pb ? battleOpenProblem(built) : null;

  useEffect(() => {
    let alive = true;
    setResume(undefined);
    if (!pb || !setup) return undefined;
    if (attempt > 0) { setResume(null); return undefined; } // a retry starts fresh
    loadBattleCheckpoint(pb.id).then((cp) => {
      if (!alive) return;
      if (cp && !checkpointFits(cp, setup)) { clearBattleCheckpoint(pb.id); setResume(null); return; }
      setResume(cp || null);
    });
    return () => { alive = false; };
  }, [pb?.id, setup]); // eslint-disable-line react-hooks/exhaustive-deps

  // A battle that cannot be shown is settled on Auto at once (the outcome service), with the reason.
  useEffect(() => { if (pb && problem) dispatch({ type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { reason: problem } }); }, [pb, problem, dispatch]);

  // For the result screen (B08): the campaign facts the result shows (the turn, the generals for
  // their fate, Auto's odds for this same battle), read once, when the battle ends.
  const getCampaign = useCallback(() => ({
    turnNumber: state.turnNumber, year: state.year, hiredCommanders: state.hiredCommanders || {},
    auto: pb ? autoOddsForPendingBattle(state, pb) : null
  }), [pb?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pb) return null;
  const abandon = (reason = null) => { clearBattleCheckpoint(pb.id); dispatch({ type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: typeof reason === 'string' ? { reason } : undefined }); };
  const retry = () => { clearBattleCheckpoint(pb.id); setAttempt((a) => a + 1); };
  if (built.error) {
    return <BattleFailure title="The battle could not be set up" message="Something went wrong while preparing this battle." detail={built.error} onAuto={() => abandon('setup_error')} onRetry={retry} />;
  }
  if (!setup || problem || resume === undefined) return null;
  const finish = (ended) => {
    clearBattleCheckpoint(pb.id);
    dispatch({ type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result: ended.result, log: ended.log } });
  };
  const setupKey = setupKeyOf(setup);
  return (
    <BattleErrorBoundary key={`${pb.id}:${attempt}`} onAuto={() => abandon('screen_error')} onRetry={retry}>
      <TacticalBattleScreen
        key={`${pb.id}:${attempt}`}
        setup={setup}
        playerSide={pb.playerSide === 'defender' ? 1 : 0}
        title={battleName(state, pb)}
        resume={resume}
        onCheckpoint={(cp) => saveBattleCheckpoint(pb.id, { ...cp, setupVersion: SETUP_VERSION, setupKey, savedAt: Date.now() })}
        onFinish={finish}
        onAbandon={abandon}
        onRetry={retry}
        getCampaign={getCampaign}
      />
    </BattleErrorBoundary>
  );
};

export default TacticalBattleHost;
