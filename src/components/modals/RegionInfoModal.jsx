import { tradeRouteStatus } from '../../engine/tradeDisruptions';
import ColonyBlock from './ColonyBlock';
// src/components/modals/RegionInfoModal.jsx
// Region information modal/panel with close button

import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin, X, Shield, Users, Building, Building2, Target, AlertTriangle, Flag, Swords, Settings2, Anchor, Ship,
  ChevronUp, Flame, HeartPulse, Eye, EyeOff, Sprout, TrendingUp, Landmark, Gem, Compass
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, getCapital, getNationCapital } from '../../data/regions';
import { canSeeRegionDetails, getIntelTurnsLeft } from '../../engine/intel';
import { ACTION_COSTS, SETTLE_COLONIZE_CONTROL_THRESHOLD, ESPIONAGE_SUCCESS_CHANCE, INTEL_DURATION_TURNS } from '../../data/actionCosts';
import { isCoastal, isReachableBySea } from '../../data/navalReach';
import { isAtWarWithPlayer, hasCasusBelli, isInTruce } from '../../engine/diplomacy';
import { canAttack } from '../../engine/hostility';
import { opinionOf } from '../../engine/opinion';
import { moodWord } from './firstContactModel';
import { isIndependentNation, PERSONALITIES } from '../../data/independents';
import IndependentCityCard from '../independents/IndependentCityCard';
import RazeControl from './RazeControl';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { formatNumber, getControlColor, getFieldedStrength, getStability, getSupplyCapacity } from '../../utils/helpers';
import { categoryTierName, extractionName, wonderName, terrainWord, buildingCategoryLabel, unitClassName, resourceName, independentKindName } from '../../i18n/gameText';
import { BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, EXTRACTION_BUILDINGS, getBuildingSlots, getUsedBuildingSlots } from '../../data/buildings';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { getRankForXp } from '../../data/promotions';
import { regionDeposits } from '../../data/deposits';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { payWhy } from '../panels/empireText';
import { declareWarConfirm } from '../ui/confirmSpecs';
import { BuildingIcon, ExtractionIcon, ResourceIcon, UnitIcon, WonderIcon } from '../ui/icons';
import { getTotalDev } from '../../engine/development';
import { validateInvasion, validateAmphibious } from '../../engine/invasion';
import { attackReach, planMarchAttack, marchAttackUnits } from '../../engine/marchAttack';
import { estimateMarchOdds } from '../../engine/battleOdds';
import { marchOddsText } from '../map/marchOddsText';
import { describeAttackBlock } from '../../utils/attackAvailability';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useInteraction, useDismissOverlays, PRIORITY } from '../../hooks/useExclusivePanel';
import { useReportInset } from '../../context/MapInsetsContext';
import ProgressBar from '../ui/ProgressBar';
import { ActionButton } from '../ui';
import TopLayer from '../ui/TopLayer';
import PreBattleModal from '../battle/PreBattleModal';
import { startMarch, selectNation, selectArmy, selectTile } from '../map/marchEvents';
import { settlerStatus } from '../map/settleRoutes';
import { placeName, marchOrigin } from '../../engine/routes';
import { unitsStationedIn, fieldUnitsOf, whereLabel } from '../../engine/unitLocation';
import { unitTile } from '../../engine/armies';
import { supplyOf } from '../../engine/supplyMeter';
import { atSea } from '../../engine/fleets';
import { wallsLabel } from '../battle/warModel';
import { cultureOf, loyaltyOf, loyaltyTarget } from '../../engine/loyalty';
import PeaceDealSheet from '../battle/PeaceDealSheet';
import { claimOn, canFabricateClaim, CLAIM_FABRICATE_TURNS } from '../../engine/claims';
import { DISASTER_LABELS } from '../../engine/cityDisasters';
import { cityHousingCap, cityDamageOf } from '../../engine/cityManifest';

// Whether `fromRegionId` can reach `toRegionId` right now — land-adjacent, or (for a naval force)
// within the current age's sea-lane reach. Same helper ProvinceModal defines for its own,
// player-owned-side reachability checks.
import { nameNow } from '../../i18n/names';
import { useT } from '../../i18n/useT';
import { reasonText } from '../../i18n/messageText';
import { msgRefText } from '../battle/battleText';
import { t as tNow } from '../../i18n/core';
import { ageOf } from '../../engine/nationState';
import { sideAgeOf } from '../../engine/ageRefs';
import { shownPeople } from '../../data/ages';
import { sizeToPeople } from '../../engine/world/cities';
import { canPay } from '../../utils/costs';

