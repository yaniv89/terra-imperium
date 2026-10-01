// src/components/modals/RegionInfoModal.jsx
// Region information modal/panel with close button

import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin, X, Shield, Users, Building, Building2, Target, AlertTriangle, Flag, Swords, Settings2, Anchor, Ship,
  ChevronUp, Flame, HeartPulse, Eye, EyeOff, Sprout, TrendingUp, Landmark, Hammer, Gem, Compass
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, getCapital, getNationCapital } from '../../data/regions';
import { canSeeRegionDetails, getIntelTurnsLeft } from '../../engine/intel';
import { ACTION_COSTS, SETTLE_COLONIZE_CONTROL_THRESHOLD, ESPIONAGE_SUCCESS_CHANCE, INTEL_DURATION_TURNS } from '../../data/actionCosts';
import { isCoastal, isReachableBySea } from '../../data/navalReach';
import { isAtWarWithPlayer, hasCasusBelli, isInTruce } from '../../engine/diplomacy';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { canAfford, formatNumber, getControlColor, getRelationColor, getFieldedStrength, getDisplayPopulation, getStability, getSupplyCapacity } from '../../utils/helpers';
import { BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, EXTRACTION_BUILDINGS, getCategoryTierName, getBuildingSlots, getUsedBuildingSlots } from '../../data/buildings';
import { getBuildingIconPath, getExtractionIconPath } from '../../data/buildingIcons';
import { getUnitIconPath } from '../../data/unitIcons';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { getRankForXp } from '../../data/promotions';
import { getDepositsFor } from '../../data/deposits';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { getTotalDev } from '../../engine/development';
import { validateInvasion, validateAmphibious } from '../../engine/invasion';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useReportInset } from '../../context/MapInsetsContext';
import ProgressBar from '../ui/ProgressBar';
import { ActionButton } from '../ui';
import PreBattleModal from '../battle/PreBattleModal';
import PeaceDealSheet from '../battle/PeaceDealSheet';

// Whether `fromRegionId` can reach `toRegionId` right now — land-adjacent, or (for a naval force)
// within the current age's sea-lane reach. Same helper ProvinceModal defines for its own,
// player-owned-side reachability checks.
const isReachable = (fromRegionId, toRegionId, age) =>
  getNeighborIds(fromRegionId).includes(toRegionId) || isReachableBySea(fromRegionId, toRegionId, age);

