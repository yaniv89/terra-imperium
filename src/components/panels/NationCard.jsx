// src/components/panels/NationCard.jsx
// One nation's relation card (plans/civ-map-rework.md E4: the nation sheet reuses it, the Peoples
// tab shows the chosen one). Field Atlas look (W07, plans/UI-DESIGN.md): the title and relation,
// the opinion of you with its reasons on tap and a bar centred on zero, the treaties as chips, the
// main actions as tiles that say before you try whether they would accept or refuse (and why, in
// one line under them), and the long tail of secondary actions behind "More actions".
import React, { useState } from 'react';
import { Target, Gift, Eye, Heart, Users, Crown, Ban, AlertTriangle, ChevronDown, ChevronUp, DoorOpen, Scale } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Chip } from '../ui/atlas';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { declareWarConfirm } from '../ui/confirmSpecs';
import TopLayer from '../ui/TopLayer';
import PeaceDealSheet from '../battle/PeaceDealSheet';
import { useEffects } from '../../context/EffectsContext';
import { WORLD_NATIONS } from '../../data/worldNations';
import { ActionTypes } from '../../data/types';
import {
  ACTION_COSTS, SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, ESPIONAGE_SUCCESS_CHANCE, INTEL_DURATION_TURNS, ESPIONAGE_TECH_POINTS_STOLEN,
  MAX_RIVALS, VASSALIZE_HOSTILITY_CEILING, VASSALIZE_STRENGTH_RATIO, VASSAL_ANNEX_COOLDOWN_TURNS, VASSAL_ANNEX_DIP_PER_DEV
} from '../../data/actionCosts';
import { hasCasusBelli, isAtWarWithPlayer, isInTruce, isWarBetween, getTradePactCapacity } from '../../engine/diplomacy';
import { getTotalDev } from '../../engine/development';
import { getNationCapital, getBorderingNationIds } from '../../data/regions';
import { canAfford, formatNumber, getFieldedStrength } from '../../utils/helpers';
import { hasIntel } from '../../engine/intel';
import { opinionOf, opinionBreakdown } from '../../engine/opinion';
import { getEffectiveMilitaryPower } from '../../engine/aiEconomy';
import { claimsAgainst, claimableCities, CLAIM_FABRICATE_TURNS, CLAIM_RANGE_RINGS } from '../../engine/claims';
import { hasOpenBorders, openBordersAcceptance, demandAcceptance, DEMANDS } from '../../engine/accords';
import { tradeRouteStatus } from '../../engine/tradeDisruptions';
import MapTradeBox from './MapTradeBox';
import { t as tNow, hasKey } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { reasonText } from '../../i18n/messageText';
import { msgRefText } from '../battle/battleText';
import { opinionLabel, opinionDetail } from './opinionText';
import { ageOf } from '../../engine/nationState';
import { ageVersusPlayer } from '../ui/ageProgress';
import { shortAge } from './researchSheetModel';

// Plan feedback ("I don't understand why I can't start a war, I have plenty of resources"): the
// player was reading the top-bar Gold total and assuming that meant "affordable," when most
// diplomacy actions are actually gated on ADM/DIP/MIL power (separate, far scarcer pools —
// src/components/ui/ResourceBar.jsx's adm/dip/mil badges) rather than gold. `formatCost` puts the
// real price directly in the button label (matching the pattern "Sue for Peace (200g)"/"Annex (…
// DIP)" already used below), and `describeShortfall` turns a failed dispatchIfAffordable into a
// specific reason instead of a generic "Not enough resources" — both readable without a hover
// tooltip, which mobile touch has no equivalent of.

const UNIT_KEYS = new Set(['gold', 'dip', 'adm', 'mil']);
const unitOf = (key) => (UNIT_KEYS.has(key) ? ` ${tNow(`nc.unit.${key}`)}` : key);
const formatCost = (costs) => Object.entries(costs)
  .filter(([, amount]) => amount > 0)
  .map(([key, amount]) => `${formatNumber(amount)}${unitOf(key)}`)
  .join(', ');
const describeShortfall = (resources, costs) => Object.entries(costs)
  .filter(([key, amount]) => (resources[key] || 0) < amount)
  .map(([key, amount]) => tNow('nc.shortfallItem', { n: formatNumber(amount), unit: unitOf(key).trim(), have: formatNumber(resources[key] || 0) }))
  .join(', ');

