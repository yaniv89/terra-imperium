// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): an empire-wide Government & Policies section (always visible),
// plus region details and eight of the twelve planned per-region/empire actions — Gain Control,
// Build Infrastructure, Build Defenses, Construct Building, Develop Resource Site, Quell Unrest,
// Adopt Policy/Reform (government), and government adoption itself. Settle/Colonize, Population
// Policy, Construct Wonder and Set Tax Rate remain deferred as real, separate follow-up work
// (tracked as its own task), not silently dropped: the current one-region-per-nation world model
// has no clean "unowned land" for Settle/Colonize to claim, and Construct Wonder needs its own
// world-uniqueness tracking that doesn't exist yet.

import React from 'react';
import { Building2, Shield, Flag, Hammer, Gem, HeartCrack, Landmark, ScrollText, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { ACTION_COSTS } from '../../data/actionCosts';
import { BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getCategoryTierName, EXTRACTION_BUILDINGS, canBuildExtraction } from '../../data/buildings';
import { getDepositsFor } from '../../data/deposits';
import { getEffectiveAgeId } from '../../data/ages';
import { GOVERNMENT_TYPES, canAdoptGovernment } from '../../data/government';
import { POLICIES, POLICY_IDS } from '../../data/policies';
import { canAfford, formatNumber, getStability, getSupplyCapacity } from '../../utils/helpers';
import { ActionButton } from '../ui';

const DomesticPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const playerNation = state.nations[state.playerNationId];

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const ownerName = regionState ? (state.nations[regionState.owner]?.name || regionState.owner) : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;

  const handleAdoptGovernment = (governmentId) => {
    if (!canAfford(state.resources, ACTION_COSTS.adoptGovernment)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId } });
  };
  const handleAdoptPolicy = (policyId) => {
    if (!canAfford(state.resources, ACTION_COSTS.adoptPolicy)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.ADOPT_POLICY, payload: { policyId } });
  };
  const handleRemovePolicy = (policyId) => {
    if (!canAfford(state.resources, ACTION_COSTS.removePolicy)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.REMOVE_POLICY, payload: { policyId } });
  };

  const currentGovernment = GOVERNMENT_TYPES[playerNation?.government];
  const availableGovernments = Object.values(GOVERNMENT_TYPES).filter(
    (gov) => gov.id !== playerNation?.government && canAdoptGovernment(gov.id, state.age)
  );
  const adoptedPolicies = playerNation?.policies || [];
  const availablePolicies = POLICY_IDS.filter((id) => !adoptedPolicies.includes(id));

  const governmentSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Government</div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Current</div>
        <div className="text-white font-semibold">{currentGovernment ? currentGovernment.name : 'None adopted'}</div>
        {currentGovernment && (
          <div className="text-[10px] text-slate-500 mt-0.5">
            {adoptedPolicies.length}/{currentGovernment.slots} policy slots filled
          </div>
        )}
      </div>
      {availableGovernments.map((gov) => (
        <ActionButton
          key={gov.id}
          icon={Landmark}
          label={`Adopt ${gov.name}`}
          description={`${gov.slots} policy slot${gov.slots === 1 ? '' : 's'}`}
          costs={ACTION_COSTS.adoptGovernment}
          onClick={() => handleAdoptGovernment(gov.id)}
          disabled={!canAfford(state.resources, ACTION_COSTS.adoptGovernment)}
          size="small"
        />
      ))}

      {currentGovernment && (
        <>
          <div className="text-xs font-semibold text-slate-300 pt-1">Policies</div>
          {adoptedPolicies.map((policyId) => (
            <div key={policyId} className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg p-2 text-xs">
              <ScrollText size={14} className="text-amber-400 shrink-0" />
              <div className="flex-1">
                <div className="text-white">{POLICIES[policyId]?.name}</div>
                <div className="text-slate-500">{POLICIES[policyId]?.description}</div>
              </div>
              <button
                onClick={() => handleRemovePolicy(policyId)}
                className="shrink-0 p-1 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400"
                title="Repeal policy"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {adoptedPolicies.length < currentGovernment.slots && availablePolicies.map((policyId) => (
            <ActionButton
              key={policyId}
              icon={ScrollText}
              label={POLICIES[policyId].name}
              description={POLICIES[policyId].description}
              costs={ACTION_COSTS.adoptPolicy}
              onClick={() => handleAdoptPolicy(policyId)}
              disabled={!canAfford(state.resources, ACTION_COSTS.adoptPolicy)}
              size="small"
            />
          ))}
        </>
      )}
    </div>
  );

  if (!regionData || !regionState) {
    return (
      <div className="space-y-4">
        {governmentSection}
        <div className="text-slate-400 text-sm text-center mt-8">
          Select a region on the globe to see its details.
        </div>
      </div>
    );
  }

  const dispatchAction = (type, payload, insufficientMessage) => {
    if (insufficientMessage) {
      addLog(insufficientMessage, 'action');
      return;
    }
    dispatch({ type, payload: { regionId: selectedRegion, ...payload } });
  };

  const handleGainControl = () => {
    if (!canAfford(state.resources, ACTION_COSTS.gainControl)) return addLog('Not enough resources', 'action');
    dispatchAction(ActionTypes.GAIN_CONTROL);
  };
  const handleBuildInfrastructure = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildInfrastructure)) return addLog('Not enough resources', 'action');
    dispatchAction(ActionTypes.BUILD_INFRASTRUCTURE);
  };
  const handleBuildDefenses = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildDefenses)) return addLog('Not enough resources', 'action');
    dispatchAction(ActionTypes.BUILD_DEFENSES);
  };
  const handleQuellUnrest = () => {
    if (!canAfford(state.resources, ACTION_COSTS.quellUnrest)) return addLog('Not enough resources', 'action');
    dispatchAction(ActionTypes.QUELL_UNREST);
  };
  const handleConstructBuilding = (categoryId) => {
    if (!canAfford(state.resources, ACTION_COSTS.constructBuilding)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: selectedRegion, categoryId } });
  };
  const handleDevelopResourceSite = (resourceId) => {
    if (!canAfford(state.resources, ACTION_COSTS.developResourceSite)) return addLog('Not enough resources', 'action');
    dispatch({ type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: selectedRegion, resourceId } });
  };

  const deposits = getDepositsFor(selectedRegion);
  const undevelopedDeposits = deposits.filter(resId => !regionState.buildings.extraction[resId]);
  // Matches the reducer's own gate (GameContext.jsx's CONSTRUCT_BUILDING/DEVELOP_RESOURCE_SITE) —
  // otherwise a tech-earned age ahead of the calendar would accept the action but show it as
  // disabled here.
  const effectiveAge = getEffectiveAgeId(state.age, state.techAgeId);

  return (
    <div className="space-y-4">
      {governmentSection}

      <div className="flex items-center gap-2 text-white font-bold text-lg pt-2 border-t border-slate-800">
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
          <div className="text-white font-semibold">Level {regionState.currentInfrastructure} (Supply {getSupplyCapacity(regionState.currentInfrastructure)})</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Defense</div>
          <div className="text-white font-semibold">Level {regionState.defenseLevel}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400">Stability</div>
          <div className="text-white font-semibold">{getStability(regionState)}%</div>
        </div>
      </div>

      {isPlayerOwned && (
        <>
          <div className="space-y-2">
            <ActionButton
              icon={Flag}
              label="Gain Control"
              description="Raise control in this region"
              costs={ACTION_COSTS.gainControl}
              effects={{ control: 5 }}
              onClick={handleGainControl}
              disabled={regionState.control >= 100}
            />
            <ActionButton
              icon={Hammer}
              label="Build Infrastructure"
              description="Raises supply capacity and resource output"
              costs={ACTION_COSTS.buildInfrastructure}
              effects={{ infrastructure: 1 }}
              onClick={handleBuildInfrastructure}
              disabled={regionState.currentInfrastructure >= 10}
            />
            <ActionButton
              icon={Shield}
              label="Build Defenses"
              description="Strengthens this region against invasion"
              costs={ACTION_COSTS.buildDefenses}
              effects={{ defense: 1 }}
              onClick={handleBuildDefenses}
              disabled={regionState.defenseLevel >= 10}
            />
            <ActionButton
              icon={HeartCrack}
              label="Quell Unrest"
              description="Suppress unrest before it spreads"
              costs={ACTION_COSTS.quellUnrest}
              effects={{ unrest: 30 }}
              onClick={handleQuellUnrest}
              disabled={regionState.unrest <= 0}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Buildings</div>
            {BUILDING_CATEGORY_IDS.map(categoryId => {
              const category = BUILDING_CATEGORIES[categoryId];
              const currentTier = regionState.buildings.categories[categoryId];
              const currentName = currentTier >= 0 ? getCategoryTierName(categoryId, currentTier) : null;
              const nextTier = currentTier + 1;
              const nextName = getCategoryTierName(categoryId, nextTier);
              const buildable = nextName && canBuildTier(categoryId, effectiveAge, nextTier);
              return (
                <ActionButton
                  key={categoryId}
                  icon={Building2}
                  label={`${category.label}: ${currentName || 'None'}`}
                  description={nextName ? `Build ${nextName}` : 'Fully developed for this age'}
                  costs={nextName ? ACTION_COSTS.constructBuilding : null}
                  onClick={() => handleConstructBuilding(categoryId)}
                  disabled={!buildable}
                  size="small"
                />
              );
            })}
          </div>

          {deposits.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Resource Deposits</div>
              {deposits.map(resId => {
                const developed = regionState.buildings.extraction[resId];
                const buildable = !developed && canBuildExtraction(resId, effectiveAge);
                return (
                  <ActionButton
                    key={resId}
                    icon={Gem}
                    label={`${EXTRACTION_BUILDINGS[resId].name}${developed ? ' (built)' : ''}`}
                    description={`Develop this region's ${resId} deposit`}
                    costs={!developed ? ACTION_COSTS.developResourceSite : null}
                    onClick={() => handleDevelopResourceSite(resId)}
                    disabled={!buildable}
                    size="small"
                  />
                );
              })}
              {undevelopedDeposits.length === 0 && (
                <div className="text-[10px] text-slate-500">Every known deposit here is already developed.</div>
              )}
            </div>
          )}
        </>
      )}

      {!isPlayerOwned && (
        <div className="text-slate-500 text-xs text-center pt-4 border-t border-slate-800">
          You don&apos;t control this region — domestic actions are unavailable here.
        </div>
      )}
    </div>
  );
};

export default DomesticPanel;
