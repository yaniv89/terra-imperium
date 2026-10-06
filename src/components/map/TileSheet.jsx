// src/components/map/TileSheet.jsx
// The tile sheet (plans/civ-map-rework.md E4; W04 in plans/UI-DESIGN.md): what a tapped tile of land
// is (terrain, features, river, coast, resource, yields, who owns it) and what the player can do
// there. As the settle lens's site card: the centre's yields, why the site is good, the nearest
// city in km, the claim, and the reason a red tile is blocked with its numbers; the one brass
// action is "Found City here" (settlers on it) or "Go and found city" (idle settlers elsewhere).
// Also the armies on the tile (attack, declare war) and a fleet's landing. Docked on the left as
// a corner card; a bottom sheet on a phone held upright.
import React, { useMemo } from 'react';
import { MapPin, Tent, Flag, Swords, Ban } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { tileFacts, IMPROVEMENTS } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { ResourceIcon, ImprovementIcon } from '../ui/icons';
import { settlerPath, settlersOf, SETTLER_MOVES } from '../../engine/settlers';
import { WORLD_NATIONS } from '../../data/worldNations';
import { atSea } from '../../engine/fleets';
import { tileAccess, unitTile } from '../../engine/armies';
import { declareWarModel } from '../panels/warActions';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import PreBattleModal from '../battle/PreBattleModal';
import { Button, CloseButton, Label, Stat } from '../ui/atlas';
import { settleSiteModel } from './settleSiteModel';

const TileSheet = ({ tile, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const [attackFrom, setAttackFrom] = React.useState(null);
  const isMobile = useIsMobile();
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
  // The settlers who would go: the nearest idle ones that can reach it.
  const goer = site?.ok ? idle.map((u) => ({ u, turns: turnsFor(u) })).filter((x) => x.turns != null).sort((a, b) => a.turns - b.turns)[0] || null : null;
  const yields = site?.yields || { food: 0, production: 0, gold: 0 };

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

      {facts.land && <Label className="mb-1">{settlers.length && !ownerCity ? 'Chosen site' : 'This tile'}</Label>}
      <div className="grid grid-cols-3 gap-1.5 mb-2" data-testid="tile-yields">
        <Stat value={`+${yields.food}`} label="Food" color="var(--fa-good)" />
        <Stat value={`+${yields.production}`} label="Production" />
        <Stat value={`+${yields.gold}`} label="Gold" color="var(--fa-brass)" />
      </div>
      {(facts.resource || facts.improvement || facts.district) && (
        <div className="flex flex-wrap gap-2 text-[12px] mb-2">
          {facts.resource && <span className="capitalize inline-flex items-center gap-1"><ResourceIcon resourceId={facts.resource} size={18} />{facts.resource}</span>}
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
                <div className="flex items-start gap-2 rounded-lg border border-fa-danger bg-[rgba(229,96,77,0.12)] px-3 py-2 text-[13px]" data-testid="settle-reason">
                  <Ban className="w-4 h-4 mt-0.5 text-fa-danger-text shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-fa-danger-text">{site.reason}</span>
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
          {here.length > 0 && (
            <Button variant="primary" hero className="w-full" disabled={!site?.ok} onClick={() => dispatch({ type: ActionTypes.FOUND_CITY, payload: { unitId: here[0].id } })} data-testid="found-city">
              <Flag className="w-4 h-4" aria-hidden="true" /> Found City here
            </Button>
          )}
          {!here.length && goer && (
            <>
              <div className="text-[12px] text-fa-muted">Settlers from {state.regions[goer.u.regionId]?.name || 'the road'} arrive in {goer.turns} turn{goer.turns === 1 ? '' : 's'}, then found.</div>
              <Button variant="primary" hero className="w-full" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: goer.u.id, tile } })} data-testid="send-settler">
                <Tent className="w-4 h-4" aria-hidden="true" /> Go and found city
              </Button>
            </>
          )}
          {!here.length && site?.ok && idle.filter((u) => u !== goer?.u).map((u) => {
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
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto fa-sheet border-t rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl sheet-panel" data-testid="tile-sheet">
        {body}
      </div>
    );
  }
  return (
    <div className="absolute corner-card corner-card-second top-[calc(var(--header-height,2.25rem)+0.5rem)] left-[calc(var(--city-rail-w,0px)+0.5rem)] pl:left-[max(env(safe-area-inset-left),0.5rem)] z-20 fa-sheet border rounded-[10px] p-3 w-[300px] max-w-[calc(100vw-1rem)] shadow-2xl max-h-[calc(100dvh-var(--header-height,2.25rem)-1.5rem)] overflow-y-auto" data-testid="tile-sheet">
      {body}
    </div>
  );
};

export default TileSheet;