// Diplomacy actions that travel visibly between the player's capital and the target nation's.
const DIPLOMACY_EFFECT_BY_ACTION = {
  [ActionTypes.DECLARE_WAR]: 'declare_war',
  [ActionTypes.SUE_FOR_PEACE]: 'sue_for_peace',
  [ActionTypes.TRADE_AGREEMENT]: 'trade_agreement',
  [ActionTypes.GIFT_BRIBE]: 'gift_bribe',
  [ActionTypes.FABRICATE_CLAIM]: 'fabricate_claim',
  [ActionTypes.MILITARY_ALLIANCE]: 'military_alliance',
  [ActionTypes.ESPIONAGE]: 'espionage',
  [ActionTypes.RIVAL_NATION]: 'rival_nation',
  [ActionTypes.PROPOSE_MARRIAGE]: 'propose_marriage',
  [ActionTypes.BREAK_ALLIANCE]: 'break_alliance',
  [ActionTypes.INSULT]: 'insult',
  [ActionTypes.ASSIGN_DIPLOMAT]: 'assign_diplomat',
  [ActionTypes.VASSALIZE]: 'vassalize',
  [ActionTypes.RELEASE_VASSAL]: 'release_vassal'
};

// Deliberately never sets the native `disabled` attribute: a real disabled button swallows every
// click/tap with zero feedback, which is exactly what made every gated diplomacy action look
// "broken" on mobile (no hover tooltip to explain why, and no tap ever reaches onClick). `looksDisabled`
// is styling only — onClick still fires, and callers are expected to explain the block via addLog
// (dispatchIfAffordable already does for cost; a few callers add their own reason on top).
const IconButton = ({ icon: Icon, label, onClick, disabled: looksDisabled, title }) => (
  <button type="button" onClick={onClick} title={title} className={`fa-chip gap-1.5 ${looksDisabled ? 'opacity-55' : ''}`}>
    <Icon size={13} aria-hidden="true" />
    {label}
  </button>
);

