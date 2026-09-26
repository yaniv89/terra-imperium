// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): purely empire-wide management now — Government & Reforms, Laws,
// Estates, Court (ruler/heir/advisors/stability), National Identity, and Empire (Security/Taxes/
// Economy/Great Projects). Region-specific actions (development, buildings, resource deposits,
// per-region great projects) used to be appended here whenever a region was selected, which is what
// made this tab overcrowded — they now live in their own Civ-style screen, ProvinceModal.jsx,
// opened via RegionInfoModal's "Manage Region" button. Government/Laws/Estates/Identity default
// collapsed (changed rarely); Court/Empire default open (checked almost every turn) — see
// CollapsibleSection.
import React from 'react';
import { Landmark, ScrollText, Coins, ShieldAlert, Crown, Users, TrendingUp } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import {
  ACTION_COSTS, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD,
  FUSION_GRID_ACTIVATION_HELIUM3, FUSION_GRID_UPKEEP_HELIUM3_PER_TURN, FUSION_GRID_GOLD_MULT_BONUS
} from '../../data/actionCosts';
import {
  GOVERNMENT_TYPES, getActiveReforms, getAvailableGovernmentTypes, getReformChoices, canChangeGovernmentType, canEnactReform
} from '../../data/government';
import { IDENTITY_AXES, IDENTITY_AXIS_IDS, IDENTITY_MIN, IDENTITY_MAX } from '../../data/identity';
import { LAW_CATEGORY_IDS, LAW_CATEGORIES, getLaw, canEnactLaw, getLawChangeCost, getRequiredTechName } from '../../data/laws';
import { ESTATE_LABELS, ESTATE_LOYALTY_HIGH_THRESHOLD, ESTATE_LOYALTY_LOW_THRESHOLD, getEstatePrivileges, CROWN_LAND_LOW_THRESHOLD, CROWN_LAND_HIGH_THRESHOLD } from '../../data/estates';
import { canDoEstateInteraction } from '../../engine/estates';
import {
  GREAT_PROJECTS, GREAT_PROJECT_IDS, getGreatProjectCost, getGreatProjectOwner, canUpgradeGreatProject
} from '../../data/greatProjects';
import { TAX_RATES, TAX_RATE_IDS } from '../../data/taxRates';
import { calcNationBalance, getLoanCapacity, getLoanSize, hasBankingHouses } from '../../engine/economy';
import { canAfford, formatNumber } from '../../utils/helpers';
import { getAdvisorHireCost } from '../../engine/succession';
import { getIncreaseStabilityCost, STABILITY_MAX } from '../../engine/nationalPower';
import { getModifier } from '../../engine/modifiers/sheet';
import { TRAITS } from '../../data/traits';
import { ActionButton, CollapsibleSection } from '../ui';

const POWER_POOL_NAMES = { adm: 'Administrative', dip: 'Diplomatic', mil: 'Military' };

const DomesticPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];

  const handleSetTaxRate = (rate) => {
    if (!canAfford(state.resources, ACTION_COSTS.setTaxRate)) return addLog('Not enough resources', 'action');
    triggerEffect('set_tax_rate', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_TAX_RATE, payload: { rate } });
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
      {(() => {
        const taxCooldownTurn = playerNation?.taxRateCooldownUntil || 0;
        const onTaxCooldown = state.turnNumber < taxCooldownTurn;
        return (
          <div className="grid grid-cols-4 gap-1.5">
            {TAX_RATE_IDS.map((rateId) => (
              <button
                key={rateId}
                onClick={() => handleSetTaxRate(rateId)}
                disabled={playerNation?.taxRate === rateId || onTaxCooldown || !canAfford(state.resources, ACTION_COSTS.setTaxRate)}
                title={onTaxCooldown && playerNation?.taxRate !== rateId
                  ? `${TAX_RATES[rateId].description} (available turn ${taxCooldownTurn})`
                  : TAX_RATES[rateId].description}
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
        );
      })()}

      <div className="text-xs font-semibold text-slate-300 pt-1">Economy</div>
      {(() => {
        const { income, expenses, net } = calcNationBalance(state, state.playerNationId);
        const loans = playerNation?.loans || [];
        const loanCapacity = getLoanCapacity(state, state.playerNationId);
        const canBorrow = hasBankingHouses(state, state.playerNationId);
        return (
          <div className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Income</span><span>+{formatNumber(Math.round(income.gold || 0))}g</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Upkeep &amp; interest</span>
              <span>-{formatNumber(Object.values(expenses).reduce((s, v) => s + v, 0))}g</span>
            </div>
            <div className={`flex justify-between font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>Net</span><span>{net >= 0 ? '+' : ''}{formatNumber(Math.round(net))}g</span>
            </div>
            {!canBorrow ? (
              <div className="text-slate-500 pt-1">Loans require Banking Houses (Economy tech).</div>
            ) : (
              <>
                <div className="text-slate-400 pt-1">Loans: {loans.length}/{loanCapacity}</div>
                {loans.map((loan) => (
                  <div key={loan.id} className="flex justify-between items-center text-slate-300">
                    <span>{formatNumber(loan.principal)}g @ {Math.round(loan.interestRate * 100)}%</span>
                    <button
                      onClick={() => dispatch({ type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } })}
                      disabled={(state.resources.gold || 0) < loan.principal}
                      className="text-[10px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-1.5 py-0.5"
                    >
                      Repay
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => dispatch({ type: ActionTypes.REQUEST_LOAN })}
                  disabled={loans.length >= loanCapacity}
                  className="w-full text-[10px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-1.5 py-1 mt-1"
                >
                  Request Loan (~{formatNumber(getLoanSize(state, state.playerNationId))}g)
                </button>
              </>
            )}
            {(state.completedMissions || []).includes('outer_planets') && (
              <button
                onClick={() => dispatch({ type: ActionTypes.ACTIVATE_FUSION_GRID })}
                disabled={playerNation?.fusionGridActive || (state.resources.helium3 || 0) < FUSION_GRID_ACTIVATION_HELIUM3}
                title={`50 Helium-3 once, then ${FUSION_GRID_UPKEEP_HELIUM3_PER_TURN}/turn, for +${Math.round(FUSION_GRID_GOLD_MULT_BONUS * 100)}% Gold income while supplied.`}
                className="w-full text-[10px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-1.5 py-1 mt-1"
              >
                {playerNation?.fusionGridActive ? 'Fusion Grid Online' : `Activate Fusion Grid (${FUSION_GRID_ACTIVATION_HELIUM3} He-3)`}
              </button>
            )}
          </div>
        );
      })()}

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

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Court" icon={Crown} defaultOpen>
        {courtSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="Empire" icon={ShieldAlert} defaultOpen>
        {empireSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="Government" icon={Landmark} summary={currentGovernmentType?.name}>
        {governmentSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="Laws" icon={ScrollText}>
        {lawsSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="Estates" icon={Coins} summary={`Crown Land ${crownLand}%`}>
        {estatesSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="National Identity" icon={Users}>
        {identitySection}
      </CollapsibleSection>
    </div>
  );
};

export default DomesticPanel;
