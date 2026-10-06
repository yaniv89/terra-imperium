// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): purely empire-wide management now — Government & Reforms, Laws,
// Court (ruler/advisors/stability), National Identity, and Empire (Security/Taxes/
// Economy/Great Projects). Region-specific actions (development, buildings, resource deposits,
// per-region great projects) used to be appended here whenever a region was selected, which is what
// made this tab overcrowded — they now live in their own Civ-style screen, ProvinceModal.jsx,
// opened via RegionInfoModal's "Manage Region" button. Government/Laws/Identity default
// collapsed (changed rarely); Court/Empire default open (checked almost every turn) — see
// CollapsibleSection.
import React from 'react';
import { WonderIcon } from '../ui/icons';
import { Landmark, ScrollText, Coins, ShieldAlert, Crown, Users, TrendingUp, Globe2, Swords, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import EmpireOverview from './EmpireOverview';
import MilitaryPanel from './MilitaryPanel';
import DiplomacyPanel from './DiplomacyPanel';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import {
  ACTION_COSTS, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD,
  FUSION_GRID_ACTIVATION_HELIUM3, FUSION_GRID_UPKEEP_HELIUM3_PER_TURN, FUSION_GRID_GOLD_MULT_BONUS } from '../../data/actionCosts';
import {
  GOVERNMENT_TYPES, getActiveReforms, getAvailableGovernmentTypes, getReformChoices, canChangeGovernmentType, canEnactReform
} from '../../data/government';
import { IDENTITY_AXES, IDENTITY_AXIS_IDS, IDENTITY_MIN, IDENTITY_MAX } from '../../data/identity';
import { LAW_CATEGORY_IDS, LAW_CATEGORIES, getLaw, canEnactLaw, getLawChangeCost, getRequiredTechName } from '../../data/laws';
import {
  GREAT_PROJECTS, GREAT_PROJECT_IDS, getGreatProjectOwner
} from '../../data/greatProjects';
import { TAX_RATES, TAX_RATE_IDS } from '../../data/taxRates';
import { calcNationBalance, getLoanCapacity, getLoanSize, hasBankingHouses } from '../../engine/economy';
import { canAfford, formatNumber } from '../../utils/helpers';
import { getAdvisorHireCost } from '../../engine/rulers';
import { getIncreaseStabilityCost, STABILITY_MAX } from '../../engine/nationalPower';
import { getModifier } from '../../engine/modifiers/sheet';
import { TRAITS } from '../../data/traits';
import { ActionButton, CollapsibleSection } from '../ui';
import { cityGroups, governorChoices, GOVERNOR_FOOD, GOVERNOR_PRODUCTION_MULT, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_ASSIGN_TURNS, GOVERNOR_REFRESH_TURNS } from '../../engine/governors';
import { authorityOf, AUTHORITY_NO_LAWS, AUTHORITY_CIVIL_WAR } from '../../engine/authority';
import { lawRulesOf, describeRules } from '../../engine/lawRules';

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
        const canRaise = ownedByPlayer && entry.tier < (project.tiers?.length || 3);
        return (
          <div key={projectId} className="bg-slate-800/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white inline-flex items-center gap-1.5"><WonderIcon projectId={projectId} size={20} />{project.name}</span>
              <span className="text-slate-400">{status}</span>
            </div>
            <div className="text-slate-500">{project.description}</div>
            {canRaise && <div className="text-[10px] text-amber-200">Raise it to tier {entry.tier + 1} from {state.regions[entry.regionId]?.name || 'its city'}&apos;s production queue (Wonders).</div>}
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
  const advisors = playerNation?.advisors || {};
  const advisorCandidates = state.advisorPool?.[state.playerNationId] || {};
  const nationStability = playerNation?.stability || 0;
  const nationLegitimacy = playerNation?.legitimacy ?? 50;
  const nationPrestige = playerNation?.prestige || 0;

  // Governors (src/engine/governors.js): one seat per city group, a court candidate in it.
  const governorsSection = (() => {
    const me = state.playerNationId;
    const nation = state.nations[me];
    const groups = cityGroups(state, me);
    const choices = governorChoices(nation);
    if (!groups.length) return null;
    return (
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm space-y-2" data-testid="governors">
        <div className="flex items-center gap-2"><Users size={14} className="text-emerald-300 shrink-0" /><div className="text-white font-semibold">Governors</div></div>
        <div className="text-[10px] text-slate-500">A governed group: +{GOVERNOR_FOOD} food, +{Math.round(GOVERNOR_PRODUCTION_MULT * 100)}% production, +{GOVERNOR_CULTURE} culture, +{GOVERNOR_LOYALTY} loyalty and skill, less unrest. Ungoverned: {UNGOVERNED_LOYALTY} loyalty. Taking office takes {GOVERNOR_ASSIGN_TURNS} turns.</div>
        {groups.map((g) => {
          const gov = nation.governors?.[g.seat];
          const arriving = gov && state.turnNumber < gov.ready;
          return (
            <div key={g.seat} className="rounded-lg border border-slate-700 p-2 space-y-1" data-testid="governor-seat">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white">{state.regions[g.seat]?.name} <span className="text-slate-500">+{g.cities.length - 1}</span></span>
                <span className={gov ? 'text-emerald-300' : 'text-amber-300'}>{gov ? `${gov.name} (skill ${gov.skill}${arriving ? `, arrives in ${gov.ready - state.turnNumber}` : ''})` : `ungoverned (${UNGOVERNED_LOYALTY} loyalty)`}</span>
              </div>
              {gov ? (
                <button type="button" onClick={() => dispatch({ type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: g.seat } })} className="min-h-[36px] px-2 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200">Recall</button>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {choices.map((c) => (
                    <button key={c.id} type="button" data-testid="assign-governor" onClick={() => dispatch({ type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: g.seat, candidateId: c.id } })} className="min-h-[36px] px-2 rounded bg-emerald-700 hover:bg-emerald-600 text-xs text-white">Seat {c.name} (skill {c.skill})</button>
                  ))}
                  {!choices.length && <span className="text-[10px] text-slate-500">No one at court is free: candidates arrive every {GOVERNOR_REFRESH_TURNS} turns.</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  })();

  const authority = authorityOf(state, state.playerNationId);
  const courtSection = (
    <div className="space-y-2">
      <div className="bg-slate-800/60 rounded-lg p-3 text-sm" data-testid="authority">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-300 font-semibold">Authority</span>
          <span className={`font-mono font-bold ${authority.total < AUTHORITY_CIVIL_WAR ? 'text-red-400' : authority.total < AUTHORITY_NO_LAWS ? 'text-amber-300' : 'text-emerald-300'}`}>{authority.total}</span>
        </div>
        <div className="h-1.5 rounded bg-slate-700 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${authority.total}%` }} /></div>
        <div className="text-[10px] text-slate-500 mt-1">{authority.parts.map((p) => `${p.label} ${p.value > 0 ? '+' : ''}${p.value}`).join(' · ')}</div>
        {authority.total < AUTHORITY_NO_LAWS && <div className="text-[10px] text-amber-300 mt-0.5">Under {AUTHORITY_NO_LAWS}: no new laws{authority.total < AUTHORITY_CIVIL_WAR ? `; under ${AUTHORITY_CIVIL_WAR} a civil war brews` : ''}.</div>}
      </div>
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
          <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-700 pt-1">
            When the reign ends a new ruler takes over{playerNation?.government?.type === 'monarchy' ? ' from the same royal house' : ''}.
          </div>
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

  const rulesInForce = describeRules(lawRulesOf(playerNation));
  const lawsSection = (
    <div className="space-y-2">
      {rulesInForce.length > 0 && <div className="text-[11px] text-emerald-200/90 bg-slate-800/40 rounded-lg px-2 py-1" data-testid="law-rules">In force: {rulesInForce.join('; ')}.</div>}
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

  const warsNow = Object.values(state.nations).filter((n) => !n.isPlayer && isAtWarWithPlayer(state, n.id));
  return (
    <div className="space-y-3">
      <CollapsibleSection title="Overview" icon={Globe2} defaultOpen>
        <EmpireOverview />
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection id="war" title="War" icon={Swords} summary={warsNow.length ? `at war with ${warsNow.length}` : 'at peace'}>
        <MilitaryPanel />
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection id="relations" title="Relations" icon={Flag} summary={`${Object.values(state.nations).filter((n) => !n.isPlayer && n.hasTradeAgreement).length} trade pacts`}>
        <DiplomacyPanel />
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection id="court" title="Court" icon={Crown} defaultOpen>
        {courtSection}
        {governorsSection}
      </CollapsibleSection>
      <div className="border-t border-slate-800" />
      <CollapsibleSection title="Treasury" icon={ShieldAlert}>
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
      <CollapsibleSection title="National Identity" icon={Users}>
        {identitySection}
      </CollapsibleSection>
    </div>
  );
};

export default DomesticPanel;
