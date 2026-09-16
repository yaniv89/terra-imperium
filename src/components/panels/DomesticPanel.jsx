// src/components/panels/DomesticPanel.jsx
// Domestic tab — region overview. The full Civ-style action set (Gain Control, Build
// Infrastructure, Build Defenses, Construct Building, ...) described in the plan lands in
// Phase B once region buildings/deposits/stability exist for those actions to act on.

import React from 'react';
import { Building2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { formatNumber } from '../../utils/helpers';

const DomesticPanel = ({ selectedRegion }) => {
  const { state } = useGame();

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const ownerName = regionState ? (state.nations[regionState.owner]?.name || regionState.owner) : null;

  if (!regionData || !regionState) {
    return (
      <div className="text-slate-400 text-sm text-center mt-8">
        Select a region on the globe to see its details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white font-bold text-lg">
        <Building2 size={20} className="text-blue-400" />
        {regionData.name}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Owner</div>
          <div className="text-white font-semibold">{ownerName}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Control</div>
          <div className="text-white font-semibold">{regionState.control}%</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Population</div>
          <div className="text-white font-semibold">{formatNumber(regionState.currentPopulation)}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Infrastructure</div>
          <div className="text-white font-semibold">Level {regionState.currentInfrastructure}</div>
        </div>
      </div>
      <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
        Region buildings, resource development and domestic policy actions are coming in a future update.
      </div>
    </div>
  );
};

export default DomesticPanel;