// Plan feedback: on mobile the old corner-panel treatment (absolute, no height cap) could grow
// taller than the small mobile map itself, hiding the very region you just tapped and spilling
// past the map card's edges. On mobile this now renders as a real bottom sheet instead — `fixed`
// to the viewport (not confined to the map's own small bounding box), capped height with its own
// scroll, sliding up from below the whole screen rather than floating on top of the map.
// position="panel" (used inside MapModal's own full-screen flat map, which has its own compact
// title bar, not GameHeader) keeps the plain top-2 corner offset. position="panel-hud" (used by
// MapContainer's main view, now the full-bleed game surface under the floating GameHeader) offsets
// below GameHeader's real, responsive height via the --header-height custom property it publishes,
// so this card never renders underneath the fixed header.
//
// Bug fix (plan feedback: "region popup visibility... can't read shit"): this used to render its
// actual text/stats directly on a translucent, blurred background (bg-slate-900/95 or /98) — fine
// for a small "select a region" hint, much harder to read once it's a real content card sitting
// over a busy map. It's plain solid bg-slate-900 now, matching every other content surface in the
// game (ProvinceModal, LogDrawer, PanelDrawer's ActionPanel) — only small HUD chrome (the header,
// the mode toggle) stays translucent.
const RegionInfoModal = ({ regionId, onClose, onManage, position = 'panel' }) => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const isMobile = useIsMobile();
  const isCornerCard = position === 'panel' || position === 'panel-hud';
  const cornerTopClass = position === 'panel-hud' ? 'top-[calc(var(--header-height,4.5rem)+0.5rem)]' : 'top-2';
  // Plan §5.1/§5.2: the mobile bottom sheet reports its height so the map centres things above it,
  // and shrinks to a peek while an invasion/settle animation fired from here plays.
  const sheetRef = useRef(null);
  const sheetShown = isMobile && isCornerCard && !!regionId;
  useReportInset('region-info', 'bottom', sheetRef, sheetShown);
  const [peeking, cancelPeek] = useAutoPeek(sheetShown);
  const [expanded, setExpanded] = useState(false);
  const [battleChoiceFrom, setBattleChoiceFrom] = useState(null);
  const [landingChoice, setLandingChoice] = useState(null);
  const [peaceOpen, setPeaceOpen] = useState(false); // naval unit id of a landing awaiting "auto or command?"
  useEffect(() => { setExpanded(false); }, [regionId]);

  // No persistent "select a region" placeholder on mobile — an always-visible empty-state sheet
  // would just be more of the same clutter this change is trying to reduce. Desktop keeps it,
  // since there it's a small, stationary corner hint, not a sheet competing for screen space.
  if (!regionId) {
    if (isMobile && isCornerCard) return null;
    return (
      <div className={`
        ${isCornerCard
          ? `absolute ${cornerTopClass} left-2 z-20`
          : 'relative'
        }
        bg-slate-900 p-3 rounded-lg text-xs min-w-[180px]
        border border-slate-700 shadow-xl
      `}>
        <div className="text-slate-400 italic flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>Select a region on the map</span>
        </div>
      </div>
    );
  }

  const regionData = REGIONS_DATA[regionId];
  const regionState = state.regions[regionId];

  if (!regionData || !regionState) return null;

  const isPlayerOwned = regionState.owner === state.playerNationId;
  const ownerNation = !isPlayerOwned ? state.nations[regionState.owner] : null;

  // Foreign-region attack/settle options (plan feedback: "Manage Region" now only opens for your
  // own provinces, Civ-style — a foreign region's available actions surface here directly instead).
  const invasionSources = !isPlayerOwned
    ? getNeighborIds(regionId)
      .filter((nId) => state.regions[nId]?.owner === state.playerNationId)
      .map((nId) => ({
        regionId: nId,
        unitCount: Object.values(state.units).filter((u) => u.regionId === nId && u.ownerId === state.playerNationId && u.domain === 'land').length,
        blockedReason: describeAttackBlock(validateInvasion(state, nId, regionId))
      }))
      .filter((source) => source.unitCount > 0)
    : [];
  const amphibiousSources = (!isPlayerOwned && isCoastal(regionId))
    ? Object.values(state.units)
      .filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, state.age))
      .map((u) => ({ unit: u, cargoCount: Object.values(state.units).filter((c) => c.embarkedOn === u.id).length,
        blockedReason: describeAttackBlock(validateAmphibious(state, u.id, regionId)) }))
      .filter(({ cargoCount }) => cargoCount > 0)
    : [];
  const defendingNavalUnits = !isPlayerOwned
    ? Object.values(state.units).filter((u) => u.regionId === regionId && u.domain === 'naval' && u.ownerId !== state.playerNationId)
    : [];
  const navalEngagementSources = (!isPlayerOwned && defendingNavalUnits.length > 0)
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, state.age)).map((u) => u.regionId))]
    : [];
  // The war to settle when this region is held by your army (its owner is the enemy).
  const occupationWar = regionState.occupiedBy === state.playerNationId
    ? state.wars.find((w) => w.active && ((w.aggressor === state.playerNationId && w.enemy === regionState.owner) || (w.enemy === state.playerNationId && w.aggressor === regionState.owner)))
    : null;
  // Attacking needs a war with the owner (plan §M13). At peace, the attack buttons would do nothing,
  // so they're replaced by the decision that actually comes first: declaring war.
  // Already held by your army (an occupation from an older save): no attack left to make there.
  const atWarWithOwner = !!ownerNation && isAtWarWithPlayer(state, ownerNation.id) && regionState.occupiedBy !== state.playerNationId;
  const hasMilitaryOption = invasionSources.length + amphibiousSources.length + navalEngagementSources.length > 0;
  const warJustified = !!ownerNation && hasCasusBelli(state, state.playerNationId, ownerNation.id);
  const declareWarCosts = warJustified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
  const breaksTruce = !!ownerNation && !atWarWithOwner && isInTruce(state, state.playerNationId, ownerNation.id);
  const warBlockedReason = !ownerNation || atWarWithOwner ? null
    : state.nations[state.playerNationId]?.vassalOf ? "You can't declare war while you're a vassal."
      : null;
  // Mirrors SETTLE_COLONIZE: only rebel-held land, or a wiped-out nation's remnant, can be settled.
  const regionOwner = state.nations[regionState.owner];
  const isRebelHeld = Object.values(state.units).some((u) => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID);
  const isUngoverned = !regionOwner || regionOwner.isEliminated || (isRebelHeld && !regionOwner.hasMilitaryPact && regionOwner.vassalOf !== state.playerNationId);
  const canSettle = !isPlayerOwned && isUngoverned && isAdjacentToOwner(regionId, state.regions, state.playerNationId) && regionState.control < SETTLE_COLONIZE_CONTROL_THRESHOLD;

  // Foreign provinces only show their insides with intel on the owner (src/engine/intel.js).
  const revealed = canSeeRegionDetails(state, regionId);
  const intelTurnsLeft = getIntelTurnsLeft(state, regionState.owner);
  // The big-picture data every region shows, owned or foreign.
  const coastal = isCoastal(regionId);
  const unitsHere = Object.values(state.units).filter((u) => u.regionId === regionId);
  const rebelsHere = unitsHere.filter((u) => u.ownerId === REBEL_OWNER_ID);
  const ownGarrison = unitsHere.filter((u) => u.ownerId === regionState.owner && !u.embarkedOn);
  // Your forces first, then everyone else's, grouped by owner.
  const unitGroups = [...new Set(unitsHere.map((u) => u.ownerId))]
    .sort((a, b) => (a === state.playerNationId ? -1 : b === state.playerNationId ? 1 : 0))
    .map((ownerId) => ({ ownerId, units: unitsHere.filter((u) => u.ownerId === ownerId) }));
  const totalDev = getTotalDev(regionState);
  const buildingSlots = getBuildingSlots(totalDev, !!regionData.isCapital);
  const usedBuildingSlots = regionState.buildings ? getUsedBuildingSlots(regionState.buildings) : 0;
  const builtCategories = BUILDING_CATEGORY_IDS
    .map((categoryId) => ({ categoryId, tier: regionState.buildings?.categories?.[categoryId] ?? -1 }))
    .filter(({ tier }) => tier >= 0);
  const projectsHere = Object.entries(state.greatProjects || {})
    .filter(([, entry]) => entry?.regionId === regionId)
    .map(([projectId, entry]) => ({ projectId, tier: entry.tier || 1 }));
  const deposits = getDepositsFor(regionData.startOwner); // geological, keyed by the province's home country
  const neighbors = getNeighborIds(regionId)
    .filter((id) => REGIONS_DATA[id])
    .map((id) => {
      const owner = state.regions[id]?.owner;
      return { id, name: REGIONS_DATA[id].name, color: state.nations[owner]?.color || '#64748b', mine: owner === state.playerNationId };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));

  // Every attack stops at the pre-battle modal first (manual / auto-resolve / call off) — even an
  // undefended province: without intel you can't know it's empty, and nothing should be launched
  // behind your back. No setting skips it.
  const handleInvade = (fromRegionId) => {
    const blockedReason = describeAttackBlock(validateInvasion(state, fromRegionId, regionId));
    if (blockedReason) return addLog(blockedReason, 'action');
    setBattleChoiceFrom(fromRegionId);
  };
  const handleAmphibiousAssault = (navalUnitId) => {
    const blockedReason = describeAttackBlock(validateAmphibious(state, navalUnitId, regionId));
    if (blockedReason) return addLog(blockedReason, 'action');
    setLandingChoice(navalUnitId);
  };
  const handleNavalEngagement = (fromRegionId) => {
    if (!canAfford(state.resources, ACTION_COSTS.navalEngagement)) return addLog('Not enough resources', 'action');
    triggerEffect('naval_engagement', { from: fromRegionId, to: regionId });
    dispatch({ type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId, targetRegionId: regionId } });
  };
  const handleDeclareWar = () => {
    if (warBlockedReason) return addLog(warBlockedReason, 'action');
    if (!canAfford(state.resources, declareWarCosts)) return addLog('Not enough resources to declare war', 'action');
    triggerEffect('declare_war', { from: getNationCapital(state.playerNationId), to: getNationCapital(ownerNation.id) });
    dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId: ownerNation.id } });
  };
  const handleGatherIntel = () => {
    if (!canAfford(state.resources, ACTION_COSTS.espionage)) return addLog('Not enough resources', 'action');
    triggerEffect('espionage', { from: getCapital(state, state.playerNationId), to: regionId });
    dispatch({ type: ActionTypes.ESPIONAGE, payload: { nationId: regionState.owner, type: 'gather_intel' } });
  };
  const handleSettleColonize = () => {
    if (!canAfford(state.resources, ACTION_COSTS.settleColonize)) return addLog('Not enough resources', 'action');
    triggerEffect('settle_colonize', { region: regionId });
    dispatch({ type: ActionTypes.SETTLE_COLONIZE, payload: { regionId } });
  };

  const mobileSheet = isMobile && isCornerCard;

  return (
    <div ref={mobileSheet ? sheetRef : undefined} className={
      mobileSheet
        ? `fixed inset-x-0 bottom-0 z-30 ${peeking ? 'max-h-[18vh]' : expanded ? 'max-h-[calc(100dvh-var(--header-height,4.5rem)-0.5rem)]' : 'max-h-[55vh]'} transition-[max-height] duration-300 ease-out overflow-y-auto overscroll-contain rounded-t-2xl bg-slate-900 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs border-t border-slate-700 shadow-2xl`
        : `${isCornerCard ? `absolute ${cornerTopClass} left-2 z-20 max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto overscroll-contain` : 'relative'}
           bg-slate-900 p-3 rounded-lg text-xs w-[300px] max-w-[calc(100vw-1rem)]
           border border-slate-700 shadow-xl`
    }>
      {mobileSheet && (
        // Tapping the grab handle toggles between the half-height sheet and a near-full-screen one
        // (and brings a peeking sheet straight back).
        <button
          type="button"
          aria-label={expanded ? 'Collapse region details' : 'Expand region details'}
          onClick={peeking ? cancelPeek : () => setExpanded((v) => !v)}
          className="w-full flex flex-col items-center justify-center -mt-3 -mb-1 text-slate-500"
        >
          <div className="w-10 h-1 rounded-full bg-slate-700" />
          <ChevronUp className={`w-3.5 h-3.5 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate text-sm">{regionData.name}</div>
            <div className="text-slate-500 text-[10px] capitalize flex flex-wrap gap-x-1.5">
              <span>{regionData.terrain}</span>
              {coastal && <span>· Coastal</span>}
              {regionData.isCapital && <span className="text-purple-400">· Capital</span>}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Owner */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400">Owner:</span>
        <span className={`font-semibold ${isPlayerOwned ? 'text-blue-400' : ''}`} style={{ color: !isPlayerOwned ? ownerNation?.color : undefined }}>
          {isPlayerOwned ? state.nations[state.playerNationId]?.name : ownerNation?.name || 'Unknown'}
        </span>
      </div>

      {/* Civ-style "manage this region" entry point — only for your own provinces, same as
          Civilization only gives you a city screen for your own cities. A foreign region's
          available actions (invade, settle, etc.) render further down instead. */}
      {onManage && isPlayerOwned && (
        <button
          onClick={onManage}
          className="w-full flex items-center justify-center gap-1.5 mb-2 py-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage Region
        </button>
      )}

      {/* Alerts */}
      {(regionState.underInvasion || regionState.occupiedBy || (revealed && rebelsHere.length > 0) || (isPlayerOwned && regionState.formerOwner)) && (
        <div className="mb-2 space-y-1">
          {regionState.underInvasion && (
            <div className="flex items-center gap-1.5 text-orange-400 font-semibold animate-pulse">
              <AlertTriangle className="w-3 h-3" /><span>Under Invasion!</span>
            </div>
          )}
          {regionState.occupiedBy === state.playerNationId && occupationWar && (
            <div className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 p-2 text-[11px] text-cyan-100 space-y-1.5" data-testid="occupation-note">
              <div>Your army holds {regionData.name}, but it stays {ownerNation?.name || 'theirs'}&apos;s land until peace. Demand it in a peace deal to make it yours.</div>
              <button type="button" onClick={() => setPeaceOpen(true)} className="w-full min-h-[40px] rounded-lg bg-cyan-600/80 border border-cyan-300 font-semibold text-white" data-testid="open-peace-deal">Negotiate peace…</button>
            </div>
          )}
          {regionState.occupiedBy && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <Flag className="w-3 h-3" /><span>Occupied by {state.nations[regionState.occupiedBy]?.name || 'Unknown'}</span>
            </div>
          )}
          {revealed && rebelsHere.length > 0 && (
            <div className="flex items-center gap-1.5 text-red-400">
              <Flame className="w-3 h-3" /><span>{rebelsHere.length} rebel unit{rebelsHere.length === 1 ? '' : 's'} in revolt here</span>
            </div>
          )}
          {isPlayerOwned && regionState.formerOwner && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Conquered from {state.nations[regionState.formerOwner]?.name || regionState.formerOwner} — not yet integrated</span>
            </div>
          )}
        </div>
      )}

      {/* Foreign relations */}
      {!isPlayerOwned && ownerNation && (
        <div className="mb-2 space-y-1">
          <StatLine label="Relation" value={ownerNation.relationStatus} valueStyle={{ color: getRelationColor(ownerNation.relationStatus) }} />
          <StatLine icon={Swords} label="Nation's army" value={revealed ? formatNumber(getFieldedStrength(state, regionState.owner)) : 'Unknown'} valueClass={revealed ? 'text-red-400' : 'text-slate-500'} />
          <StatLine label="Hostility" value={`${ownerNation.hostility}%`} valueClass="text-orange-400" />
          <div className="flex flex-wrap gap-1 pt-1">
            {ownerNation.hasPeaceTreaty && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">✓ Peace Treaty</span>}
            {ownerNation.hasTradeAgreement && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">✓ Trade Agreement</span>}
            {isAtWarWithPlayer(state, ownerNation.id) && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">⚔ At War</span>}
          </div>
        </div>
      )}

      {/* Attack / settle options — the foreign-region equivalent of "Manage Region" above. */}
      {!isPlayerOwned && ownerNation && (
        <div className="mb-2 pt-2 border-t border-slate-700 space-y-1.5">
          {invasionSources.length === 0 && amphibiousSources.length === 0 && navalEngagementSources.length === 0 && !canSettle && (
            <div className="text-slate-500 text-[10px]">No actions available against this region right now.</div>
          )}
          {!atWarWithOwner && hasMilitaryOption && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5" data-testid="peace-gate">
              <div className="text-[11px] text-amber-200">
                You&apos;re at peace with {ownerNation.name}. Invading means war — declare it first, then attack.
                {breaksTruce && <span className="block text-red-300 mt-0.5">This breaks your truce: stability, prestige and your neighbours&apos; trust will suffer.</span>}
              </div>
              <ActionButton
                icon={Swords}
                label={`Declare war on ${ownerNation.name}${warJustified ? '' : ' (unjustified)'}`}
                description={warBlockedReason || (warJustified ? 'You have a casus belli' : 'No casus belli — costs more and angers the world')}
                costs={declareWarCosts}
                onClick={handleDeclareWar}
                disabled={!!warBlockedReason || !canAfford(state.resources, declareWarCosts)}
                variant="danger"
                size="small"
              />
            </div>
          )}
          {atWarWithOwner && invasionSources.map(({ regionId: srcId, unitCount, blockedReason }) => (
            <ActionButton
              key={srcId}
              icon={Flag}
              label={`Invade from ${REGIONS_DATA[srcId]?.name}`}
              description={blockedReason || `${unitCount} land unit${unitCount === 1 ? '' : 's'} available`}
              costs={ACTION_COSTS.launchInvasion}
              onClick={() => handleInvade(srcId)}
              disabled={!!blockedReason}
              variant="danger"
              size="small"
            />
          ))}
          {atWarWithOwner && amphibiousSources.map(({ unit, cargoCount, blockedReason }) => (
            <ActionButton
              key={unit.id}
              icon={Anchor}
              label={`Amphibious assault from ${REGIONS_DATA[unit.regionId]?.name}`}
              description={blockedReason || `${cargoCount} embarked land unit${cargoCount === 1 ? '' : 's'}`}
              costs={ACTION_COSTS.amphibiousAssault}
              onClick={() => handleAmphibiousAssault(unit.id)}
              disabled={!!blockedReason}
              variant="danger"
              size="small"
            />
          ))}
          {atWarWithOwner && navalEngagementSources.map((srcId) => (
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
          {canSettle && (
            <ActionButton
              icon={Flag}
              label="Settle / Colonize"
              description={`${regionOwner && !regionOwner.isEliminated ? 'Rebels hold this land' : 'No one governs this land'} (${Math.round(regionState.control)}% control) — absorb it peacefully, no military required`}
              costs={ACTION_COSTS.settleColonize}
              onClick={handleSettleColonize}
              disabled={!canAfford(state.resources, ACTION_COSTS.settleColonize)}
              size="small"
            />
          )}
        </div>
      )}

      {/* ---- The big picture: everything about this province, scrollable. A foreign province's
          insides stay hidden until a successful espionage op against its owner (engine/intel.js). ---- */}
      {!revealed && (
        <Section icon={EyeOff} title="No intelligence">
          <div className="text-slate-400 mb-2">
            {ownerNation?.name || 'Its owner'} keeps its provinces closed to you. Population, garrisons, buildings,
            development and resources stay unknown until your agents get inside.
          </div>
          {regionState.lastAttackedTurn != null && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400">Control (siege)</span>
                <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>{Math.round(regionState.control)}%</span>
              </div>
              <ProgressBar value={regionState.control} color="dynamic" size="small" />
            </div>
          )}
          <ActionButton
            icon={Eye}
            label="Gather Intelligence"
            description={`Send agents into ${ownerNation?.name || 'this nation'} — ${Math.round(ESPIONAGE_SUCCESS_CHANCE * 100)}% chance to reveal all of its provinces for ${INTEL_DURATION_TURNS} turns; if caught, their hostility rises`}
            costs={ACTION_COSTS.espionage}
            onClick={handleGatherIntel}
            disabled={!canAfford(state.resources, ACTION_COSTS.espionage)}
            resources={state.resources}
            size="small"
          />
        </Section>
      )}
      {revealed && (<>
      <Section icon={Target} title="Overview" aside={!isPlayerOwned && intelTurnsLeft !== null ? (intelTurnsLeft > 0 ? `Intel: ${intelTurnsLeft} turn${intelTurnsLeft === 1 ? '' : 's'} left` : 'Intel: last turn') : null}>
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-400">Control</span>
            <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>{Math.round(regionState.control)}%</span>
          </div>
          <ProgressBar value={regionState.control} color="dynamic" size="small" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile icon={Users} label="Population" value={formatNumber(getDisplayPopulation(regionState, regionData, state.year))} />
          <StatTile icon={HeartPulse} label="Stability" value={`${Math.round(getStability(regionState))}%`} valueClass={getStability(regionState) < 50 ? 'text-red-400' : 'text-slate-100'} />
          <StatTile icon={Building} label="Infrastructure" value={`${regionState.currentInfrastructure || 0}/10`} sub={`Supply ${getSupplyCapacity(regionState.currentInfrastructure)}`} />
          <StatTile icon={Shield} label="Defenses" value={`Lv ${regionState.defenseLevel || 0}`} sub={`Terrain fort ${regionData.fortification}`} />
          <StatTile icon={Target} label="Strategic value" value={`${regionData.strategicValue}/10`} />
          {(regionState.climateResilience || 0) > 0
            ? <StatTile icon={Sprout} label="Climate resilience" value={regionState.climateResilience} />
            : <StatTile icon={Swords} label="Garrison" value={ownGarrison.length} sub={ownGarrison.length ? `${formatNumber(ownGarrison.reduce((sum, u) => sum + (u.strength || 0), 0))} strength` : 'No troops'} />}
        </div>
      </Section>

      <Section icon={TrendingUp} title="Development" aside={`${totalDev} total`}>
        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label="Tax" value={regionState.dev?.tax || 0} valueClass="text-amber-300" />
          <StatTile label="Production" value={regionState.dev?.production || 0} valueClass="text-sky-300" />
          <StatTile label="Manpower" value={regionState.dev?.manpower || 0} valueClass="text-red-300" />
        </div>
      </Section>

      <Section icon={Swords} title="Armies here" aside={unitsHere.length ? `${unitsHere.length} unit${unitsHere.length === 1 ? '' : 's'}` : null}>
        {unitsHere.length === 0 && <Empty>No units stationed in this region.</Empty>}
        <div className="space-y-1.5">
          {unitGroups.map(({ ownerId, units }) => (
            <div key={ownerId}>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ownerId === REBEL_OWNER_ID ? '#ef4444' : state.nations[ownerId]?.color || '#64748b' }} />
                <span className="truncate">{ownerId === REBEL_OWNER_ID ? 'Rebels' : ownerId === state.playerNationId ? 'Your forces' : state.nations[ownerId]?.name || ownerId}</span>
                <span className="ml-auto font-mono">{formatNumber(units.reduce((sum, u) => sum + (u.strength || 0), 0))} str</span>
              </div>
              <div className="space-y-1">
                {units.map((unit) => (
                  <UnitLine key={unit.id} unit={unit} age={state.age} commander={unit.commanderId ? state.hiredCommanders?.[unit.commanderId] : null} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Building2} title="Buildings" aside={`${usedBuildingSlots}/${buildingSlots} slots`}>
        {builtCategories.length === 0 && <Empty>No buildings yet.</Empty>}
        <div className="space-y-1">
          {builtCategories.map(({ categoryId, tier }) => {
            const category = BUILDING_CATEGORIES[categoryId];
            const tierAge = category.tiers[tier]?.age;
            return (
              <div key={categoryId} className="flex items-center gap-2 bg-slate-800/60 rounded px-2 py-1.5">
                <GameIcon path={getBuildingIconPath(categoryId, tierAge)} className="w-5 h-5 text-amber-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-slate-100 font-semibold truncate">{getCategoryTierName(categoryId, tier)}</div>
                  <div className="text-slate-500 text-[10px]">{category.label}</div>
                </div>
                <TierPips filled={tier + 1} total={category.tiers.length} />
              </div>
            );
          })}
        </div>
      </Section>

      {(projectsHere.length > 0 || regionState.greatProjectConstruction) && (
        <Section icon={Landmark} title="Great projects">
          <div className="space-y-1">
            {projectsHere.map(({ projectId, tier }) => (
              <div key={projectId} className="flex items-center justify-between bg-slate-800/60 rounded px-2 py-1.5">
                <span className="text-yellow-200 font-semibold truncate">{GREAT_PROJECTS[projectId]?.name || projectId}</span>
                <TierPips filled={tier} total={GREAT_PROJECTS[projectId]?.tiers?.length || 3} />
              </div>
            ))}
            {regionState.greatProjectConstruction && (
              <div className="bg-slate-800/60 rounded px-2 py-1.5 text-slate-300">
                <Hammer className="w-3 h-3 inline mr-1 text-amber-300" />
                Building {GREAT_PROJECTS[regionState.greatProjectConstruction.projectId]?.name} (tier {regionState.greatProjectConstruction.tier}) —{' '}
                {regionState.greatProjectConstruction.turnsLeft} turn{regionState.greatProjectConstruction.turnsLeft === 1 ? '' : 's'} left
              </div>
            )}
          </div>
        </Section>
      )}

      <Section icon={Gem} title="Resources">
        {deposits.length === 0 && <Empty>No known resource deposits.</Empty>}
        <div className="flex flex-wrap gap-1.5">
          {deposits.map((resId) => {
            const developed = !!regionState.buildings?.extraction?.[resId];
            return (
              <div key={resId} className={`flex items-center gap-1.5 rounded px-2 py-1 border ${developed ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800/60 text-slate-400'}`}>
                <GameIcon path={getExtractionIconPath(resId)} className="w-4 h-4 shrink-0" />
                <span className="capitalize">{resId}</span>
                <span className="text-[10px] opacity-80">{developed ? EXTRACTION_BUILDINGS[resId]?.name : 'undeveloped'}</span>
              </div>
            );
          })}
        </div>
      </Section>
      </>)}

      <Section icon={Compass} title="Neighbours" aside={neighbors.length ? `${neighbors.length}` : null}>
        {neighbors.length === 0 && <Empty>No land neighbours.</Empty>}
        <div className="flex flex-wrap gap-1">
          {neighbors.map(({ id, name, color, mine }) => (
            <span key={id} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${mine ? 'bg-blue-500/15 text-blue-200' : 'bg-slate-800/70 text-slate-300'}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
      </Section>

      {battleChoiceFrom && <PreBattleModal fromRegionId={battleChoiceFrom} targetRegionId={regionId} onClose={() => setBattleChoiceFrom(null)} />}
      {peaceOpen && occupationWar && <PeaceDealSheet warId={occupationWar.id} onClose={() => setPeaceOpen(false)} />}
      {landingChoice && <PreBattleModal navalUnitId={landingChoice} targetRegionId={regionId} onClose={() => setLandingChoice(null)} />}

      {/* Description */}
      {regionData.description && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-slate-500 text-[10px] italic">
          {regionData.description}
        </div>
      )}
    </div>
  );
};

