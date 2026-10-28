// src/components/battle/TacticalBattleHost.jsx
// Opens the commanded battle whenever the campaign has one pending (state.pendingBattle), resuming
// from its last checkpoint if the app was closed mid-battle, and hands the result back to the
// reducer (RESOLVE_TACTICAL_BATTLE) — or auto-resolves it on request (ABANDON_TACTICAL_BATTLE).
// Guards (the frozen empty battle of the phone playtest): a battle that can no longer be set up,
// or that has no troops on one side, is never opened: it is settled on Auto through the outcome
// service with a log line saying why. An error while setting it up, starting it or drawing it shows
// BattleFailure (a readable message, Auto or Try again) instead of a frozen field. A checkpoint is
// resumed only into the battle it was saved from (setupKeyOf): battle ids repeat between games.
// The result screen shows the campaign's receipt (src/engine/battleReceipt.js): the same pure
// reducer Continue runs, on the same state with the same action, so what is shown is what is
// committed. A battle that has ended is kept with its end record (the checkpoint store): closing
// the app on the result screen and coming back hands that same result over, never a second fight.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nameNow } from '../../i18n/names';
import { t as tNow } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { battleName } from '../../engine/battleNames';
import { setupKeyOf, SETUP_VERSION } from '../../battle/setup/buildBattleSetup';
import { battleReceipt, resolveActionOf } from '../../engine/battleReceipt';
import { saveBattleCheckpoint, loadBattleCheckpoint, clearBattleCheckpoint } from '../../battle/worker/battleStore';
import TacticalBattleScreen from './TacticalBattleScreen';
import BattleCard from './BattleCard';
import { battleCardRows } from './battleCardModel';
import BattleFailure, { BattleErrorBoundary } from './BattleFailure';
import { autoOddsForPendingBattle } from './autoCompare';
import { battleOpenProblem, checkpointFits, safeBattleSetup } from './battleOpenGuard';
import { crashLog } from '../../utils/crashLog';

// The page was killed during a battle (a phone out of memory: src/utils/crashLog.js) and the
// player pressed Continue: the battle is not reloaded at once (the same load could fail the same
// way, "A problem repeatedly occurred"); the player chooses Resume or Auto. Once per page load.
let crashChecked = false;
export const reopenedAfterCrash = (log = crashLog()) => {
  if (crashChecked) return false;
  crashChecked = true;
  return log?.last?.ending === 'crash' && log.last.screen === 'battle';
};

const TacticalBattleHost = () => {
  useT();
  const { state, dispatch } = useGame();
  const pb = state.pendingBattle;
  const [resume, setResume] = useState(undefined); // undefined = still looking for a checkpoint
  const [attempt, setAttempt] = useState(0); // Try again remounts the battle from the start
  const [cardSeen, setCardSeen] = useState(null); // the id of the battle whose card was answered
  const [afterCrash, setAfterCrash] = useState(() => reopenedAfterCrash());
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionRef = useRef(null); // { ended, action }: one action per ended battle, for the receipt and for Continue

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
      // The battle had already ended when the app was closed: its result is handed over as it was.
      if (cp?.ended?.result && Array.isArray(cp.ended.log)) {
        clearBattleCheckpoint(pb.id);
        dispatch(resolveActionOf(pb, cp.ended, setupKeyOf(setup)));
        return;
      }
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
  // Switch to Auto part-way (H-01): the battle as it stands (the worker's snapshot, or a saved
  // checkpoint) goes with the action, and Auto goes on from there (src/engine/battleSwitch.js).
  const switchAuto = (snap) => {
    clearBattleCheckpoint(pb.id);
    const switchAt = snap?.log ? { log: snap.log, tick: snap.tick, hash: snap.hash ?? null, setupKey: setup ? setupKeyOf(setup) : null, setupVersion: SETUP_VERSION } : undefined;
    dispatch({ type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: switchAt ? { switchAt } : undefined });
  };
  if (built.error) {
    return <BattleFailure title={tNow('bt.host.setupTitle')} message={tNow('bt.host.setupMessage')} detail={built.error} onAuto={() => abandon('setup_error')} onRetry={retry} />;
  }
  if (!setup || problem || resume === undefined) return null;
  if (afterCrash) {
    return <BattleFailure title={tNow('bt.host.crashTitle')} message={tNow('bt.host.crashMessage')} retryLabel={tNow('bt.host.resume')} onAuto={() => switchAuto(resume)} onRetry={() => setAfterCrash(false)} />;
  }
  // U22: a fresh battle (not a resumed one) shows why it differs before the troops deploy.
  const cardRows = resume === null && cardSeen !== pb.id ? battleCardRows(setup, pb.playerSide === 'defender' ? 1 : 0) : [];
  if (cardRows.length > 1) return <BattleCard title={nameNow('battle', null, battleName(state, pb))} rows={cardRows} onDeploy={() => setCardSeen(pb.id)} />;
  const setupKey = setupKeyOf(setup);
  // The live battle's own end record goes with the log (battleVerify.js): the rules it ran under,
  // which battle it was and the world it ended on, so the reducer's replay is checked against it.
  const actionFor = (ended) => {
    if (actionRef.current?.ended !== ended) actionRef.current = { ended, action: resolveActionOf(pb, ended, setupKey) };
    return actionRef.current.action;
  };
  // The battle ended: its end record is kept until Continue, so the result survives a closed app.
  const onEnded = (ended) => saveBattleCheckpoint(pb.id, { ended: { result: ended.result, log: ended.log, hash: ended.hash, chain: ended.chain, tick: ended.tick }, setupVersion: SETUP_VERSION, setupKey, savedAt: Date.now() });
  const getReceipt = (ended) => battleReceipt(stateRef.current, actionFor(ended));
  const finish = (ended) => {
    clearBattleCheckpoint(pb.id);
    dispatch(actionFor(ended));
  };
  return (
    <BattleErrorBoundary key={`${pb.id}:${attempt}`} onAuto={() => abandon('screen_error')} onRetry={retry}>
      <TacticalBattleScreen
        key={`${pb.id}:${attempt}`}
        setup={setup}
        playerSide={pb.playerSide === 'defender' ? 1 : 0}
        title={nameNow('battle', null, battleName(state, pb))}
        resume={resume}
        onCheckpoint={(cp) => saveBattleCheckpoint(pb.id, { ...cp, setupVersion: SETUP_VERSION, setupKey, savedAt: Date.now() })}
        onFinish={finish}
        onAbandon={abandon}
        onSwitchAuto={switchAuto}
        onRetry={retry}
        getCampaign={getCampaign}
        tipsSeen={(state.battleReports || []).length > 0}
        getReceipt={getReceipt}
        onEnded={onEnded}
      />
    </BattleErrorBoundary>
  );
};

export default TacticalBattleHost;
