// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): an empire-wide Government & Policies section (always visible),
// an empire-wide Taxes & Wonders section (Set Tax Rate, Construct Wonder), plus region details
// and the ten remaining per-region/empire actions — Gain Control, Build Infrastructure, Build
// Defenses, Construct Building, Develop Resource Site, Quell Unrest, Population Policy, Settle/
// Colonize, Adopt Policy/Reform (government), and government adoption itself. All twelve of the
// plan's Domestic actions are now real: Settle/Colonize targets a bordering region whose own
// control has collapsed (SETTLE_COLONIZE_CONTROL_THRESHOLD) — a real "expand without war" path.

import React from 'react';
import { Building2, Shield, Flag, Hammer, Gem, HeartCrack, Landmark, ScrollText, Sprout, Coins, ShieldAlert } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, isAdjacentToOwner, getNationCapital } from '../../data/regions';
import { ACTION_COSTS, SETTLE_COLONIZE_CONTROL_THRESHOLD, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, CLIMATE_RESILIENCE_MAX } from '../../data/actionCosts';
import {
  BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getCategoryTierName, EXTRACTION_BUILDINGS, canBuildExtraction,
  getBuildingTierCost, getBuildingSlots, getUsedBuildingSlots
} from '../../data/buildings';
import { TECH_TREE } from '../../data/techTree';
import { getDepositsFor } from '../../data/deposits';
import { INTEGRATION_CONTROL_THRESHOLD } from '../../data/rebellion';
import { getEffectiveAgeId } from '../../data/ages';
import { FOOD_TIER_GROWTH_BONUS } from '../../engine/population';
import {
  GOVERNMENT_TYPES, getActiveReforms, getAvailableGovernmentTypes, getReformChoices, canChangeGovernmentType, canEnactReform
} from '../../data/government';
import { IDENTITY_AXES, IDENTITY_AXIS_IDS, IDENTITY_MIN, IDENTITY_MAX } from '../../data/identity';
import { LAW_CATEGORY_IDS, LAW_CATEGORIES, getLaw, canEnactLaw, getLawChangeCost, getRequiredTechName } from '../../data/laws';
import { ESTATE_LABELS, ESTATE_LOYALTY_HIGH_THRESHOLD, ESTATE_LOYALTY_LOW_THRESHOLD, getEstatePrivileges, CROWN_LAND_LOW_THRESHOLD, CROWN_LAND_HIGH_THRESHOLD } from '../../data/estates';
import { canDoEstateInteraction } from '../../engine/estates';
import {
  GREAT_PROJECTS, GREAT_PROJECT_IDS, getGreatProjectCost, getGreatProjectOwner, canStartGreatProject, canUpgradeGreatProject
} from '../../data/greatProjects';
import { TAX_RATES, TAX_RATE_IDS } from '../../data/taxRates';
import { canAfford, formatNumber, getStability, getSupplyCapacity, getDisplayPopulation } from '../../utils/helpers';
import { getAdvisorHireCost } from '../../engine/succession';
import { getIncreaseStabilityCost, STABILITY_MAX } from '../../engine/nationalPower';
import { DEV_TYPE_IDS, DEV_TYPE_POOL, getDevelopProvinceCost, getTotalDev } from '../../engine/development';
import { getModifier } from '../../engine/modifiers/sheet';
import { TRAITS } from '../../data/traits';
import { ActionButton } from '../ui';
import { Crown, Users, TrendingUp } from 'lucide-react';

const POWER_POOL_NAMES = { adm: 'Administrative', dip: 'Diplomatic', mil: 'Military' };