// ---- small presentational pieces ------------------------------------------------------------

const Section = ({ icon: Icon, title, aside, children }) => (
  <div className="mt-2 pt-2 border-t border-slate-700">
    <div className="flex items-center gap-1.5 mb-1.5 text-slate-300 font-semibold">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
      <span>{title}</span>
      {aside && <span className="ml-auto text-slate-500 font-normal text-[10px]">{aside}</span>}
    </div>
    {children}
  </div>
);

const Empty = ({ children }) => <div className="text-slate-500 text-[10px]">{children}</div>;

const StatLine = ({ icon: Icon, label, value, valueClass = 'text-slate-300', valueStyle }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-400 flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />}{label}:</span>
    <span className={`font-semibold ${valueClass}`} style={valueStyle}>{value}</span>
  </div>
);

const StatTile = ({ icon: Icon, label, value, sub, valueClass = 'text-slate-100' }) => (
  <div className="bg-slate-800/60 rounded px-2 py-1.5 min-w-0">
    <div className="text-slate-500 text-[10px] flex items-center gap-1 truncate">{Icon && <Icon className="w-3 h-3 shrink-0" />}{label}</div>
    <div className={`font-mono font-bold ${valueClass}`}>{value}</div>
    {sub && <div className="text-slate-500 text-[10px] truncate">{sub}</div>}
  </div>
);

