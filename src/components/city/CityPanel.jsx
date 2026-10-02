// src/components/city/CityPanel.jsx
// The city sheet's first two views (plans/civ-map-rework.md, E4 and workstream 3.4): "City" is
// the header (size, growth, housing, amenities, focus, this turn's yields) with the build queue
// (units, buildings, tile improvements) under it; "Tiles" lists the city's land with each tile's
// yields, which tiles are worked, locks, and the tiles the city can buy next. Every action goes
// through the reducer's city cases (QUEUE_PRODUCTION, DEQUEUE_PRODUCTION, SET_CITY_FOCUS,
// TOGGLE_TILE_LOCK, BUY_TILE), so the rules live in src/engine/world/cities.js, not here.
// Phone first: 44 px rows, one column, nothing that needs a hover.
import React, { useMemo } from 'react';
import { Lock, Unlock, X, Plus, Coins, Wheat, Hammer, Home, Smile, ArrowUp } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { getResearched } from '../../engine/nationState';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { UNIT_CLASSES, getAvailableClasses } from '../../data/unitClasses';
import { IMPROVEMENTS, tileFacts, tileYields, canImprove } from '../../data/tileYields';
import {
  FOCUS, growthThreshold, housingOf, amenitiesOf, productionCost, canQueue, claimCandidates, buyTileCost, MAX_SIZE, allocateTiles, cityYields
} from '../../engine/world/cities';

const FOCUS_LABEL = { balanced: 'Balanced', food: 'Food', production: 'Production', gold: 'Gold' };

const describeTile = (facts) => {
  const parts = [facts.terrain];
  if (facts.relief !== 'flat') parts.push(facts.relief);
  if (facts.feature !== 'none') parts.push(facts.feature);
  if (facts.river) parts.push('river');
  return parts.join(', ');
};

const itemLabel = (item, tiles) => {
  if (item.kind === 'unit') return UNIT_CLASSES[item.classId]?.name || item.classId;
  if (item.kind === 'building') return BUILDING_CATEGORIES[item.category]?.tiers[item.tier]?.name || `${item.category} ${item.tier + 1}`;
  if (item.kind === 'improvement') return `${IMPROVEMENTS[item.improvement]?.name || item.improvement} on ${tiles.names?.[item.tile] || describeTile(tileFacts(tiles, item.tile))}`;
  if (item.kind === 'settler') return 'Settlers (takes one citizen, founds a city)';
  return item.kind;
};

const Yield = ({ icon: Icon, value, title, className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} title={title}><Icon className="w-3 h-3" />{value}</span>
);

