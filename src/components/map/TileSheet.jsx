// src/components/map/TileSheet.jsx
// The tile sheet (plans/civ-map-rework.md, E4): what a tapped tile of free land is (terrain,
// features, river, coast, resource, yields, who owns it) and what the player can do there:
// found a city with settlers standing on it, or send idle settlers to it. The same corner card
// as the region card on desktop and a bottom sheet on a phone.
import React, { useMemo } from 'react';
import { X, MapPin, Wheat, Hammer, Coins, Tent, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { getResearched } from '../../engine/nationState';
import { tileFacts, tileYields, IMPROVEMENTS } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { ResourceIcon, ImprovementIcon } from '../ui/icons';
import { canSettle, scoreSite, settlerPath, settlersOf, SETTLER_MOVES } from '../../engine/settlers';
import { WORLD_NATIONS } from '../../data/worldNations';
import { atSea } from '../../engine/fleets';
import { tileAccess, unitTile } from '../../engine/armies';
import { declareWarModel } from '../panels/warActions';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import PreBattleModal from '../battle/PreBattleModal';
import { Swords } from 'lucide-react';

const Yield = ({ icon: Icon, value, title, className }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} title={title}><Icon className="w-3 h-3" />{value}</span>
);

const TileSheet = ({ tile, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const [attackFrom, setAttackFrom] = React.useState(null);
  const isMobile = useIsMobile();
  const tiles = getTiles();
  const me = state.playerNationId;
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const researched = useMemo(() => getResearched(state, me), [state, me]);
  const facts = useMemo(() => (tile == null ? null : tileFacts(tiles, tile, state.world?.tileState?.[tile])), [tile, tiles, state.world]);
  const settlers = useMemo(() => settlersOf(state.units, me), [state.units, me]);
  const here = settlers.filter((u) => u.tile === tile);
  const coming = settlers.filter((u) => u.target === tile && u.tile !== tile);
  const idle = settlers.filter((u) => u.target == null && u.tile !== tile);
  const can = useMemo(() => (facts?.land ? canSettle(state, tile, me, ageId) : { ok: false, reason: 'A city needs land.' }), [state, tile, me, ageId, facts]);
  if (tile == null || !facts) return null;
  const y = tileYields(facts, researched);
  const ownerCity = state.world?.tileOwner?.[tile] ? state.regions[state.world.tileOwner[tile]] : null;
  const ownerNation = ownerCity ? state.nations[ownerCity.owner] : null;
  const name = tiles.names[tile] || (facts.river ? `On the ${tiles.riverNames[tile] || 'river'}` : facts.land ? 'Wild land' : 'Open water');
  const parts = [facts.terrain, facts.relief !== 'flat' ? facts.relief : null, facts.feature !== 'none' ? facts.feature : null, facts.river ? 'river' : null, facts.coastal && facts.land ? 'coast' : null].filter(Boolean);
  const country = tiles.countryOf(tile);
  const turnsFor = (u) => { const p = settlerPath(state, u.tile, tile, me); return p ? Math.ceil(p.length / SETTLER_MOVES) : null; };
  // A fleet at sea beside this shore can land its troops here (fleets.js), on own, allied or free land.
  // An enemy army on this tile and your stacks beside it: a field battle (fieldBattle.js).
  const enemyHere = facts.land ? enemyStackAt(state, tile, me) : [];
  // A foreign army at peace with you on this tile: name it, and offer the war (warActions.js).
  const foreignHere = facts.land && !enemyHere.length ? Object.values(state.units).filter((u) => u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && u.ownerId !== me && u.ownerId !== 'rebels' && unitTile(state, u) === tile) : [];
  const foreignWar = foreignHere.length ? declareWarModel(state, foreignHere[0].ownerId) : null;
  const attackSources = enemyHere.length
    ? [...new Set(Object.values(state.units).filter((u) => u.ownerId === me && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.tile != null && tiles.neighbors[u.tile].includes(tile)).map((u) => u.regionId))]
      .map((rid) => ({ regionId: rid, v: validateFieldAttack(state, rid, tile) }))
    : [];
  const landing = facts.land && ['own', 'friend', 'wild'].includes(tileAccess(state, tile, me))
    ? Object.values(state.units).filter((u) => u.ownerId === me && u.domain === 'naval' && atSea(state, u) && tiles.neighbors[u.tile].includes(tile))
      .flatMap((f) => Object.values(state.units).filter((c) => c.embarkedOn === f.id))
    : [];

  const body = (
    <>
      <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate text-sm">{name}</div>
            <div className="text-slate-500 text-[10px] capitalize">{parts.join(', ')}{country && !ownerCity ? ` · ${WORLD_NATIONS[country]?.name || country} lands` : ''}</div>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
      </div>
      {enemyHere.length > 0 && (
        <div className="mb-2 space-y-1" data-testid="enemy-army-here">
          <div className="text-xs text-red-300 font-semibold flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {state.nations[enemyHere[0].ownerId]?.name || 'Rebel'} army here: {enemyHere.length} unit{enemyHere.length === 1 ? '' : 's'}</div>
          {attackSources.map(({ regionId, v }) => (
            <button key={regionId} type="button" disabled={!v.ok && v.reason !== 'cost'} onClick={() => setAttackFrom(regionId)} data-testid="attack-army" className="w-full min-h-[44px] rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1">
              Attack with the army of {state.regions[regionId]?.name || regionId}{v.ok ? ` (${v.attackerUnits.length} unit${v.attackerUnits.length === 1 ? '' : 's'})` : v.reason === 'no_moves' ? ' (already moved)' : ''}
            </button>
          ))}
        </div>
      )}
      {foreignWar && (
        <div className="mb-2 space-y-1" data-testid="foreign-army-here">
          <div className="text-xs text-amber-200 font-semibold">{foreignWar.name}&apos;s army here: {foreignHere.length} unit{foreignHere.length === 1 ? '' : 's'} (at peace)</div>
          <button type="button" disabled={!foreignWar.enabled} onClick={() => dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId: foreignWar.nationId } })} title={foreignWar.note} data-testid="tile-declare-war" className="w-full min-h-[44px] rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1"><Swords className="w-3.5 h-3.5" /> {foreignWar.label}</button>
        </div>
      )}
      {attackFrom && <PreBattleModal fromRegionId={attackFrom} tile={tile} onClose={() => setAttackFrom(null)} />}
      <div className="flex flex-wrap gap-3 text-xs mb-2" data-testid="tile-yields">
        <Yield icon={Wheat} value={`${y.food} food`} className="text-emerald-300" title="Food" />
        <Yield icon={Hammer} value={`${y.production} production`} className="text-amber-300" title="Production" />
        <Yield icon={Coins} value={`${y.gold} gold`} className="text-yellow-300" title="Gold" />
        {facts.resource && <span className="text-fuchsia-300 capitalize inline-flex items-center gap-1"><ResourceIcon resourceId={facts.resource} size={18} />{facts.resource}</span>}
        {facts.improvement && <span className="text-sky-300 inline-flex items-center gap-1"><ImprovementIcon improvementId={facts.improvement} size={18} />{IMPROVEMENTS[facts.improvement]?.name || facts.improvement}{facts.pillaged ? ' (pillaged)' : ''}</span>}
        {facts.district && <span className="text-violet-300" data-testid="tile-district">{DISTRICTS[facts.district]?.name || facts.district}{facts.pillaged ? ' (pillaged)' : ''}</span>}
      </div>
      {ownerCity ? (
        <button type="button" onClick={() => onSelectRegion?.(ownerCity.id)} className="w-full text-left text-xs rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-2 min-h-[40px]">
          Land of <span className="text-white font-semibold">{ownerCity.name}</span> <span className="text-slate-400">({ownerNation?.name || ownerCity.owner})</span>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">{facts.land ? (can.ok ? `A city here would score ${scoreSite(state, tile)}.` : can.reason) : 'Nobody lives at sea.'}</div>
          {here.length > 0 && (
            <button type="button" disabled={!can.ok} onClick={() => dispatch({ type: ActionTypes.FOUND_CITY, payload: { unitId: here[0].id } })} data-testid="found-city" className="w-full min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1">
              <Flag className="w-4 h-4" /> Found a city here
            </button>
          )}
          {coming.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-xs rounded-lg bg-slate-800/60 border border-slate-700 px-2 min-h-[40px]">
              <span className="text-slate-200 flex items-center gap-1"><Tent className="w-3.5 h-3.5" /> Settlers arriving in {turnsFor(u) ?? '?'} turn{turnsFor(u) === 1 ? '' : 's'}</span>
              <button type="button" onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile: null } })} className="text-slate-400 underline">Cancel</button>
            </div>
          ))}
          {facts.land && can.ok && idle.map((u) => {
            const turns = turnsFor(u);
            const from = state.regions[u.regionId]?.name || 'the road';
            return (
              <button key={u.id} type="button" disabled={turns == null} onClick={() => dispatch({ type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: u.id, tile } })} data-testid="send-settler" className="w-full min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1">
                <Tent className="w-4 h-4" /> {turns == null ? `Settlers near ${from} cannot reach it` : `Send settlers from ${from}: ${turns} turn${turns === 1 ? '' : 's'}`}
              </button>
            );
          })}
          {facts.land && can.ok && !settlers.length && <div className="text-[11px] text-slate-500">Build settlers in a city of size 2 or more to claim this land.</div>}
          {landing.length > 0 && (
            <button type="button" onClick={() => landing.forEach((c) => dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: c.id, tile } }))} data-testid="land-here" className="w-full min-h-[44px] rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1">
              Land {landing.length} unit{landing.length === 1 ? '' : 's'} here
            </button>
          )}
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto bg-slate-900 border-t border-slate-700 rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs shadow-2xl sheet-panel" data-testid="tile-sheet">
        {body}
      </div>
    );
  }
  return (
    <div className="absolute corner-card corner-card-second top-[calc(var(--header-height,4.5rem)+0.5rem)] left-2 z-20 bg-slate-900 p-3 rounded-lg text-xs w-[300px] max-w-[calc(100vw-1rem)] border border-slate-700 shadow-xl max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto" data-testid="tile-sheet">
      {body}
    </div>
  );
};

export default TileSheet;