// A main action as a tile (W07): what it is and, below, its price or the answer they would give.
// "Would refuse" draws a dashed danger border; the tile still reacts and explains (never disabled).
const Tile = ({ label, sub, onClick, refuse, looksDisabled, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className={`text-start rounded-lg border px-2.5 py-2 min-h-[52px] hover:bg-fa-hover transition-colors ${refuse ? 'border-dashed border-fa-danger bg-fa-ink/30' : 'border-fa-line bg-fa-raised'} ${looksDisabled ? 'opacity-60' : ''}`}>
    <span className="block text-[13px] font-semibold leading-tight text-fa-text">{label}</span>
    {sub && <span className={`block text-[11px] leading-tight mt-0.5 ${refuse ? 'text-fa-danger-text' : 'text-fa-muted'}`}>{sub}</span>}
  </button>
);

// One nation's relation card. Local `expanded` state gates the long tail of secondary actions
// behind a "More" toggle (plan feedback) — 1-2 primary actions (whichever is relevant to the
// current relationship) always stay visible.
export const NationCard = ({ nation, hideTitle = false }) => {
  const { state, dispatch, addLog } = useGame();
  const { t } = useT();
  const { triggerEffect } = useEffects();
  const [expanded, setExpanded] = useState(false);
  const [peaceOpen, setPeaceOpen] = useState(false);

  const dispatchIfAffordable = (type, costs, extra = {}) => {
    if (!canAfford(state.resources, costs)) return addLog(t('nc.notEnough', { list: describeShortfall(state.resources, costs) }), 'action');
    const effectType = DIPLOMACY_EFFECT_BY_ACTION[type];
    if (effectType) triggerEffect(effectType, { from: getNationCapital(state.playerNationId), to: getNationCapital(nation.id) });
    dispatch({ type, payload: { nationId: nation.id, ...extra } });
  };

  const nationData = WORLD_NATIONS[nation.id];
  const atWarWithPlayer = isAtWarWithPlayer(state, nation.id);
  // War score (plan §M13), shown from the player's own perspective regardless of which side of
  // the war record (aggressor/enemy) the player happens to be.
  const activeWar = state.wars.find(w => w.active && isWarBetween(w, state.playerNationId, nation.id));
  const playerWarScore = activeWar ? (activeWar.aggressor === state.playerNationId ? activeWar.score : -activeWar.score) : 0;
  const justified = hasCasusBelli(state, state.playerNationId, nation.id);
  const declareWarCosts = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
  const sueForPeaceCosts = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - (nation.warExhaustion || 0) * 2)), dip: 1 };

  const player = state.nations[state.playerNationId];
  const isRival = (player.rivals || []).includes(nation.id);
  const isVassalOfPlayer = nation.vassalOf === state.playerNationId;
  const truceActive = !atWarWithPlayer && isInTruce(state, state.playerNationId, nation.id);
  // What the trade agreement is doing now: open, cut (where, why, how long) or paying nothing (tradeDisruptions.js).
  const trade = nation.hasTradeAgreement ? tradeRouteStatus(state, nation.id) : null;
  // `nation.isAtWar` is broad — true if they're fighting ANYONE, not just the player. A nation
  // busy elsewhere can't be wooed with a marriage (PROPOSE_MARRIAGE gates on it), but it CAN be
  // attacked or allied with — declaring on it just opens a second front for them.
  const targetEngagedElsewhere = nation.isAtWar && !atWarWithPlayer;
  const theirOtherEnemies = targetEngagedElsewhere
    ? state.wars.filter((w) => w.active && (w.aggressor === nation.id || w.enemy === nation.id))
      .map((w) => { const id = w.aggressor === nation.id ? w.enemy : w.aggressor; return state.nations[id]?.name ? nameNow('people', id, state.nations[id].name) : null; }).filter(Boolean)
    : [];
  const bordersPlayer = getBorderingNationIds(state.regions, state.playerNationId).includes(nation.id);
  const tradePactCapacity = getTradePactCapacity(player);
  const activeTradePactCount = Object.values(state.nations).filter((n) => n.hasTradeAgreement).length;
  // Mirrors gameReducer.js's own MILITARY_ALLIANCE acceptance formula exactly — a silent reducer-
  // side guard the UI previously had no idea existed, so a high-hostility/low-prestige nation would
  // just do nothing when Alliance was tapped.
  const allianceAcceptanceScore = (50 - (nation.hostility || 0)) / 2 + (nation.prestige || 0) / 10 + (nation.hasTradeAgreement ? 20 : 0);
  const canMarry = !atWarWithPlayer
    && !targetEngagedElsewhere
    && player.government?.type === 'monarchy'
    && nation.government?.type === 'monarchy'
    && !(player.marriageWith || []).includes(nation.id);
  const hasDiplomatAssigned = (player.diplomatTasks || []).some((t) => t.targetId === nation.id);
  const canAssignDiplomat = !hasDiplomatAssigned && (player.diplomatTasks || []).length < (player.diplomats || 0);
  const canVassalize = !atWarWithPlayer && !nation.vassalOf && nation.id !== state.playerNationId
    && (nation.hostility || 0) <= VASSALIZE_HOSTILITY_CEILING
    && getEffectiveMilitaryPower(state, state.playerNationId) >= getEffectiveMilitaryPower(state, nation.id) * VASSALIZE_STRENGTH_RATIO;
  const vassalTotalDev = isVassalOfPlayer ? Object.values(state.regions).reduce((s, r) => s + (r.owner === nation.id ? getTotalDev(r) : 0), 0) : 0;
  const annexCost = { dip: Math.round(VASSAL_ANNEX_DIP_PER_DEV * vassalTotalDev) };
  const canAnnex = isVassalOfPlayer && state.turnNumber >= (nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS;

  // Secondary actions only apply in the "at peace, not a vassal" branch — vassal/at-war branches
  // are already short (1-2 buttons) so they never need a "More" toggle.
  const hasSecondary = !isVassalOfPlayer && !atWarWithPlayer;

  const opinion = opinionOf(state, nation.id);
  const breakdown = opinionBreakdown(state, nation.id);
  const allianceAnswer = allianceAcceptanceScore >= 0;
  const tradeBlock = nation.hasTradeAgreement ? null : nation.isAtWar ? t('nc.tradeBlockWar') : activeTradePactCount >= tradePactCapacity ? t('nc.tradeBlockFull', { a: activeTradePactCount, b: tradePactCapacity }) : null;
  const tribute = demandAcceptance(state, nation.id, 'tribute');
  const tributeReason = tribute.reason ? reasonText(tribute) : null;
  const borders = openBordersAcceptance(state, nation.id);
  const bordersOpen = hasOpenBorders(state, player.id, nation.id);
  const metTurn = state.fog?.met?.[state.playerNationId]?.[nation.id];
  // The first refusal worth explaining, with its numbers (rule 4: "would refuse" before trying).
  const refusal = atWarWithPlayer || isVassalOfPlayer ? null
    : !allianceAnswer && !nation.hasMilitaryPact ? t('nc.refusalPact', { opinion, trade: nation.hasTradeAgreement ? '' : t('nc.refusalPactTrade') })
      : !bordersOpen && !borders.accepted ? t('nc.refusalBorders', { opinion: borders.opinion, needed: borders.needed })
        : null;

  return (
    <div className="space-y-2.5" data-testid="nation-card" data-nation={nation.id}>
      {!hideTitle && <div className="flex items-start gap-2">
        <span className="w-3 h-3 rounded-sm mt-1.5 shrink-0" style={{ backgroundColor: nation.color || nationData?.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="fa-heading text-[17px] leading-tight">{nameNow('people', nation.id, nation.name)}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={`fa-chip !min-h-[24px] !px-2 !text-[11px] uppercase tracking-wide ${atWarWithPlayer ? 'text-fa-danger-text border-fa-danger' : nation.hasMilitaryPact ? 'text-fa-good border-fa-good/60' : ''}`}>
              {atWarWithPlayer ? t('nc.status.war') : isVassalOfPlayer ? t('nc.status.vassal') : nation.hasMilitaryPact ? t('nc.status.pact') : nation.hasPeaceTreaty ? t('nc.status.peace') : nation.relationStatus ? (hasKey(`nc.rel.${nation.relationStatus}`, 'en') ? t(`nc.rel.${nation.relationStatus}`) : nation.relationStatus) : t('nc.status.met')}
            </span>
            <span className="fa-chip !min-h-[24px] !px-2 !text-[11px]" data-testid="nation-age" data-age-vs-you={ageVersusPlayer(state, nation.id)}>{t(`p2.pp.age.${ageVersusPlayer(state, nation.id)}`, { age: shortAge(ageOf(state, nation.id)) })}</span>
            <span className="text-[12px] text-fa-muted">{metTurn != null ? t('nc.metT', { n: metTurn }) : t('nc.known')}{nation.doctrine ? `, ${hasKey(`p2.aidoc.${nation.doctrine}`, 'en') ? t(`p2.aidoc.${nation.doctrine}`) : nation.doctrine}` : ''}</span>
          </div>
        </div>
      </div>}

      <div className="fa-card px-3 py-2">
        <details data-testid="opinion">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-2 min-h-[32px]">
            <span className="fa-label">{t('nc.opinionOf')}</span>
            <span className="flex items-baseline gap-2">
              <span className={`fa-num text-[15px] font-semibold ${opinion >= 20 ? 'text-fa-good' : opinion <= -40 ? 'text-fa-danger-text' : 'text-fa-enemy'}`}>{opinion > 0 ? '+' : ''}{opinion}</span>
              <span className="text-[11px] text-fa-you underline">{t('nc.why')}</span>
            </span>
          </summary>
          <ul className="mt-1 space-y-0.5">
            {breakdown.rows.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 text-[12px]"><span className="text-fa-muted">{opinionLabel(r, true)}{r.detail ? ` (${opinionDetail(r)})` : ''}</span><span className={`fa-num ${r.value >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{r.value > 0 ? '+' : ''}{r.value}</span></li>
            ))}
            {breakdown.rounding !== 0 && <li className="flex justify-between gap-2 text-[12px]"><span className="text-fa-muted">{t('nc.rounding')}</span><span className="fa-num">{breakdown.rounding > 0 ? '+' : ''}{breakdown.rounding}</span></li>}
            {breakdown.clamped && <li className="flex justify-between gap-2 text-[12px]"><span className="text-fa-muted">{t('nc.clamped', { end: breakdown.total > 0 ? t('nc.top') : t('nc.bottom'), sum: `${breakdown.sum > 0 ? '+' : ''}${breakdown.sum}` })}</span><span className="fa-num">{breakdown.total > 0 ? '+' : ''}{breakdown.total}</span></li>}
            <li className="flex justify-between gap-2 text-[12px] border-t border-fa-line pt-0.5" data-testid="opinion-total"><span className="text-fa-text">{t('nc.total')}</span><span className="fa-num text-fa-text">{breakdown.total > 0 ? '+' : ''}{breakdown.total}</span></li>
            {breakdown.plain && <li className="text-[11px] text-fa-muted">{t('nc.plain')}</li>}
          </ul>
        </details>
        <div className="relative h-1.5 mt-1 rounded-full bg-fa-ink/60" aria-hidden="true">
          <span className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px bg-fa-muted" />
          <span className={`absolute inset-y-0 rounded-full ${opinion >= 0 ? 'bg-fa-good' : 'bg-fa-danger'}`} style={opinion >= 0 ? { insetInlineStart: '50%', width: `${Math.min(50, opinion / 2)}%` } : { insetInlineEnd: '50%', width: `${Math.min(50, -opinion / 2)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 text-[12px] text-fa-muted mt-1.5">
          <span>{t('nc.army')} {hasIntel(state, nation.id) ? <span className="fa-num text-fa-text">{formatNumber(getFieldedStrength(state, nation.id))}</span> : <span className="fa-num" title={t('nc.armyUnknown')}>?</span>}</span>
          {atWarWithPlayer && <span>{t('nc.warExhaustion')} <span className="fa-num text-fa-text">{Math.round(nation.warExhaustion || 0)}</span></span>}
          {atWarWithPlayer && activeWar && <span>{t('nc.warScore')} <span className={`fa-num ${playerWarScore >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{playerWarScore >= 0 ? '+' : ''}{playerWarScore}</span></span>}
        </div>
      </div>

      {(nation.hasPeaceTreaty || nation.hasTradeAgreement || nation.hasMilitaryPact || bordersOpen || truceActive || isRival || hasDiplomatAssigned || claimsAgainst(state, player.id, nation.id).length > 0 || (player.claimsInProgress || []).some((c) => state.regions[c.cityId]?.owner === nation.id)) && (
        <div className="flex flex-wrap gap-1.5">
          {nation.hasPeaceTreaty && !atWarWithPlayer && <Chip tone="good">{t('nc.peaceTreaty')}</Chip>}
          {nation.hasTradeAgreement && <Chip tone={trade && !trade.pays ? 'enemy' : 'you'} data-testid="trade-chip">{trade && !trade.pays ? (trade.phase === 'cut' ? t('nc.tradeCut') : t('nc.tradeNothing')) : t('nc.tradeAgreement')}</Chip>}
          {nation.hasMilitaryPact && <Chip tone="good">{t('nc.militaryPact')}</Chip>}
          {bordersOpen && <Chip tone="good" data-testid="open-borders-badge">{t('nc.openBorders')}</Chip>}
          {claimsAgainst(state, player.id, nation.id).length > 0 && <Chip data-testid="claim-badge">{t('nc.claimOn', { names: claimsAgainst(state, player.id, nation.id).map((c) => nameNow('city', null, c.name)).join(', ') })}</Chip>}
          {(player.claimsInProgress || []).filter((c) => state.regions[c.cityId]?.owner === nation.id).map((c) => (
            <Chip key={c.cityId}>{t('nc.claimIn', { name: nameNow('city', null, state.regions[c.cityId]?.name), n: Math.max(0, c.done - state.turnNumber) })}</Chip>
          ))}
          {truceActive && <Chip>{t('nc.truceUntil', { n: nation.truces?.[state.playerNationId] })}</Chip>}
          {isRival && <Chip tone="enemy">{t('nc.rival')}</Chip>}
          {hasDiplomatAssigned && <Chip tone="you">{t('nc.diplomatAssigned')}</Chip>}
        </div>
      )}
      {trade && (
        <p className={`text-[12px] ${trade.pays ? 'text-fa-muted' : 'text-fa-danger-text'}`} data-testid="trade-status">{t('nc.tradeRoute', { text: msgRefText(trade.textMsg, trade.text), advice: trade.advice ? ` ${msgRefText(trade.adviceMsg, trade.advice)}` : '' })}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {isVassalOfPlayer ? (
          <>
            <Tile label={t('nc.annex', { n: formatNumber(annexCost.dip) })} sub={canAnnex ? t('nc.annexSub') : t('nc.fromTurn', { n: (nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS })} looksDisabled={!canAnnex || !canAfford(state.resources, annexCost)}
              onClick={() => {
                if (!canAnnex) return addLog(t('nc.cantAnnex', { n: (nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS }), 'action');
                if (!canAfford(state.resources, annexCost)) return addLog(t('nc.notEnoughNeed', { list: describeShortfall(state.resources, annexCost) }), 'action');
                dispatch({ type: ActionTypes.ANNEX_VASSAL, payload: { nationId: nation.id } });
                return undefined;
              }} />
            <Tile label={t('nc.release')} sub={t('nc.releaseSub')} onClick={() => dispatch({ type: ActionTypes.RELEASE_VASSAL, payload: { nationId: nation.id } })} />
          </>
        ) : atWarWithPlayer ? (
          <>
            <Tile label={t('nc.peaceDeal')} sub={t('nc.peaceDealSub')} onClick={() => setPeaceOpen(true)} />
            <Tile label={t('nc.sue', { n: sueForPeaceCosts.gold })} sub={t('nc.sueSub')} looksDisabled={!canAfford(state.resources, sueForPeaceCosts)}
              onClick={() => dispatchIfAffordable(ActionTypes.SUE_FOR_PEACE, sueForPeaceCosts)} />
            <TopLayer>{peaceOpen && activeWar && <PeaceDealSheet warId={activeWar.id} onClose={() => setPeaceOpen(false)} />}</TopLayer>
          </>
        ) : (
          <>
            <Tile label={t('nc.declareWar')} testId="declare-war"
              sub={t('nc.declareSub', { cause: justified ? t('nc.cause') : t('nc.noCause'), cost: formatCost(declareWarCosts), fighting: theirOtherEnemies.length ? t('nc.alreadyFighting', { list: theirOtherEnemies.join(', ') }) : '' })}
              looksDisabled={!canAfford(state.resources, declareWarCosts) || !!player.vassalOf}
              onClick={() => {
                if (player.vassalOf) return addLog(t('nc.vassalNoWar'), 'action');
                if (!canAfford(state.resources, declareWarCosts)) return dispatchIfAffordable(ActionTypes.DECLARE_WAR, declareWarCosts);
                // Two taps: the card shows the cost and the opinion hit first (H-08).
                askConfirm(declareWarConfirm(state, nation.id), () => dispatchIfAffordable(ActionTypes.DECLARE_WAR, declareWarCosts));
                return undefined;
              }} />
            {nation.hasMilitaryPact ? (
              <Tile label={t('nc.breakPact')} sub={t('nc.breakPactSub')} onClick={() => dispatchIfAffordable(ActionTypes.BREAK_ALLIANCE, {})} />
            ) : (
              <Tile label={t('nc.offerPact')} sub={allianceAnswer ? t('nc.wouldAcceptCost', { cost: formatCost(ACTION_COSTS.militaryAlliance) }) : t('nc.wouldRefuse')} refuse={!allianceAnswer} looksDisabled={!canAfford(state.resources, ACTION_COSTS.militaryAlliance)}
                onClick={() => {
                  if (!allianceAnswer) return addLog(t('nc.noAlliance', { name: nameNow('people', nation.id, nation.name) }), 'action');
                  dispatchIfAffordable(ActionTypes.MILITARY_ALLIANCE, ACTION_COSTS.militaryAlliance);
                  return undefined;
                }} />
            )}
            {!nation.hasTradeAgreement && (
              <Tile label={t('nc.trade')} sub={tradeBlock || t('nc.tradeSub', { cost: formatCost(ACTION_COSTS.tradeAgreement), a: activeTradePactCount, b: tradePactCapacity })} refuse={!!tradeBlock} looksDisabled={!canAfford(state.resources, ACTION_COSTS.tradeAgreement)}
                onClick={() => {
                  if (nation.isAtWar) return addLog(t('nc.atWarNoTrade', { name: nameNow('people', nation.id, nation.name) }), 'action');
                  if (activeTradePactCount >= tradePactCapacity) return addLog(t('nc.tradeCapacity', { a: activeTradePactCount, b: tradePactCapacity }), 'action');
                  dispatchIfAffordable(ActionTypes.TRADE_AGREEMENT, ACTION_COSTS.tradeAgreement);
                  return undefined;
                }} />
            )}
            <Tile label={t('nc.demandTribute')} sub={tributeReason || (tribute.accepted ? t('nc.wouldYieldCost', { cost: formatCost(ACTION_COSTS.demand) }) : t('nc.wouldRefuseCause'))} refuse={!tribute.accepted}
              looksDisabled={!!tribute.reason || !canAfford(state.resources, ACTION_COSTS.demand)}
              onClick={() => (tribute.reason ? addLog(tributeReason, 'action') : dispatchIfAffordable(ActionTypes.DEMAND, ACTION_COSTS.demand, { kind: 'tribute', cityId: null }))} />
          </>
        )}
      </div>

      {refusal && <div className="flex items-start gap-2 rounded-lg border border-fa-line bg-fa-ink/40 px-2.5 py-2 text-[12px]" data-testid="refusal-reason"><Ban className="w-3.5 h-3.5 mt-0.5 text-fa-danger-text shrink-0" aria-hidden="true" /><span>{refusal}</span></div>}

      {hasSecondary && <MapTradeBox nation={nation} />}

      {hasSecondary && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="fa-btn fa-btn-ghost fa-btn-sm w-full" aria-expanded={expanded}>
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {expanded ? t('nc.fewer') : t('nc.more')}
        </button>
      )}

      {expanded && hasSecondary && (
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const site = claimableCities(state, player.id, nation.id)[0];
            return (
              <IconButton
                icon={Target}
                label={site ? t('nc.fabricate', { name: nameNow('city', null, site.city.name), cost: formatCost(ACTION_COSTS.fabricateClaim) }) : t('nc.fabricateNone')}
                title={site ? t('nc.fabricateTitle', { name: nameNow('city', null, site.city.name), n: CLAIM_FABRICATE_TURNS }) : t('nc.fabricateNeed', { n: CLAIM_RANGE_RINGS })}
                disabled={!site || !canAfford(state.resources, ACTION_COSTS.fabricateClaim)}
                onClick={() => site && dispatchIfAffordable(ActionTypes.FABRICATE_CLAIM, ACTION_COSTS.fabricateClaim, { cityId: site.city.id })}
              />
            );
          })()}
          {bordersOpen
            ? <IconButton icon={DoorOpen} label={t('nc.closeBorders')} title={t('nc.closeBordersTitle')} onClick={() => dispatch({ type: ActionTypes.CLOSE_BORDERS, payload: { nationId: nation.id } })} />
            : <IconButton icon={DoorOpen} label={t('nc.openBordersLabel', { cost: formatCost(ACTION_COSTS.openBorders), refuse: borders.accepted ? '' : t('nc.wouldRefuseShort') })} title={borders.accepted ? t('nc.openBordersAccept') : t('nc.openBordersRefuse', { opinion: borders.opinion, needed: borders.needed, war: borders.atWar ? t('nc.andAtWar') : '' })} disabled={!canAfford(state.resources, ACTION_COSTS.openBorders)} onClick={() => dispatchIfAffordable(ActionTypes.OPEN_BORDERS, ACTION_COSTS.openBorders)} />}
          {Object.keys(DEMANDS).filter((kind) => kind !== 'tribute').map((kind) => {
            const claimed = kind === 'city' ? claimsAgainst(state, player.id, nation.id).filter((c) => nation.capitalRegionId !== c.id)[0] : null;
            if (kind === 'city' && !claimed) return null;
            const answer = demandAcceptance(state, nation.id, kind, claimed?.id);
            return (
              <IconButton key={kind} icon={Scale} label={t('nc.demandLine', { label: kind === 'city' ? t('nc.demandCity', { name: nameNow('city', null, claimed.name) }) : t(`nc.demandLabel.${kind}`), cost: formatCost(ACTION_COSTS.demand), tail: answer.reason ? '' : answer.accepted ? t('nc.wouldYield') : t('nc.wouldRefuseShort') })}
                title={answer.reason ? reasonText(answer) : t('nc.demandTitleScore', { verdict: answer.accepted ? t('nc.demandTitleYield') : t('nc.demandTitleRefuse'), score: answer.score, ratio: answer.ratio, opinion: answer.opinion })}
                disabled={!!answer.reason || !canAfford(state.resources, ACTION_COSTS.demand)}
                onClick={() => dispatchIfAffordable(ActionTypes.DEMAND, ACTION_COSTS.demand, { kind, cityId: claimed?.id || null })} />
            );
          })}
          <IconButton icon={Gift} label={t('nc.gift', { cost: formatCost(ACTION_COSTS.giftBribe) })} title={t('nc.giftTitle')} disabled={!canAfford(state.resources, ACTION_COSTS.giftBribe)} onClick={() => dispatchIfAffordable(ActionTypes.GIFT_BRIBE, ACTION_COSTS.giftBribe)} />
          <IconButton icon={Eye} label={t('nc.espionage', { cost: formatCost(ACTION_COSTS.espionage) })}
            title={t('nc.espionageTitle', { n: ESPIONAGE_TECH_POINTS_STOLEN, p: Math.round(ESPIONAGE_SUCCESS_CHANCE * 100), t: INTEL_DURATION_TURNS })}
            disabled={!canAfford(state.resources, ACTION_COSTS.espionage)} onClick={() => dispatchIfAffordable(ActionTypes.ESPIONAGE, ACTION_COSTS.espionage)} />
          <IconButton icon={AlertTriangle} label={t('nc.insult')} title={t('nc.insultTitle')} onClick={() => dispatchIfAffordable(ActionTypes.INSULT, {})} />
          <IconButton icon={Target} label={isRival ? t('nc.unrival') : t('nc.rivalN', { a: (player.rivals || []).length, b: MAX_RIVALS })}
            title={isRival ? t('nc.unrivalTitle') : t('nc.rivalTitle')}
            disabled={!isRival && ((player.rivals || []).length >= MAX_RIVALS || !bordersPlayer)}
            onClick={() => {
              if (!isRival && !bordersPlayer) return addLog(t('nc.noBorderRival', { name: nameNow('people', nation.id, nation.name) }), 'action');
              if (!isRival && (player.rivals || []).length >= MAX_RIVALS) return addLog(t('nc.haveRivals', { n: MAX_RIVALS }), 'action');
              dispatchIfAffordable(isRival ? ActionTypes.UNRIVAL_NATION : ActionTypes.RIVAL_NATION, {});
              return undefined;
            }} />
          {canMarry && <IconButton icon={Heart} label={t('nc.marriage', { cost: formatCost(ACTION_COSTS.proposeMarriage) })} title={t('nc.marriageTitle')} disabled={!canAfford(state.resources, ACTION_COSTS.proposeMarriage)} onClick={() => dispatchIfAffordable(ActionTypes.PROPOSE_MARRIAGE, ACTION_COSTS.proposeMarriage)} />}
          {hasDiplomatAssigned ? (
            <IconButton icon={Users} label={t('nc.recall')} onClick={() => dispatch({ type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: nation.id } })} />
          ) : (
            <IconButton icon={Users} label={t('nc.assign', { cost: formatCost(ACTION_COSTS.assignDiplomat) })}
              title={t('nc.assignTitle', { a: (player.diplomatTasks || []).length, b: player.diplomats || 0 })}
              disabled={!canAssignDiplomat || !canAfford(state.resources, ACTION_COSTS.assignDiplomat)}
              onClick={() => {
                if (!canAssignDiplomat) return addLog(t('nc.noDiplomats', { a: (player.diplomatTasks || []).length, b: player.diplomats || 0 }), 'action');
                dispatchIfAffordable(ActionTypes.ASSIGN_DIPLOMAT, ACTION_COSTS.assignDiplomat);
                return undefined;
              }} />
          )}
          {canVassalize && <IconButton icon={Crown} label={t('nc.vassalize', { cost: formatCost(ACTION_COSTS.vassalize) })} title={t('nc.vassalizeTitle')} disabled={!canAfford(state.resources, ACTION_COSTS.vassalize)} onClick={() => dispatchIfAffordable(ActionTypes.VASSALIZE, ACTION_COSTS.vassalize)} />}
        </div>
      )}
    </div>
  );
};

export default NationCard;
