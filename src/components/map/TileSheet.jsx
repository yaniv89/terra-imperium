// src/components/map/TileSheet.jsx
// The tile sheet (plans/civ-map-rework.md E4; W04 in plans/UI-DESIGN.md): what a tapped tile of land
// is (terrain, features, river, coast, resource, yields, who owns it) and what the player can do
// there. As the settle lens's site card: the centre's yields, why the site is good, the nearest
// city in km, the claim, and the reason a red tile is blocked with its numbers; the one brass
// action is "Found City here" (settlers on it) or "Go and found city" (idle settlers elsewhere).
// Also the armies on the tile (attack, declare war) and a fleet's landing. Docked on the left as
// a corner card; a bottom sheet on a phone held upright.
import React, { useMemo, useRef } from 'react';
import { MapPin, Tent, Flag, Swords, Ban, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { tileFacts, IMPROVEMENTS, resourceKnown } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { ResourceIcon, ImprovementIcon } from '../ui/icons';
import { settlerPath, settlersOf, settlersHomeCity, SETTLER_MOVES } from '../../engine/settlers';
import { WORLD_NATIONS } from '../../data/worldNations';
import { atSea } from '../../engine/fleets';
import { tileAccess, unitTile } from '../../engine/armies';
import { declareWarModel } from '../panels/warActions';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import PreBattleModal from '../battle/PreBattleModal';
import { Button, CloseButton, Label, Stat } from '../ui/atlas';
import { settleSiteModel } from './settleSiteModel';
import { settlerStatus } from './settleRoutes';
import { useReportInset } from '../../context/MapInsetsContext';

// `settleUnitId`: the settler whose site is being chosen (the settle mode, settleMode.js): it is
// the one that goes, whatever other settlers wait. `onSettle(unit)` starts the mode for a settler.
const TileSheet = ({ tile, onClose, onSelectRegion, settleUnitId = null, onSettle = null }) => {
  const { state, dispatch } = useGame();
  const [attackFrom, setAttackFrom] = React.useState(null);
  const [confirmDisband, setConfirmDisband] = React.useState(null); // a settler's id: "Send them home?"
  const isMobile = useIsMobile();
  // The map centres a site in the part of the screen this sheet leaves (MapInsetsContext): "Next
  // good site" never lands under it (playtest audit I088).
  const sheetRef = useRef(null);
  useReportInset('tile-sheet', isMobile ? 'bottom' : 'left', sheetRef, tile != null);
  const tiles = getTiles();
  const me = state.playerNationId;
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const facts = useMemo(() => (tile == null ? null : tileFacts(tiles, tile, state.world?.tileState?.[tile])), [tile, tiles, state.world]);
  const settlers = useMemo(() => settlersOf(state.units, me), [state.units, me]);
  const site = useMemo(() => (facts?.land ? settleSiteModel(state, tile, ageId) : null), [state, tile, ageId, facts]);
  if (tile == null || !facts) return null;
  const here = settlers.filter((u) => u.tile === tile);
  const coming = settlers.filter((u) => u.target === tile && u.tile !== tile);
  const idle = settlers.filter((u) => u.target == null && u.tile !== tile);
  const ownerCity = state.world?.tileOwner?.[tile] ? state.regions[state.world.tileOwner[tile]] : null;
  const ownerNation = ownerCity ? state.nations[ownerCity.owner] : null;
  const name = tiles.names[tile] || (facts.river ? `On the ${tiles.riverNames[tile] || 'river'}` : facts.land ? 'Wild land' : 'Open water');
  const parts = [facts.terrain, facts.relief !== 'flat' ? facts.relief : null, facts.feature !== 'none' ? facts.feature : null, facts.river ? 'river' : null, facts.coastal && facts.land ? 'coast' : null].filter(Boolean);
  const country = tiles.countryOf(tile);
  const turnsFor = (u) => { const p = settlerPath(state, u.tile, tile, me); return p ? Math.ceil(p.length / SETTLER_MOVES) : null; };
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
  const resource = facts.resource && resourceKnown(facts.resource, ageId) ? facts.resource : null;
  // The one main action sits in the sheet's footer, always in view (it used to be under the fold
  // at 844x340: playtest audit I090).
  const sendGoer = () => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: goer.u.id, tile } });
  const main = here.length > 0 && !ownerCity
    ? <Button variant="primary" hero className="w-full" disabled={!site?.ok} onClick={() => dispatch({ type: ActionTypes.FOUND_CITY, payload: { unitId: (here.find((u) => u.id === settleUnitId) || here[0]).id } })} data-testid="found-city"><Flag className="w-4 h-4" aria-hidden="true" /> Found City here</Button>
    : !ownerCity && goer
      ? <Button variant="primary" hero className="w-full" onClick={sendGoer} data-testid="send-settler"><Tent className="w-4 h-4" aria-hidden="true" /> Go and found city: {goer.turns} turn{goer.turns === 1 ? '' : 's'}</Button>
      : null;

  const body = (
    <>
      <div className="flex items-start gap-2.5 mb-2">
        {settlers.length ? <Tent className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" /> : <MapPin className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h2 className="fa-heading text-[17px] leading-tight truncate">{name}</h2>
          <div className="text-[12px] text-fa-muted capitalize">{parts.join(', ')}{country && !ownerCity ? ` · ${WORLD_NATIONS[country]?.name || country} lands` : ''}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {enemyHere.length > 0 && (
        <div className="mb-2 space-y-1.5" data-testid="enemy-army-here">
          <div className="text-[13px] text-fa-danger-text font-semibold flex items-center gap-1.5"><Swords className="w-4 h-4" /> {state.nations[enemyHere[0].ownerId]?.name || 'Rebel'} army here: {enemyHere.length} unit{enemyHere.length === 1 ? '' : 's'}</div>
          {attackSources.map(({ regionId, v }) => (
            <Button key={regionId} variant="danger" className="w-full" disabled={!v.ok && v.reason !== 'cost'} onClick={() => setAttackFrom(regionId)} data-testid="attack-army">
              Attack with the army of {state.regions[regionId]?.name || regionId}{v.ok ? ` (${v.attackerUnits.length} unit${v.attackerUnits.length === 1 ? '' : 's'})` : v.reason === 'no_moves' ? ' (already moved)' : ''}
            </Button>
          ))}
        </div>
      )}
      {foreignWar && (
        <div className="mb-2 space-y-1.5" data-testid="foreign-army-here">
          <div className="text-[13px] text-fa-enemy font-semibold">{foreignWar.name}&apos;s army here: {foreignHere.length} unit{foreignHere.length === 1 ? '' : 's'} (at peace)</div>
          <Button variant="danger" className="w-full" disabled={!foreignWar.enabled} onClick={() => dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId: foreignWar.nationId } })} title={foreignWar.note} data-testid="tile-declare-war"><Swords className="w-4 h-4" /> {foreignWar.label}</Button>
        </div>
      )}
      {attackFrom && <PreBattleModal fromRegionId={attackFrom} tile={tile} onClose={() => setAttackFrom(null)} />}

      {facts.land && <Label className="mb-1">{asSite ? 'Chosen site, as a city centre' : 'This tile'}</Label>}
      <div className="grid grid-cols-3 gap-1.5 mb-2" data-testid="tile-yields">
        <Stat value={`+${yields.food}`} label="Food" color="var(--fa-good)" />
        <Stat value={`+${yields.production}`} label="Production" />
        <Stat value={`+${yields.gold}`} label="Gold" color="var(--fa-brass)" />
      </div>
      {asSite && site.warnings.map((w) => (
        <div key={w.id} className="flex items-start gap-2 rounded-lg border border-amber-400/70 bg-[rgba(251,191,36,0.12)] px-3 py-2 mb-2 text-[12px]" data-testid="site-warning" data-warning={w.id}>
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" aria-hidden="true" />
          <span>{w.text}</span>
        </div>
      ))}
      {(resource || facts.improvement || facts.district) && (
        <div className="flex flex-wrap gap-2 text-[12px] mb-2">
          {resource && <span className="capitalize inline-flex items-center gap-1"><ResourceIcon resourceId={resource} size={18} />{resource}</span>}
          {facts.improvement && <span className="inline-flex items-center gap-1"><ImprovementIcon improvementId={facts.improvement} size={18} />{IMPROVEMENTS[facts.improvement]?.name || facts.improvement}{facts.pillaged ? ' (pillaged)' : ''}</span>}
          {facts.district && <span className="text-fa-indep" data-testid="tile-district">{DISTRICTS[facts.district]?.name || facts.district}{facts.pillaged ? ' (pillaged)' : ''}</span>}
        </div>
      )}
      {ownerCity ? (
        <button type="button" onClick={() => onSelectRegion?.(ownerCity.id)} className="w-full text-left text-[13px] fa-card hover:bg-fa-hover px-3 py-2 min-h-[44px]">
          Land of <span className="font-semibold">{ownerCity.name}</span> <span className="text-fa-muted">({ownerNation?.name || ownerCity.owner})</span>
          {settlers.length > 0 && ownerCity.owner !== me && <span className="block text-[12px] text-fa-danger-text" data-testid="settle-reason">No city here: it belongs to {ownerNation?.name || ownerCity.owner}.</span>}
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
                  {/^Too close/.test(site.reason || '') && <div className="mt-1 text-[11px] text-fa-muted" data-testid="spacing-rule">{site.spacing.text}{settleUnitId ? ' Next good site, on the bar above, goes to land that is free.' : ''}</div>}
                </div>
              )}
            </>
          ) : <div className="text-[12px] text-fa-muted">Nobody lives at sea.</div>}
          {coming.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-[13px] fa-card px-3 min-h-[44px]">
              <span className="flex items-center gap-1.5"><Tent className="w-4 h-4" /> Settlers arrive in {turnsFor(u) ?? '?'} turn{turnsFor(u) === 1 ? '' : 's'}, then found</span>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile: null } })}>Cancel</Button>
            </div>
          ))}
          {!here.length && goer && <div className="text-[12px] text-fa-muted">Settlers from {state.regions[goer.u.regionId]?.name || 'the road'} arrive in {goer.turns} turn{goer.turns === 1 ? '' : 's'}, then found.</div>}
          {cannotReach && <div className="text-[12px] text-fa-danger-text" data-testid="settler-no-way">These settlers have no way there over land they may cross.</div>}
          {!here.length && site?.ok && !chosen && idle.filter((u) => u !== goer?.u).map((u) => {
            const turns = turnsFor(u);
            const from = state.regions[u.regionId]?.name || 'the road';
            return (
              <Button key={u.id} className="w-full" disabled={turns == null} onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile } })} data-testid="send-settler">
                <Tent className="w-4 h-4" /> {turns == null ? `Settlers near ${from} cannot reach it` : `Send settlers from ${from}: ${turns} turn${turns === 1 ? '' : 's'}`}
              </Button>
            );
          })}
          {facts.land && site?.ok && !settlers.length && <div className="text-[12px] text-fa-muted">A city here would score {site.score}. Build settlers in a city of size 2 or more to claim this land.</div>}
          {landing.length > 0 && (
            <Button className="w-full" onClick={() => landing.forEach((c) => dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: c.id, tile } }))} data-testid="land-here">
              Land {landing.length} unit{landing.length === 1 ? '' : 's'} here
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
              <div className="text-[12px]">Send them home? The settlers are gone; their citizen joins {settlersHomeCity(state, u)?.name || 'no city (none can take them)'}. The production spent is lost.</div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" className="flex-1" onClick={() => { setConfirmDisband(null); dispatch({ type: ActionTypes.DISBAND_SETTLERS, payload: { unitId: u.id } }); }} data-testid="settler-disband-confirm">Send them home</Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDisband(null)}>Keep them</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {u.target == null && settleUnitId !== u.id && onSettle && <Button size="sm" className="flex-1" onClick={() => onSettle(u)} data-testid="settler-choose-site">Choose a site</Button>}
              {u.target == null && <Button size="sm" variant="ghost" className="flex-1" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_HOLD, payload: { unitId: u.id, hold: !u.hold } })} title={u.hold ? 'They ask for a site again' : 'They wait here and stop asking for a site'} data-testid="settler-hold">{u.hold ? 'Stop waiting' : 'Wait here'}</Button>}
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDisband(u.id)} data-testid="settler-disband">Disband</Button>
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
    <div className="absolute corner-card corner-card-second top-[calc(var(--header-height,2.25rem)+0.5rem)] left-[calc(var(--city-rail-w,0px)+0.5rem)] pl:left-[max(env(safe-area-inset-left),0.5rem)] z-20 fa-sheet border rounded-[10px] p-3 w-[300px] max-w-[calc(100vw-1rem)] shadow-2xl max-h-[calc(100dvh-var(--header-height,2.25rem)-1.5rem)] overflow-y-auto" data-testid="tile-sheet" ref={sheetRef}>
      {body}
      {main && <div className="sticky -bottom-3 -mx-3 -mb-3 px-3 pt-2 pb-3 fa-sheet z-10" data-testid="tile-main-action">{main}</div>}
    </div>
  );
};

export default TileSheet;
