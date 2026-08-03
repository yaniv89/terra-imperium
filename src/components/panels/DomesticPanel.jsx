// src/components/panels/DomesticPanel.jsx
// Domestic actions panel - land purchase, immigration, infrastructure, lobbying

import React from 'react';
import { Sprout, Ship, Hammer, Globe, Flag, Building } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { getAvgCoreControl, canAfford } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';
import { ActionButton } from '../ui';

const DomesticPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  
  const isPreState = state.phase === GamePhases.PRE_STATE;
  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const isPlayerOwned = regionState?.owner === 'player';
  const avgCoreControl = getAvgCoreControl(state);
  const canDeclareIndependence = isPreState && avgCoreControl >= 60;

  // Buy Land (Pre-state only). Cost/effect are applied atomically by the reducer — this
  // handler only gives the player an immediate, specific reason when a click won't do anything.
  const handleBuyLand = () => {
    if (!isPlayerOwned) {
      addLog('Select an owned region first', 'action');
      return;
    }
    if (regionState.control >= 100) {
      addLog('Region already at 100% control', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.buyLand)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.BUY_LAND, payload: { regionId: selectedRegion } });
  };

  // Immigration/Aliyah
  const handleImmigration = () => {
    const costs = isPreState ? ACTION_COSTS.immigrationPreState : ACTION_COSTS.immigrationPostState;
    if (!canAfford(state.resources, costs)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.ORGANIZE_IMMIGRATION });
  };

  // Build structure
  const handleBuildInfra = () => {
    if (!isPlayerOwned) {
      addLog('Select an owned region first', 'action');
      return;
    }
    if (regionState.currentInfrastructure >= 10) {
      addLog('Infrastructure already at maximum', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.buildInfrastructure)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: selectedRegion } });
  };

  // Lobby Powers
  const handleLobby = () => {
    if (!canAfford(state.resources, ACTION_COSTS.lobbyPowers)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.LOBBY_POWERS });
  };

  // Declare Independence
  const handleDeclareIndependence = () => {
    if (!canDeclareIndependence) {
      addLog('Need 60% average core control', 'action');
      return;
    }
    dispatch({ type: ActionTypes.DECLARE_INDEPENDENCE });
  };

  return (
    <div className="space-y-2">
      {/* Selected region indicator */}
      {selectedRegion && isPlayerOwned && (
        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30 mb-3">
          <div className="text-xs text-blue-400 flex items-center gap-1.5">
            <Building className="w-3 h-3" />
            <span>Selected: <strong>{regionData?.name}</strong></span>
            <span className="ml-auto font-mono">{regionState?.control}% control</span>
          </div>
        </div>
      )}

      {/* Buy Land - Pre-state only */}
      {isPreState && (
        <ActionButton
          icon={Sprout}
          label="Buy Land"
          description="Purchase land to increase control in selected region"
          costs={ACTION_COSTS.buyLand}
          effects={{ control: 5 }}
          onClick={handleBuyLand}
          disabled={!isPlayerOwned || state.resources.actionPoints < 1 || regionState?.control >= 100}
          variant="success"
        />
      )}

      {/* Immigration */}
      <ActionButton
        icon={Ship}
        label={isPreState ? "Organize Aliyah" : "National Aliyah"}
        description={isPreState 
          ? "Bring immigrants to strengthen the Yishuv" 
          : "Mass immigration brings workers and scientists"
        }
        costs={isPreState ? ACTION_COSTS.immigrationPreState : ACTION_COSTS.immigrationPostState}
        effects={isPreState 
          ? { manpower: 1000 }
          : { manpower: 2000, techPoints: 5 }
        }
        onClick={handleImmigration}
        disabled={state.resources.actionPoints < 1}
        variant="primary"
      />

      {/* Build Infrastructure */}
      <ActionButton
        icon={Hammer}
        label="Build Infrastructure"
        description="Improve roads, utilities, and facilities in selected region"
        costs={ACTION_COSTS.buildInfrastructure}
        effects={{ infrastructure: 1, custom: '+Income/turn' }}
        onClick={handleBuildInfra}
        disabled={!isPlayerOwned || state.resources.actionPoints < 1 || regionState?.currentInfrastructure >= 10}
        variant="default"
      />

      {/* Lobby Powers */}
      <ActionButton
        icon={Globe}
        label="Lobby Powers"
        description="Build international support and diplomatic capital"
        costs={ACTION_COSTS.lobbyPowers}
        effects={{ diplomacyPoints: 10 }}
        onClick={handleLobby}
        disabled={state.resources.actionPoints < 1}
        variant="default"
      />

      {/* Independence Declaration - Pre-state only when ready */}
      {isPreState && canDeclareIndependence && (
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-lg border border-blue-500/50 animate-pulse">
          <div className="text-blue-300 font-bold text-sm mb-2 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Independence Available!
          </div>
          <p className="text-xs text-blue-200/70 mb-3">
            Core control is above 60%. You can now declare the State of Israel. 
            Warning: This will trigger invasion by neighboring Arab states.
          </p>
          <ActionButton
            icon={Flag}
            label="Declare Independence"
            description="Establish the State of Israel"
            effects={{ custom: 'Triggers War of Independence' }}
            onClick={handleDeclareIndependence}
            variant="primary"
          />
        </div>
      )}

      {/* Progress to independence - Pre-state */}
      {isPreState && !canDeclareIndependence && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-xs mb-2">Progress to Independence</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (avgCoreControl / 60) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-300">{avgCoreControl}%/60%</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Increase control in core regions (Tel Aviv, Jerusalem, Haifa, Galilee, Negev) to unlock independence.
          </p>
        </div>
      )}

      {/* No region selected hint */}
      {!selectedRegion && (
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 text-center">
          <p className="text-xs text-slate-500">
            Select a region on the map to build infrastructure or buy land
          </p>
        </div>
      )}
    </div>
  );
};

export default DomesticPanel;
