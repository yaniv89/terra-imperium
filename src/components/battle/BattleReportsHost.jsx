// src/components/battle/BattleReportsHost.jsx
// Watches the battle history (state.battleReports): every new auto-resolved battle plays its
// replay (BattleReplay.jsx), unless the player turned that off ("instant battles" in the
// Military tab). Commanded battles already end on their own result screen. Also opens the full
// report sheet on request (battleReportEvents.js).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import BattleReplay from './BattleReplay';
import BattleReportSheet from './BattleReportSheet';
import { OPEN_BATTLE_REPORT } from './battleReportEvents';
import { timelineFor } from './battleReportView';

const NO_REPORTS = [];

const BattleReportsHost = ({ onShowRegion }) => {
  const { state } = useGame();
  const reports = state.battleReports || NO_REPORTS;
  // Start from what's already there: loading a save never replays old battles.
  const seenRef = useRef(reports[0]?.id ?? null);
  const [replay, setReplay] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const top = reports[0]?.id ?? null;
    if (top === seenRef.current) return;
    const seenAt = reports.findIndex((r) => r.id === seenRef.current);
    const fresh = (seenAt === -1 ? reports : reports.slice(0, seenAt)).filter((r) => !r.commanded && timelineFor(r).length > 0);
    seenRef.current = top;
    if (fresh.length && !state.battleSettings?.instantBattles && !state.pendingBattle) setReplay([...fresh].reverse());
  }, [reports, state.battleSettings?.instantBattles, state.pendingBattle]);

  useEffect(() => {
    const onOpen = (e) => setOpenId(e.detail);
    window.addEventListener(OPEN_BATTLE_REPORT, onOpen);
    return () => window.removeEventListener(OPEN_BATTLE_REPORT, onOpen);
  }, []);

  const open = useCallback((id) => { setReplay(null); setOpenId(id); }, []);
  const entry = openId ? reports.find((r) => r.id === openId) : null;

  return (
    <>
      <BattleReplay entries={replay} onOpen={open} onClose={() => setReplay(null)} />
      <BattleReportSheet entry={entry} onClose={() => setOpenId(null)} onShowRegion={onShowRegion} />
    </>
  );
};

export default BattleReportsHost;
