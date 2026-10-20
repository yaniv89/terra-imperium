// src/components/panels/DomesticPanel.jsx
// Domestic tab (plan §5 / §9): purely empire-wide management now — Government & Reforms, Laws,
// Court (ruler/advisors/stability), National Identity, and Empire (Security/Taxes/
// Economy/Great Projects). Region-specific actions (development, buildings, resource deposits,
// per-region great projects) used to be appended here whenever a region was selected, which is what
// made this tab overcrowded — they now live in their own Civ-style screen, ProvinceModal.jsx,
// opened via RegionInfoModal's "Manage Region" button. Government/Laws/Identity default
// collapsed (changed rarely); Court/Empire default open (checked almost every turn) — see
// CollapsibleSection.
import { nameNow } from '../../i18n/names';
import { useT } from '../../i18n/useT';
import { isolateLtr } from '../../i18n';
import { advisorQuote, lawEffectText, lawLockText, describeRulesText, governmentCardLines, poolLabel } from './empireText';
import { techName, taxRateName, taxRateDescription, wonderName, wonderDescription, governmentName, reformName, reformDescription, lawName, lawLine, identityDescription, identityPole, rulerLine } from '../../i18n/gameText';
import { t as tNow } from '../../i18n';
import React from 'react';
import { WonderIcon } from '../ui/icons';
import { Landmark, ScrollText, Coins, ShieldAlert, Crown, Users, TrendingUp, Globe2, Swords } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import EmpireOverview from './EmpireOverview';
import MilitaryPanel from './MilitaryPanel';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import {
  ACTION_COSTS, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD } from '../../data/actionCosts';
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
import { ActionButton, CollapsibleSection } from '../ui';
import { cityGroups, governorChoices, GOVERNOR_FOOD, GOVERNOR_PRODUCTION_MULT, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_ASSIGN_TURNS, GOVERNOR_REFRESH_TURNS } from '../../engine/governors';
import { authorityOf, AUTHORITY_NO_LAWS, AUTHORITY_CIVIL_WAR } from '../../engine/authority';
import { lawRulesOf } from '../../engine/lawRules';
import { previewGovernmentChange } from '../../engine/governmentPreview';
import { openGovernmentChange } from './GovernmentChangeDialog';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { changeLawConfirm } from '../ui/confirmSpecs';
import { powerPoolsShort, POWER_POOL_HELP } from '../../data/powerPools';
import { ageOf } from '../../engine/nationState';
import { stonePhaseOf } from '../../engine/stonePhase';

