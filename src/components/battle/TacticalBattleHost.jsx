// src/components/battle/TacticalBattleHost.jsx
// Opens the commanded battle whenever the campaign has one pending (state.pendingBattle), resuming
// from its last checkpoint if the app was closed mid-battle, and hands the result back to the
// reducer (RESOLVE_TACTICAL_BATTLE) — or auto-resolves it on request (ABANDON_TACTICAL_BATTLE).
import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { buildInvasionSetup, SETUP_VERSION } from '../../battle/setup/buildBattleSetup';
import { saveBattleCheckpoint, loadBattleCheckpoint, clearBattleCheckpoint } from '../../battle/worker/battleStore';
import TacticalBattleScreen from './TacticalBattleScreen';

const TacticalBattleHost = () => {
  const { state, dispatch } = useGame();
  const pb = state.pendingBattle;
  const [resume, setResume] = useState(undefined); // undefined = still looking for a checkpoint

  // The setup is fixed for the life of the battle (its units are locked), so build it once per id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setup = useMemo(() => (pb ? buildInvasionSetup(state, pb) : null), [pb?.id]);

  useEffect(() => {
    let alive = true;
    setResume(undefined);
    if (!pb) return undefined;
    loadBattleCheckpoint(pb.id).then((cp) => { if (alive) setResume(cp && cp.setupVersion === SETUP_VERSION ? cp : null); });
    return () => { alive = false; };
  }, [pb?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A battle that can no longer be set up (e.g. an old save) falls back to auto-resolve.
  useEffect(() => { if (pb && !setup) dispatch({ type: ActionTypes.ABANDON_TACTICAL_BATTLE }); }, [pb, setup, dispatch]);

  if (!pb || !setup || resume === undefined) return null;
  const finish = (ended) => {
    clearBattleCheckpoint(pb.id);
    dispatch({ type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result: ended.result } });
  };
  const abandon = () => { clearBattleCheckpoint(pb.id); dispatch({ type: ActionTypes.ABANDON_TACTICAL_BATTLE }); };
  return (
    <TacticalBattleScreen
      key={pb.id}
      setup={setup}
      playerSide={pb.playerSide === 'defender' ? 1 : 0}
      title={`Battle of ${REGIONS_DATA[pb.targetRegionId]?.name || 'the border'}`}
      resume={resume}
      onCheckpoint={(cp) => saveBattleCheckpoint(pb.id, { ...cp, setupVersion: SETUP_VERSION, savedAt: Date.now() })}
      onFinish={finish}
      onAbandon={abandon}
    />
  );
};

export default TacticalBattleHost;