const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
// a nation's name in the current language (a people's title, or an independent's form)
const pn = (n, id = n?.id) => (n ? nameNow('people', id, n.name) : undefined);
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
// actual text/stats directly on a translucent, blurred background (bg-fa-panel/95 or /98) — fine
// for a small "select a region" hint, much harder to read once it's a real content card sitting
// over a busy map. It's plain solid bg-fa-panel now, matching every other content surface in the
// game (ProvinceModal, LogDrawer, PanelDrawer's ActionPanel) — only small HUD chrome (the header,
// the mode toggle) stays translucent.
const RegionInfoModal = ({ regionId, onClose, onManage, position = 'panel' }) => {
  const { state, dispatch, addLog } = useGame();
  const { t } = useT();
  const turnsOf = (n) => t('ind.turns', { count: n });
  const { triggerEffect } = useEffects();
  const isMobile = useIsMobile();
  const isCornerCard = position === 'panel' || position === 'panel-hud';
  const cornerTopClass = position === 'panel-hud' ? 'top-[calc(var(--header-height,2.25rem)+0.5rem)]' : 'top-2';
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
  // The corner card on a phone held sideways or a tablet is one of the left-edge panels: opening the
  // tab dock beside it (or a decision card) closes it, so two panels never squeeze the map to a
  // sliver (the interaction registry, useExclusivePanel.js; same rule as ProvinceModal).
  const cardWanted = !!regionId && isCornerCard && !isMobile;
  const card = useInteraction('region-card', cardWanted, { kind: 'panel', priority: PRIORITY.panel, user: true });
  useDismissOverlays(() => onClose?.(), cardWanted);
  const cardTucked = cardWanted && !card.shown;
  useEffect(() => { if (cardTucked) onClose?.(); }, [cardTucked]); // eslint-disable-line react-hooks/exhaustive-deps

  // No persistent "select a region" placeholder on mobile — an always-visible empty-state sheet
  // would just be more of the same clutter this change is trying to reduce. Desktop keeps it,
  // since there it's a small, stationary corner hint, not a sheet competing for screen space.
  // No empty "select a region" hint: the map is the hint (plans/UI-DESIGN.md rule 3).
  if (!regionId) return null;

  const regionData = REGIONS_DATA[regionId];
  const regionState = state.regions[regionId];

  if (!regionData || !regionState) return null;

  const isNeutralFrontier = state.scenario?.mode === 'emergent' && regionState.owner === null;
  const isPlayerOwned = regionState.owner === state.playerNationId;
  const ownerNation = !isPlayerOwned ? state.nations[regionState.owner] : null;

  // Foreign-region attack/settle options (plan feedback: "Manage Region" now only opens for your
  // own provinces, Civ-style — a foreign region's available actions surface here directly instead).
  // ACT-01: an army based far away but standing beside this city (a march that halted here) is a
  // source too; before, only the neighbouring cities' armies were, and its card had no attack.
  const besideBases = !isPlayerOwned
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === state.playerNationId && u.domain === 'land' && !u.embarkedOn).map((u) => u.regionId))]
      .filter((id) => !getNeighborIds(regionId).includes(id) && attackReach(state, id, regionId) === 'adjacent')
      .sort()
    : [];
  const invasionSources = !isPlayerOwned
    ? [...getNeighborIds(regionId), ...besideBases]
      .filter((nId) => state.regions[nId]?.owner === state.playerNationId)
      .map((nId) => {
        // Only an army that borders the city invades at once; a far one marches there to attack
        // it (marchAttack.js): the button shows the turns and gives the march order.
        const far = attackReach(state, nId, regionId) === 'far';
        return {
          regionId: nId,
          // Where the army really stands (its tile), not the city it is based at.
          where: whereLabel(state, marchOrigin(state, nId))?.text || null,
          unitCount: Object.values(state.units).filter((u) => u.regionId === nId && u.ownerId === state.playerNationId && u.domain === 'land').length,
          blockedReason: far ? null : describeAttackBlock(validateInvasion(state, nId, regionId)),
          march: far ? planMarchAttack(state, nId, regionId) : null
        };
      })
      .filter((source) => source.unitCount > 0)
    : [];
  const amphibiousSources = (!isPlayerOwned && isCoastal(regionId))
    ? Object.values(state.units)
      .filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, ageOf(state, state.playerNationId)))
      .map((u) => ({ unit: u, cargoCount: Object.values(state.units).filter((c) => c.embarkedOn === u.id).length,
        blockedReason: describeAttackBlock(validateAmphibious(state, u.id, regionId)) }))
      .filter(({ cargoCount }) => cargoCount > 0)
    : [];
  const defendingNavalUnits = !isPlayerOwned
    ? Object.values(state.units).filter((u) => u.regionId === regionId && u.domain === 'naval' && u.ownerId !== state.playerNationId)
    : [];
  const navalEngagementSources = (!isPlayerOwned && defendingNavalUnits.length > 0)
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === state.playerNationId && u.domain === 'naval' && isReachable(u.regionId, regionId, ageOf(state, state.playerNationId))).map((u) => u.regionId))]
    : [];
  // The war to settle when this region is held by your army (its owner is the enemy).
  const occupationWar = regionState.occupiedBy === state.playerNationId
    ? state.wars.find((w) => w.active && ((w.aggressor === state.playerNationId && w.enemy === regionState.owner) || (w.enemy === state.playerNationId && w.aggressor === regionState.owner)))
    : null;
  // Attacking needs a war with the owner (plan §M13). At peace, the attack buttons would do nothing,
  // so they're replaced by the decision that actually comes first: declaring war.
  // Already held by your army (an occupation from an older save): no attack left to make there.
  // An independent city (hostility.js) may be attacked without a war: it counts as "at war" here.
  const ownerIsIndependent = !!ownerNation && isIndependentNation(ownerNation);
  const ownerMood = ownerNation ? moodWord(opinionOf(state, ownerNation.id)) : null;
  const atWarWithOwner = !!ownerNation && (isAtWarWithPlayer(state, ownerNation.id) || canAttack(state, state.playerNationId, ownerNation.id)) && regionState.occupiedBy !== state.playerNationId;
  // Land nobody owns (an emergent world's frontier) has no war to declare and no one to invade.
  const hasMilitaryOption = !!ownerNation && invasionSources.length + amphibiousSources.length + navalEngagementSources.length > 0;
  const warJustified = !!ownerNation && hasCasusBelli(state, state.playerNationId, ownerNation.id);
  const declareWarCosts = warJustified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
  const breaksTruce = !!ownerNation && !atWarWithOwner && isInTruce(state, state.playerNationId, ownerNation.id);
  const warBlockedReason = !ownerNation || atWarWithOwner ? null
    : state.nations[state.playerNationId]?.vassalOf ? t('ri.vassalNoWar')
      : null;
  // Mirrors SETTLE_COLONIZE: only rebel-held land, or a wiped-out nation's remnant, can be settled.
  const regionOwner = state.nations[regionState.owner];
  const isRebelHeld = Object.values(state.units).some((u) => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID);
  const isUngoverned = !regionOwner || regionOwner.isEliminated || (isRebelHeld && !regionOwner.hasMilitaryPact && regionOwner.vassalOf !== state.playerNationId);
  const canSettle = !isNeutralFrontier && !isPlayerOwned && isUngoverned && isAdjacentToOwner(regionId, state.regions, state.playerNationId) && regionState.control < SETTLE_COLONIZE_CONTROL_THRESHOLD;

  // Foreign provinces only show their insides with intel on the owner (src/engine/intel.js).
  const revealed = canSeeRegionDetails(state, regionId);
  const intelTurnsLeft = getIntelTurnsLeft(state, regionState.owner);
  // The big-picture data every region shows, owned or foreign.
  const coastal = isCoastal(regionId);
  // "Here" is physical (unitLocation.js): an army that only has this city as its base and stands
  // days away is listed as "in the field", not here (playtest audit I059).
  const unitsHere = unitsStationedIn(state, regionId);
  const awayUnits = fieldUnitsOf(state, regionId, state.playerNationId).filter((u) => u.classId !== 'settler');
  const awayTiles = [...new Set(awayUnits.map((u) => unitTile(state, u)).filter((t) => t != null))];
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
  const deposits = regionDeposits(regionData); // geological, keyed by the province's home country
  const neighbors = getNeighborIds(regionId)
    .filter((id) => REGIONS_DATA[id])
    .map((id) => {
      const owner = state.regions[id]?.owner;
      return { id, name: nameNow('city', null, REGIONS_DATA[id].name), color: state.nations[owner]?.color || '#64748b', mine: owner === state.playerNationId };
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
    if (!canPay(state, ACTION_COSTS.navalEngagement)) return addLog(t('ri.notEnough'), 'action');
    triggerEffect('naval_engagement', { from: fromRegionId, to: regionId });
    dispatch({ type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId, targetRegionId: regionId } });
  };
  const handleDeclareWar = () => {
    if (warBlockedReason) return addLog(warBlockedReason, 'action');
    if (!canPay(state, declareWarCosts)) return addLog(t('ri.notEnoughWar'), 'action');
    // Two taps: the card shows the cost and the opinion hit first (H-08).
    const nationId = ownerNation.id;
    askConfirm(declareWarConfirm(state, nationId), () => {
      triggerEffect('declare_war', { from: getNationCapital(state.playerNationId), to: getNationCapital(nationId) });
      dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId } });
    });
  };
  const handleGatherIntel = () => {
    if (!canPay(state, ACTION_COSTS.espionage)) return addLog(t('ri.notEnough'), 'action');
    triggerEffect('espionage', { from: getCapital(state, state.playerNationId), to: regionId });
    dispatch({ type: ActionTypes.ESPIONAGE, payload: { nationId: regionState.owner, type: 'gather_intel' } });
  };
  const handleSettleColonize = () => {
    if (!canPay(state, ACTION_COSTS.settleColonize)) return addLog(t('ri.notEnough'), 'action');
    triggerEffect('settle_colonize', { region: regionId });
    dispatch({ type: ActionTypes.SETTLE_COLONIZE, payload: { regionId } });
  };

  const mobileSheet = isMobile && isCornerCard;

  return (
    <div ref={mobileSheet ? sheetRef : undefined} className={
      mobileSheet
        ? `fixed inset-x-0 bottom-0 z-30 ${peeking ? 'max-h-[18vh]' : expanded ? 'max-h-[calc(100dvh-var(--header-height,4.5rem)-0.5rem)]' : 'max-h-[55vh]'} transition-[max-height] duration-300 ease-out overflow-y-auto overscroll-contain rounded-t-2xl fa-sheet p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[13px] border-t shadow-2xl`
        : `${isCornerCard ? `absolute corner-card ${cornerTopClass} start-[calc(var(--city-rail-w,0px)+0.5rem)] pl:start-[max(var(--safe-start),0.5rem)] z-20 max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto overscroll-contain` : 'relative'}
           fa-sheet p-3 rounded-[10px] text-[13px] w-[310px] max-w-[calc(100vw-1rem)]
           border border-fa-line shadow-xl`
    }>
      {mobileSheet && (
        // Tapping the grab handle toggles between the half-height sheet and a near-full-screen one
        // (and brings a peeking sheet straight back).
        <button
          type="button"
          aria-label={expanded ? t('ri.collapse') : t('ri.expand')}
          onClick={peeking ? cancelPeek : () => setExpanded((v) => !v)}
          className="w-full flex flex-col items-center justify-center -mt-3 -mb-1 text-fa-muted"
        >
          <div className="w-10 h-1 rounded-full bg-fa-hover" />
          <ChevronUp className={`w-3.5 h-3.5 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {/* Header */}
      <div className="flex justify-between items-start border-b border-fa-line pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-5 h-5 text-fa-muted shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="fa-heading text-[17px] leading-tight truncate">{nameNow('city', null, regionData.name)}</h2>
            <div className="text-fa-muted text-[12px] capitalize flex flex-wrap gap-x-1.5">
              <span>{terrainWord(regionData.terrain)}</span>
              {coastal && <span>{t('ri.coastal')}</span>}
              {regionData.isCapital && <span>{t('ri.capital')}</span>}
            </div>
            {regionState.size != null && (
              <div className="text-fa-muted text-[12px] truncate">
                {t('ri.sizeTiles', { size: regionState.size, count: regionState.tiles?.length || 1 })}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t('ri.close')}
          className="fa-icon-btn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Owner */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-fa-muted">{t('ri.owner')}</span>
        <span className={`font-semibold ${isPlayerOwned ? 'text-fa-you' : ''}`} style={{ color: !isPlayerOwned ? ownerNation?.color : undefined }}>
          {isPlayerOwned ? pn(state.nations[state.playerNationId], state.playerNationId) : ownerNation ? <button type="button" onClick={() => selectNation(ownerNation.id)} className="underline decoration-dotted min-h-[24px]" title={t('ri.openNationSheet')} data-testid="open-nation-sheet">{pn(ownerNation)}</button> : (isNeutralFrontier ? (regionState.colony ? (regionState.colony.ownerId === state.playerNationId ? t('ri.freeLandYours') : t('ri.freeLandOf', { who: pn(state.nations[regionState.colony.ownerId], regionState.colony.ownerId) || t('ri.aNation') })) : t('ri.freeLand')) : t('ri.unknown'))}
        </span>
      </div>

      {/* Civ-style "manage this region" entry point — only for your own provinces, same as
          Civilization only gives you a city screen for your own cities. A foreign region's
          available actions (invade, settle, etc.) render further down instead. */}
      {onManage && isPlayerOwned && (
        <button
          onClick={onManage}
          className="fa-btn fa-btn-primary w-full mb-2"
          data-testid="open-city-sheet"
        >
          <Settings2 className="w-4 h-4" aria-hidden="true" />
          {t('ri.openCity')}
        </button>
      )}

      {/* Alerts */}
      {(regionState.underInvasion || regionState.siege || regionState.occupiedBy || regionState.disaster || (revealed && rebelsHere.length > 0) || (isPlayerOwned && regionState.formerOwner)) && (
        <div className="mb-2 space-y-1">
          {regionState.disaster && (
            <div className="rounded-lg border border-fa-science/60 bg-fa-raised p-2 text-[12px]" data-testid="disaster-note">{t('ri.disaster.line', { label: DISASTER_LABELS[regionState.disaster.kind] ? t(`ri.disaster.${DISASTER_LABELS[regionState.disaster.kind]}`) : regionState.disaster.kind, what: regionState.disaster.kind === 'flood' ? t('ri.disaster.flood') : regionState.disaster.kind === 'fire' ? t('ri.disaster.fire') : regionState.plague?.i > 0 ? t('ri.disaster.plague', { pct: Math.round(regionState.plague.i * 100) }) : t('ri.disaster.none'), until: regionState.plague?.i > 0 ? '' : t('ri.disaster.until', { n: regionState.disaster.until }) })}</div>
          )}
          {regionState.underInvasion && (
            <div className="flex items-center gap-1.5 text-fa-enemy font-semibold animate-pulse">
              <AlertTriangle className="w-3 h-3" /><span>{t('ri.underInvasion')}</span>
            </div>
          )}
          {regionState.siege && (
            <div className="rounded-lg border border-fa-enemy/70 bg-fa-raised p-2 text-[12px]" data-testid="siege-note">
              <div className="font-semibold">{regionState.siege.by ? t('ri.siegeBy', { name: pn(state.nations[regionState.siege.by], regionState.siege.by) || t('ri.siegeRebels') }) : t('ri.siegeRecovering')}{regionState.siege.encircled ? t('ri.encircled') : ''}</div>
              <div className="h-1.5 bg-fa-line rounded-full mt-1 overflow-hidden"><div className="h-full bg-fa-enemy" style={{ width: `${Math.round(100 * regionState.siege.hp / Math.max(1, regionState.siege.maxHp))}%` }} /></div>
              <div className="text-fa-muted mt-0.5">{t('ri.siegeHolds', { walls: wallsLabel(regionState), hp: regionState.siege.hp, max: regionState.siege.maxHp })}</div>
            </div>
          )}
          {regionState.owner && (() => {
            // The real city in battle (src/engine/cityManifest.js): who its houses shelter, and
            // what an earlier battle left in ruins or damaged (repairs are free).
            const dmg = cityDamageOf(regionState);
            const ruined = Object.keys(dmg.ruined).filter((id) => id.startsWith('house-')).length;
            const damaged = Object.keys(dmg.damaged).length;
            return (
              <div className="text-[12px] text-fa-text" data-testid="city-battle-note">
                {t('ri.battleHouses', { n: cityHousingCap(state, regionId) })}
                {ruined > 0 && <span className="text-fa-enemy">{t('ri.housesRuins', { count: ruined })}</span>}
                {damaged > 0 && <span className="text-fa-enemy">{t('ri.damagedRepairing', { n: damaged })}</span>}
              </div>
            );
          })()}
          {regionState.occupiedBy === state.playerNationId && occupationWar && (
            <div className="rounded-lg border border-fa-line bg-fa-raised p-2 text-[12px] space-y-1.5" data-testid="occupation-note">
              <div>{t('ri.occupationNote', { city: nameNow('city', null, regionData.name), owner: pn(ownerNation) || t('ri.theirs') })}</div>
              <button type="button" onClick={() => setPeaceOpen(true)} className="fa-btn fa-btn-secondary w-full" data-testid="open-peace-deal">{t('ri.negotiate')}</button>
            </div>
          )}
          {regionState.occupiedBy && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <Flag className="w-3 h-3" /><span>{t('ri.occupiedBy', { name: pn(state.nations[regionState.occupiedBy], regionState.occupiedBy) || t('ri.unknown') })}</span>
            </div>
          )}
          {revealed && rebelsHere.length > 0 && (
            <div className="flex items-center gap-1.5 text-fa-danger-text">
              <Flame className="w-3 h-3" /><span>{t('ri.rebelUnits', { count: rebelsHere.length })}</span>
            </div>
          )}
          {isPlayerOwned && regionState.formerOwner && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{t('ri.conqueredFrom', { name: pn(state.nations[regionState.formerOwner], regionState.formerOwner) || regionState.formerOwner })}</span>
            </div>
          )}
        </div>
      )}

      {/* Keep or raze a city taken by force (phase W3, razing.js). */}
      {isPlayerOwned && (regionState.conquest || regionState.razing) && <div className="mb-2"><RazeControl state={state} dispatch={dispatch} city={regionState} /></div>}

      {/* Foreign relations */}
      {!isPlayerOwned && ownerNation && (
        <div className="mb-2 space-y-1">
          {/* the word follows the opinion number, never the status stored when a deal was signed */}
          <StatLine label={t('ri.relation')} value={t(`p2.mood.${ownerMood}`)} valueClass={ownerMood === 'Friendly' || ownerMood === 'Warm' ? 'text-fa-good' : ownerMood === 'Wary' ? '' : 'text-fa-danger-text'} />
          <StatLine icon={Swords} label={t('ri.nationArmy')} value={revealed ? formatNumber(getFieldedStrength(state, regionState.owner)) : t('ri.armyUnknown')} valueClass={revealed ? 'text-fa-danger-text' : 'text-fa-muted'} />
          <StatLine label={t('ri.hostility')} value={`${ownerNation.hostility}%`} valueClass="text-fa-enemy" />
          <div className="flex flex-wrap gap-1 pt-1">
            {ownerNation.hasPeaceTreaty && !isAtWarWithPlayer(state, ownerNation.id) && <span className="px-1.5 py-0.5 bg-green-500/20 text-fa-good rounded text-[10px]">{t('ri.peaceTreaty')}</span>}
            {ownerNation.hasTradeAgreement && <span className="px-1.5 py-0.5 bg-blue-500/20 text-fa-you rounded text-[10px]">{t('ri.tradeAgreement')}</span>}
            {isAtWarWithPlayer(state, ownerNation.id) && <span className="px-1.5 py-0.5 bg-red-500/20 text-fa-danger-text rounded text-[10px] animate-pulse">{t('ri.atWar')}</span>}
            {ownerIsIndependent && <span className="px-1.5 py-0.5 bg-slate-500/20 text-fa-text rounded text-[10px]" data-testid="independent-badge" title={t('ri.independentTitle')}>{t('ri.independentBadge', { kind: independentKindName(ownerNation.indep?.personality || 'tribal', PERSONALITIES[ownerNation.indep?.personality]?.name || 'Tribal') })}</span>}
          </div>
          {ownerIsIndependent && <IndependentCityCard state={state} nationId={ownerNation.id} />}
        </div>
      )}

      {/* Attack / settle options — the foreign-region equivalent of "Manage Region" above. Also shown
          for land with no owner at all: a frontier region's only action, the expedition, lives here
          (it used to be hidden behind the owner check, so frontier land could never be claimed). */}
      {!isPlayerOwned && (ownerNation || isNeutralFrontier || canSettle) && (
        <div className="mb-2 pt-2 border-t border-fa-line space-y-1.5">
          {!hasMilitaryOption && !isNeutralFrontier && !canSettle && (
            <div className="text-fa-muted text-[10px]" data-testid="no-attack-reason">{atWarWithOwner ? t('ri.noAttackAtWar') : t('ri.noActions')}</div>
          )}
          {regionState.tile != null && (() => {
            const kind = claimOn(state, state.playerNationId, regionState);
            const pending = (state.nations[state.playerNationId]?.claimsInProgress || []).find((c) => c.cityId === regionId);
            const can = canFabricateClaim(state, state.playerNationId, regionId);
            // At war a new claim is pointless (it only justifies a war): show it only when one is held or in the works.
            if (atWarWithOwner && !kind && !pending) return null;
            return (
              <div className="rounded-lg border border-fa-line bg-fa-raised/60 p-2 space-y-1" data-testid="claim-card">
                <div className="text-[11px] text-fa-text">
                  {kind === 'core' ? t('ri.claimCore', { owner: pn(ownerNation) })
                    : kind === 'claim' ? t('ri.claimHeld')
                      : pending ? t('ri.claimPending', { turns: turnsOf(Math.max(0, pending.done - state.turnNumber)) })
                        : can.ok ? t('ri.claimNone', { turns: turnsOf(CLAIM_FABRICATE_TURNS) }) : reasonText(can)}
                </div>
                {!kind && !pending && can.ok && (
                  <ActionButton icon={Target} label={t('ri.fabricate', { city: nameNow('city', null, regionState.name) })} description={turnsOf(CLAIM_FABRICATE_TURNS)} costs={ACTION_COSTS.fabricateClaim}
                    onClick={() => dispatch({ type: ActionTypes.FABRICATE_CLAIM, payload: { cityId: regionId } })} disabled={!canPay(state, ACTION_COSTS.fabricateClaim)} why={payWhy(state, ACTION_COSTS.fabricateClaim)} size="small" />
                )}
              </div>
            );
          })()}
          {!atWarWithOwner && !isPlayerOwned && !!ownerNation && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5" data-testid="peace-gate">
              <div className="text-[11px] text-amber-200">
                {t('ri.peaceGate', { owner: pn(ownerNation), how: hasMilitaryOption ? t('ri.peaceGateInvade') : t('ri.peaceGateMarch') })}
                {breaksTruce && <span className="block text-fa-danger-text mt-0.5">{t('ri.breaksTruce')}</span>}
              </div>
              <ActionButton
                icon={Swords}
                label={t('ri.declareOn', { owner: pn(ownerNation), unjust: warJustified ? '' : t('ri.unjustified') })}
                description={warBlockedReason || (warJustified ? t('ri.causeYes') : t('ri.causeNo'))}
                costs={declareWarCosts}
                onClick={handleDeclareWar}
                disabled={!!warBlockedReason || !canPay(state, declareWarCosts)}
                why={warBlockedReason || payWhy(state, declareWarCosts)}
                variant="danger"
                size="small"
              />
            </div>
          )}
          {regionState.integratingUntil > state.turnNumber && <p className="text-xs text-amber-200">{t('ri.integrating', { n: regionState.integratingUntil })}</p>}
          {ownerNation?.hasTradeAgreement && (() => { const route = tradeRouteStatus(state, ownerNation.id); return route ? <p className={`text-xs ${route.pays ? 'text-fa-text' : 'text-fa-danger-text'}`} data-testid="trade-route-status">{t('ri.tradeRoute', { text: msgRefText(route.textMsg, route.text), bigger: route.pays ? t('ri.biggerPay') : '', advice: route.advice ? ` ${msgRefText(route.adviceMsg, route.advice)}` : '' })}</p> : null; })()}
          {isNeutralFrontier && <ColonyBlock regionId={regionId} />}
          {atWarWithOwner && invasionSources.map(({ regionId: srcId, unitCount, blockedReason, march, where }) => (march ? (
            <ActionButton
              key={srcId}
              icon={Swords}
              label={t('ri.marchOn', { city: nameNow('city', null, regionState.name), where: where ? t('ri.armyWhere', { where }) : '' })}
              description={march.ok ? t('ri.marchDesc', { turns: turnsOf(march.turns), stops: march.stopsAt ? t('ri.stopsAt', { city: state.regions[march.stopsAt]?.name ? nameNow('city', null, state.regions[march.stopsAt].name) : t('ri.anEnemyCity') }) : '' }) + ` ${marchOddsText(estimateMarchOdds(state, marchAttackUnits(state, srcId), regionId), nameNow('city', null, regionState.name))?.text || ''}` : reasonText(march)}
              onClick={() => dispatch({ type: ActionTypes.SET_ROUTE, payload: { fromRegionId: srcId, toRegionId: regionId, attack: true } })}
              disabled={!march.ok}
              why={march.ok ? null : reasonText(march)}
              variant="danger"
              size="small"
            />
          ) : (
            <ActionButton
              key={srcId}
              icon={Flag}
              label={t('ri.invade', { city: nameNow('city', null, regionState.name), where: where ? t('ri.armyWhere', { where }) : '' })}
              description={blockedReason || t('ri.landUnits', { count: unitCount })}
              costs={ACTION_COSTS.launchInvasion}
              onClick={() => handleInvade(srcId)}
              disabled={!!blockedReason}
              why={blockedReason}
              variant="danger"
              size="small"
            />
          )))}
          {atWarWithOwner && amphibiousSources.map(({ unit, cargoCount, blockedReason }) => (
            <ActionButton
              key={unit.id}
              icon={Anchor}
              label={t('ri.amphibious', { city: nameNow('city', null, REGIONS_DATA[unit.regionId]?.name) })}
              description={blockedReason || t('ri.embarked', { count: cargoCount })}
              costs={ACTION_COSTS.amphibiousAssault}
              onClick={() => handleAmphibiousAssault(unit.id)}
              disabled={!!blockedReason}
              why={blockedReason}
              variant="danger"
              size="small"
            />
          ))}
          {atWarWithOwner && navalEngagementSources.map((srcId) => (
            <ActionButton
              key={srcId}
              icon={Ship}
              label={t('ri.naval', { city: nameNow('city', null, REGIONS_DATA[srcId]?.name) })}
              description={t('ri.contest', { count: defendingNavalUnits.length })}
              costs={ACTION_COSTS.navalEngagement}
              onClick={() => handleNavalEngagement(srcId)}
              disabled={!canPay(state, ACTION_COSTS.navalEngagement)}
              why={payWhy(state, ACTION_COSTS.navalEngagement)}
              variant="danger"
              size="small"
            />
          ))}
          {canSettle && (
            <ActionButton
              icon={Flag}
              label={t('ri.settle')}
              description={t('ri.settleDesc', { who: regionOwner && !regionOwner.isEliminated ? t('ri.rebelsHold') : t('ri.noOneGoverns'), control: Math.round(regionState.control) })}
              costs={ACTION_COSTS.settleColonize}
              onClick={handleSettleColonize}
              disabled={!canPay(state, ACTION_COSTS.settleColonize)}
              why={payWhy(state, ACTION_COSTS.settleColonize)}
              size="small"
            />
          )}
        </div>
      )}

      {/* ---- The big picture: everything about this province, scrollable. A foreign province's
          insides stay hidden until a successful espionage op against its owner (engine/intel.js). ---- */}
      {!revealed && (
        <Section icon={EyeOff} title={t('ri.noIntel')}>
          <div className="text-fa-muted mb-2">
            {t('ri.noIntelBody', { owner: pn(ownerNation) || t('ri.itsOwner') })}
          </div>
          {regionState.tile != null && regionState.owner && (isPlayerOwned || revealed) && (() => {
            const lt = loyaltyTarget(state, regionState);
            const culture = Object.entries(cultureOf(regionState)).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const loyalty = loyaltyOf(regionState);
            return (
              <div className="mb-2" data-testid="loyalty">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-fa-muted">{t('ri.loyalty')}</span>
                  <span className={`font-mono font-bold ${loyalty <= 25 ? 'text-fa-danger-text' : loyalty < lt.total ? 'text-amber-300' : 'text-fa-good'}`}>{loyalty}{loyalty !== lt.total ? ` → ${lt.total}` : ''}</span>
                </div>
                <ProgressBar value={loyalty} color="dynamic" size="small" />
                <div className="text-[10px] text-fa-muted mt-0.5">
                  {culture.map(([id, v]) => `${pn(state.nations[id], id) || id} ${Math.round(v * 100)}%`).join(' · ')}
                  {lt.fromShare != null && t('sw.loy.people', { n: lt.fromShare })}{lt.garrison ? t('sw.loy.garrison', { n: `+${lt.garrison}` }) : ''}{lt.amenities ? t('sw.loy.amenities', { n: signed(lt.amenities) }) : ''}{lt.conquered ? t('sw.loy.conquered', { n: lt.conquered }) : ''}{lt.capitalLost ? t('sw.loy.capitalLost', { n: lt.capitalLost }) : ''}{lt.governor ? t('sw.loy.governor', { n: signed(lt.governor) }) : ''}{lt.law ? t('sw.loy.laws', { n: signed(lt.law) }) : ''}{lt.wonder ? t('sw.loy.wonder', { n: `+${lt.wonder}` }) : ''}
                </div>
              </div>
            );
          })()}
          {regionState.lastAttackedTurn != null && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-fa-muted">{t('ri.controlSiege')}</span>
                <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>{Math.round(regionState.control)}%</span>
              </div>
              <ProgressBar value={regionState.control} color="dynamic" size="small" />
            </div>
          )}
          <ActionButton
            icon={Eye}
            label={t('ri.gatherIntel')}
            description={t('ri.gatherDesc', { nation: pn(ownerNation) || t('ri.thisNation'), p: Math.round(ESPIONAGE_SUCCESS_CHANCE * 100), n: INTEL_DURATION_TURNS })}
            costs={ACTION_COSTS.espionage}
            onClick={handleGatherIntel}
            disabled={!canPay(state, ACTION_COSTS.espionage)}
            why={payWhy(state, ACTION_COSTS.espionage)}
            resources={state.resources}
            size="small"
          />
        </Section>
      )}
      {revealed && (<>
      <Section icon={Target} title={t('ri.overview')} aside={!isPlayerOwned && intelTurnsLeft !== null ? (intelTurnsLeft > 0 ? t('ri.intelLeft', { count: intelTurnsLeft }) : t('ri.intelLast')) : null}>
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-fa-muted">{t('ri.control')}</span>
            <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>{Math.round(regionState.control)}%</span>
          </div>
          <ProgressBar value={regionState.control} color="dynamic" size="small" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile icon={Users} label={t('ri.pop')} value={formatNumber(shownPeople(regionState.currentPopulation ?? sizeToPeople(regionState.size), sideAgeOf(state, regionState.owner)))} sub={regionState.size != null ? t('ri.sizeSub', { n: regionState.size }) : undefined} />
          <StatTile icon={HeartPulse} label={t('ri.stability')} value={`${Math.round(getStability(regionState))}%`} valueClass={getStability(regionState) < 50 ? 'text-fa-danger-text' : 'text-fa-text'} />
          <StatTile icon={Building} label={t('ri.infrastructure')} value={`${regionState.currentInfrastructure || 0}/10`} sub={t('ri.supply', { n: getSupplyCapacity(regionState.currentInfrastructure) })} />
          <StatTile icon={Shield} label={t('ri.defenses')} value={t('ri.lv', { n: regionState.defenseLevel || 0 })} sub={t('ri.terrainFort', { n: regionData.fortification })} />
          <StatTile icon={Target} label={t('ri.strategic')} value={`${regionData.strategicValue}/10`} />
          {(regionState.climateResilience || 0) > 0
            ? <StatTile icon={Sprout} label={t('ri.climate')} value={regionState.climateResilience} />
            : <StatTile icon={Swords} label={t('ri.garrison')} value={ownGarrison.length} sub={ownGarrison.length ? t('ri.strengthN', { n: formatNumber(ownGarrison.reduce((sum, u) => sum + (u.strength || 0), 0)) }) : t('ri.noTroops')} />}
        </div>
      </Section>

      <Section icon={TrendingUp} title={t('ri.development')} aside={t('ri.totalDev', { n: totalDev })}>
        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label={t('ri.tax')} value={regionState.dev?.tax || 0} valueClass="text-amber-300" />
          <StatTile label={t('ri.production')} value={regionState.dev?.production || 0} valueClass="text-fa-you" />
          <StatTile label={t('ri.manpower')} value={regionState.dev?.manpower || 0} valueClass="text-fa-danger-text" />
        </div>
      </Section>

      <Section icon={Swords} title={t('ri.armiesHere')} aside={unitsHere.length ? t('ri.unitsAside', { count: unitsHere.length }) : null}>
        {unitsHere.length === 0 && <Empty>{t('ri.noUnits')}</Empty>}
        {awayTiles.map((tile) => {
          const n = awayUnits.filter((u) => unitTile(state, u) === tile).length;
          return (
            <button key={tile} type="button" onClick={() => selectArmy(tile)} data-testid="army-away" className="w-full text-start min-h-[36px] rounded-lg bg-fa-hover hover:bg-fa-line text-[11px] text-fa-text px-2 mb-1.5">
              {t('ri.awayArmy', { count: n, where: whereLabel(state, tile).text })}
            </button>
          );
        })}
        <div className="space-y-1.5">
          {unitGroups.map(({ ownerId, units }) => (
            <div key={ownerId}>
              <div className="flex items-center gap-1.5 text-[10px] text-fa-muted mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ownerId === REBEL_OWNER_ID ? '#ef4444' : state.nations[ownerId]?.color || '#64748b' }} />
                <span className="truncate">{ownerId === REBEL_OWNER_ID ? t('ri.rebels') : ownerId === state.playerNationId ? t('ri.yourForces') : pn(state.nations[ownerId], ownerId) || ownerId}</span>
                <span className="ms-auto font-mono">{t('ri.str', { n: formatNumber(units.reduce((sum, u) => sum + (u.classId === 'settler' ? 0 : u.strength || 0), 0)) })}</span>
              </div>
              <div className="space-y-1">
                {units.map((unit) => (
                  <UnitLine key={unit.id} unit={unit} age={ageOf(state, state.playerNationId)} commander={unit.commanderId ? state.hiredCommanders?.[unit.commanderId] : null} />
                ))}
              </div>
              {ownerId === state.playerNationId && units.some((u) => u.domain !== 'naval' && !u.embarkedOn) && (() => {
                const onRoute = units.find((u) => u.route?.length);
                const dest = onRoute?.route[onRoute.route.length - 1];
                // The order is for the land units that stand here (their ids), never for every
                // unit based here; "Choose units" opens the stack's own sheet to march a part of it.
                const landHere = units.filter((u) => u.domain !== 'naval' && !u.embarkedOn && u.classId !== 'settler');
                const ids = landHere.map((u) => u.id);
                return (
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={() => startMarch(regionId, { unitIds: ids })} data-testid="march-start" className="flex-1 min-h-[36px] rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-fa-text text-[12px] font-semibold flex items-center justify-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" /> {t('ri.marchBtn')}
                    </button>
                    {landHere.length > 1 && regionState.tile != null && (
                      <button onClick={() => selectArmy(regionState.tile)} data-testid="march-choose-units" title={t('ri.chooseUnitsTitle')} className="flex-1 min-h-[36px] rounded-lg bg-fa-hover hover:bg-fa-line text-[12px] px-2">
                        {t('ri.chooseUnits')}
                      </button>
                    )}
                    {onRoute && (
                      <button onClick={() => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: ids } })} className="flex-1 min-h-[36px] rounded-lg bg-fa-hover hover:bg-fa-line text-[12px] truncate px-2" title={t('ri.marchingTo', { place: nameNow('place', null, placeName(state, dest)) })}>
                        {t('ri.stopMarch', { place: nameNow('place', null, placeName(state, dest)) })}
                      </button>
                    )}
                  </div>
                );
              })()}
              {ownerId === state.playerNationId && units.some((u) => u.domain === 'naval' && !atSea(state, u)) && (() => {
                const sailing = units.find((u) => u.domain === 'naval' && u.route?.length);
                const dest = sailing?.route[sailing.route.length - 1];
                return (
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={() => startMarch(regionId, { naval: true })} data-testid="sail-start" className="flex-1 min-h-[36px] rounded-lg bg-sky-700/80 hover:bg-sky-600 text-fa-text text-[12px] font-semibold flex items-center justify-center gap-1.5">
                      <Ship className="w-3.5 h-3.5" /> {t('ri.sailBtn')}
                    </button>
                    {sailing && (
                      <button onClick={() => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: units.filter((u) => u.domain === 'naval').map((u) => u.id) } })} className="flex-1 min-h-[36px] rounded-lg bg-fa-hover hover:bg-fa-line text-[12px] truncate px-2" title={t('ri.sailingTo', { place: nameNow('place', null, placeName(state, dest)) })}>
                        {t('ri.stopSailing', { place: nameNow('place', null, placeName(state, dest)) })}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Building2} title={t('ri.buildings')} aside={t('ri.slots', { a: usedBuildingSlots, b: buildingSlots })}>
        {builtCategories.length === 0 && <Empty>{t('ri.noBuildings')}</Empty>}
        <div className="space-y-1">
          {builtCategories.map(({ categoryId, tier }) => {
            const category = BUILDING_CATEGORIES[categoryId];
            return (
              <div key={categoryId} className="flex items-center gap-2 bg-fa-raised/60 rounded px-2 py-1.5">
                <BuildingIcon category={categoryId} tier={tier} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-fa-text font-semibold truncate">{categoryTierName(categoryId, tier)}</div>
                  <div className="text-fa-muted text-[10px]">{buildingCategoryLabel(categoryId, category.label)}</div>
                </div>
                <TierPips filled={tier + 1} total={category.tiers.length} />
              </div>
            );
          })}
        </div>
      </Section>

      {projectsHere.length > 0 && (
        <Section icon={Landmark} title={t('ri.greatProjects')}>
          <div className="space-y-1">
            {projectsHere.map(({ projectId, tier }) => (
              <div key={projectId} className="flex items-center justify-between bg-fa-raised/60 rounded px-2 py-1.5">
                <span className="text-yellow-200 font-semibold truncate inline-flex items-center gap-1.5"><WonderIcon projectId={projectId} size={20} />{wonderName(projectId, GREAT_PROJECTS[projectId]?.name)}</span>
                <TierPips filled={tier} total={GREAT_PROJECTS[projectId]?.tiers?.length || 3} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section icon={Gem} title={t('ri.resources')}>
        {deposits.length === 0 && <Empty>{t('ri.noDeposits')}</Empty>}
        <div className="flex flex-wrap gap-1.5">
          {deposits.map((resId) => {
            const developed = !!regionState.buildings?.extraction?.[resId];
            return (
              <div key={resId} className={`flex items-center gap-1.5 rounded px-2 py-1 border ${developed ? 'border-emerald-500/50 bg-emerald-500/10 text-fa-good' : 'border-fa-line bg-fa-raised/60 text-fa-muted'}`}>
                {developed ? <ExtractionIcon resourceId={resId} size={18} /> : <ResourceIcon resourceId={resId} size={18} />}
                <span className="capitalize">{resourceName(resId, resId)}</span>
                <span className="text-[10px] opacity-80">{developed ? extractionName(resId, EXTRACTION_BUILDINGS[resId]?.name) : t('ri.undeveloped')}</span>
              </div>
            );
          })}
        </div>
      </Section>
      </>)}

      <Section icon={Compass} title={t('ri.neighbours')} aside={neighbors.length ? `${neighbors.length}` : null}>
        {neighbors.length === 0 && <Empty>{t('ri.noNeighbours')}</Empty>}
        <div className="flex flex-wrap gap-1">
          {neighbors.map(({ id, name, color, mine }) => (
            <span key={id} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${mine ? 'bg-blue-500/15 text-blue-200' : 'bg-fa-raised/70 text-fa-text'}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
      </Section>

      <TopLayer>
        {battleChoiceFrom && <PreBattleModal fromRegionId={battleChoiceFrom} targetRegionId={regionId} onClose={() => setBattleChoiceFrom(null)} />}
        {peaceOpen && occupationWar && <PeaceDealSheet warId={occupationWar.id} onClose={() => setPeaceOpen(false)} />}
        {landingChoice && <PreBattleModal navalUnitId={landingChoice} targetRegionId={regionId} onClose={() => setLandingChoice(null)} />}
      </TopLayer>

      {/* Description */}
      {regionData.description && (
        <div className="mt-2 pt-2 border-t border-fa-line text-fa-muted text-[10px] italic">
          {regionData.description}
        </div>
      )}
    </div>
  );
};

// ---- small presentational pieces ------------------------------------------------------------

const Section = ({ icon: Icon, title, aside, children }) => (
  <div className="mt-2 pt-2 border-t border-fa-line">
    <div className="flex items-center gap-1.5 mb-1.5 text-fa-text font-semibold">
      {Icon && <Icon className="w-3.5 h-3.5 text-fa-muted" />}
      <span>{title}</span>
      {aside && <span className="ms-auto text-fa-muted font-normal text-[10px]">{aside}</span>}
    </div>
    {children}
  </div>
);

const Empty = ({ children }) => <div className="text-fa-muted text-[10px]">{children}</div>;

const StatLine = ({ icon: Icon, label, value, valueClass = 'text-fa-text', valueStyle }) => (
  <div className="flex items-center justify-between">
    <span className="text-fa-muted flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />}{label}:</span>
    <span className={`font-semibold ${valueClass}`} style={valueStyle}>{value}</span>
  </div>
);

const StatTile = ({ icon: Icon, label, value, sub, valueClass = 'text-fa-text' }) => (
  <div className="bg-fa-raised/60 rounded px-2 py-1.5 min-w-0">
    <div className="text-fa-muted text-[10px] flex items-center gap-1 truncate">{Icon && <Icon className="w-3 h-3 shrink-0" />}{label}</div>
    <div className={`font-mono font-bold ${valueClass}`}>{value}</div>
    {sub && <div className="text-fa-muted text-[12px] truncate">{sub}</div>}
  </div>
);

const TierPips = ({ filled, total }) => (
  <div className="flex gap-0.5 shrink-0" title={tNow('ri.tier', { a: filled, b: total })}>
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-amber-400' : 'bg-fa-hover'}`} />
    ))}
  </div>
);


