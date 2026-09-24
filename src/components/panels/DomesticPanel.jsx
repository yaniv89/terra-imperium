// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): an empire-wide Government & Policies section (always visible),
// an empire-wide Taxes & Wonders section (Set Tax Rate, Construct Wonder), plus region details
// and the ten remaining per-region/empire actions — Gain Control, Build Infrastructure, Build
// Defenses, Construct Building, Develop Resource Site, Quell Unrest, Population Policy, Settle/
// Colonize, Adopt Policy/Reform (government), and government adoption itself. All twelve of the
// plan's Domestic actions are now real: Settle/Colonize targets a bordering region whose own
// control has collapsed (SETTLE_COLONIZE_CONTROL_THRESHOLD) — a real "expand without war" path.

import React from 'react';
import { Building2, Shield, Flag, Hammer, Gem, HeartCrack, Landmark, ScrollText, X, Sprout, Coins, ShieldAlert } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, isAdjacentToOwner, getNationCapital } from '../../data/regions';
import { ACTION_COSTS, SETTLE_COLONIZE_CONTROL_THRESHOLD, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, CLIMATE_RESILIENCE_MAX } from '../../data/actionCosts';
import { BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getCategoryTierName, EXTRACTION_BUILDINGS, canBuildExtraction } from '../../data/buildings';
import { getDepositsFor } from '../../data/deposits';
import { INTEGRATION_CONTROL_THRESHOLD } from '../../data/rebellion';
import { getEffectiveAgeId } from '../../data/ages';
import { FOOD_TIER_GROWTH_BONUS } from '../../engine/population';
import { GOVERNMENT_TYPES, canAdoptGovernment } from '../../data/government';
import { IDENTITY_AXES, IDENTITY_AXIS_IDS, IDENTITY_MIN, IDENTITY_MAX } from '../../data/identity';
import { POLICIES, POLICY_IDS } from '../../data/policies';
import { WONDERS, WONDER_IDS, canConstructWonder } from '../../data/wonders';
import { TAX_RATES, TAX_RATE_IDS } from '../../data/taxRates';
import { canAfford, formatNumber, getStability, getSupplyCapacity, getDisplayPopulation } from '../../utils/helpers';
import { getAdvisorHireCost } from '../../engine/succession';
import { TRAITS } from '../../data/traits';
import { ActionButton } from '../ui';
import { Crown, Users } from 'lucide-react';

const POWER_POOL_NAMES = { adm: 'Administrative', dip: 'Diplomatic', mil: 'Military' };

const DomesticPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const ownerName = regionState ? (state.nations[regionState.owner]?.name || regionState.owner) : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;
  const effectiveAgeForEmpire = getEffectiveAgeId(state.age, state.techAgeId);

  const handleSetTaxRate = (rate) => {
    if (!canAfford(state.resources, ACTION_COSTS.setTaxRate)) return addLog('Not enough resources', 'action');
    triggerEffect('set_tax_rate', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_TAX_RATE, payload: { rate } });
  };
  const handleConstructWonder = (wonderId) => {
    if (!canAfford(state.resources, ACTION_COSTS.constructWonder)) return addLog('Not enough resources', 'action');
    triggerEffect('construct_wonder', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId } });
  };
  const handleCounterIntelligence = () => {
    if (!canAfford(state.resources, ACTION_COSTS.counterIntelligence)) return addLog('Not enough resources', 'action');
    triggerEffect('counter_intelligence', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.COUNTER_INTELLIGENCE });
  };

  const empireSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Security</div>
      <ActionButton
        icon={ShieldAlert}
        label="Counter-Intelligence"
        description={`Uncover a plot by whoever's most hostile toward you: -${COUNTER_INTEL_HOSTILITY_REDUCTION} their hostility, +${COUNTER_INTEL_DIPLOMACY_POINTS_REWARD} Diplomacy Points`}
        costs={ACTION_COSTS.counterIntelligence}
        onClick={handleCounterIntelligence}
        disabled={!canAfford(state.resources, ACTION_COSTS.counterIntelligence)}
        size="small"
      />

      <div className="text-xs font-semibold text-slate-300 pt-1">Taxes</div>
      <div className="grid grid-cols-3 gap-1.5">
        {TAX_RATE_IDS.map((rateId) => (
          <button
            key={rateId}
            onClick={() => handleSetTaxRate(rateId)}
            disabled={playerNation?.taxRate === rateId || !canAfford(state.resources, ACTION_COSTS.setTaxRate)}
            title={TAX_RATES[rateId].description}
            className={`text-xs rounded-lg p-2 border ${
              playerNation?.taxRate === rateId
                ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            } disabled:opacity-50`}
          >
            <Coins size={14} className="mx-auto mb-0.5" />
            {TAX_RATES[rateId].name}
          </button>
        ))}
      </div>

      <div className="text-xs font-semibold text-slate-300 pt-1">World Wonders</div>
      {WONDER_IDS.map((wonderId) => {
        const wonder = WONDERS[wonderId];
        const builderId = state.wondersBuilt?.[wonderId];
        const builtByPlayer = builderId === state.playerNationId;
        const builtByOther = builderId && !builtByPlayer;
        const buildable = !builderId && canConstructWonder(wonderId, effectiveAgeForEmpire, state.wondersBuilt);
        return (
          <ActionButton
            key={wonderId}
            icon={Landmark}
            label={builtByOther ? `${wonder.name} (built by ${state.nations[builderId]?.name || builderId})` : `${wonder.name}${builtByPlayer ? ' (completed)' : ''}`}
            description={wonder.description}
            costs={!builderId ? ACTION_COSTS.constructWonder : null}
            onClick={() => handleConstructWonder(wonderId)}
            disabled={!buildable}
            size="small"
          />
        );
      })}
    </div>
  );

  const handleHireAdvisor = (pool, candidateIndex, cost) => {
    if ((state.resources.gold || 0) < cost) return addLog('Not enough gold', 'action');
    triggerEffect('hire_advisor', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.HIRE_ADVISOR, payload: { pool, candidateIndex } });
  };

  const ruler = playerNation?.ruler;
  const heir = playerNation?.heir;
  const advisors = playerNation?.advisors || {};
  const advisorCandidates = state.advisorPool?.[state.playerNationId] || {};

  const courtSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Court</div>
      {ruler && (
        <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber-400 shrink-0" />
            <div className="text-white font-semibold">{ruler.name} of House {ruler.dynasty}</div>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            ADM {ruler.adm} · DIP {ruler.dip} · MIL {ruler.mil}
            {ruler.traits?.length > 0 && ` · ${ruler.traits.map((id) => TRAITS[id]?.name || id).join(', ')}`}
          </div>
          <div className="text-[10px] text-slate-500">
            Reign ends turn {ruler.reignEndsTurn}
          </div>
          {heir && (
            <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-700 pt-1">
              Heir: {heir.name} (claim {heir.claim}) · ADM {heir.adm} · DIP {heir.dip} · MIL {heir.mil}
            </div>
          )}
          {!heir && (
            <div className="text-[10px] text-amber-500 mt-1 border-t border-slate-700 pt-1">
              No heir — succession crisis risk
            </div>
          )}
        </div>
      )}

      <div className="text-xs font-semibold text-slate-300 pt-1">Advisors</div>
      {['adm', 'dip', 'mil'].map((pool) => {
        const current = advisors[pool];
        const candidates = advisorCandidates[pool] || [];
        return (
          <div key={pool} className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users size={12} />
              {POWER_POOL_NAMES[pool]} Advisor
            </div>
            {current ? (
              <div className="text-white">{current.name} (level {current.level})</div>
            ) : (
              <div className="text-slate-500">None hired</div>
            )}
            {candidates.map((candidate, index) => {
              const cost = getAdvisorHireCost(candidate.level);
              return (
                <ActionButton
                  key={candidate.id}
                  icon={Users}
                  label={`Hire ${candidate.name} (level ${candidate.level})`}
                  costs={{ gold: cost }}
                  onClick={() => handleHireAdvisor(pool, index, cost)}
                  disabled={current?.id === candidate.id || (state.resources.gold || 0) < cost}
                  resources={state.resources}
                  size="small"
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const handleAdoptGovernment = (governmentId) => {
    if (!canAfford(state.resources, ACTION_COSTS.adoptGovernment)) return addLog('Not enough resources', 'action');
    triggerEffect('adopt_government', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId } });
  };
  const handleAdoptPolicy = (policyId) => {
    if (!canAfford(state.resources, ACTION_COSTS.adoptPolicy)) return addLog('Not enough resources', 'action');
    triggerEffect('adopt_policy', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.ADOPT_POLICY, payload: { policyId } });
  };
  const handleRemovePolicy = (policyId) => {
    if (!canAfford(state.resources, ACTION_COSTS.removePolicy)) return addLog('Not enough resources', 'action');
    triggerEffect('remove_policy', { region: getNationCapital(state.playerNationId) });
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
          resources={state.resources}
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

  const handleShiftIdentity = (axis, direction) => {
    if (!canAfford(state.resources, ACTION_COSTS.shiftIdentity)) return addLog('Not enough resources', 'action');
    triggerEffect('shift_identity', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SHIFT_IDENTITY, payload: { axis, direction } });
  };

  const identitySection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">National Identity</div>
      {IDENTITY_AXIS_IDS.map((axisId) => {
        const axis = IDENTITY_AXES[axisId];
        const value = playerNation?.identity?.[axisId] || 0;
        return (
          <div key={axisId} className="bg-slate-800/60 rounded-lg p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400" title={axis.description}>{axis.negativePole} &harr; {axis.positivePole}</span>
              <span className="text-white font-mono">{value > 0 ? `+${value}` : value}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleShiftIdentity(axisId, -1)}
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || value <= IDENTITY_MIN}
                className="flex-1 text-[10px] rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 py-1"
              >
                &larr; {axis.negativePole}
              </button>
              <button
                onClick={() => handleShiftIdentity(axisId, 1)}
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || value >= IDENTITY_MAX}
                className="flex-1 text-[10px] rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 py-1"
              >
                {axis.positivePole} &rarr;
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!regionData || !regionState) {
    return (
      <div className="space-y-4">
        {governmentSection}
        <div className="border-t border-slate-800 pt-2">{courtSection}</div>
        <div className="border-t border-slate-800 pt-2">{identitySection}</div>
        <div className="border-t border-slate-800 pt-2">{empireSection}</div>
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
    triggerEffect('gain_control', { region: selectedRegion });
    dispatchAction(ActionTypes.GAIN_CONTROL);
  };
  const handleBuildInfrastructure = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildInfrastructure)) return addLog('Not enough resources', 'action');
    triggerEffect('build_infrastructure', { region: selectedRegion });
    dispatchAction(ActionTypes.BUILD_INFRASTRUCTURE);
  };
  const handleBuildDefenses = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildDefenses)) return addLog('Not enough resources', 'action');
    triggerEffect('build_defenses', { region: selectedRegion });
    dispatchAction(ActionTypes.BUILD_DEFENSES);
  };
  const handleBuildClimateResilience = () => {
    if (!canAfford(state.resources, ACTION_COSTS.buildClimateResilience)) return addLog('Not enough resources', 'action');
    triggerEffect('build_climate_resilience', { region: selectedRegion });
    dispatchAction(ActionTypes.BUILD_CLIMATE_RESILIENCE);
  };
  const handleQuellUnrest = () => {
    if (!canAfford(state.resources, ACTION_COSTS.quellUnrest)) return addLog('Not enough resources', 'action');
    triggerEffect('quell_unrest', { region: selectedRegion });
    dispatchAction(ActionTypes.QUELL_UNREST);
  };
  const handlePopulationPolicy = () => {
    if (!canAfford(state.resources, ACTION_COSTS.populationPolicy)) return addLog('Not enough resources', 'action');
    triggerEffect('population_policy', { region: selectedRegion });
    dispatchAction(ActionTypes.POPULATION_POLICY);
  };
  const handleSettleColonize = () => {
    if (!canAfford(state.resources, ACTION_COSTS.settleColonize)) return addLog('Not enough resources', 'action');
    triggerEffect('settle_colonize', { region: selectedRegion });
    dispatchAction(ActionTypes.SETTLE_COLONIZE);
  };
  const handleConstructBuilding = (categoryId) => {
    if (!canAfford(state.resources, ACTION_COSTS.constructBuilding)) return addLog('Not enough resources', 'action');
    // The icon must match the TIER actually being built (the age it belongs to), not the current
    // calendar/tech age — a rushed one-age-ahead build already shows next age's structure.
    const nextTierIndex = (regionState?.buildings.categories[categoryId] ?? -1) + 1;
    const tierAge = BUILDING_CATEGORIES[categoryId]?.tiers[nextTierIndex]?.age;
    triggerEffect('construct_building', { region: selectedRegion, variant: categoryId, age: tierAge });
    dispatch({ type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: selectedRegion, categoryId } });
  };
  const handleDevelopResourceSite = (resourceId) => {
    if (!canAfford(state.resources, ACTION_COSTS.developResourceSite)) return addLog('Not enough resources', 'action');
    triggerEffect('develop_resource_site', { region: selectedRegion, variant: resourceId });
    dispatch({ type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: selectedRegion, resourceId } });
  };

  const deposits = getDepositsFor(regionData?.startOwner); // deposits are geological, keyed by the province's home country
  const undevelopedDeposits = deposits.filter(resId => !regionState.buildings.extraction[resId]);
  // Matches the reducer's own gate (GameContext.jsx's CONSTRUCT_BUILDING/DEVELOP_RESOURCE_SITE) —
  // otherwise a tech-earned age ahead of the calendar would accept the action but show it as
  // disabled here.
  const effectiveAge = getEffectiveAgeId(state.age, state.techAgeId);

  return (
    <div className="space-y-4">
      {governmentSection}
      <div className="pt-2 border-t border-slate-800">{courtSection}</div>
      <div className="pt-2 border-t border-slate-800">{identitySection}</div>

      <div className="flex items-center gap-2 text-white font-bold text-lg pt-2 border-t border-slate-800">
        <Building2 size={20} className="text-blue-400" />
        {regionData.name}
      </div>
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

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Buildings</div>
            {BUILDING_CATEGORY_IDS.map(categoryId => {
              const category = BUILDING_CATEGORIES[categoryId];
              const currentTier = regionState.buildings.categories[categoryId];
              const currentName = currentTier >= 0 ? getCategoryTierName(categoryId, currentTier) : null;
              const nextTier = currentTier + 1;
              const nextName = getCategoryTierName(categoryId, nextTier);
              const buildable = nextName && canBuildTier(categoryId, effectiveAge, nextTier);
              // Food & Growth is the one category with a mechanical effect worth naming here (it
              // feeds resolveTurn.js's population growth via src/engine/population.js) — every
              // other category's own action (Develop Resource Site, the Science tech-point yield,
              // etc.) already states its effect elsewhere, so this doesn't generalize a pattern
              // that isn't there yet for the rest.
              const foodEffect = categoryId === 'food' && nextName
                ? `, +${((nextTier + 1) * FOOD_TIER_GROWTH_BONUS * 100).toFixed(2)}%/turn population growth`
                : '';
              return (
                <ActionButton
                  key={categoryId}
                  icon={Building2}
                  label={`${category.label}: ${currentName || 'None'}`}
                  description={nextName ? `Build ${nextName}${foodEffect}` : 'Fully developed for this age'}
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
        <div className="space-y-2 pt-2 border-t border-slate-800">
          {isAdjacentToOwner(selectedRegion, state.regions, state.playerNationId) && regionState.control < SETTLE_COLONIZE_CONTROL_THRESHOLD ? (
            <ActionButton
              icon={Flag}
              label="Settle / Colonize"
              description={`${ownerName}'s grip here has collapsed (${regionState.control}% control) — absorb it peacefully, no military required`}
              costs={ACTION_COSTS.settleColonize}
              onClick={handleSettleColonize}
            />
          ) : (
            <div className="text-slate-500 text-xs text-center">
              You don&apos;t control this region — domestic actions are unavailable here.
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-slate-800">{empireSection}</div>
    </div>
  );
};

export default DomesticPanel;
