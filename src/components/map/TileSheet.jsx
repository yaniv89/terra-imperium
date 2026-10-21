// src/components/map/TileSheet.jsx
// The tile sheet (plans/civ-map-rework.md E4; W04 in plans/UI-DESIGN.md): what a tapped tile of land
// is (terrain, features, river, coast, resource, yields, who owns it) and what the player can do
// there. As the settle lens's site card: the centre's yields, why the site is good, the nearest
// city in km, the claim, and the reason a red tile is blocked with its numbers; the one brass
// action is "Found City here" (settlers on it) or "Go and found city" (idle settlers elsewhere).
// Also the armies on the tile (attack, declare war) and a fleet's landing. Docked on the left as
// a corner card; a bottom sheet on a phone held upright.
import { t as tNow } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { nameNow } from '../../i18n/names';
import { terrainWord, tileResourceName, improvementName, districtName } from '../../i18n/gameText';
import React, { useMemo, useRef } from 'react';
import { useCornerSheet } from '../../hooks/useExclusivePanel';
import { MapPin, Tent, Flag, Swords, Ban, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { tileFacts, IMPROVEMENTS, resourceKnown } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { ResourceIcon, ImprovementIcon } from '../ui/icons';
import { settlerPath, settlersOf, settlersHomeCity, SETTLER_MOVES } from '../../engine/settlers';
import countriesMeta from '../../data/geo/countries-meta.json';
import { atSea } from '../../engine/fleets';
import { tileAccess, unitTile } from '../../engine/armies';
import { declareWarModel } from '../panels/warActions';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import PreBattleModal from '../battle/PreBattleModal';
import { Button, CloseButton, Label, Stat } from '../ui/atlas';
import { settleSiteModel } from './settleSiteModel';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { declareWarConfirm } from '../ui/confirmSpecs';
import { settlerStatus } from './settleRoutes';
import { useReportInset } from '../../context/MapInsetsContext';
import { ageOf, getResearched } from '../../engine/nationState';

// `settleUnitId`: the settler whose site is being chosen (the settle mode, settleMode.js): it is
// the one that goes, whatever other settlers wait. `onSettle(unit)` starts the mode for a settler.
const TileSheet = ({ tile, onClose, onSelectRegion, settleUnitId = null, onSettle = null }) => {
  const { state, dispatch } = useGame();
  const { t, lang } = useT();
  const [attackFrom, setAttackFrom] = React.useState(null);
  const [confirmDisband, setConfirmDisband] = React.useState(null); // a settler's id: "Send them home?"
  const isMobile = useIsMobile();
  const corner = useCornerSheet('tile-sheet', tile != null, onClose); // one sheet at a time on a phone (H-18)
  // The map centres a site in the part of the screen this sheet leaves (MapInsetsContext): "Next
  // good site" never lands under it (playtest audit I088).
  const sheetRef = useRef(null);
  useReportInset('tile-sheet', isMobile ? 'bottom' : 'left', sheetRef, tile != null);
  const tiles = getTiles();
  const me = state.playerNationId;
  const ageId = ageOf(state, state.playerNationId);
  const facts = useMemo(() => (tile == null ? null : tileFacts(tiles, tile, state.world?.tileState?.[tile])), [tile, tiles, state.world]);
  const settlers = useMemo(() => settlersOf(state.units, me), [state.units, me]);
  const site = useMemo(() => (facts?.land ? settleSiteModel(state, tile, ageId) : null), [state, tile, ageId, facts, lang]); // eslint-disable-line react-hooks/exhaustive-deps -- lang only words the site
  if (tile == null || !facts || !corner.shown) return null;
  const here = settlers.filter((u) => u.tile === tile);
  const coming = settlers.filter((u) => u.target === tile && u.tile !== tile);
  const idle = settlers.filter((u) => u.target == null && u.tile !== tile);
  const ownerCity = state.world?.tileOwner?.[tile] ? state.regions[state.world.tileOwner[tile]] : null;
  const ownerNation = ownerCity ? state.nations[ownerCity.owner] : null;
  const name = tiles.names[tile] ? nameNow('place', null, tiles.names[tile]) : facts.river ? (tiles.riverNames[tile] ? t('mx.tile.onRiver', { name: nameNow('place', null, tiles.riverNames[tile]) }) : t('mx.tile.onRiverPlain')) : facts.land ? t('mx.tile.wild') : t('mx.tile.openWater');
  const parts = [terrainWord(facts.terrain), facts.relief !== 'flat' ? terrainWord(facts.relief) : null, facts.feature !== 'none' ? terrainWord(facts.feature) : null, facts.river ? terrainWord('river') : null, facts.coastal && facts.land ? terrainWord('coast') : null].filter(Boolean);
  const country = tiles.countryOf(tile);
  const turnsFor = (u) => { const p = settlerPath(state, u.tile, tile, me); return p ? Math.ceil(p.length / SETTLER_MOVES) : null; };
  const turnsText = (count) => (count == null ? t('mx.tile.unknownTurns') : t('march.turns', { count }));
  const cityText = (id, english) => nameNow('city', null, english || id);
  // An enemy army on this tile and your stacks beside it: a field battle (fieldBattle.js).
  const enemyHere = facts.land ? enemyStackAt(state, tile, me) : [];
  // A foreign army at peace with you on this tile: name it, and offer the war (warActions.js).
  const foreignHere = facts.land && !enemyHere.length ? Object.values(state.units).filter((u) => u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && u.ownerId !== me && u.ownerId !== 'rebels' && unitTile(state, u) === tile) : [];
  const foreignWar = foreignHere.length ? declareWarModel(state, foreignHere[0].ownerId) : null;
  const attackSources = enemyHere.length
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === me && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.tile != null && tiles.neighbors[u.tile].includes(tile)).map((u) => u.regionId))]
      .map((rid) => ({ regionId: rid, v: validateFieldAttack(state, rid, tile) }))
    : [];
  // A fleet at sea beside this shore can land its troops here (fleets.js), on own, allied or free land.
  const landing = facts.land && ['own', 'friend', 'wild'].includes(tileAccess(state, tile, me))
    ? Object.values(state.units).filter((u) => u.ownerId === me && u.domain === 'naval' && atSea(state, u) && tiles.neighbors[u.tile].includes(tile))
      .flatMap((f) => Object.values(state.units).filter((c) => c.embarkedOn === f.id))
    : [];
  // The settlers who would go: the ones whose site is being chosen (the settle mode), else the
  // nearest idle ones that can reach it.
  const chosen = settleUnitId ? idle.find((u) => u.id === settleUnitId) : null;
  const goer = site?.ok ? (chosen ? [chosen] : idle).map((u) => ({ u, turns: turnsFor(u) })).filter((x) => x.turns != null).sort((a, b) => a.turns - b.turns)[0] || null : null;
  const cannotReach = site?.ok && chosen && !goer;
  // A site for a city (free land while you have settlers): what its CENTRE would yield, which the
  // city rules never let fall under 2 food, 1 production, 1 gold; otherwise the tile's own yields.
  const asSite = settlers.length > 0 && !ownerCity && !!site?.centre;
  const yields = (asSite ? site.centre : site?.yields) || { food: 0, production: 0, gold: 0 };
  const resource = facts.resource && resourceKnown(facts.resource, ageId, getResearched(state, state.playerNationId)) ? facts.resource : null;
  // The one main action sits in the sheet's footer, always in view (it used to be under the fold
  // at 844x340: playtest audit I090).
  const sendGoer = () => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: goer.u.id, tile } });
  const main = here.length > 0 && !ownerCity
    ? <Button variant="primary" hero className="w-full" disabled={!site?.ok} onClick={() => dispatch({ type: ActionTypes.FOUND_CITY, payload: { unitId: (here.find((u) => u.id === settleUnitId) || here[0]).id } })} data-testid="found-city"><Flag className="w-4 h-4" aria-hidden="true" /> {t('mx.tile.foundHere')}</Button>
    : !ownerCity && goer
      ? <Button variant="primary" hero className="w-full" onClick={sendGoer} data-testid="send-settler"><Tent className="w-4 h-4" aria-hidden="true" /> {t('mx.tile.goFound', { turns: turnsText(goer.turns) })}</Button>
      : null;

  const body = (
    <>
      <div className="flex items-start gap-2.5 mb-2">
        {settlers.length ? <Tent className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" /> : <MapPin className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h2 className="fa-heading text-[17px] leading-tight truncate">{name}</h2>
          <div className="text-[12px] text-fa-muted capitalize">{parts.join(', ')}{country && !ownerCity ? t('mx.tile.lands', { name: nameNow('land', null, countriesMeta[country]?.name || country) }) : ''}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {enemyHere.length > 0 && (
        <div className="mb-2 space-y-1.5" data-testid="enemy-army-here">
          <div className="text-[13px] text-fa-danger-text font-semibold flex items-center gap-1.5"><Swords className="w-4 h-4" /> {t('mx.tile.enemyArmy', { count: enemyHere.length, name: state.nations[enemyHere[0].ownerId]?.name ? nameNow('people', enemyHere[0].ownerId, state.nations[enemyHere[0].ownerId].name) : t('mx.tile.rebel') })}</div>
          {attackSources.map(({ regionId, v }) => (
            <Button key={regionId} variant="danger" className="w-full" disabled={!v.ok && v.reason !== 'cost'} onClick={() => setAttackFrom(regionId)} data-testid="attack-army">
              {t('mx.tile.attackWith', { name: cityText(regionId, state.regions[regionId]?.name), extra: v.ok ? t('mx.tile.attackUnits', { count: v.attackerUnits.length }) : v.reason === 'no_moves' ? t('mx.tile.attackMoved') : '' })}
            </Button>
          ))}
        </div>
      )}
      {foreignWar && (
        <div className="mb-2 space-y-1.5" data-testid="foreign-army-here">
          <div className="text-[13px] text-fa-enemy font-semibold">{t('mx.tile.foreignArmy', { name: foreignWar.shown, count: foreignHere.length })}</div>
          <Button variant="danger" className="w-full" disabled={!foreignWar.enabled} onClick={() => askConfirm(declareWarConfirm(state, foreignWar.nationId), () => dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId: foreignWar.nationId } }))} title={foreignWar.note} data-testid="tile-declare-war"><Swords className="w-4 h-4" /> {foreignWar.label}</Button>
        </div>
      )}
      {attackFrom && <PreBattleModal fromRegionId={attackFrom} tile={tile} onClose={() => setAttackFrom(null)} />}

      {facts.land && <Label className="mb-1">{asSite ? t('mx.tile.chosenSite') : t('mx.tile.thisTile')}</Label>}
      <div className="grid grid-cols-3 gap-1.5 mb-2" data-testid="tile-yields">
        <Stat value={`+${yields.food}`} label={t('mx.tile.food')} color="var(--fa-good)" />
        <Stat value={`+${yields.production}`} label={t('mx.tile.production')} />
        <Stat value={`+${yields.gold}`} label={t('mx.tile.gold')} color="var(--fa-brass)" />
      </div>
      {asSite && site.warnings.map((w) => (
        <div key={w.id} className="flex items-start gap-2 rounded-lg border border-amber-400/70 bg-[rgba(251,191,36,0.12)] px-3 py-2 mb-2 text-[12px]" data-testid="site-warning" data-warning={w.id}>
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" aria-hidden="true" />
          <span>{w.text}</span>
        </div>
      ))}
      {(resource || facts.improvement || facts.district) && (
        <div className="flex flex-wrap gap-2 text-[12px] mb-2">
          {resource && <span className="capitalize inline-flex items-center gap-1"><ResourceIcon resourceId={resource} size={18} />{tileResourceName(resource)}</span>}
          {facts.improvement && <span className="inline-flex items-center gap-1"><ImprovementIcon improvementId={facts.improvement} size={18} />{improvementName(facts.improvement, IMPROVEMENTS[facts.improvement]?.name || facts.improvement)}{facts.pillaged ? t('mx.tile.pillaged') : ''}</span>}
          {facts.district && <span className="text-fa-indep" data-testid="tile-district">{districtName(facts.district, DISTRICTS[facts.district]?.name || facts.district)}{facts.pillaged ? t('mx.tile.pillaged') : ''}</span>}
        </div>
      )}
      {ownerCity ? (
        <button type="button" onClick={() => onSelectRegion?.(ownerCity.id)} className="w-full text-start text-[13px] fa-card hover:bg-fa-hover px-3 py-2 min-h-[44px]">
          {t('mx.tile.landOf')} <span className="font-semibold">{nameNow('city', null, ownerCity.name)}</span> <span className="text-fa-muted">({nameNow('people', ownerCity.owner, ownerNation?.name || ownerCity.owner)})</span>
          {settlers.length > 0 && ownerCity.owner !== me && <span className="block text-[12px] text-fa-danger-text" data-testid="settle-reason">{t('mx.tile.noCityHere', { name: nameNow('people', ownerCity.owner, ownerNation?.name || ownerCity.owner) })}</span>}
        </button>
      ) : (
        <div className="space-y-2">
          {facts.land && site ? (
            <>
              <ul className="space-y-0.5 text-[12px]" data-testid="site-facts">
                {site.lines.map((l) => <li key={l.id} className="flex gap-2"><span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-fa-muted shrink-0" aria-hidden="true" />{l.text}</li>)}
              </ul>
              {!site.ok && (
                <div className="rounded-lg border border-fa-danger bg-[rgba(229,96,77,0.12)] px-3 py-2 text-[13px]" data-testid="settle-reason">
                  <div className="flex items-start gap-2">
                    <Ban className="w-4 h-4 mt-0.5 text-fa-danger-text shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-fa-danger-text">{site.reason}</span>
                  </div>
                  {site.tooClose && <div className="mt-1 text-[11px] text-fa-muted" data-testid="spacing-rule">{site.spacing.text}{settleUnitId ? tNow('st.nextGood') : ''}</div>}
                </div>
              )}
            </>
          ) : <div className="text-[12px] text-fa-muted">{tNow('st.noOneAtSea')}</div>}
          {coming.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-[13px] fa-card px-3 min-h-[44px]">
              <span className="flex items-center gap-1.5"><Tent className="w-4 h-4" /> {t('mx.tile.arrive', { turns: turnsText(turnsFor(u)) })}</span>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile: null } })}>{t('mx.cancel')}</Button>
            </div>
          ))}
          {!here.length && goer && <div className="text-[12px] text-fa-muted">{t('mx.tile.arriveFrom', { from: state.regions[goer.u.regionId]?.name ? cityText(goer.u.regionId, state.regions[goer.u.regionId].name) : t('mx.tile.road'), turns: turnsText(goer.turns) })}</div>}
          {cannotReach && <div className="text-[12px] text-fa-danger-text" data-testid="settler-no-way">{t('mx.tile.noWay')}</div>}
          {!here.length && site?.ok && !chosen && idle.filter((u) => u !== goer?.u).map((u) => {
            const turns = turnsFor(u);
            const from = state.regions[u.regionId]?.name ? cityText(u.regionId, state.regions[u.regionId].name) : t('mx.tile.road');
            return (
              <Button key={u.id} className="w-full" disabled={turns == null} onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile } })} data-testid="send-settler">
                <Tent className="w-4 h-4" /> {turns == null ? t('mx.tile.cannotReach', { from }) : t('mx.tile.sendFrom', { from, turns: turnsText(turns) })}
              </Button>
            );
          })}
          {facts.land && site?.ok && !settlers.length && <div className="text-[12px] text-fa-muted"><div>{t('mx.tile.rating', { rating: t('mx.tile.rating.' + site.rating) })}{site.why ? ' ' + t('mx.tile.why', { why: site.why, total: site.score }) : ''}</div><div>{t('mx.tile.claimHint')}</div></div>}
          {landing.length > 0 && (
            <Button className="w-full" onClick={() => landing.forEach((c) => dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: c.id, tile } }))} data-testid="land-here">
              {t('mx.tile.land', { count: landing.length })}
            </Button>
          )}
        </div>
      )}
      {/* Your settlers standing here: what else they can do (I093). */}
      {here.map((u) => (
        <div key={u.id} className="fa-card px-3 py-2 space-y-1.5 mt-2" data-testid="settler-orders">
          <div className="text-[12px] text-fa-muted flex items-center gap-1.5"><Tent className="w-4 h-4" aria-hidden="true" />{settlerStatus(state, u).text}</div>
          {confirmDisband === u.id ? (
            <div className="space-y-1.5">
              <div className="text-[12px]">{t('mx.tile.sendHomeAsk', { city: settlersHomeCity(state, u)?.name ? nameNow('city', null, settlersHomeCity(state, u).name) : t('mx.tile.noCityTakes') })}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" className="flex-1" onClick={() => { setConfirmDisband(null); dispatch({ type: ActionTypes.DISBAND_SETTLERS, payload: { unitId: u.id } }); }} data-testid="settler-disband-confirm">{t('mx.tile.sendHome')}</Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDisband(null)}>{t('mx.tile.keepThem')}</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {u.target == null && settleUnitId !== u.id && onSettle && <Button size="sm" className="flex-1" onClick={() => onSettle(u)} data-testid="settler-choose-site">{t('mx.tile.chooseSite')}</Button>}
              {u.target == null && <Button size="sm" variant="ghost" className="flex-1" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_HOLD, payload: { unitId: u.id, hold: !u.hold } })} title={u.hold ? t('mx.tile.askAgain') : t('mx.tile.waitTitle')} data-testid="settler-hold">{u.hold ? t('mx.tile.stopWaiting') : t('mx.tile.waitHere')}</Button>}
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDisband(u.id)} data-testid="settler-disband">{t('mx.tile.disband')}</Button>
            </div>
          )}
        </div>
      ))}
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto fa-sheet border-t rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl sheet-panel" data-testid="tile-sheet" ref={sheetRef}>
        {body}
        {main && <div className="sticky -bottom-3 -mx-3 -mb-3 px-3 pt-2 pb-3 fa-sheet z-10" data-testid="tile-main-action">{main}</div>}
      </div>
    );
  }
  return (
    <div className="absolute corner-card corner-card-second top-[calc(var(--header-height,2.25rem)+0.5rem)] start-[calc(var(--city-rail-w,0px)+0.5rem)] pl:start-[max(var(--safe-start),0.5rem)] z-20 fa-sheet border rounded-[10px] p-3 w-[300px] max-w-[calc(100vw-1rem)] shadow-2xl max-h-[calc(100dvh-var(--header-height,2.25rem)-1.5rem)] overflow-y-auto" data-testid="tile-sheet" ref={sheetRef}>
      {body}
      {main && <div className="sticky -bottom-3 -mx-3 -mb-3 px-3 pt-2 pb-3 fa-sheet z-10" data-testid="tile-main-action">{main}</div>}
    </div>
  );
};

export default TileSheet;