const DomesticPanel = () => {
  useT(); // redraw when the language changes
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const playerNation = state.nations[state.playerNationId];

  const handleSetTaxRate = (rate) => {
    if (!canAfford(state.resources, ACTION_COSTS.setTaxRate)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('set_tax_rate', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_TAX_RATE, payload: { rate } });
  };
  const handleCounterIntelligence = () => {
    if (!canAfford(state.resources, ACTION_COSTS.counterIntelligence)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('counter_intelligence', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.COUNTER_INTELLIGENCE });
  };

  const empireSection = (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-fa-text">{tNow('dom.security')}</div>
      <ActionButton
        icon={ShieldAlert}
        label={tNow('dom.counter')}
        description={tNow('p1.dom.counterDesc', { hostility: COUNTER_INTEL_HOSTILITY_REDUCTION, dip: COUNTER_INTEL_DIPLOMACY_POINTS_REWARD })}
        costs={ACTION_COSTS.counterIntelligence}
        onClick={handleCounterIntelligence}
        disabled={!canAfford(state.resources, ACTION_COSTS.counterIntelligence)}
        size="small"
      />

      <div className="text-xs font-semibold text-fa-text pt-1">{tNow('dom.taxes')}</div>
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
                  ? tNow('p1.dom.taxAvail', { desc: taxRateDescription(rateId, TAX_RATES[rateId].description), turn: taxCooldownTurn })
                  : taxRateDescription(rateId, TAX_RATES[rateId].description)}
                className={`text-xs rounded-lg p-2 border ${
                  playerNation?.taxRate === rateId
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-fa-raised/60 border-fa-line text-fa-text hover:bg-fa-raised'
                } disabled:opacity-50`}
              >
                <Coins size={14} className="mx-auto mb-0.5" />
                {taxRateName(rateId, TAX_RATES[rateId].name)}
              </button>
            ))}
          </div>
        );
      })()}

      <div className="text-xs font-semibold text-fa-text pt-1">{tNow('dom.economy')}</div>
      {(() => {
        const { income, expenses, net } = calcNationBalance(state, state.playerNationId);
        const loans = playerNation?.loans || [];
        const loanCapacity = getLoanCapacity(state, state.playerNationId);
        const canBorrow = hasBankingHouses(state, state.playerNationId);
        return (
          <div className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex justify-between text-fa-text">
              <span>{tNow('topbar.income')}</span><span>+{formatNumber(Math.round(income.gold || 0))}{tNow('empire.g')}</span>
            </div>
            <div className="flex justify-between text-fa-muted">
              <span>{tNow('dom.upkeep')}</span>
              <span>-{formatNumber(Object.values(expenses).reduce((s, v) => s + v, 0))}{tNow('empire.g')}</span>
            </div>
            <div className={`flex justify-between font-semibold ${net >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>
              <span>{tNow('dom.net')}</span><span>{net >= 0 ? '+' : ''}{formatNumber(Math.round(net))}{tNow('empire.g')}</span>
            </div>
            {!canBorrow ? (
              <div className="text-fa-muted pt-1">{tNow('dom.loans')}</div>
            ) : (
              <>
                <div className="text-fa-muted pt-1">{tNow('p1.dom.loansCount', { n: loans.length, cap: loanCapacity })}</div>
                {loans.map((loan) => (
                  <div key={loan.id} className="flex justify-between items-center text-fa-text">
                    <span>{tNow('p1.dom.loanRow', { amount: formatNumber(loan.principal), rate: Math.round(loan.interestRate * 100) })}</span>
                    <button
                      onClick={() => dispatch({ type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } })}
                      disabled={(state.resources.gold || 0) < loan.principal}
                      className="text-[10px] bg-fa-hover hover:bg-fa-line disabled:opacity-50 rounded px-1.5 py-0.5"
                    >
                      {tNow('p1.dom.repay')}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => dispatch({ type: ActionTypes.REQUEST_LOAN })}
                  disabled={loans.length >= loanCapacity}
                  className="w-full text-[10px] bg-fa-hover hover:bg-fa-line disabled:opacity-50 rounded px-1.5 py-1 mt-1"
                >
                  {tNow('p1.dom.requestLoan', { n: formatNumber(getLoanSize(state, state.playerNationId)) })}
                </button>
              </>
            )}
          </div>
        );
      })()}

      <div className="text-xs font-semibold text-fa-text pt-1">{tNow('dom.projects')}</div>
      {GREAT_PROJECT_IDS.map((projectId) => {
        const project = GREAT_PROJECTS[projectId];
        const entry = state.greatProjects?.[projectId];
        const ownerId = entry ? getGreatProjectOwner(state, projectId) : null;
        const ownedByPlayer = ownerId === state.playerNationId;
        const status = !entry ? tNow('p1.dom.notBuilt')
          : !ownerId ? tNow('p1.dom.tierContested', { tier: entry.tier })
            : ownedByPlayer ? tNow('p1.dom.tierYours', { tier: entry.tier })
              : tNow('p1.dom.tierOther', { tier: entry.tier, name: state.nations[ownerId]?.name ? nameNow('people', ownerId, state.nations[ownerId].name) : ownerId });
        const canRaise = ownedByPlayer && entry.tier < (project.tiers?.length || 3);
        return (
          <div key={projectId} className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-fa-text inline-flex items-center gap-1.5"><WonderIcon projectId={projectId} size={20} />{wonderName(projectId, project.name)}</span>
              <span className="text-fa-muted">{status}</span>
            </div>
            <div className="text-fa-muted">{wonderDescription(projectId, project.description)}</div>
            {canRaise && <div className="text-[10px] text-amber-200">{tNow('p1.dom.raiseIt', { tier: entry.tier + 1, city: state.regions[entry.regionId]?.name ? nameNow('city', null, state.regions[entry.regionId].name) : tNow('p1.dom.itsCity') })}</div>}
          </div>
        );
      })}
    </div>
  );

  const handleHireAdvisor = (pool, candidateIndex, cost) => {
    if ((state.resources.gold || 0) < cost) return addLog(tNow('p1.dom.notGold'), 'action');
    triggerEffect('hire_advisor', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.HIRE_ADVISOR, payload: { pool, candidateIndex } });
  };

  const stabilityCostMult = getModifier(state, state.playerNationId, 'national.stabilityCost').total;
  const increaseStabilityCost = getIncreaseStabilityCost(state, state.playerNationId, stabilityCostMult);
  const handleIncreaseStability = () => {
    if ((state.resources.adm || 0) < increaseStabilityCost) return addLog(tNow('p1.dom.notAdm'), 'action');
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
      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm space-y-2" data-testid="governors">
        <div className="flex items-center gap-2"><Users size={14} className="text-fa-good shrink-0" /><div className="text-fa-text font-semibold">{tNow('dom.governors')}</div></div>
        <div className="text-[10px] text-fa-muted">{tNow('p1.dom.govHelp', { food: GOVERNOR_FOOD, prod: Math.round(GOVERNOR_PRODUCTION_MULT * 100), culture: GOVERNOR_CULTURE, loyalty: GOVERNOR_LOYALTY, ung: isolateLtr(UNGOVERNED_LOYALTY), turns: GOVERNOR_ASSIGN_TURNS })}</div>
        {groups.map((g) => {
          const gov = nation.governors?.[g.seat];
          const arriving = gov && state.turnNumber < gov.ready;
          return (
            <div key={g.seat} className="rounded-lg border border-fa-line p-2 space-y-1" data-testid="governor-seat">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-fa-text">{nameNow('city', null, state.regions[g.seat]?.name)} <span className="text-fa-muted">+{g.cities.length - 1}</span></span>
                <span className={gov ? 'text-fa-good' : 'text-amber-300'}>{gov ? tNow(arriving ? 'p1.dom.govArriving' : 'p1.dom.govSkill', { name: nameNow('person', null, gov.name), skill: gov.skill, turns: gov.ready - state.turnNumber }) : tNow('p1.dom.ungoverned', { n: isolateLtr(UNGOVERNED_LOYALTY) })}</span>
              </div>
              {gov ? (
                <button type="button" onClick={() => dispatch({ type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: g.seat } })} className="min-h-[36px] px-2 rounded bg-fa-hover hover:bg-fa-line text-xs text-fa-text">{tNow('dom.recall')}</button>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {choices.map((c) => (
                    <button key={c.id} type="button" data-testid="assign-governor" onClick={() => dispatch({ type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: g.seat, candidateId: c.id } })} className="min-h-[36px] px-2 rounded bg-emerald-700 hover:bg-emerald-600 text-xs text-fa-text">{tNow('p1.dom.seat', { name: nameNow('person', null, c.name), skill: c.skill })}</button>
                  ))}
                  {!choices.length && <span className="text-[10px] text-fa-muted">{tNow('p1.dom.noOneFree', { n: GOVERNOR_REFRESH_TURNS })}</span>}
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
      {/* Authority is drawn once, with its parts, at the top of the Overview (I144); the Court only links to it. */}
      {authority.total < AUTHORITY_NO_LAWS && <div className="text-[11px] text-amber-300 bg-fa-raised/60 rounded-lg px-2 py-1" data-testid="authority">{tNow('p1.dom.authorityLine', { total: authority.total, noLaws: AUTHORITY_NO_LAWS, civil: authority.total < AUTHORITY_CIVIL_WAR ? tNow('p1.dom.authorityCivil', { n: AUTHORITY_CIVIL_WAR }) : '' })}</div>}
      {ruler && (
        <div className="bg-fa-raised/60 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber-400 shrink-0" />
            <div className="text-fa-text font-semibold">{rulerLine(ruler)}</div>
          </div>
          <div className="text-[10px] text-fa-muted mt-0.5">
            {poolLabel('adm')} {ruler.adm} · {poolLabel('dip')} {ruler.dip} · {poolLabel('mil')} {ruler.mil}
          </div>
          <div className="text-[10px] text-fa-muted" data-testid="ruler-skill-help">
            {tNow('p1.dom.skillHelp')} {powerPoolsShort()}
          </div>
          <div className="text-[10px] text-fa-muted mt-1 border-t border-fa-line pt-1">
            {tNow('p1.no.noHeirs')}
          </div>
        </div>
      )}

      <div className="bg-fa-raised/60 rounded-lg p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-fa-muted">{tNow('dom.stability')}</span>
          <span className={`font-mono font-semibold ${nationStability > 0 ? 'text-fa-good' : nationStability < 0 ? 'text-fa-danger-text' : 'text-fa-text'}`}>
            {nationStability > 0 ? `+${nationStability}` : nationStability}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fa-muted">{tNow('dom.legitimacy')}</span>
          <span className={`font-mono font-semibold ${nationLegitimacy < 50 ? 'text-fa-danger-text' : 'text-fa-text'}`}>{Math.round(nationLegitimacy)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fa-muted">{tNow('dom.prestige')}</span>
          <span className="font-mono font-semibold text-fa-text">{nationPrestige > 0 ? `+${nationPrestige}` : nationPrestige}</span>
        </div>
        <ActionButton
          icon={TrendingUp}
          label={tNow('dom.increaseStability')}
          description={nationStability >= STABILITY_MAX ? tNow('p1.dom.maxStability') : tNow('p1.dom.plusStability')}
          costs={{ adm: increaseStabilityCost }}
          onClick={handleIncreaseStability}
          disabled={nationStability >= STABILITY_MAX || (state.resources.adm || 0) < increaseStabilityCost}
          resources={state.resources}
          size="small"
        />
      </div>

      <div className="text-xs font-semibold text-fa-text pt-1">{tNow('dom.advisors')}</div>
      {['adm', 'dip', 'mil'].map((pool) => {
        const current = advisors[pool];
        const candidates = advisorCandidates[pool] || [];
        return (
          <div key={pool} className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-fa-muted">
              <Users size={12} />
              {tNow('p1.dom.advisorTitle', { pool: tNow(`p1.pool.${pool}`) })}
            </div>
            <div className="text-[10px] text-fa-muted">{tNow('p1.dom.advisorAdds', { pool: poolLabel(pool), name: POWER_POOL_HELP[pool].name, short: POWER_POOL_HELP[pool].short })}</div>
            {current ? (
              <div className="text-fa-text">{nameNow('person', null, current.name)} {tNow('p1.dom.level', { level: current.level })}</div>
            ) : (
              <div className="text-fa-muted">{tNow('dom.noneHired')}</div>
            )}
            {candidates.map((candidate, index) => {
              const cost = getAdvisorHireCost(candidate.level);
              return (
                <ActionButton
                  key={candidate.id}
                  icon={Users}
                  label={tNow('p1.dom.hire', { name: nameNow('person', null, candidate.name), level: candidate.level })}
                  description={advisorQuote(candidate.level, pool, current)}
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

  // Nothing applies here: the confirm dialog (GovernmentChangeDialog.jsx) shows the preview, lets
  // the player choose the reforms and dispatches only on its own button (I140).
  const handleChangeGovernmentType = (typeId) => {
    if (!canAfford(state.resources, ACTION_COSTS.changeGovernmentType)) return addLog(tNow('ri.notEnough'), 'action');
    openGovernmentChange(typeId); // the card is drawn by GovernmentChangeDialog inside NationOverviewSheet
  };
  const handleEnactReform = (ageId, reformId) => {
    if (!canAfford(state.resources, ACTION_COSTS.enactGovernmentReform)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('enact_government_reform', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId, reformId } });
  };
  const handleChangeLaw = (category, lawId) => {
    const costs = { adm: getLawChangeCost(state, state.playerNationId, category, lawId) };
    if (!canAfford(state.resources, costs)) return addLog(tNow('ri.notEnough'), 'action');
    // Two taps: the card shows the cost and what the law does first (H-08).
    askConfirm(changeLawConfirm(state, category, lawId, costs), () => {
      triggerEffect('change_law', { region: getNationCapital(state.playerNationId) });
      dispatch({ type: ActionTypes.CHANGE_LAW, payload: { category, lawId } });
    });
  };

  const currentGovernmentType = GOVERNMENT_TYPES[playerNation?.government?.type];
  const availableGovernmentTypes = getAvailableGovernmentTypes(ageOf(state, state.playerNationId), playerNation?.identity, stonePhaseOf(state, state.playerNationId))
    .filter((t) => t.id !== playerNation?.government?.type);
  const activeReforms = getActiveReforms(playerNation);
  const currentAgeReformChoices = playerNation?.government ? getReformChoices(playerNation.government.type, ageOf(state, state.playerNationId)) : [];
  const currentAgeReformChosen = playerNation?.government?.reforms?.[ageOf(state, state.playerNationId)];

  const governmentSection = (
    <div className="space-y-2">
      <div className="bg-fa-raised/60 rounded-lg p-3 text-sm">
        <div className="text-fa-muted">{tNow('dom.current')}</div>
        <div className="text-fa-text font-semibold">{currentGovernmentType ? governmentName(currentGovernmentType.id, currentGovernmentType.name) : tNow('p1.dom.noneAdopted')}</div>
        {activeReforms.length > 0 && (
          <div className="text-[10px] text-fa-muted mt-0.5">{activeReforms.map((r) => reformName(r.id, r.name)).join(' · ')}</div>
        )}
      </div>
      {availableGovernmentTypes.map((gov) => {
        const preview = previewGovernmentChange(state, gov.id);
        return (
        <React.Fragment key={gov.id}>
        <ActionButton
          icon={Landmark}
          label={tNow('p1.dom.become', { name: governmentName(gov.id, gov.name) })}
          description={preview.ok ? tNow('p1.dom.becomeTap', { lines: governmentCardLines(preview) }) : tNow('p1.dom.becomeReset')}
          costs={ACTION_COSTS.changeGovernmentType}
          onClick={() => handleChangeGovernmentType(gov.id)}
          disabled={!canAfford(state.resources, ACTION_COSTS.changeGovernmentType) || !canChangeGovernmentType(playerNation, gov.id, ageOf(state, state.playerNationId), stonePhaseOf(state, state.playerNationId))}
          resources={state.resources}
          size="small"
        />
        {preview.locksLaws && <div className="text-[11px] text-fa-danger-text px-1" data-testid="gov-locks-laws">{tNow('p1.dom.dropsAuthority', { n: AUTHORITY_NO_LAWS })}</div>}
        </React.Fragment>
        );
      })}

      {currentGovernmentType && currentAgeReformChoices.length > 0 && (
        <>
          <div className="text-xs font-semibold text-fa-text pt-1">
            {currentAgeReformChosen ? tNow('p1.dom.currentReform') : tNow('p1.dom.chooseReform')}
          </div>
          {currentAgeReformChoices.map((reform) => (
            currentAgeReformChosen === reform.id ? (
              <div key={reform.id} className="flex items-center gap-1.5 bg-fa-raised/60 rounded-lg p-2 text-xs">
                <ScrollText size={14} className="text-amber-400 shrink-0" />
                <div className="flex-1">
                  <div className="text-fa-text">{reformName(reform.id, reform.name)}</div>
                  <div className="text-fa-muted">{reformDescription(reform.id, reform.description)}</div>
                </div>
              </div>
            ) : (
              <ActionButton
                key={reform.id}
                icon={ScrollText}
                label={reformName(reform.id, reform.name)}
                description={reformDescription(reform.id, reform.description)}
                costs={ACTION_COSTS.enactGovernmentReform}
                onClick={() => handleEnactReform(ageOf(state, state.playerNationId), reform.id)}
                disabled={!canAfford(state.resources, ACTION_COSTS.enactGovernmentReform) || !canEnactReform(playerNation, ageOf(state, state.playerNationId), reform.id, ageOf(state, state.playerNationId))}
                size="small"
              />
            )
          ))}
        </>
      )}
    </div>
  );

  const rulesInForce = describeRulesText(lawRulesOf(playerNation));
  const lawsSection = (
    <div className="space-y-2">
      {rulesInForce.length > 0 && <div className="text-[11px] text-emerald-200/90 bg-fa-raised/40 rounded-lg px-2 py-1" data-testid="law-rules">{tNow('p1.dom.inForce', { rules: rulesInForce.join('; ') })}</div>}
      {LAW_CATEGORY_IDS.map((category) => {
        const currentLawId = playerNation?.laws?.[category];
        const currentLaw = getLaw(category, currentLawId);
        const alternatives = LAW_CATEGORIES[category].filter((l) => l.id !== currentLawId);
        return (
          <div key={category} className="bg-fa-raised/60 rounded-lg p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-fa-muted capitalize">{tNow(`p1.lawcat.${category}`)}</span>
              <span className="text-fa-text font-semibold">{currentLaw && lawName(currentLaw.id, currentLaw.name)}</span>
            </div>
            {currentLaw && <div className="text-fa-muted" data-testid={`law-effects-${category}`}>{lawLine(currentLaw, lawEffectText(currentLaw))}</div>}
            <div className="flex flex-col gap-1.5 pt-1">
              {alternatives.map((law) => {
                const canEnact = canEnactLaw(state, state.playerNationId, category, law.id);
                const cost = { adm: getLawChangeCost(state, state.playerNationId, category, law.id) };
                const requiredTech = getRequiredTechName(law);
                const effectText = lawEffectText(law);
                const lock = lawLockText(state, state.playerNationId, category, law);
                return (
                  <div key={law.id} className="flex flex-col items-start gap-0.5">
                    <button
                      onClick={() => handleChangeLaw(category, law.id)}
                      disabled={!canEnact || !canAfford(state.resources, cost)}
                      title={requiredTech && !canEnact ? tNow('p1.dom.requires', { tech: techName(law.requiresTech, requiredTech) }) : lawLine(law, effectText)}
                      className="text-[10px] rounded bg-fa-hover/80 hover:bg-fa-line disabled:opacity-40 disabled:cursor-not-allowed text-fa-text px-2 py-1"
                    >
                      {lawName(law.id, law.name)} ({cost.adm} {poolLabel('adm')})
                    </button>
                    <span className="text-[10px] text-fa-muted" data-testid={`law-alt-${law.id}`}>{lawLine(law, effectText)}{lock ? ` ${tNow('p1.dom.locked', { why: lock })}` : ''}</span>
                  </div>
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
    if (!canAfford(state.resources, ACTION_COSTS.shiftIdentity)) return addLog(tNow('ri.notEnough'), 'action');
    triggerEffect('shift_identity', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SHIFT_IDENTITY, payload: { axis, direction } });
  };

  const identitySection = (
    <div className="space-y-2">
      {IDENTITY_AXIS_IDS.map((axisId) => {
        const axis = IDENTITY_AXES[axisId];
        const value = playerNation?.identity?.[axisId] || 0;
        return (
          <div key={axisId} className="bg-fa-raised/60 rounded-lg p-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-fa-muted" title={identityDescription(axisId, axis.description)}>{identityPole(axisId, 'neg', axis.negativePole)} &harr; {identityPole(axisId, 'pos', axis.positivePole)}</span>
              <span className="text-fa-text font-mono">{value > 0 ? `+${value}` : value}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleShiftIdentity(axisId, -1)}
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || identityOnCooldown || value <= IDENTITY_MIN}
                className="flex-1 text-[10px] rounded bg-fa-hover/80 hover:bg-fa-line disabled:opacity-40 disabled:cursor-not-allowed text-fa-text py-1"
              >
                &larr; {identityPole(axisId, 'neg', axis.negativePole)}
              </button>
              <button
                onClick={() => handleShiftIdentity(axisId, 1)}
                disabled={!canAfford(state.resources, ACTION_COSTS.shiftIdentity) || identityOnCooldown || value >= IDENTITY_MAX}
                className="flex-1 text-[10px] rounded bg-fa-hover/80 hover:bg-fa-line disabled:opacity-40 disabled:cursor-not-allowed text-fa-text py-1"
              >
                {identityPole(axisId, 'pos', axis.positivePole)} &rarr;
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
      <CollapsibleSection title={tNow('dom.overview')} icon={Globe2} defaultOpen>
        <EmpireOverview />
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection id="war" title={tNow('dom.war')} icon={Swords} summary={warsNow.length ? tNow('dom.atWarWith', { n: warsNow.length }) : tNow('dom.atPeace')}>
        <MilitaryPanel />
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection id="court" title={tNow('dom.court')} icon={Crown} defaultOpen>
        {courtSection}
        {governorsSection}
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection title={tNow('dom.treasury')} icon={ShieldAlert}>
        {empireSection}
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection title={tNow('dom.government')} icon={Landmark} summary={currentGovernmentType && governmentName(currentGovernmentType.id, currentGovernmentType.name)}>
        {governmentSection}
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection title={tNow('dom.laws')} icon={ScrollText}>
        {lawsSection}
      </CollapsibleSection>
      <div className="border-t border-fa-line" />
      <CollapsibleSection title={tNow('dom.identity')} icon={Users}>
        {identitySection}
      </CollapsibleSection>
    </div>
  );
};

export default DomesticPanel;
