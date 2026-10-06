// src/components/panels/NationCard.jsx
// One nation's relation card (plans/civ-map-rework.md E4: the nation sheet reuses it, the Diplomacy
// tab lists one per nation). Local `expanded` state gates the long tail of secondary actions
// behind a "More" toggle; 1-2 primary actions always stay visible.
import React, { useState } from 'react';
import { Swords, Target, HeartHandshake, ShieldCheck, Gift, Flag, Eye, Heart, Users, Crown, Unlock, Ban, AlertTriangle, ChevronDown, ChevronUp, DoorOpen, Scale
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
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
import { canAfford, formatNumber, getRelationColor, getFieldedStrength } from '../../utils/helpers';
import { hasIntel } from '../../engine/intel';
import { opinionOf, opinionReasons } from '../../engine/opinion';
import { getEffectiveMilitaryPower } from '../../engine/aiEconomy';
import { claimsAgainst, claimableCities, CLAIM_FABRICATE_TURNS, CLAIM_RANGE_RINGS } from '../../engine/claims';
import { hasOpenBorders, openBordersAcceptance, demandAcceptance, DEMANDS } from '../../engine/accords';

// Plan feedback ("I don't understand why I can't start a war, I have plenty of resources"): the
// player was reading the top-bar Gold total and assuming that meant "affordable," when most
// diplomacy actions are actually gated on ADM/DIP/MIL power (separate, far scarcer pools —
// src/components/ui/ResourceBar.jsx's adm/dip/mil badges) rather than gold. `formatCost` puts the
// real price directly in the button label (matching the pattern "Sue for Peace (200g)"/"Annex (…
// DIP)" already used below), and `describeShortfall` turns a failed dispatchIfAffordable into a
// specific reason instead of a generic "Not enough resources" — both readable without a hover
// tooltip, which mobile touch has no equivalent of.

const RESOURCE_SHORT_LABEL = { gold: 'g', dip: 'DIP', adm: 'ADM', mil: 'MIL' };
const formatCost = (costs) => Object.entries(costs)
  .filter(([, amount]) => amount > 0)
  .map(([key, amount]) => `${formatNumber(amount)}${RESOURCE_SHORT_LABEL[key] || key}`)
  .join(' ');
const describeShortfall = (resources, costs) => Object.entries(costs)
  .filter(([key, amount]) => (resources[key] || 0) < amount)
  .map(([key, amount]) => `${formatNumber(amount)}${RESOURCE_SHORT_LABEL[key] || key} (have ${formatNumber(resources[key] || 0)})`)
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
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] ${
      looksDisabled ? 'bg-slate-800 text-slate-500' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
    }`}
  >
    <Icon size={11} />
    {label}
  </button>
);



// One nation's relation card. Local `expanded` state gates the long tail of secondary actions
// behind a "More" toggle (plan feedback) — 1-2 primary actions (whichever is relevant to the
// current relationship) always stay visible.
export const NationCard = ({ nation }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [expanded, setExpanded] = useState(false);
  const [peaceOpen, setPeaceOpen] = useState(false);

  const dispatchIfAffordable = (type, costs, extra = {}) => {
    if (!canAfford(state.resources, costs)) return addLog(`Not enough resources — need ${describeShortfall(state.resources, costs)}`, 'action');
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
  // `nation.isAtWar` is broad — true if they're fighting ANYONE, not just the player. A nation
  // busy elsewhere can't be wooed with a marriage (PROPOSE_MARRIAGE gates on it), but it CAN be
  // attacked or allied with — declaring on it just opens a second front for them.
  const targetEngagedElsewhere = nation.isAtWar && !atWarWithPlayer;
  const theirOtherEnemies = targetEngagedElsewhere
    ? state.wars.filter((w) => w.active && (w.aggressor === nation.id || w.enemy === nation.id))
      .map((w) => state.nations[w.aggressor === nation.id ? w.enemy : w.aggressor]?.name).filter(Boolean)
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

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all
        ${atWarWithPlayer
          ? 'bg-red-500/10 border-red-500/30'
          : nation.hasPeaceTreaty
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-slate-800/50 border-slate-700'
        }
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-sm text-white flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nation.color || nationData?.color }} />
            {nation.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-medium" style={{ color: getRelationColor(nation.relationStatus) }}>
              {nation.relationStatus}
            </span>
            {nation.doctrine && (
              <span className="text-[9px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1">
                {nation.doctrine}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          <details className="text-slate-400" data-testid="opinion">
            <summary className="cursor-pointer list-none">Opinion: <span className={`font-mono ${opinionOf(state, nation.id) >= 20 ? 'text-emerald-300' : opinionOf(state, nation.id) <= -40 ? 'text-red-400' : 'text-orange-300'}`}>{opinionOf(state, nation.id) > 0 ? '+' : ''}{opinionOf(state, nation.id)}</span></summary>
            <ul className="mt-1 text-left text-[10px] space-y-0.5">
              {opinionReasons(state, nation.id).map((r) => (
                <li key={r.id} className="flex justify-between gap-2"><span>{r.label}{r.detail ? ` (${r.detail})` : ''}</span><span className={`font-mono ${r.value >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{r.value > 0 ? '+' : ''}{r.value}</span></li>
              ))}
            </ul>
          </details>
          <div className="text-slate-400">
            Military: {hasIntel(state, nation.id)
              ? <span className="text-red-400 font-mono">{formatNumber(getFieldedStrength(state, nation.id))}</span>
              : <span className="text-slate-500 font-mono" title="Unknown — a successful espionage op reveals it">?</span>}
          </div>
          {atWarWithPlayer && (
            <div className="text-slate-400">
              War Exhaustion: <span className="text-amber-400 font-mono">{nation.warExhaustion || 0}</span>
            </div>
          )}
          {atWarWithPlayer && activeWar && (
            <div className="text-slate-400">
              War Score: <span className={`font-mono ${playerWarScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>{playerWarScore >= 0 ? '+' : ''}{playerWarScore}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {nation.hasPeaceTreaty && (
          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">✓ Peace Treaty</span>
        )}
        {nation.hasTradeAgreement && (
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">✓ Trade Agreement</span>
        )}
        {nation.hasMilitaryPact && (
          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">✓ Military Pact</span>
        )}
        {hasOpenBorders(state, player.id, nation.id) && (
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]" data-testid="open-borders-badge">Open borders</span>
        )}
        {claimsAgainst(state, player.id, nation.id).length > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]" data-testid="claim-badge">Claim on {claimsAgainst(state, player.id, nation.id).map((c) => c.name).join(', ')}</span>
        )}
        {(player.claimsInProgress || []).filter((c) => state.regions[c.cityId]?.owner === nation.id).map((c) => (
          <span key={c.cityId} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded text-[10px]">Claim on {state.regions[c.cityId]?.name} in {Math.max(0, c.done - state.turnNumber)} turns</span>
        ))}
        {atWarWithPlayer && (
          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">⚔ AT WAR</span>
        )}
        {truceActive && (
          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px]">Truce (turn {nation.truces?.[state.playerNationId]})</span>
        )}
        {isRival && (
          <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px]">Rival</span>
        )}
        {isVassalOfPlayer && (
          <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded text-[10px]">Your Vassal</span>
        )}
        {hasDiplomatAssigned && (
          <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px]">Diplomat assigned</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 items-center">
        {isVassalOfPlayer ? (
          <>
            <IconButton
              icon={Crown}
              label={`Annex (${formatNumber(annexCost.dip)} DIP)`}
              title={canAnnex ? 'Absorb this vassal\'s territory into your realm' : `Available turn ${(nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS}`}
              disabled={!canAnnex || !canAfford(state.resources, annexCost)}
              onClick={() => {
                if (!canAnnex) return addLog(`Can't annex yet — available turn ${(nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS}`, 'action');
                if (!canAfford(state.resources, annexCost)) return addLog(`Not enough resources — need ${describeShortfall(state.resources, annexCost)}`, 'action');
                dispatch({ type: ActionTypes.ANNEX_VASSAL, payload: { nationId: nation.id } });
              }}
            />
            <IconButton icon={Unlock} label="Release" onClick={() => dispatch({ type: ActionTypes.RELEASE_VASSAL, payload: { nationId: nation.id } })} />
          </>
        ) : atWarWithPlayer ? (
          <>
            <IconButton
              icon={HeartHandshake}
              label="Peace deal"
              title="Negotiate terms — demand the land you occupy to make it yours"
              onClick={() => setPeaceOpen(true)}
            />
            <IconButton
              icon={Flag}
              label={`Sue for Peace (${sueForPeaceCosts.gold}g)`}
              title="End the war with a white peace — you give up any land you occupy"
              disabled={!canAfford(state.resources, sueForPeaceCosts)}
              onClick={() => dispatchIfAffordable(ActionTypes.SUE_FOR_PEACE, sueForPeaceCosts)}
            />
            <TopLayer>{peaceOpen && activeWar && <PeaceDealSheet warId={activeWar.id} onClose={() => setPeaceOpen(false)} />}</TopLayer>
          </>
        ) : (
          <>
            {/* Primary actions — always visible */}
            <IconButton
              icon={Swords}
              label={`${justified ? 'Declare War' : 'Declare War (unjustified)'} (${formatCost(declareWarCosts)})`}
              title={`${justified ? 'A casus belli justifies this war' : 'No casus belli — costs more and hurts relations'}${theirOtherEnemies.length ? ` · already fighting ${theirOtherEnemies.join(', ')} — you'd open a second front` : ''}`}
              disabled={!canAfford(state.resources, declareWarCosts) || !!player.vassalOf}
              onClick={() => {
                if (player.vassalOf) return addLog("Can't declare war while you're a vassal", 'action');
                dispatchIfAffordable(ActionTypes.DECLARE_WAR, declareWarCosts);
              }}
            />
            {nation.hasMilitaryPact ? (
              <IconButton
                icon={Ban}
                label="Break Alliance"
                title="Ends the pact — raises their hostility"
                onClick={() => dispatchIfAffordable(ActionTypes.BREAK_ALLIANCE, {})}
              />
            ) : (
              <IconButton
                icon={ShieldCheck}
                label={`Alliance (${formatCost(ACTION_COSTS.militaryAlliance)})`}
                title="Acceptance scores hostility, prestige, and any existing trade agreement"
                disabled={!canAfford(state.resources, ACTION_COSTS.militaryAlliance) || allianceAcceptanceScore < 0}
                onClick={() => {
                  if (allianceAcceptanceScore < 0) return addLog(`${nation.name} won't accept an alliance yet — needs lower hostility or more of your prestige`, 'action');
                  dispatchIfAffordable(ActionTypes.MILITARY_ALLIANCE, ACTION_COSTS.militaryAlliance);
                }}
              />
            )}

            {hasSecondary && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px]"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? 'Less' : 'More'}
              </button>
            )}

            {expanded && (
              <>
                {(() => {
                  const site = claimableCities(state, player.id, nation.id)[0];
                  return (
                    <IconButton
                      icon={Target}
                      label={site ? `Fabricate claim on ${site.city.name} (${formatCost(ACTION_COSTS.fabricateClaim)})` : 'Fabricate claim (no city in reach)'}
                      title={site ? `A casus belli for ${site.city.name}, ready in ${CLAIM_FABRICATE_TURNS} turns` : `A claim needs one of their cities within ${CLAIM_RANGE_RINGS} tiles of your border`}
                      disabled={!site || !canAfford(state.resources, ACTION_COSTS.fabricateClaim)}
                      onClick={() => site && dispatchIfAffordable(ActionTypes.FABRICATE_CLAIM, ACTION_COSTS.fabricateClaim, { cityId: site.city.id })}
                    />
                  );
                })()}
                {(() => {
                  const open = hasOpenBorders(state, player.id, nation.id);
                  const answer = openBordersAcceptance(state, nation.id);
                  return open
                    ? <IconButton icon={DoorOpen} label="Close borders" title="Your armies, settlers and traders lose passage through their land, and theirs through yours" onClick={() => dispatch({ type: ActionTypes.CLOSE_BORDERS, payload: { nationId: nation.id } })} />
                    : <IconButton icon={DoorOpen} label={`Open borders (${formatCost(ACTION_COSTS.openBorders)})`} title={answer.accepted ? 'They would accept: passage for armies, settlers and trade both ways, +10 opinion' : `They would refuse today (opinion ${answer.opinion}, needs ${answer.needed}${answer.atWar ? ', and you are at war' : ''})`} disabled={!canAfford(state.resources, ACTION_COSTS.openBorders)} onClick={() => dispatchIfAffordable(ActionTypes.OPEN_BORDERS, ACTION_COSTS.openBorders)} />;
                })()}
                {Object.entries(DEMANDS).map(([kind, d]) => {
                  const claimed = kind === 'city' ? claimsAgainst(state, player.id, nation.id).filter((c) => nation.capitalRegionId !== c.id)[0] : null;
                  if (kind === 'city' && !claimed) return null;
                  const answer = demandAcceptance(state, nation.id, kind, claimed?.id);
                  return (
                    <IconButton key={kind} icon={Scale} label={`${kind === 'city' ? `Demand ${claimed.name}` : d.label} (${formatCost(ACTION_COSTS.demand)})`}
                      title={answer.reason || `${answer.accepted ? 'They would yield' : 'They would refuse, giving you a casus belli'} (score ${answer.score}: strength x${answer.ratio}, opinion ${answer.opinion})`}
                      disabled={!!answer.reason || !canAfford(state.resources, ACTION_COSTS.demand)}
                      onClick={() => dispatchIfAffordable(ActionTypes.DEMAND, ACTION_COSTS.demand, { kind, cityId: claimed?.id || null })} />
                  );
                })}
                {!nation.hasTradeAgreement && (
                  <IconButton
                    icon={HeartHandshake}
                    label={`Trade Agreement (${formatCost(ACTION_COSTS.tradeAgreement)})`}
                    title={`Trade pacts in use: ${activeTradePactCount}/${tradePactCapacity}`}
                    disabled={!canAfford(state.resources, ACTION_COSTS.tradeAgreement) || nation.isAtWar || activeTradePactCount >= tradePactCapacity}
                    onClick={() => {
                      if (nation.isAtWar) return addLog(`${nation.name} is at war and won't sign a trade agreement`, 'action');
                      if (activeTradePactCount >= tradePactCapacity) return addLog(`Already at your trade pact capacity (${activeTradePactCount}/${tradePactCapacity})`, 'action');
                      dispatchIfAffordable(ActionTypes.TRADE_AGREEMENT, ACTION_COSTS.tradeAgreement);
                    }}
                  />
                )}
                <IconButton
                  icon={Gift}
                  label={`Gift (${formatCost(ACTION_COSTS.giftBribe)})`}
                  title="Reduces hostility"
                  disabled={!canAfford(state.resources, ACTION_COSTS.giftBribe)}
                  onClick={() => dispatchIfAffordable(ActionTypes.GIFT_BRIBE, ACTION_COSTS.giftBribe)}
                />
                <IconButton
                  icon={Eye}
                  label={`Espionage (${formatCost(ACTION_COSTS.espionage)})`}
                  title={`Steal ${ESPIONAGE_TECH_POINTS_STOLEN} Tech Points (${Math.round(ESPIONAGE_SUCCESS_CHANCE * 100)}% chance) and reveal their provinces and army for ${INTEL_DURATION_TURNS} turns — if caught, hostility rises`}
                  disabled={!canAfford(state.resources, ACTION_COSTS.espionage)}
                  onClick={() => dispatchIfAffordable(ActionTypes.ESPIONAGE, ACTION_COSTS.espionage)}
                />
                <IconButton
                  icon={AlertTriangle}
                  label="Insult"
                  title="Free — raises their hostility, for rivalries"
                  onClick={() => dispatchIfAffordable(ActionTypes.INSULT, {})}
                />
                <IconButton
                  icon={Target}
                  label={isRival ? 'Unrival' : `Rival (${(player.rivals || []).length}/${MAX_RIVALS})`}
                  title={isRival ? 'Stop treating them as a rival' : 'Must border you — a fallen rival grants prestige'}
                  disabled={!isRival && ((player.rivals || []).length >= MAX_RIVALS || !bordersPlayer)}
                  onClick={() => {
                    if (!isRival && !bordersPlayer) return addLog(`${nation.name} doesn't border you — can't become a rival`, 'action');
                    if (!isRival && (player.rivals || []).length >= MAX_RIVALS) return addLog(`Already have ${MAX_RIVALS} rivals`, 'action');
                    dispatchIfAffordable(isRival ? ActionTypes.UNRIVAL_NATION : ActionTypes.RIVAL_NATION, {});
                  }}
                />
                {canMarry && (
                  <IconButton
                    icon={Heart}
                    label={`Royal Marriage (${formatCost(ACTION_COSTS.proposeMarriage)})`}
                    title="Both monarchies: reduces their hostility"
                    disabled={!canAfford(state.resources, ACTION_COSTS.proposeMarriage)}
                    onClick={() => dispatchIfAffordable(ActionTypes.PROPOSE_MARRIAGE, ACTION_COSTS.proposeMarriage)}
                  />
                )}
                {hasDiplomatAssigned ? (
                  <IconButton icon={Users} label="Recall Diplomat" onClick={() => dispatch({ type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: nation.id } })} />
                ) : (
                  <IconButton
                    icon={Users}
                    label={`Assign Diplomat (${formatCost(ACTION_COSTS.assignDiplomat)})`}
                    title={`Improve Relations — ${(player.diplomatTasks || []).length}/${player.diplomats || 0} diplomats in use`}
                    disabled={!canAssignDiplomat || !canAfford(state.resources, ACTION_COSTS.assignDiplomat)}
                    onClick={() => {
                      if (!canAssignDiplomat) return addLog(`No free diplomats (${(player.diplomatTasks || []).length}/${player.diplomats || 0} in use)`, 'action');
                      dispatchIfAffordable(ActionTypes.ASSIGN_DIPLOMAT, ACTION_COSTS.assignDiplomat);
                    }}
                  />
                )}
                {canVassalize && (
                  <IconButton
                    icon={Crown}
                    label={`Vassalize (${formatCost(ACTION_COSTS.vassalize)})`}
                    title="Low hostility and overwhelming strength required"
                    disabled={!canAfford(state.resources, ACTION_COSTS.vassalize)}
                    onClick={() => dispatchIfAffordable(ActionTypes.VASSALIZE, ACTION_COSTS.vassalize)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NationCard;
