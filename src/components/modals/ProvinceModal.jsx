// src/components/modals/ProvinceModal.jsx
// Civ-style "manage this region" screen (plan feedback: region actions used to be mixed into the
// Domestic/Military tabs alongside empire-wide content, which is what made both tabs overcrowded).
// Selecting a region shows the compact RegionInfoModal with a "Manage Region" button; this modal is
// what that button opens. Three tabs — Overview / Economy & Buildings / Military — hold every
// region-specific action, moved out of DomesticPanel.jsx's and MilitaryPanel.jsx's old region
// branches (behavior is unchanged, just relocated).
import React, { useState, useEffect } from 'react';
import {
  X, Building2, Shield, Flag, Hammer, Gem, HeartCrack, Sprout, Landmark, TrendingUp,
  UserPlus, Trash2, Award, Anchor, Ship, Flame
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, getCapital } from '../../data/regions';
import { ACTION_COSTS, SETTLE_COLONIZE_CONTROL_THRESHOLD, CLIMATE_RESILIENCE_MAX } from '../../data/actionCosts';
import {
  BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getCategoryTierName, EXTRACTION_BUILDINGS, canBuildExtraction,
  getBuildingTierCost, getBuildingSlots, getUsedBuildingSlots
} from '../../data/buildings';
import { TECH_TREE } from '../../data/techTree';
import { getDepositsFor } from '../../data/deposits';
import { INTEGRATION_CONTROL_THRESHOLD } from '../../data/rebellion';
import { getEffectiveAgeId } from '../../data/ages';
import { FOOD_TIER_GROWTH_BONUS } from '../../engine/population';
import { GREAT_PROJECTS, GREAT_PROJECT_IDS, getGreatProjectCost, canStartGreatProject } from '../../data/greatProjects';
import { DEV_TYPE_IDS, DEV_TYPE_POOL, getDevelopProvinceCost, getTotalDev } from '../../engine/development';
import { getModifier } from '../../engine/modifiers/sheet';
import { canAfford, formatNumber, getStability, getSupplyCapacity, getDisplayPopulation } from '../../utils/helpers';
import { getRecruitUnitCost } from '../../engine/economy';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { ALL_PERKS, XP_THRESHOLDS, RANK_ORDER, getRankForXp, canPromote, hasPerk } from '../../data/promotions';
import { isCoastal, getSeaLanesWithinReach, isReachableBySea } from '../../data/navalReach';
import { REBEL_OWNER_ID, REVOLT_SUCCESS_TURNS } from '../../data/rebellion';
import { ActionButton } from '../ui';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'economy', label: 'Economy & Buildings' },
  { id: 'military', label: 'Military' }
];

// Same reachability helpers MilitaryPanel used to define — see its own header (before this move)
// for why: land-adjacent always, plus (for naval units) sea lanes within the current age's reach.
const getMoveOptions = (unit, age, regions, playerNationId) => {
  const isOwned = (id) => regions[id]?.owner === playerNationId;
  const landNeighbors = getNeighborIds(unit.regionId).filter(isOwned);
  if (unit.domain !== 'naval') return landNeighbors;
  const seaLanes = getSeaLanesWithinReach(unit.regionId, age).map((lane) => lane.to).filter(isOwned);
  return [...new Set([...landNeighbors, ...seaLanes])];
};
const isReachable = (fromRegionId, toRegionId, age) =>
  getNeighborIds(fromRegionId).includes(toRegionId) || isReachableBySea(fromRegionId, toRegionId, age);