const CityPanel = ({ cityId, view = 'city' }) => {
  const { state, dispatch } = useGame();
  const city = state.regions[cityId];
  const tiles = getTiles();
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const researched = useMemo(() => getResearched(state, state.playerNationId), [state]);
  const world = useMemo(() => ({ cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} }), [state.regions, state.world]);
  const citiesOwned = useMemo(() => Object.values(state.regions).filter((c) => c.owner === state.playerNationId).length, [state.regions, state.playerNationId]);

  // Live yields for the current focus and locks (the engine's own allocation), not last turn's.
  const live = useMemo(() => {
    if (!city) return null;
    const worked = allocateTiles(city, tiles, world, researched);
    return { worked, yields: cityYields(city, tiles, world, worked, researched, { luxuries: (city.lastYields?.luxuries || []).length }) };
  }, [city, tiles, world, researched]);
  const yields = live?.yields || { food: 0, production: 0, gold: 0, science: 0, culture: 0 };
  const housing = city ? housingOf(city, researched) : 0;
  const amen = city ? amenitiesOf(city, { luxuries: (city.lastYields?.luxuries || []).length }) : { need: 0, supply: 0, net: 0 };
  const threshold = city ? growthThreshold(city.size) : 0;
  const growthTurns = city && yields.food > 0 && city.size < MAX_SIZE ? Math.ceil(Math.max(0, threshold - city.food) / yields.food) : null;
  const costCtx = { ageId, citiesOwned };
  const turnsFor = (item, progress = 0) => Math.max(1, Math.ceil(Math.max(0, productionCost(item, costCtx) - progress) / Math.max(0.1, yields.production)));

  const options = useMemo(() => {
    if (!city) return [];
    const out = [];
    const check = (item) => canQueue(city, tiles, world, item, { researched, ageId });
    const settler = { kind: 'settler' };
    out.push({ item: settler, group: 'Units', ...check(settler) });
    getAvailableClasses(ageId).forEach((classId) => {
      const item = { kind: 'unit', classId };
      out.push({ item, group: 'Units', ...check(item) });
    });
    Object.keys(BUILDING_CATEGORIES).forEach((category) => {
      const tier = (city.buildings?.categories?.[category] ?? -1) + 1;
      if (!BUILDING_CATEGORIES[category].tiers[tier]) return;
      const item = { kind: 'building', category, tier };
      out.push({ item, group: 'Buildings', ...check(item) });
    });
    city.tiles.forEach((t) => {
      if (t === city.tile) return;
      const facts = tileFacts(tiles, t, world.tileState[t]);
      Object.keys(IMPROVEMENTS).forEach((improvement) => {
        if (!canImprove(facts, improvement, researched) || (facts.improvement === improvement && !facts.pillaged)) return;
        const item = { kind: 'improvement', improvement, tile: t };
        out.push({ item, group: 'Improvements', ok: true });
      });
    });
    // Queued improvements are not offered twice.
    const queued = new Set([city.production.current, ...city.production.queue].filter(Boolean).map((i) => JSON.stringify(i)));
    return out.filter((o) => !queued.has(JSON.stringify(o.item)));
  }, [city, tiles, world, researched, ageId]);

  const tileRows = useMemo(() => {
    if (!city) return [];
    const worked = new Set(live?.worked || city.worked || []);
    return city.tiles.map((t) => {
      const facts = tileFacts(tiles, t, world.tileState[t]);
      return { tile: t, facts, y: tileYields(facts, researched), worked: t === city.tile || worked.has(t), locked: city.locked.includes(t), centre: t === city.tile };
    }).sort((a, b) => (b.centre - a.centre) || (b.worked - a.worked) || a.tile - b.tile);
  }, [city, tiles, world, researched, live]);
  const candidates = useMemo(() => (city ? claimCandidates(city, tiles, world, { ageId, researched }).slice(0, 6) : []), [city, tiles, world, ageId, researched]);

  if (!city) return null;
  const mine = city.owner === state.playerNationId;
  const queue = [city.production.current, ...city.production.queue].filter(Boolean);

  if (view === 'tiles') {
    return (
      <div className="space-y-3" data-testid="city-tiles">
        <div className="text-[11px] text-slate-400">
          {city.size} citizens work {Math.min(city.size, city.tiles.length - 1)} of {city.tiles.length - 1} tiles ({FOCUS_LABEL[city.focus]} focus). Lock a tile to always work it.
        </div>
        <ul className="space-y-1">
          {tileRows.map(({ tile, facts, y, worked, locked, centre }) => (
            <li key={tile} className={`flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs ${worked ? 'bg-emerald-900/30 border border-emerald-700/40' : 'bg-slate-800/60 border border-slate-700/60'}`}>
              <div className="min-w-0 flex-1">
                <div className="text-slate-100 truncate capitalize">{centre ? `${city.name} (centre)` : describeTile(facts)}{facts.resource ? ` · ${facts.resource}` : ''}{facts.improvement ? ` · ${IMPROVEMENTS[facts.improvement]?.name || facts.improvement}${facts.pillaged ? ' (pillaged)' : ''}` : ''}</div>
                <div className="text-slate-400 flex gap-2">
                  <Yield icon={Wheat} value={y.food} title="Food" className="text-emerald-300" />
                  <Yield icon={Hammer} value={y.production} title="Production" className="text-amber-300" />
                  <Yield icon={Coins} value={y.gold} title="Gold" className="text-yellow-300" />
                  {worked && !centre && <span className="text-emerald-400">worked</span>}
                </div>
              </div>
              {mine && !centre && (
                <button type="button" onClick={() => dispatch({ type: ActionTypes.TOGGLE_TILE_LOCK, payload: { cityId, tile } })} className={`p-2 rounded-lg min-w-[40px] min-h-[40px] ${locked ? 'bg-blue-600/70 text-white' : 'bg-slate-700/60 text-slate-300'}`} aria-label={locked ? 'Unlock tile' : 'Lock tile'} title={locked ? 'Unlock: let the city choose' : 'Lock: always work this tile'}>
                  {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
        {mine && candidates.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1">Buy land ({city.cultureBank != null ? `${Math.round(city.cultureBank)} culture banked` : 'culture claims the best tile on its own'})</div>
            <ul className="space-y-1">
              {candidates.map((c) => {
                const facts = tileFacts(tiles, c.tile, world.tileState[c.tile]);
                const y = tileYields(facts, researched);
                const cost = buyTileCost(city, c);
                const can = (state.resources.gold || 0) >= cost;
                return (
                  <li key={c.tile} className="flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs bg-slate-800/60 border border-slate-700/60">
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-100 truncate capitalize">{describeTile(facts)}{facts.resource ? ` · ${facts.resource}` : ''} <span className="text-slate-500">ring {c.ring}</span></div>
                      <div className="text-slate-400 flex gap-2">
                        <Yield icon={Wheat} value={y.food} title="Food" className="text-emerald-300" />
                        <Yield icon={Hammer} value={y.production} title="Production" className="text-amber-300" />
                        <Yield icon={Coins} value={y.gold} title="Gold" className="text-yellow-300" />
                      </div>
                    </div>
                    <button type="button" disabled={!can} onClick={() => dispatch({ type: ActionTypes.BUY_TILE, payload: { cityId, tile: c.tile } })} className="px-3 min-h-[40px] rounded-lg bg-yellow-600/70 text-white font-semibold disabled:opacity-40" data-testid="buy-tile">
                      {cost}g
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="city-sheet">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-slate-400">Size</div>
          <div className="text-white font-semibold text-base">{city.size}</div>
          <div className="text-slate-500 text-[10px]">{growthTurns == null ? (yields.food < 0 ? 'starving' : 'not growing') : `grows in ${growthTurns} turn${growthTurns === 1 ? '' : 's'}`}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-slate-400 flex items-center gap-1"><Home className="w-3 h-3" />Housing</div>
          <div className={`font-semibold text-base ${city.size >= housing ? 'text-amber-300' : 'text-white'}`}>{city.size}/{housing}</div>
          <div className="text-slate-500 text-[10px]">{city.size >= housing + 2 ? 'full: no growth' : city.size >= housing ? 'crowded: slow growth' : 'room to grow'}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-slate-400 flex items-center gap-1"><Smile className="w-3 h-3" />Amenities</div>
          <div className={`font-semibold text-base ${amen.net < 0 ? 'text-red-300' : amen.net >= 2 ? 'text-emerald-300' : 'text-white'}`}>{amen.supply}/{amen.need}</div>
          <div className="text-slate-500 text-[10px]">{amen.net < 0 ? 'short: unrest rises' : amen.net >= 2 ? 'content: faster growth' : 'enough'}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-800/40 rounded-lg p-2" data-testid="city-yields">
        <Yield icon={Wheat} value={`${yields.food >= 0 ? '+' : ''}${yields.food} food`} title={`Food surplus after ${city.size * 2} eaten; ${Math.round(city.food)}/${threshold} banked`} className="text-emerald-300" />
        <Yield icon={Hammer} value={`${yields.production} production`} title="Production a turn" className="text-amber-300" />
        <Yield icon={Coins} value={`${yields.gold} gold`} title="Gold a turn" className="text-yellow-300" />
        <span className="text-sky-300">{yields.science} science</span>
        <span className="text-fuchsia-300">{yields.culture} culture</span>
      </div>
      {mine && (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 mr-1">Focus</span>
          {FOCUS.map((f) => (
            <button key={f} type="button" onClick={() => dispatch({ type: ActionTypes.SET_CITY_FOCUS, payload: { cityId, focus: f } })} className={`px-2 min-h-[36px] rounded-lg border ${city.focus === f ? 'bg-blue-600/70 border-blue-400 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-300'}`}>
              {FOCUS_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold text-slate-300 mb-1">Building now</div>
        {queue.length === 0 ? (
          <div className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-700 p-3">Nothing in production. Pick something below.</div>
        ) : (
          <ol className="space-y-1" data-testid="city-queue">
            {queue.map((item, i) => {
              const cost = productionCost(item, costCtx);
              const progress = i === 0 ? city.production.progress : 0;
              return (
                <li key={`${JSON.stringify(item)}-${i}`} className="flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs bg-slate-800/60 border border-slate-700/60">
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-100 truncate">{i === 0 ? '' : `${i + 1}. `}{itemLabel(item, tiles)}</div>
                    <div className="text-slate-400">{i === 0 ? `${Math.round(progress)}/${cost} · ` : `${cost} · `}{turnsFor(item, progress)} turn{turnsFor(item, progress) === 1 ? '' : 's'}</div>
                    {i === 0 && <div className="h-1 rounded bg-slate-700 mt-1"><div className="h-1 rounded bg-amber-400" style={{ width: `${Math.min(100, (progress / Math.max(1, cost)) * 100)}%` }} /></div>}
                  </div>
                  {mine && (
                    <button type="button" onClick={() => dispatch({ type: ActionTypes.DEQUEUE_PRODUCTION, payload: { cityId, index: i } })} className="p-2 rounded-lg min-w-[40px] min-h-[40px] bg-slate-700/60 text-slate-300" aria-label="Remove from queue">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {mine && ['Units', 'Buildings', 'Improvements'].map((group) => {
        const rows = options.filter((o) => o.group === group);
        if (!rows.length) return null;
        return (
          <div key={group}>
            <div className="text-[11px] font-semibold text-slate-300 mb-1">{group}</div>
            <ul className="space-y-1">
              {rows.map((o) => {
                const cost = productionCost(o.item, costCtx);
                return (
                  <li key={JSON.stringify(o.item)} className={`flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs border ${o.ok ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-900/60 border-slate-800 opacity-70'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-100 truncate">{itemLabel(o.item, tiles)}</div>
                      <div className="text-slate-400">{o.ok ? `${cost} production · ${turnsFor(o.item)} turn${turnsFor(o.item) === 1 ? '' : 's'}` : o.reason}</div>
                    </div>
                    <button type="button" disabled={!o.ok} onClick={() => dispatch({ type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId, item: o.item } })} className="p-2 rounded-lg min-w-[40px] min-h-[40px] bg-emerald-700/70 text-white disabled:opacity-40" aria-label={`Build ${itemLabel(o.item, tiles)}`} data-testid="queue-item">
                      {queue.length ? <Plus className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default CityPanel;
