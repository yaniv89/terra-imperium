// src/components/map/useFogView.js
// The game state as the player knows it (fogView.js), for map layers that draw towns and land.
import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { fogView } from './fogView';

export const useFogView = () => {
  const { state } = useGame();
  return useMemo(() => fogView(state), [state]);
};
