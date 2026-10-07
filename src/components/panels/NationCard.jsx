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

const RESOURCE_SHORT_LABEL = { gold: ' gold', dip: ' DIP', adm: ' ADM', mil: ' MIL' };
const formatCost = (costs) => Object.entries(costs)
  .filter(([, amount]) => amount > 0)
  .map(([key, amount]) => `${formatNumber(amount)}${RESOURCE_SHORT_LABEL[key] || key}`)
  .join(', ');
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
  <button type="button" onClick={onClick} title={title} className={`fa-chip gap-1.5 ${looksDisabled ? 'opacity-55' : ''}`}>
    <Icon size={13} aria-hidden="true" />
    {label}
  </button>
);

// A main action as a tile (W07): what it is and, below, its price or the answer they would give.
// "Would refuse" draws a dashed danger border; the tile still reacts and explains (never disabled).
const Tile = ({ label, sub, onClick, refuse, looksDisabled, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className={`text-left rounded-lg border px-2.5 py-2 min-h-[52px] hover:bg-fa-hover transition-colors ${refuse ? 'border-dashed border-fa-danger bg-fa-ink/30' : 'border-fa-line bg-fa-raised'} ${looksDisabled ? 'opacity-60' : ''}`}>
    <span className="block text-[13px] font-semibold leading-tight text-fa-text">{label}</span>
    {sub && <span className={`block text-[11px] leading-tight mt-0.5 ${refuse ? 'text-fa-danger-text' : 'text-fa-muted'}`}>{sub}</span>}
  </button>
);

// One nation's relation card. Local `expanded` state gates the long tail of secondary actions
// behind a "More" toggle (plan feedback) — 1-2 primary actions (whichever is relevant to the
// current relationship) always stay visible.
export const NationCard = ({ nation, hideTitle = false }) => {
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

  const opinion = opinionOf(state, nation.id);
  const allianceAnswer = allianceAcceptanceScore >= 0;
  const tradeBlock = nation.hasTradeAgreement ? null : nation.isAtWar ? 'At war: no trade' : activeTradePactCount >= tradePactCapacity ? `No free trade pact (${activeTradePactCount} of ${tradePactCapacity} in use)` : null;
  const tribute = demandAcceptance(state, nation.id, 'tribute');
  const borders = openBordersAcceptance(state, nation.id);
  const bordersOpen = hasOpenBorders(state, player.id, nation.id);
  const metTurn = state.fog?.met?.[state.playerNationId]?.[nation.id];
  // The first refusal worth explaining, with its numbers (rule 4: "would refuse" before trying).
  const refusal = atWarWithPlayer || isVassalOfPlayer ? null
    : !allianceAnswer && !nation.hasMilitaryPact ? `Pact: their opinion is ${opinion}; an alliance needs less hostility or more of your prestige${nation.hasTradeAgreement ? '' : ', and a trade agreement helps'}.`
      : !bordersOpen && !borders.accepted ? `Open borders: opinion ${borders.opinion}, needs ${borders.needed}.`
        : null;

  return (
    <div className="space-y-2.5" data-testid="nation-card" data-nation={nation.id}>
      {!hideTitle && <div className="flex items-start gap-2">
        <span className="w-3 h-3 rounded-sm mt-1.5 shrink-0" style={{ backgroundColor: nation.color || nationData?.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="fa-heading text-[17px] leading-tight">{nation.name}</div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={`fa-chip !min-h-[24px] !px-2 !text-[11px] uppercase tracking-wide ${atWarWithPlayer ? 'text-fa-danger-text border-fa-danger' : nation.hasMilitaryPact ? 'text-fa-good border-fa-good/60' : ''}`}>
              {atWarWithPlayer ? 'At war' : isVassalOfPlayer ? 'Your vassal' : nation.hasMilitaryPact ? 'Pact' : nation.hasPeaceTreaty ? 'At peace' : nation.relationStatus || 'Met'}
            </span>
            <span className="text-[12px] text-fa-muted">{metTurn != null ? `Met T${metTurn}` : 'Known'}{nation.doctrine ? `, ${nation.doctrine}` : ''}</span>
          </div>
        </div>
      </div>}

      <div className="fa-card px-3 py-2">
        <details data-testid="opinion">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-2 min-h-[32px]">
            <span className="fa-label">Opinion of you</span>
            <span className="flex items-baseline gap-2">
              <span className={`fa-num text-[15px] font-semibold ${opinion >= 20 ? 'text-fa-good' : opinion <= -40 ? 'text-fa-danger-text' : 'text-fa-enemy'}`}>{opinion > 0 ? '+' : ''}{opinion}</span>
              <span className="text-[11px] text-fa-you underline">Why?</span>
            </span>
          </summary>
          <ul className="mt-1 space-y-0.5">
            {opinionReasons(state, nation.id).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 text-[12px]"><span className="text-fa-muted">{r.label}{r.detail ? ` (${r.detail})` : ''}</span><span className={`fa-num ${r.value >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{r.value > 0 ? '+' : ''}{r.value}</span></li>
            ))}
          </ul>
        </details>
        <div className="relative h-1.5 mt-1 rounded-full bg-fa-ink/60" aria-hidden="true">
          <span className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px bg-fa-muted" />
          <span className={`absolute inset-y-0 rounded-full ${opinion >= 0 ? 'bg-fa-good' : 'bg-fa-danger'}`} style={opinion >= 0 ? { left: '50%', width: `${Math.min(50, opinion / 2)}%` } : { right: '50%', width: `${Math.min(50, -opinion / 2)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 text-[12px] text-fa-muted mt-1.5">
          <span>Army: {hasIntel(state, nation.id) ? <span className="fa-num text-fa-text">{formatNumber(getFieldedStrength(state, nation.id))}</span> : <span className="fa-num" title="Unknown: a successful espionage op reveals it">?</span>}</span>
          {atWarWithPlayer && <span>War exhaustion <span className="fa-num text-fa-text">{nation.warExhaustion || 0}</span></span>}
          {atWarWithPlayer && activeWar && <span>War score <span className={`fa-num ${playerWarScore >= 0 ? 'text-fa-good' : 'text-fa-danger-text'}`}>{playerWarScore >= 0 ? '+' : ''}{playerWarScore}</span></span>}
        </div>
      </div>

      {(nation.hasPeaceTreaty || nation.hasTradeAgreement || nation.hasMilitaryPact || bordersOpen || truceActive || isRival || hasDiplomatAssigned || claimsAgainst(state, player.id, nation.id).length > 0 || (player.claimsInProgress || []).some((c) => state.regions[c.cityId]?.owner === nation.id)) && (
        <div className="flex flex-wrap gap-1.5">
          {nation.hasPeaceTreaty && <Chip tone="good">Peace treaty</Chip>}
          {nation.hasTradeAgreement && <Chip tone="you">Trade agreement</Chip>}
          {nation.hasMilitaryPact && <Chip tone="good">Military pact</Chip>}
          {bordersOpen && <Chip tone="good" data-testid="open-borders-badge">Open borders</Chip>}
          {claimsAgainst(state, player.id, nation.id).length > 0 && <Chip data-testid="claim-badge">Claim on {claimsAgainst(state, player.id, nation.id).map((c) => c.name).join(', ')}</Chip>}
          {(player.claimsInProgress || []).filter((c) => state.regions[c.cityId]?.owner === nation.id).map((c) => (
            <Chip key={c.cityId}>Claim on {state.regions[c.cityId]?.name} in {Math.max(0, c.done - state.turnNumber)} turns</Chip>
          ))}
          {truceActive && <Chip>Truce until turn {nation.truces?.[state.playerNationId]}</Chip>}
          {isRival && <Chip tone="enemy">Rival</Chip>}
          {hasDiplomatAssigned && <Chip tone="you">Diplomat assigned</Chip>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {isVassalOfPlayer ? (
          <>
            <Tile label={`Annex (${formatNumber(annexCost.dip)} DIP)`} sub={canAnnex ? 'Their land becomes yours' : `From turn ${(nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS}`} looksDisabled={!canAnnex || !canAfford(state.resources, annexCost)}
              onClick={() => {
                if (!canAnnex) return addLog(`Can't annex yet: available turn ${(nation.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS}`, 'action');
                if (!canAfford(state.resources, annexCost)) return addLog(`Not enough resources: need ${describeShortfall(state.resources, annexCost)}`, 'action');
                dispatch({ type: ActionTypes.ANNEX_VASSAL, payload: { nationId: nation.id } });
                return undefined;
              }} />
            <Tile label="Release" sub="They go free" onClick={() => dispatch({ type: ActionTypes.RELEASE_VASSAL, payload: { nationId: nation.id } })} />
          </>
        ) : atWarWithPlayer ? (
          <>
            <Tile label="Peace deal" sub="Demand the land you hold" onClick={() => setPeaceOpen(true)} />
            <Tile label={`Sue for peace (${sueForPeaceCosts.gold} gold)`} sub="White peace: you give up the land you hold" looksDisabled={!canAfford(state.resources, sueForPeaceCosts)}
              onClick={() => dispatchIfAffordable(ActionTypes.SUE_FOR_PEACE, sueForPeaceCosts)} />
            <TopLayer>{peaceOpen && activeWar && <PeaceDealSheet warId={activeWar.id} onClose={() => setPeaceOpen(false)} />}</TopLayer>
          </>
        ) : (
          <>
            <Tile label="Declare war" testId="declare-war"
              sub={`${justified ? 'Casus belli' : 'No casus belli: costs more, hurts relations'}, ${formatCost(declareWarCosts)}${theirOtherEnemies.length ? `. Already fighting ${theirOtherEnemies.join(', ')}` : ''}`}
              looksDisabled={!canAfford(state.resources, declareWarCosts) || !!player.vassalOf}
              onClick={() => {
                if (player.vassalOf) return addLog("Can't declare war while you're a vassal", 'action');
                dispatchIfAffordable(ActionTypes.DECLARE_WAR, declareWarCosts);
                return undefined;
              }} />
            {nation.hasMilitaryPact ? (
              <Tile label="Break the pact" sub="Their hostility rises" onClick={() => dispatchIfAffordable(ActionTypes.BREAK_ALLIANCE, {})} />
            ) : (
              <Tile label="Offer pact" sub={allianceAnswer ? `Would accept, ${formatCost(ACTION_COSTS.militaryAlliance)}` : 'Would refuse'} refuse={!allianceAnswer} looksDisabled={!canAfford(state.resources, ACTION_COSTS.militaryAlliance)}
                onClick={() => {
                  if (!allianceAnswer) return addLog(`${nation.name} won't accept an alliance yet: needs lower hostility or more of your prestige`, 'action');
                  dispatchIfAffordable(ActionTypes.MILITARY_ALLIANCE, ACTION_COSTS.militaryAlliance);
                  return undefined;
                }} />
            )}
            {!nation.hasTradeAgreement && (
              <Tile label="Trade" sub={tradeBlock || `${formatCost(ACTION_COSTS.tradeAgreement)}; ${activeTradePactCount} of ${tradePactCapacity} pacts in use`} refuse={!!tradeBlock} looksDisabled={!canAfford(state.resources, ACTION_COSTS.tradeAgreement)}
                onClick={() => {
                  if (nation.isAtWar) return addLog(`${nation.name} is at war and won't sign a trade agreement`, 'action');
                  if (activeTradePactCount >= tradePactCapacity) return addLog(`Already at your trade pact capacity (${activeTradePactCount}/${tradePactCapacity})`, 'action');
                  dispatchIfAffordable(ActionTypes.TRADE_AGREEMENT, ACTION_COSTS.tradeAgreement);
                  return undefined;
                }} />
            )}
            <Tile label="Demand tribute" sub={tribute.reason || (tribute.accepted ? `Would yield, ${formatCost(ACTION_COSTS.demand)}` : 'Would refuse: a casus belli for you')} refuse={!tribute.accepted}
              looksDisabled={!!tribute.reason || !canAfford(state.resources, ACTION_COSTS.demand)}
              onClick={() => (tribute.reason ? addLog(tribute.reason, 'action') : dispatchIfAffordable(ActionTypes.DEMAND, ACTION_COSTS.demand, { kind: 'tribute', cityId: null }))} />
          </>
        )}
      </div>

      {refusal && <div className="flex items-start gap-2 rounded-lg border border-fa-line bg-fa-ink/40 px-2.5 py-2 text-[12px]" data-testid="refusal-reason"><Ban className="w-3.5 h-3.5 mt-0.5 text-fa-danger-text shrink-0" aria-hidden="true" /><span>{refusal}</span></div>}

      {hasSecondary && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="fa-btn fa-btn-ghost fa-btn-sm w-full" aria-expanded={expanded}>
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {expanded ? 'Fewer actions' : 'More actions'}
        </button>
      )}

      {expanded && hasSecondary && (
        <div className="flex flex-wrap gap-1.5">
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
          {bordersOpen
            ? <IconButton icon={DoorOpen} label="Close borders" title="Your armies, settlers and traders lose passage through their land, and theirs through yours" onClick={() => dispatch({ type: ActionTypes.CLOSE_BORDERS, payload: { nationId: nation.id } })} />
            : <IconButton icon={DoorOpen} label={`Open borders (${formatCost(ACTION_COSTS.openBorders)})${borders.accepted ? '' : ': would refuse'}`} title={borders.accepted ? 'They would accept: passage for armies, settlers and trade both ways, +10 opinion' : `They would refuse today (opinion ${borders.opinion}, needs ${borders.needed}${borders.atWar ? ', and you are at war' : ''})`} disabled={!canAfford(state.resources, ACTION_COSTS.openBorders)} onClick={() => dispatchIfAffordable(ActionTypes.OPEN_BORDERS, ACTION_COSTS.openBorders)} />}
          {Object.entries(DEMANDS).filter(([kind]) => kind !== 'tribute').map(([kind, d]) => {
            const claimed = kind === 'city' ? claimsAgainst(state, player.id, nation.id).filter((c) => nation.capitalRegionId !== c.id)[0] : null;
            if (kind === 'city' && !claimed) return null;
            const answer = demandAcceptance(state, nation.id, kind, claimed?.id);
            return (
              <IconButton key={kind} icon={Scale} label={`${kind === 'city' ? `Demand ${claimed.name}` : d.label} (${formatCost(ACTION_COSTS.demand)})${answer.reason ? '' : answer.accepted ? ': would yield' : ': would refuse'}`}
                title={answer.reason || `${answer.accepted ? 'They would yield' : 'They would refuse, giving you a casus belli'} (score ${answer.score}: strength x${answer.ratio}, opinion ${answer.opinion})`}
                disabled={!!answer.reason || !canAfford(state.resources, ACTION_COSTS.demand)}
                onClick={() => dispatchIfAffordable(ActionTypes.DEMAND, ACTION_COSTS.demand, { kind, cityId: claimed?.id || null })} />
            );
          })}
          <IconButton icon={Gift} label={`Gift (${formatCost(ACTION_COSTS.giftBribe)})`} title="Lowers their hostility" disabled={!canAfford(state.resources, ACTION_COSTS.giftBribe)} onClick={() => dispatchIfAffordable(ActionTypes.GIFT_BRIBE, ACTION_COSTS.giftBribe)} />
          <IconButton icon={Eye} label={`Espionage (${formatCost(ACTION_COSTS.espionage)})`}
            title={`Steal ${ESPIONAGE_TECH_POINTS_STOLEN} science (${Math.round(ESPIONAGE_SUCCESS_CHANCE * 100)}% chance) and see their cities and army for ${INTEL_DURATION_TURNS} turns; if caught, hostility rises`}
            disabled={!canAfford(state.resources, ACTION_COSTS.espionage)} onClick={() => dispatchIfAffordable(ActionTypes.ESPIONAGE, ACTION_COSTS.espionage)} />
          <IconButton icon={AlertTriangle} label="Insult" title="Free; raises their hostility, for rivalries" onClick={() => dispatchIfAffordable(ActionTypes.INSULT, {})} />
          <IconButton icon={Target} label={isRival ? 'Unrival' : `Rival (${(player.rivals || []).length}/${MAX_RIVALS})`}
            title={isRival ? 'Stop treating them as a rival' : 'Must border you; a fallen rival grants prestige'}
            disabled={!isRival && ((player.rivals || []).length >= MAX_RIVALS || !bordersPlayer)}
            onClick={() => {
              if (!isRival && !bordersPlayer) return addLog(`${nation.name} doesn't border you, so it can't become a rival`, 'action');
              if (!isRival && (player.rivals || []).length >= MAX_RIVALS) return addLog(`Already have ${MAX_RIVALS} rivals`, 'action');
              dispatchIfAffordable(isRival ? ActionTypes.UNRIVAL_NATION : ActionTypes.RIVAL_NATION, {});
              return undefined;
            }} />
          {canMarry && <IconButton icon={Heart} label={`Royal marriage (${formatCost(ACTION_COSTS.proposeMarriage)})`} title="Both monarchies: lowers their hostility" disabled={!canAfford(state.resources, ACTION_COSTS.proposeMarriage)} onClick={() => dispatchIfAffordable(ActionTypes.PROPOSE_MARRIAGE, ACTION_COSTS.proposeMarriage)} />}
          {hasDiplomatAssigned ? (
            <IconButton icon={Users} label="Recall diplomat" onClick={() => dispatch({ type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: nation.id } })} />
          ) : (
            <IconButton icon={Users} label={`Assign diplomat (${formatCost(ACTION_COSTS.assignDiplomat)})`}
              title={`Improve relations: ${(player.diplomatTasks || []).length}/${player.diplomats || 0} diplomats in use`}
              disabled={!canAssignDiplomat || !canAfford(state.resources, ACTION_COSTS.assignDiplomat)}
              onClick={() => {
                if (!canAssignDiplomat) return addLog(`No free diplomats (${(player.diplomatTasks || []).length}/${player.diplomats || 0} in use)`, 'action');
                dispatchIfAffordable(ActionTypes.ASSIGN_DIPLOMAT, ACTION_COSTS.assignDiplomat);
                return undefined;
              }} />
          )}
          {canVassalize && <IconButton icon={Crown} label={`Vassalize (${formatCost(ACTION_COSTS.vassalize)})`} title="Low hostility and overwhelming strength required" disabled={!canAfford(state.resources, ACTION_COSTS.vassalize)} onClick={() => dispatchIfAffordable(ActionTypes.VASSALIZE, ACTION_COSTS.vassalize)} />}
        </div>
      )}
    </div>
  );
};

export default NationCard;