const ProvinceModal = ({ regionId, open, onClose }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('overview');

  useEffect(() => { setTab('overview'); }, [regionId]);

  if (!open || !regionId) return null;

  const regionState = state.regions[regionId];
  const regionData = REGIONS_DATA[regionId];
  if (!regionData || !regionState) return null;

  const ownerName = state.nations[regionState.owner]?.name || regionState.owner;
  const isPlayerOwned = regionState.owner === state.playerNationId;
  const effectiveAge = getEffectiveAgeId(state.age, state.techAgeId);

  const dispatchAction = (type, payload) => dispatch({ type, payload: { regionId, ...payload } });

  // --- Overview handlers -----------------------------------------------------------------
  const handleGainControl = () => {
    if (!canAfford(state.resources, ACTION_COSTS.gainControl)) return addLog('Not enough resources', 'action');
    triggerEffect('gain_control', { region: regionId });
    dispatchAction(ActionTypes.GAIN_CONTROL);
  };
  const handleMoveCapital = () => {
    if (!canAfford(state.resources, ACTION_COSTS.moveCapital)) return addLog('Not enough resources', 'action');
    triggerEffect('move_capital', { region: regionId });
    dispatch({ type: ActionTypes.MOVE_CAPITAL, payload: { regionId } });
  };
  const handleQuellUnrest = () => {
    if (!canAfford(state.resources, ACTION_COSTS.quellUnrest)) return addLog('Not enough resources', 'action');
    triggerEffect('quell_unrest', { region: regionId });
    dispatchAction(ActionTypes.QUELL_UNREST);
  };
  const handlePopulationPolicy = () => {
    if (!canAfford(state.resources, ACTION_COSTS.populationPolicy)) return addLog('Not enough resources', 'action');
    triggerEffect('population_policy', { region: regionId });
    dispatchAction(ActionTypes.POPULATION_POLICY);
  };
  const handleSettleColonize = () => {
    if (!canAfford(state.resources, ACTION_COSTS.settleColonize)) return addLog('Not enough resources', 'action');
    triggerEffect('settle_colonize', { region: regionId });
    dispatchAction(ActionTypes.SETTLE_COLONIZE);
  };

  // --- Economy & Buildings handlers ------------------------------------------------------
  const developmentCostMult = getModifier(state, state.playerNationId, 'national.developmentCost').total;
  const handleDevelopProvince = (devType) => {
    const pool = DEV_TYPE_POOL[devType];
    const cost = getDevelopProvinceCost(regionState, developmentCostMult);
    if ((state.resources[pool] || 0) < cost) return addLog(`Not enough ${pool.toUpperCase()}`, 'action');
    triggerEffect('develop_province', { region: regionId });
    dispatchAction(ActionTypes.DEVELOP_PROVINCE, { devType });
  };
  const handleBuildInfrastructure = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildInfrastructure)) return addLog('Not enough resources', 'action');
    triggerEffect('build_infrastructure', { region: regionId });
    dispatchAction(ActionTypes.BUILD_INFRASTRUCTURE);
  };
  const handleBuildDefenses = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildDefenses)) return addLog('Not enough resources', 'action');
    triggerEffect('build_defenses', { region: regionId });
    dispatchAction(ActionTypes.BUILD_DEFENSES);
  };
  const handleBuildClimateResilience = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildClimateResilience)) return addLog('Not enough resources', 'action');
    triggerEffect('build_climate_resilience', { region: regionId });
    dispatchAction(ActionTypes.BUILD_CLIMATE_RESILIENCE);
  };
  const researchedTechIds = new Set(Object.keys(state.techTree).filter((id) => state.techTree[id].researched));
  const buildingCostMult = getModifier(state, state.playerNationId, 'national.buildingCost').total;
  const buildingSlots = getBuildingSlots(getTotalDev(regionState), !!regionData.isCapital);
  const usedBuildingSlots = getUsedBuildingSlots(regionState.buildings);
  const handleConstructBuilding = (categoryId) => {
    const nextTierIndex = (regionState.buildings.categories[categoryId] ?? -1) + 1;
    const cost = getBuildingTierCost(categoryId, nextTierIndex, buildingCostMult);
    if ((state.resources.gold || 0) < cost) return addLog('Not enough gold', 'action');
    // The icon must match the TIER actually being built (the age it belongs to), not the current
    // calendar/tech age — a rushed one-age-ahead build already shows next age's structure.
    const tierAge = BUILDING_CATEGORIES[categoryId]?.tiers[nextTierIndex]?.age;
    triggerEffect('construct_building', { region: regionId, variant: categoryId, age: tierAge });
    dispatch({ type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId, categoryId } });
  };
  const handleDevelopResourceSite = (resourceId) => {
    if (!canAfford(state.resources, ACTION_COSTS.developResourceSite)) return addLog('Not enough resources', 'action');
    triggerEffect('develop_resource_site', { region: regionId, variant: resourceId });
    dispatch({ type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId, resourceId } });
  };
  const handleStartGreatProject = (projectId) => {
    const { gold, adm } = getGreatProjectCost(1);
    if (!canAfford(state.resources, { gold, adm })) return addLog('Not enough resources', 'action');
    triggerEffect('start_great_project', { region: regionId });
    dispatch({ type: ActionTypes.START_GREAT_PROJECT, payload: { projectId, regionId } });
  };

  const deposits = getDepositsFor(regionData.startOwner); // deposits are geological, keyed by the province's home country
  const undevelopedDeposits = deposits.filter((resId) => !regionState.buildings.extraction[resId]);

  // --- Military handlers -------------------------------------------------------------------
  const unitsHere = Object.values(state.units).filter((u) => u.regionId === regionId);
  const availableClasses = getAvailableClasses(effectiveAge);
  const generals = Object.entries(state.hiredCommanders);
  const unassignedGenerals = generals.filter(([, g]) => !g.assignedUnitId);

  const invasionSources = !isPlayerOwned
    ? getNeighborIds(regionId)
      .filter((nId) => state.regions[nId]?.owner === state.playerNationId)
      .map((nId) => ({ regionId: nId, unitCount: Object.values(state.units).filter((u) => u.regionId === nId && u.ownerId === state.playerNationId && u.domain === 'land').length }))
      .filter((source) => source.unitCount > 0)
    : [];
  const amphibiousSources = (!isPlayerOwned && isCoastal(regionId))
    ? Object.values(state.units)
      .filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, state.age))
      .map((u) => ({ unit: u, cargoCount: Object.values(state.units).filter((c) => c.embarkedOn === u.id).length }))
      .filter(({ cargoCount }) => cargoCount > 0)
    : [];
  const defendingNavalUnits = Object.values(state.units).filter((u) => u.regionId === regionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
  const navalEngagementSources = (!isPlayerOwned && defendingNavalUnits.length > 0)
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, state.age)).map((u) => u.regionId))]
    : [];
  const rebelUnits = isPlayerOwned ? unitsHere.filter((u) => u.ownerId === REBEL_OWNER_ID) : [];

  const handleRecruit = (classId) => {
    if (!canAfford(state.resources, getRecruitUnitCost(state, state.age))) return addLog('Not enough resources', 'action');
    triggerEffect('recruit_unit', { region: regionId, variant: classId, age: state.age });
    dispatch({ type: ActionTypes.RECRUIT_UNIT, payload: { regionId, classId } });
  };
  const handleDisband = (unitId) => {
    const unit = state.units[unitId];
    if (unit) triggerEffect('disband_unit', { region: unit.regionId, variant: unit.classId, age: state.age });
    dispatch({ type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
  };
  const handleMove = (unitId, toRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.moveArmy)) return addLog('Not enough resources', 'action');
    triggerEffect('move_army', { from: state.units[unitId]?.regionId, to: toRegionId });
    dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId } });
  };
  const handleInvade = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.launchInvasion)) return addLog('Not enough resources', 'action');
    triggerEffect('ground_invasion', { from: fromRegionId, to: regionId });
    dispatch({ type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId: regionId } });
  };
  const handlePromote = (unitId, perkId) => {
    if (!canAfford(state.resources, ACTION_COSTS.promoteUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('promote_unit', { region: state.units[unitId]?.regionId });
    dispatch({ type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId } });
  };
  const handleAppointGeneral = (generalId, unitId) => {
    triggerEffect('appoint_general', { region: unitId ? state.units[unitId]?.regionId : regionId });
    dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId: unitId || null } });
  };
  const handleEmbark = (landUnitId, navalUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.embarkUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('embark_unit', { region: state.units[landUnitId]?.regionId });
    dispatch({ type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
  };
  const handleDisembark = (landUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.disembarkUnit)) return addLog('Not enough resources', 'action');
    triggerEffect('disembark_unit', { region: state.units[landUnitId]?.regionId });
    dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } });
  };
  const handleAmphibiousAssault = (navalUnitId) => {
    if (!canAfford(state.resources, ACTION_COSTS.amphibiousAssault)) return addLog('Not enough resources', 'action');
    triggerEffect('amphibious_assault', { from: state.units[navalUnitId]?.regionId, to: regionId });
    dispatch({ type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: regionId } });
  };
  const handleNavalEngagement = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.navalEngagement)) return addLog('Not enough resources', 'action');
    triggerEffect('naval_engagement', { from: fromRegionId, to: regionId });
    dispatch({ type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId, targetRegionId: regionId } });
  };
  const handleSuppressRebellion = () => {
    if (!canAfford(state.resources, ACTION_COSTS.suppressRebellion)) return addLog('Not enough resources', 'action');
    triggerEffect('suppress_rebellion', { region: regionId });
    dispatch({ type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId } });
  };

  return (
    <div
      className={isMobile ? 'fixed inset-0 z-40 bg-black/70' : 'fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm'}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={isMobile
          ? 'fixed inset-x-0 bottom-0 top-[8vh] rounded-t-2xl bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col'
          : 'bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col'}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 shrink-0 flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Building2 size={20} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{regionData.name}</div>
              <div className="text-slate-500 text-[10px] capitalize">{regionData.terrain} · {ownerName}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-2 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {tab === 'overview' && (
            <div className="space-y-3">
              {isPlayerOwned && regionState.formerOwner && (
                <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                  Conquered from {state.nations[regionState.formerOwner]?.name || regionState.formerOwner} — still at risk of
                  reverting if it revolts. Raise control to {INTEGRATION_CONTROL_THRESHOLD}% ({regionState.control}% now) to
                  fully integrate it.
                </div>
              )}
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
                  <div className="text-white font-semibold">{formatNumber(getDisplayPopulation(regionState, regionData, state.year))}</div>
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

              {isPlayerOwned ? (
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
                  {regionId !== getCapital(state, state.playerNationId) && (
                    <ActionButton
                      icon={Landmark}
                      label="Move Capital Here"
                      description={regionData.startOwner !== state.playerNationId ? 'Relocates the capital (-1 stability: outside your native territory)' : 'Relocates the capital'}
                      costs={ACTION_COSTS.moveCapital}
                      onClick={handleMoveCapital}
                      disabled={!!regionState.occupiedBy}
                    />
                  )}
                  <ActionButton
                    icon={HeartCrack}
                    label="Quell Unrest"
                    description="Suppress unrest before it spreads"
                    costs={ACTION_COSTS.quellUnrest}
                    effects={{ unrest: 30 }}
                    onClick={handleQuellUnrest}
                    disabled={regionState.unrest <= 0}
                  />
                  <ActionButton
                    icon={Sprout}
                    label="Population Policy"
                    description="Invest in growth — more population means more gold and HR income here"
                    costs={ACTION_COSTS.populationPolicy}
                    onClick={handlePopulationPolicy}
                  />
                </div>
              ) : isAdjacentToOwner(regionId, state.regions, state.playerNationId) && regionState.control < SETTLE_COLONIZE_CONTROL_THRESHOLD ? (
                <ActionButton
                  icon={Flag}
                  label="Settle / Colonize"
                  description={`${ownerName}'s grip here has collapsed (${regionState.control}% control) — absorb it peacefully, no military required`}
                  costs={ACTION_COSTS.settleColonize}
                  onClick={handleSettleColonize}
                />
              ) : (
                <div className="text-slate-500 text-xs text-center py-2">
                  You don&apos;t control this region — domestic actions are unavailable here.
                </div>
              )}
            </div>
          )}

          {tab === 'economy' && (
            isPlayerOwned ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Develop Province</div>
                  {DEV_TYPE_IDS.map((devType) => {
                    const cost = getDevelopProvinceCost(regionState, developmentCostMult);
                    const pool = DEV_TYPE_POOL[devType];
                    return (
                      <ActionButton
                        key={devType}
                        icon={TrendingUp}
                        label={`Develop ${devType[0].toUpperCase()}${devType.slice(1)} (${regionState.dev?.[devType] || 0})`}
                        description={`+1 ${devType} development`}
                        costs={{ [pool]: cost }}
                        onClick={() => handleDevelopProvince(devType)}
                        disabled={(state.resources[pool] || 0) < cost}
                        resources={state.resources}
                        size="small"
                      />
                    );
                  })}
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
                  {effectiveAge === 'modern' && (
                    <ActionButton
                      icon={Sprout}
                      label="Build Climate Resilience"
                      description="Reduces this region's exposure to weather/harvest disasters"
                      costs={ACTION_COSTS.buildClimateResilience}
                      effects={{ custom: '+1 Resilience' }}
                      onClick={handleBuildClimateResilience}
                      disabled={(regionState.climateResilience || 0) >= CLIMATE_RESILIENCE_MAX}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Buildings</span>
                    <span className="text-slate-500 font-normal">{usedBuildingSlots}/{buildingSlots} slots</span>
                  </div>
                  {BUILDING_CATEGORY_IDS.map((categoryId) => {
                    const category = BUILDING_CATEGORIES[categoryId];
                    const currentTier = regionState.buildings.categories[categoryId];
                    const currentName = currentTier >= 0 ? getCategoryTierName(categoryId, currentTier) : null;
                    const nextTier = currentTier + 1;
                    const nextName = getCategoryTierName(categoryId, nextTier);
                    const notCoastal = category.coastalOnly && !regionData.isCoastal;
                    const techGated = nextName && !canBuildTier(categoryId, researchedTechIds, nextTier);
                    const needsNewSlot = currentTier < 0;
                    const noFreeSlot = needsNewSlot && usedBuildingSlots >= buildingSlots;
                    const cost = nextName ? getBuildingTierCost(categoryId, nextTier, buildingCostMult) : null;
                    const buildable = nextName && !notCoastal && !techGated && !noFreeSlot;
                    const requiresTechName = techGated ? TECH_TREE[category.tiers[nextTier].requiresTech]?.name : null;
                    const foodEffect = categoryId === 'food' && nextName
                      ? `, +${((nextTier + 1) * FOOD_TIER_GROWTH_BONUS * 100).toFixed(2)}%/turn population growth`
                      : '';
                    const reason = notCoastal ? 'Coastal region only'
                      : techGated ? `Requires ${requiresTechName || 'a tech not yet researched'}`
                      : noFreeSlot ? 'No free building slot'
                      : nextName ? `Build ${nextName}${foodEffect}`
                      : 'Fully developed';
                    return (
                      <ActionButton
                        key={categoryId}
                        icon={Building2}
                        label={`${category.label}: ${currentName || 'None'}`}
                        description={reason}
                        costs={cost !== null ? { gold: cost } : null}
                        onClick={() => handleConstructBuilding(categoryId)}
                        disabled={!buildable}
                        resources={state.resources}
                        size="small"
                      />
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Great Projects</div>
                  {regionState.greatProjectConstruction && (
                    <div className="bg-slate-800/60 rounded-lg p-2 text-xs text-slate-300">
                      Building {GREAT_PROJECTS[regionState.greatProjectConstruction.projectId]?.name} (tier {regionState.greatProjectConstruction.tier}) —{' '}
                      {regionState.greatProjectConstruction.turnsLeft} turn{regionState.greatProjectConstruction.turnsLeft === 1 ? '' : 's'} left
                    </div>
                  )}
                  {GREAT_PROJECT_IDS.filter((projectId) => canStartGreatProject(state, state.playerNationId, projectId, regionId)).map((projectId) => {
                    const project = GREAT_PROJECTS[projectId];
                    const cost = getGreatProjectCost(1);
                    return (
                      <ActionButton
                        key={projectId}
                        icon={Landmark}
                        label={`Start ${project.name}`}
                        description={`${cost.turns} turns — ${project.description}`}
                        costs={{ gold: cost.gold, adm: cost.adm }}
                        onClick={() => handleStartGreatProject(projectId)}
                        disabled={!canAfford(state.resources, { gold: cost.gold, adm: cost.adm })}
                        resources={state.resources}
                        size="small"
                      />
                    );
                  })}
                  {!regionState.greatProjectConstruction && !GREAT_PROJECT_IDS.some((projectId) => canStartGreatProject(state, state.playerNationId, projectId, regionId)) && (
                    <div className="text-[10px] text-slate-500">No great project can be started here right now.</div>
                  )}
                </div>

                {deposits.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Resource Deposits</div>
                    {deposits.map((resId) => {
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
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center py-2">
                You don&apos;t control this region — its economy and buildings are unavailable here.
              </div>
            )
          )}

          {tab === 'military' && (
            <div className="space-y-3">
              {!isPlayerOwned && (
                <div className="space-y-2">
                  {invasionSources.length === 0 && amphibiousSources.length === 0 && navalEngagementSources.length === 0 && (
                    <div className="text-[10px] text-slate-500">
                      You don&apos;t control an adjacent region with land units, or a fleet within reach.
                    </div>
                  )}
                  {invasionSources.map(({ regionId: srcId, unitCount }) => (
                    <ActionButton
                      key={srcId}
                      icon={Flag}
                      label={`Launch from ${REGIONS_DATA[srcId]?.name}`}
                      description={`${unitCount} land unit${unitCount === 1 ? '' : 's'} available`}
                      costs={ACTION_COSTS.launchInvasion}
                      onClick={() => handleInvade(srcId)}
                      disabled={!canAfford(state.resources, ACTION_COSTS.launchInvasion)}
                      variant="danger"
                      size="small"
                    />
                  ))}
                  {amphibiousSources.map(({ unit, cargoCount }) => (
                    <ActionButton
                      key={unit.id}
                      icon={Anchor}
                      label={`Amphibious assault from ${REGIONS_DATA[unit.regionId]?.name}`}
                      description={`${cargoCount} embarked land unit${cargoCount === 1 ? '' : 's'}${getNeighborIds(regionId).some((nId) => state.regions[nId]?.owner === state.playerNationId) ? '' : ' — no beachhead, takes a landing penalty'}`}
                      costs={ACTION_COSTS.amphibiousAssault}
                      onClick={() => handleAmphibiousAssault(unit.id)}
                      disabled={!canAfford(state.resources, ACTION_COSTS.amphibiousAssault)}
                      variant="danger"
                      size="small"
                    />
                  ))}
                  {navalEngagementSources.map((srcId) => (
                    <ActionButton
                      key={srcId}
                      icon={Ship}
                      label={`Naval engagement from ${REGIONS_DATA[srcId]?.name}`}
                      description={`Contest ${defendingNavalUnits.length} enemy fleet unit${defendingNavalUnits.length === 1 ? '' : 's'}`}
                      costs={ACTION_COSTS.navalEngagement}
                      onClick={() => handleNavalEngagement(srcId)}
                      disabled={!canAfford(state.resources, ACTION_COSTS.navalEngagement)}
                      variant="danger"
                      size="small"
                    />
                  ))}
                </div>
              )}

              {isPlayerOwned && (
                <>
                  {rebelUnits.length > 0 && (
                    <ActionButton
                      icon={Flame}
                      label={`Suppress the rebellion in ${regionData.name}`}
                      description={
                        regionState.formerOwner
                          ? `${rebelUnits.length} rebel unit${rebelUnits.length === 1 ? '' : 's'} holding out — ${Math.max(0, REVOLT_SUCCESS_TURNS - (state.turnNumber - (rebelUnits[0].spawnedTurn ?? state.turnNumber)))} turn(s) left before ${state.nations[regionState.formerOwner]?.name || regionState.formerOwner} reclaims it`
                          : `${rebelUnits.length} rebel unit${rebelUnits.length === 1 ? '' : 's'} holding out`
                      }
                      costs={ACTION_COSTS.suppressRebellion}
                      onClick={handleSuppressRebellion}
                      disabled={!canAfford(state.resources, ACTION_COSTS.suppressRebellion) || unitsHere.every((u) => u.ownerId !== state.playerNationId || u.domain !== 'land')}
                      variant="danger"
                    />
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Recruit in {regionData.name}</div>
                    {(() => {
                      const recruitCost = getRecruitUnitCost(state, state.age);
                      return availableClasses.map((classId) => (
                        <ActionButton
                          key={classId}
                          icon={UserPlus}
                          label={UNIT_CLASSES[classId].name}
                          description={UNIT_CLASSES[classId].role}
                          costs={recruitCost}
                          onClick={() => handleRecruit(classId)}
                          disabled={!canAfford(state.resources, recruitCost)}
                          resources={state.resources}
                          size="small"
                        />
                      ));
                    })()}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Units stationed here</div>
                    {unitsHere.length === 0 && (
                      <div className="text-[10px] text-slate-500">No units stationed in this region.</div>
                    )}
                    {unitsHere.map((unit) => (
                      <UnitRow
                        key={unit.id}
                        unit={unit}
                        age={state.age}
                        regions={state.regions}
                        playerNationId={state.playerNationId}
                        generals={state.hiredCommanders}
                        unassignedGenerals={unassignedGenerals}
                        navalUnitsHere={unitsHere.filter((u) => u.domain === 'naval' && u.id !== unit.id)}
                        cargoByNavalId={unitsHere.reduce((acc, u) => {
                          if (u.embarkedOn) acc[u.embarkedOn] = (acc[u.embarkedOn] || 0) + 1;
                          return acc;
                        }, {})}
                        onDisband={() => handleDisband(unit.id)}
                        onMove={(toRegionId) => handleMove(unit.id, toRegionId)}
                        onPromote={(perkId) => handlePromote(unit.id, perkId)}
                        onAssignGeneral={(generalId) => handleAppointGeneral(generalId, unit.id)}
                        onUnassignGeneral={() => handleAppointGeneral(unit.commanderId, null)}
                        onEmbark={(navalUnitId) => handleEmbark(unit.id, navalUnitId)}
                        onDisembark={() => handleDisembark(unit.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Same as MilitaryPanel's old per-unit row: rank/perks, move/disband, embark/disembark, general
// assignment.
const UnitRow = ({
  unit, age, regions, playerNationId, generals, unassignedGenerals, navalUnitsHere, cargoByNavalId,
  onDisband, onMove, onPromote, onAssignGeneral, onUnassignGeneral, onEmbark, onDisembark
}) => {
  const moveOptions = getMoveOptions(unit, age, regions, playerNationId);
  const rank = getRankForXp(unit.xp || 0);
  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(rank) + 1];
  const promotable = canPromote(unit);
  const unheldPerks = ALL_PERKS.filter((p) => !hasPerk(unit, p.id));
  const commander = unit.commanderId ? generals[unit.commanderId] : null;
  const embarkableTransports = unit.domain === 'land' ? navalUnitsHere.filter((n) => (cargoByNavalId[n.id] || 0) < n.transportCapacity) : [];

  return (
    <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold capitalize">{UNIT_CLASSES[unit.classId]?.name || unit.classId}</span>
        <span className="text-slate-400 capitalize">{rank}</span>
      </div>
      <div className="flex gap-3 text-slate-400 font-mono">
        <span>STR {unit.strength}/{unit.maxStrength}</span>
        <span>MOR {unit.morale}</span>
        <span>MOV {unit.movesLeft ?? 1}</span>
      </div>
      <div className="text-slate-500 font-mono">
        XP {unit.xp || 0}{nextRank ? ` / ${XP_THRESHOLDS[nextRank]} to ${nextRank}` : ' (max rank)'}
      </div>
      {unit.domain === 'naval' && (
        <div className="text-slate-500 font-mono">Cargo {cargoByNavalId[unit.id] || 0}/{unit.transportCapacity}</div>
      )}

      {unit.embarkedOn ? (
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-slate-400 flex items-center gap-1"><Anchor size={11} /> Embarked for transport</span>
          <button onClick={onDisembark} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px]">
            Disembark
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            className="flex-1 bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] disabled:opacity-40"
            disabled={moveOptions.length === 0}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { onMove(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>Move to…</option>
            {moveOptions.map((nId) => (
              <option key={nId} value={nId}>{REGIONS_DATA[nId]?.name || nId}</option>
            ))}
          </select>
          <button
            onClick={onDisband}
            className="shrink-0 p-1.5 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400"
            title="Disband unit"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {embarkableTransports.length > 0 && (
        <select
          className="w-full bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px]"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { onEmbark(e.target.value); e.target.value = ''; } }}
        >
          <option value="" disabled>Embark on…</option>
          {embarkableTransports.map((n) => (
            <option key={n.id} value={n.id}>Transport ({cargoByNavalId[n.id] || 0}/{n.transportCapacity})</option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-1.5">
        {commander ? (
          <>
            <span className="flex-1 text-slate-400">Commander: {commander.name}</span>
            <button onClick={onUnassignGeneral} className="text-[10px] text-slate-500 hover:text-slate-300 underline">recall</button>
          </>
        ) : (
          <select
            className="flex-1 bg-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] disabled:opacity-40"
            disabled={unassignedGenerals.length === 0}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { onAssignGeneral(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>Assign general…</option>
            {unassignedGenerals.map(([id, g]) => (
              <option key={id} value={id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {promotable && (
        <div className="space-y-1 pt-1 border-t border-slate-700">
          <div className="text-slate-400 flex items-center gap-1"><Award size={11} /> Choose a promotion:</div>
          <div className="flex flex-wrap gap-1">
            {unheldPerks.map((perk) => (
              <button
                key={perk.id}
                onClick={() => onPromote(perk.id)}
                title={perk.description}
                className="px-1.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 text-[10px]"
              >
                {perk.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvinceModal;
