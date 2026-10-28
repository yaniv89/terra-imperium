// src/components/ui/NextArmyButton.jsx
// "Next army" (map-8, Civ VI's unit cycling): beside "Idle N", shown while any army marches; each
// tap selects the next stack, the ones waiting for orders first and then the marching ones, and
// flies the map to it (mapCamera.js armyCycle). After End Turn it finds where the armies went
// (playtest run 40651416284 steps 70-72: the player panned to find a marching army).
import React, { useMemo, useRef } from 'react';
import { Footprints } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { armyCycle, nextTileAfter } from '../map/mapCamera';
import { idleArmyTiles } from '../../engine/standingOrders';
import { selectArmy } from '../map/marchEvents';
import { useT } from '../../i18n/useT';

const NextArmyButton = () => {
  const { state } = useGame();
  const { t } = useT();
  const tiles = useMemo(() => (state.gameStatus === GameStatus.ACTIVE ? armyCycle(state) : []), [state]);
  const marching = useMemo(() => tiles.length - idleArmyTiles(state).length, [state, tiles]);
  const last = useRef(null);
  if (marching <= 0) return null;
  const go = () => { const tile = nextTileAfter(tiles, last.current); last.current = tile; if (tile != null) selectArmy(tile); };
  const hint = t('mx.nextArmy.hint', { n: tiles.length });
  return (
    <button type="button" onClick={go} title={hint} aria-label={hint} data-testid="next-army" data-count={tiles.length}
      className="fa-btn fa-btn-secondary !bg-fa-panel shadow-xl gap-1 !px-2.5 !min-h-[50px] pl:!min-h-[44px] whitespace-nowrap shrink-0">
      <Footprints className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{tiles.length}</span>
    </button>
  );
};

export default NextArmyButton;