// Settlers are no soldiers: no rank, strength, morale or supply, but what they are doing and the
// way to give them a site (playtest audit I057). Foreign settlers only say who they are.
const SettlerLine = ({ unit, age }) => {
  const { state } = useGame();
  const own = unit.ownerId === state.playerNationId;
  const status = own ? settlerStatus(state, unit) : null;
  return (
    <div className="flex items-center gap-2 bg-fa-raised/60 rounded px-2 py-1.5" data-testid="settler-line">
      <UnitIcon classId="settler" ageId={age} size={24} />
      <div className="min-w-0 flex-1">
        <div className="text-fa-text font-semibold truncate">{tNow('ri.settlers')}</div>
        <div className="text-[10px] text-fa-muted leading-tight">{status ? status.text : tNow('ri.settlersLooking')}</div>
      </div>
      {own && unit.tile != null && (
        <button type="button" onClick={() => selectTile(unit.tile)} data-testid="settler-choose-site" className="shrink-0 min-h-[36px] px-2.5 rounded-lg bg-fa-hover hover:bg-fa-line text-[11px] font-semibold">
          {status.state === 'travelling' ? tNow('ri.show') : tNow('ri.chooseSite')}
        </button>
      )}
    </div>
  );
};

const UnitLine = ({ unit, age, commander }) => {
  if (unit.classId === 'settler') return <SettlerLine unit={unit} age={age} />;
  const cls = UNIT_CLASSES[unit.classId];
  const strengthPct = unit.maxStrength ? Math.round((unit.strength / unit.maxStrength) * 100) : 100;
  return (
    <div className="flex items-center gap-2 bg-fa-raised/60 rounded px-2 py-1.5">
      <UnitIcon classId={unit.classId} navalLine={unit.navalLine} ageId={age} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-fa-text font-semibold truncate">{unitClassName(unit.classId, cls?.name || unit.classId)}</span>
          <span className="text-fa-muted text-[10px] capitalize">{tNow(`bt.rank.${getRankForXp(unit.xp || 0)}`)}</span>
          {unit.embarkedOn && <Anchor className="w-3 h-3 text-fa-you" aria-label={tNow('ri.embarkedAria')} />}
        </div>
        <div className="h-1 bg-fa-hover rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${strengthPct}%`, background: strengthPct > 60 ? '#22c55e' : strengthPct > 30 ? '#f59e0b' : '#ef4444' }} />
        </div>
        {commander && <div className="text-[10px] text-purple-300 truncate mt-0.5">{tNow('ri.ledBy', { name: nameNow('person', null, commander.name) })}</div>}
      </div>
      <div className="text-end font-mono text-[10px] text-fa-muted shrink-0">
        <div>{unit.strength}/{unit.maxStrength}</div>
        <div>{tNow('ri.mor', { n: unit.morale })}</div>
        {unit.domain !== 'naval' && <div className={supplyOf(unit) < 30 ? 'text-fa-danger-text' : ''} title={tNow('ri.supTitle')}>{tNow('ri.sup', { n: supplyOf(unit) })}</div>}
      </div>
    </div>
  );
};

export default RegionInfoModal;