const TierPips = ({ filled, total }) => (
  <div className="flex gap-0.5 shrink-0" title={`Tier ${filled} of ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-amber-400' : 'bg-slate-700'}`} />
    ))}
  </div>
);

// A game-icons.net silhouette (0..512 viewBox), recoloured through currentColor.
const GameIcon = ({ path, className }) => (path
  ? <svg viewBox="0 0 512 512" className={className} fill="currentColor" aria-hidden="true"><path d={path} /></svg>
  : <span className={className} />);

const UnitLine = ({ unit, age, commander }) => {
  const cls = UNIT_CLASSES[unit.classId];
  const strengthPct = unit.maxStrength ? Math.round((unit.strength / unit.maxStrength) * 100) : 100;
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 rounded px-2 py-1.5">
      <GameIcon path={getUnitIconPath(age, unit.classId)} className="w-5 h-5 text-slate-200 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-100 font-semibold truncate">{cls?.name || unit.classId}</span>
          <span className="text-slate-500 text-[10px] capitalize">{getRankForXp(unit.xp || 0)}</span>
          {unit.embarkedOn && <Anchor className="w-3 h-3 text-sky-400" aria-label="Embarked" />}
        </div>
        <div className="h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${strengthPct}%`, background: strengthPct > 60 ? '#22c55e' : strengthPct > 30 ? '#f59e0b' : '#ef4444' }} />
        </div>
        {commander && <div className="text-[10px] text-purple-300 truncate mt-0.5">Led by {commander.name}</div>}
      </div>
      <div className="text-right font-mono text-[10px] text-slate-400 shrink-0">
        <div>{unit.strength}/{unit.maxStrength}</div>
        <div>MOR {unit.morale}</div>
      </div>
    </div>
  );
};

export default RegionInfoModal;