const DomesticPanel = ({ selectedRegion }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];

  const regionState = selectedRegion ? state.regions[selectedRegion] : null;
  const regionData = selectedRegion ? REGIONS_DATA[selectedRegion] : null;
  const ownerName = regionState ? (state.nations[regionState.owner]?.name || regionState.owner) : null;
  const isPlayerOwned = regionState?.owner === state.playerNationId;

  const handleSetTaxRate = (rate) => {
    if (!canAfford(state.resources, ACTION_COSTS.setTaxRate)) return addLog('Not enough resources', 'action');
    triggerEffect('set_tax_rate', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_TAX_RATE, payload: { rate } });
  };
  const handleStartGreatProject = (projectId, regionId) => {
    const { gold, adm } = getGreatProjectCost(1);
    if (!canAfford(state.resources, { gold, adm })) return addLog('Not enough resources', 'action');
    triggerEffect('start_great_project', { region: regionId });
    dispatch({ type: ActionTypes.START_GREAT_PROJECT, payload: { projectId, regionId } });
  };
  const handleUpgradeGreatProject = (projectId) => {
    const entry = state.greatProjects[projectId];
    const { gold, adm } = getGreatProjectCost((entry?.tier || 0) + 1);
    if (!canAfford(state.resources, { gold, adm })) return addLog('Not enough resources', 'action');
    triggerEffect('upgrade_great_project', { region: entry?.regionId });
    dispatch({ type: ActionTypes.UPGRADE_GREAT_PROJECT, payload: { projectId } });
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

      <div className="text-xs font-semibold text-slate-300 pt-1">Great Projects</div>
      {GREAT_PROJECT_IDS.map((projectId) => {
        const project = GREAT_PROJECTS[projectId];
        const entry = state.greatProjects?.[projectId];
        const ownerId = entry ? getGreatProjectOwner(state, projectId) : null;
        const ownedByPlayer = ownerId === state.playerNationId;
        const status = !entry ? 'Not yet built'
          : `Tier ${entry.tier}${ownerId ? ` — ${ownedByPlayer ? 'yours' : state.nations[ownerId]?.name || ownerId}` : ' — contested'}`;
        const canUpgrade = ownedByPlayer && canUpgradeGreatProject(state, state.playerNationId, projectId);
        const upgradeCost = canUpgrade ? getGreatProjectCost(entry.tier + 1) : null;
        return (
          <div key={projectId} className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white">{project.name}</span>
              <span className="text-slate-400">{status}</span>
            </div>
            <div className="text-slate-500">{project.description}</div>
            {canUpgrade && (
              <ActionButton
                icon={Landmark}
                label={`Upgrade to Tier ${entry.tier + 1}`}
                description={`${upgradeCost.turns} turns`}
                costs={{ gold: upgradeCost.gold, adm: upgradeCost.adm }}
                onClick={() => handleUpgradeGreatProject(projectId)}
                disabled={!canAfford(state.resources, { gold: upgradeCost.gold, adm: upgradeCost.adm })}
                resources={state.resources}
                size="small"
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const handleHireAdvisor = (pool, candidateIndex, cost) => {
    if ((state.resources.gold || 0) < cost) return addLog('Not enough gold', 'action');
    triggerEffect('hire_advisor', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.HIRE_ADVISOR, payload: { pool, candidateIndex } });
  };

  const stabilityCostMult = getModifier(state, state.playerNationId, 'national.stabilityCost').total;
  const increaseStabilityCost = getIncreaseStabilityCost(state, state.playerNationId, stabilityCostMult);
  const handleIncreaseStability = () => {
    if ((state.resources.adm || 0) < increaseStabilityCost) return addLog('Not enough ADM', 'action');
    triggerEffect('increase_stability', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.INCREASE_STABILITY });
  };

  const ruler = playerNation?.ruler;
  const heir = playerNation?.heir;
  const advisors = playerNation?.advisors || {};
  const advisorCandidates = state.advisorPool?.[state.playerNationId] || {};
  const nationStability = playerNation?.stability || 0;
  const nationLegitimacy = playerNation?.legitimacy ?? 50;
  const nationPrestige = playerNation?.prestige || 0;

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

      <div className="bg-slate-800/60 rounded-lg p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Stability</span>
          <span className={`font-mono font-semibold ${nationStability > 0 ? 'text-green-400' : nationStability < 0 ? 'text-red-400' : 'text-slate-300'}`}>
            {nationStability > 0 ? `+${nationStability}` : nationStability}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Legitimacy</span>
          <span className={`font-mono font-semibold ${nationLegitimacy < 50 ? 'text-red-400' : 'text-slate-300'}`}>{Math.round(nationLegitimacy)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Prestige</span>
          <span className="font-mono font-semibold text-slate-300">{nationPrestige > 0 ? `+${nationPrestige}` : nationPrestige}</span>
        </div>
        <ActionButton
          icon={TrendingUp}
          label="Increase Stability"
          description={nationStability >= STABILITY_MAX ? 'Already at maximum stability' : '+1 stability'}
          costs={{ adm: increaseStabilityCost }}
          onClick={handleIncreaseStability}
          disabled={nationStability >= STABILITY_MAX || (state.resources.adm || 0) < increaseStabilityCost}
          resources={state.resources}
          size="small"
        />
      </div>

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

  const handleChangeGovernmentType = (typeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.changeGovernmentType)) return addLog('Not enough resources', 'action');
    triggerEffect('change_government_type', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId } });
  };
  const handleEnactReform = (ageId, reformId) => {
    if (!canAfford(state.resources, ACTION_COSTS.enactGovernmentReform)) return addLog('Not enough resources', 'action');
    triggerEffect('enact_government_reform', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId, reformId } });
  };
  const handleChangeLaw = (category, lawId) => {
    const costs = { adm: getLawChangeCost(state, state.playerNationId, category, lawId) };
    if (!canAfford(state.resources, costs)) return addLog('Not enough resources', 'action');
    triggerEffect('change_law', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CHANGE_LAW, payload: { category, lawId } });
  };

  const currentGovernmentType = GOVERNMENT_TYPES[playerNation?.government?.type];
  const availableGovernmentTypes = getAvailableGovernmentTypes(state.age, playerNation?.identity)
    .filter((t) => t.id !== playerNation?.government?.type);
  const activeReforms = getActiveReforms(playerNation);
  const currentAgeReformChoices = playerNation?.government ? getReformChoices(playerNation.government.type, state.age) : [];
  const currentAgeReformChosen = playerNation?.government?.reforms?.[state.age];

  const governmentSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Government</div>
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
        <div className="text-slate-400">Current</div>
        <div className="text-white font-semibold">{currentGovernmentType ? currentGovernmentType.name : 'None adopted'}</div>
        {activeReforms.length > 0 && (
          <div className="text-[10px] text-slate-500 mt-0.5">{activeReforms.map((r) => r.name).join(' · ')}</div>
        )}
      </div>
      {availableGovernmentTypes.map((gov) => (
        <ActionButton
          key={gov.id}
          icon={Landmark}
          label={`Become a ${gov.name}`}
          description="Resets your reform choices; -2 stability."
          costs={ACTION_COSTS.changeGovernmentType}
          onClick={() => handleChangeGovernmentType(gov.id)}
          disabled={!canAfford(state.resources, ACTION_COSTS.changeGovernmentType) || !canChangeGovernmentType(playerNation, gov.id, state.age)}
          resources={state.resources}
          size="small"
        />
      ))}

      {currentGovernmentType && currentAgeReformChoices.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-300 pt-1">
            {currentAgeReformChosen ? 'Current Reform' : 'Choose a Reform'}
          </div>
          {currentAgeReformChoices.map((reform) => (
            currentAgeReformChosen === reform.id ? (
              <div key={reform.id} className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg p-2 text-xs">
                <ScrollText size={14} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <div className="text-white">{reform.name}</div>
                  <div className="text-slate-500">{reform.description}</div>
                </div>
              </div>
            ) : (
              <ActionButton
                key={reform.id}
                icon={ScrollText}
                label={reform.name}
                description={reform.description}
                costs={ACTION_COSTS.enactGovernmentReform}
                onClick={() => handleEnactReform(state.age, reform.id)}
                disabled={!canAfford(state.resources, ACTION_COSTS.enactGovernmentReform) || !canEnactReform(playerNation, state.age, reform.id, state.age)}
                size="small"
              />
            )
          ))}
        </>
      )}
    </div>
  );

  const lawsSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Laws</div>
      {LAW_CATEGORY_IDS.map((category) => {
        const currentLawId = playerNation?.laws?.[category];
        const currentLaw = getLaw(category, currentLawId);
        const alternatives = LAW_CATEGORIES[category].filter((l) => l.id !== currentLawId);
        return (
          <div key={category} className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 capitalize">{category}</span>
              <span className="text-white font-semibold">{currentLaw?.name}</span>
            </div>
            {currentLaw?.description && <div className="text-slate-500">{currentLaw.description}</div>}
            <div className="flex flex-wrap gap-1 pt-1">
              {alternatives.map((law) => {
                const canEnact = canEnactLaw(state, state.playerNationId, category, law.id);
                const cost = { adm: getLawChangeCost(state, state.playerNationId, category, law.id) };
                const requiredTech = getRequiredTechName(law);
                return (
                  <button
                    key={law.id}
                    onClick={() => handleChangeLaw(category, law.id)}
                    disabled={!canEnact || !canAfford(state.resources, cost)}
                    title={requiredTech && !canEnact ? `Requires ${requiredTech}` : law.description}
                    className="text-[10px] rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 px-2 py-1"
                  >
                    {law.name} ({cost.adm} ADM)
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const handleSeizeLand = () => {
    if (!canAfford(state.resources, ACTION_COSTS.seizeLand)) return addLog('Not enough resources', 'action');
    triggerEffect('seize_land', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SEIZE_LAND, payload: {} });
  };
  const handleSellLand = () => {
    if (!canAfford(state.resources, ACTION_COSTS.sellLand)) return addLog('Not enough resources', 'action');
    triggerEffect('sell_land', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SELL_LAND, payload: {} });
  };
  const handleGrantPrivilege = (estateId, privilegeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.grantEstatePrivilege)) return addLog('Not enough resources', 'action');
    triggerEffect('grant_estate_privilege', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.GRANT_ESTATE_PRIVILEGE, payload: { estateId, privilegeId } });
  };
  const handleRevokePrivilege = (estateId, privilegeId) => {
    triggerEffect('revoke_estate_privilege', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.REVOKE_ESTATE_PRIVILEGE, payload: { estateId, privilegeId } });
  };
  const handleClergyTithe = () => {
    triggerEffect('clergy_tithe', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.CLERGY_TITHE, payload: {} });
  };
  const handleNobilityLevies = () => {
    triggerEffect('nobility_levies', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.NOBILITY_LEVIES, payload: {} });
  };

  const crownLand = playerNation?.crownLand ?? 50;
  const estatesSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Estates</div>
      <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Crown Land</span>
          <span className={`font-mono ${crownLand <= CROWN_LAND_LOW_THRESHOLD ? 'text-red-400' : crownLand >= CROWN_LAND_HIGH_THRESHOLD ? 'text-emerald-400' : 'text-white'}`}>{crownLand}%</span>
        </div>
        <div className="flex gap-1.5">
          <ActionButton icon={Landmark} label="Seize Land" description="+10 crown land, -20 loyalty (all estates)" costs={ACTION_COSTS.seizeLand}
            onClick={handleSeizeLand} disabled={!canAfford(state.resources, ACTION_COSTS.seizeLand) || !canDoEstateInteraction(playerNation, 'seizeLand', state.turnNumber)} size="small" />
          <ActionButton icon={Coins} label="Sell Land" description="-10 crown land, +gold, +10 burgher loyalty" costs={ACTION_COSTS.sellLand}
            onClick={handleSellLand} disabled={!canAfford(state.resources, ACTION_COSTS.sellLand) || !canDoEstateInteraction(playerNation, 'sellLand', state.turnNumber)} size="small" />
        </div>
      </div>
      {Object.entries(playerNation?.estates || {}).map(([estateId, estate]) => (
        <div key={estateId} className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">{ESTATE_LABELS[estateId] || estateId}</span>
            <span className={`font-mono ${estate.loyalty < ESTATE_LOYALTY_LOW_THRESHOLD ? 'text-red-400' : estate.loyalty >= ESTATE_LOYALTY_HIGH_THRESHOLD ? 'text-emerald-400' : 'text-slate-300'}`}>
              Loyalty {Math.round(estate.loyalty)} · Influence {Math.round(estate.influence)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {getEstatePrivileges(estateId).map((privilege) => {
              const granted = estate.privileges.includes(privilege.id);
              return granted ? (
                <button key={privilege.id} onClick={() => handleRevokePrivilege(estateId, privilege.id)} title={privilege.description}
                  className="text-[10px] rounded bg-amber-700/40 hover:bg-red-700/40 border border-amber-600/50 text-amber-200 px-2 py-1">
                  {privilege.name} (revoke)
                </button>
              ) : (
                <button key={privilege.id} onClick={() => handleGrantPrivilege(estateId, privilege.id)}
                  disabled={!canAfford(state.resources, ACTION_COSTS.grantEstatePrivilege)} title={privilege.description}
                  className="text-[10px] rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 px-2 py-1">
                  Grant {privilege.name}
                </button>
              );
            })}
            {estateId === 'clergy' && (
              <button onClick={handleClergyTithe} className="text-[10px] rounded bg-yellow-700/40 hover:bg-yellow-600/40 border border-yellow-600/50 text-yellow-200 px-2 py-1">
                Tithe (-10 loyalty)
              </button>
            )}
            {estateId === 'nobility' && (
              <button onClick={handleNobilityLevies} className="text-[10px] rounded bg-red-700/40 hover:bg-red-600/40 border border-red-600/50 text-red-200 px-2 py-1">
                Raise Levies (-10 loyalty)
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const identityOnCooldown = (state.turnNumber || 0) < (playerNation?.identityShiftCooldownTurn || 0);
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
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || identityOnCooldown || value <= IDENTITY_MIN}
                className="flex-1 text-[10px] rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 py-1"
              >
                &larr; {axis.negativePole}
              </button>
              <button
                onClick={() => handleShiftIdentity(axisId, 1)}
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || identityOnCooldown || value >= IDENTITY_MAX}
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
        <div className="border-t border-slate-800 pt-2">{lawsSection}</div>
        <div className="border-t border-slate-800 pt-2">{estatesSection}</div>
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
  const developmentCostMult = getModifier(state, state.playerNationId, 'national.developmentCost').total;
  const handleDevelopProvince = (devType) => {
    const pool = DEV_TYPE_POOL[devType];
    const cost = getDevelopProvinceCost(regionState, developmentCostMult);
    if ((state.resources[pool] || 0) < cost) return addLog(`Not enough ${pool.toUpperCase()}`, 'action');
    triggerEffect('develop_province', { region: selectedRegion });
    dispatchAction(ActionTypes.DEVELOP_PROVINCE, { devType });
  };
  const researchedTechIds = new Set(Object.keys(state.techTree).filter((id) => state.techTree[id].researched));
  const buildingCostMult = getModifier(state, state.playerNationId, 'national.buildingCost').total;
  const buildingSlots = regionState ? getBuildingSlots(getTotalDev(regionState), !!regionData?.isCapital) : 0;
  const usedBuildingSlots = regionState ? getUsedBuildingSlots(regionState.buildings) : 0;
  const handleConstructBuilding = (categoryId) => {
    const nextTierIndex = (regionState?.buildings.categories[categoryId] ?? -1) + 1;
    const cost = getBuildingTierCost(categoryId, nextTierIndex, buildingCostMult);
    if ((state.resources.gold || 0) < cost) return addLog('Not enough gold', 'action');
    // The icon must match the TIER actually being built (the age it belongs to), not the current
    // calendar/tech age — a rushed one-age-ahead build already shows next age's structure.
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
      <div className="pt-2 border-t border-slate-800">{lawsSection}</div>
      <div className="pt-2 border-t border-slate-800">{estatesSection}</div>
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
            <div className="text-xs font-semibold text-slate-300 pt-1">Develop Province</div>
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
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Buildings</span>
              <span className="text-slate-500 font-normal">{usedBuildingSlots}/{buildingSlots} slots</span>
            </div>
            {BUILDING_CATEGORY_IDS.map(categoryId => {
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
              // Food & Growth is the one category with a mechanical effect worth naming here (it
              // feeds resolveTurn.js's population growth via src/engine/population.js) — every
              // other category's own action (Develop Resource Site, the Science tech-point yield,
              // etc.) already states its effect elsewhere, so this doesn't generalize a pattern
              // that isn't there yet for the rest.
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

          {isPlayerOwned && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Great Projects</div>
              {regionState.greatProjectConstruction && (
                <div className="bg-slate-800/60 rounded-lg p-2 text-xs text-slate-300">
                  Building {GREAT_PROJECTS[regionState.greatProjectConstruction.projectId]?.name} (tier {regionState.greatProjectConstruction.tier}) —{' '}
                  {regionState.greatProjectConstruction.turnsLeft} turn{regionState.greatProjectConstruction.turnsLeft === 1 ? '' : 's'} left
                </div>
              )}
              {GREAT_PROJECT_IDS.filter((projectId) => canStartGreatProject(state, state.playerNationId, projectId, selectedRegion)).map((projectId) => {
                const project = GREAT_PROJECTS[projectId];
                const cost = getGreatProjectCost(1);
                return (
                  <ActionButton
                    key={projectId}
                    icon={Landmark}
                    label={`Start ${project.name}`}
                    description={`${cost.turns} turns — ${project.description}`}
                    costs={{ gold: cost.gold, adm: cost.adm }}
                    onClick={() => handleStartGreatProject(projectId, selectedRegion)}
                    disabled={!canAfford(state.resources, { gold: cost.gold, adm: cost.adm })}
                    resources={state.resources}
                    size="small"
                  />
                );
              })}
            </div>
          )}

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
