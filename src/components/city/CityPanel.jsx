// src/components/city/CityPanel.jsx
// The city sheet's first two views (plans/civ-map-rework.md, E4 and workstream 3.4): "City" is
// the header (size, growth, housing, amenities, focus, this turn's yields) with the build queue
// (units, buildings, tile improvements) under it; "Tiles" lists the city's land with each tile's
// yields, which tiles are worked, locks, and the tiles the city can buy next. Every action goes
// through the reducer's city cases (QUEUE_PRODUCTION, DEQUEUE_PRODUCTION, SET_CITY_FOCUS,
// TOGGLE_TILE_LOCK, BUY_TILE), so the rules live in src/engine/world/cities.js, not here.
// Phone first: 44 px rows, one column, nothing that needs a hover.
// Playtest audits, lane L3 (CB05): every number here is an engine selector's (src/engine/
// cityEconomy.js, cityEffects.js, through cityBuildModel.js), so the price on a button is the
// price charged and the turns are the turn's. The Build tab keeps a one-line queue bar pinned at
// the top and never removes a row while it is open, so a second tap lands on the same row (I045).
import { unitDisplayName, unitClassLabel } from '../../data/unitNames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Unlock, X, Plus, Coins, Wheat, Hammer, Home, Smile, ArrowUp, ArrowUpToLine, ChevronDown, ChevronUp, MapPin, AlertTriangle, Check } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { getResearched } from '../../engine/nationState';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getAvailableClasses } from '../../data/unitClasses';
import { IMPROVEMENTS, tileFacts, tileYields } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { templatesOf, nextTemplateUnit, templateSize } from '../../engine/armyTemplates';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { cityLive, growthView, landQuotes, focusPreview } from '../../engine/cityEconomy';
import { GROUPS, describeTile, tileBearing, buildOptions, buildQueue, focusHint, turnsText, rushText } from './cityBuildModel';
import { focusPlace } from '../map/marchEvents';
import { BuildingIcon, UnitIcon, WonderIcon, ImprovementIcon, ResourceIcon } from '../ui/icons';
import { Meter, Stat } from '../ui/atlas';

const FOCUS_LABEL = { balanced: 'Balanced', food: 'Food', production: 'Production', gold: 'Gold' };
const signed = (v) => `${v > 0 ? '+' : ''}${v}`;

// The icon of a production item (build list and queue): the delivered art, fixed size.
const ItemIcon = ({ item, ageId, size = 28 }) => {
  if (item.kind === 'unit') return <UnitIcon classId={item.classId} navalLine={item.navalLine} ageId={ageId} size={size} />;
  if (item.kind === 'settler') return <UnitIcon classId="settler" ageId={ageId} size={size} />;
  if (item.kind === 'army') return <UnitIcon classId={nextTemplateUnit(item) || Object.keys(item.composition || {})[0] || 'infantry'} ageId={ageId} size={size} />;
  if (item.kind === 'building') return <BuildingIcon category={item.category} tier={item.tier} size={size} />;
  if (item.kind === 'wonder') return <WonderIcon projectId={item.projectId} size={size} />;
  if (item.kind === 'improvement') return <ImprovementIcon improvementId={item.improvement} size={size} />;
  return <span className="inline-block shrink-0" style={{ width: size, height: size }} />;
};

// A tile's resource and improvement as small icons ahead of its description.
const TileMarks = ({ facts }) => (facts.resource || facts.improvement ? (
  <span className="inline-flex items-center gap-0.5 mr-1 align-middle">
    {facts.resource && <ResourceIcon resourceId={facts.resource} size={16} />}
    {facts.improvement && <ImprovementIcon improvementId={facts.improvement} size={16} />}
  </span>
) : null);

const Yield = ({ icon: Icon, value, title, className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} title={title}><Icon className="w-3 h-3" />{value}</span>
);

const FLASH_MS = 2600;
const GROUP_FILTERS = ['All', ...GROUPS];

const CityPanel = ({ cityId, view = 'city' }) => {
  const { state, dispatch } = useGame();
  const city = state.regions[cityId];
  const tiles = getTiles();
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const mine = !!city && city.owner === state.playerNationId;
  const showOverview = view === 'overview' || view === 'city';
  const showBuild = view === 'build' || view === 'city';
  const researched = useMemo(() => getResearched(state, state.playerNationId), [state]);
  // The city as the next turn will work it (cityEconomy.js): one source for every number below.
  const live = useMemo(() => (state.regions[cityId] ? cityLive(state, cityId) : null), [state, cityId]);
  const growth = useMemo(() => (live ? growthView(state, cityId, live) : null), [state, cityId, live]);
  const queue = useMemo(() => (live ? buildQueue(state, cityId, live) : []), [state, cityId, live]);
  const options = useMemo(() => (live && showBuild && mine ? buildOptions(state, cityId, live) : []), [state, cityId, live, showBuild, mine]);
  const hint = useMemo(() => (options.length ? focusHint(state, cityId, options, live) : null), [state, cityId, options, live]);
  const focus = useMemo(() => (live && mine && showOverview ? focusPreview(state, cityId) : null), [state, cityId, live, mine, showOverview]);
  const land = useMemo(() => (live && view === 'tiles' ? landQuotes(state, cityId).slice(0, 6) : []), [state, cityId, live, view]);

  const tileRows = useMemo(() => {
    if (!city || !live) return [];
    const worked = new Set(live.worked);
    const tileState = state.world?.tileState || {};
    return city.tiles.map((t) => {
      const facts = tileFacts(tiles, t, tileState[t]);
      return { tile: t, facts, y: tileYields(facts, researched), worked: t === city.tile || worked.has(t), locked: city.locked.includes(t), centre: t === city.tile };
    }).sort((a, b) => (b.centre - a.centre) || (b.worked - a.worked) || a.tile - b.tile);
  }, [city, tiles, state.world, researched, live]);

  // Build tab state: the open queue, the group shown, the row opened for its details, and the
  // last tap (what the confirmation line under the queue bar reports).
  const [queueOpen, setQueueOpen] = useState(false);
  const [group, setGroup] = useState('All');
  const [openRow, setOpenRow] = useState(null);
  const [tap, setTap] = useState(null);
  // The order whose rush offer is open (I019): a tap on Buy shows the quote, a second pays.
  const [buyAt, setBuyAt] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!city || !live) return null;
  const yields = live.yields;
  const housing = live.housing;
  const amen = live.amenities;

  const queueNow = (o) => {
    // What was there before the tap: the line then says what the reducer really did with it.
    setTap({ cityId, label: o.label, before: queue.length, logs: state.logs.length });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTap(null), FLASH_MS);
    dispatch({ type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId, item: o.item } });
  };
  // Accepted when the queue grew; refused when the reducer logged a reason instead.
  const flash = tap && tap.cityId === cityId
    ? (queue.length > tap.before
      ? { ok: true, text: `Added: ${tap.label}. ${queue.length} in the queue.` }
      : state.logs.length > tap.logs ? { ok: false, text: `Not added: ${state.logs[state.logs.length - 1].message}` } : null)
    : null;
  const openTile = (tile) => { if (tile != null) focusPlace([{ tile }, { regionId: cityId }]); };
  const toggleRow = (o) => { setOpenRow((id) => (id === o.id ? null : o.id)); openTile(o.tile); };

  if (view === 'tiles') {
    return (
      <div className="space-y-3" data-testid="city-tiles">
        <div className="text-[11px] text-fa-muted">
          {city.size} citizens work {Math.min(city.size, city.tiles.length - 1)} of {city.tiles.length - 1} tiles ({FOCUS_LABEL[city.focus]} focus). Lock a tile to always work it.
        </div>
        <ul className="space-y-1">
          {tileRows.map(({ tile, facts, y, worked, locked, centre }) => (
            <li key={tile} className={`flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs ${worked ? 'bg-fa-raised border border-fa-good/50' : 'bg-transparent border border-fa-line'}`}>
              <div className="min-w-0 flex-1">
                <div className="text-fa-text truncate capitalize"><TileMarks facts={facts} />{centre ? `${city.name} (centre)` : describeTile(facts)}{facts.resource ? ` · ${facts.resource}` : ''}{facts.improvement ? ` · ${IMPROVEMENTS[facts.improvement]?.name || facts.improvement}${facts.pillaged ? ' (pillaged)' : ''}` : ''}{facts.district ? ` · ${DISTRICTS[facts.district]?.name || facts.district}${facts.pillaged ? ' (pillaged)' : ''}` : ''}{centre ? '' : <span className="text-fa-muted normal-case"> · {tileBearing(tiles, city.tile, tile).text}</span>}</div>
                <div className="text-fa-muted flex gap-2">
                  <Yield icon={Wheat} value={y.food} title="Food" className="text-fa-good" />
                  <Yield icon={Hammer} value={y.production} title="Production" className="text-fa-text" />
                  <Yield icon={Coins} value={y.gold} title="Gold" className="text-fa-brass" />
                  {worked && !centre && <span className="text-fa-good">worked</span>}
                </div>
              </div>
              {mine && !centre && (
                <button type="button" onClick={() => dispatch({ type: ActionTypes.TOGGLE_TILE_LOCK, payload: { cityId, tile } })} className={`fa-icon-btn ${locked ? 'fa-selected' : ''}`} aria-label={locked ? 'Unlock tile' : 'Lock tile'} title={locked ? 'Unlock: let the city choose' : 'Lock: always work this tile'}>
                  {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
        {mine && land.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-fa-text mb-1">Buy land ({city.cultureBank != null ? `${Math.round(city.cultureBank)} culture banked` : 'culture claims the best tile on its own'})</div>
            <ul className="space-y-1" data-testid="buy-land">
              {land.map((q) => (
                <li key={q.tile} className="flex items-center gap-2 rounded-lg px-2 py-1 min-h-[44px] text-xs fa-card">
                  <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => openTile(q.tile)} onKeyDown={(e) => { if (e.key === 'Enter') openTile(q.tile); }} title="Show this tile on the map">
                    <div className="text-fa-text capitalize"><TileMarks facts={q.facts} />{describeTile(q.facts)}{q.facts.resource ? ` · ${q.facts.resource}` : ''} <span className="text-fa-muted normal-case">· {tileBearing(tiles, city.tile, q.tile).text}</span></div>
                    <div className="text-fa-muted flex gap-2">
                      <Yield icon={Wheat} value={q.yields.food} title="Food" className="text-fa-good" />
                      <Yield icon={Hammer} value={q.yields.production} title="Production" className="text-fa-text" />
                      <Yield icon={Coins} value={q.yields.gold} title="Gold" className="text-fa-brass" />
                    </div>
                    {q.need && !q.need.built && <div className="text-[11px] leading-snug text-fa-muted" data-testid="land-resource-need">{q.need.text}</div>}
                  </div>
                  <button type="button" disabled={!q.affordable} onClick={() => dispatch({ type: ActionTypes.BUY_TILE, payload: { cityId, tile: q.tile } })} className="fa-btn fa-btn-secondary fa-num disabled:opacity-40 min-h-[44px]" data-testid="buy-tile" title={q.affordable ? `Buy for ${q.cost} gold` : `Needs ${q.cost} gold`} aria-label={`Buy this tile for ${q.cost} gold`}>
                    {q.cost}g
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // W05 (plans/UI-DESIGN.md): the Overview tab is the city at a glance (focus first, then yields,
  // size and housing, what it builds with its bar, the buildings); Build holds the queue and the
  // build lists. `view="city"` (older callers) shows both.
  const current = queue[0] || null;
  const built = Object.entries(city.buildings?.categories || {}).filter(([, tier]) => tier >= 0)
    .map(([category, tier]) => ({ id: category, name: BUILDING_CATEGORIES[category]?.tiers[tier]?.name || category }));
  const wondersHere = Object.entries(state.greatProjects || {}).filter(([, e]) => e?.regionId === cityId).map(([id]) => ({ id, name: GREAT_PROJECTS[id]?.name || id }));
  const growthLine = growth.state === 'growing' ? `grows in ${growth.turns} turn${growth.turns === 1 ? '' : 's'}`
    : growth.state === 'starving' ? 'starving' : growth.state === 'full' ? 'housing full: no growth' : growth.state === 'max' ? 'as large as it can be' : growth.state === 'outpost' ? 'an outpost' : 'not growing';
  const currentTurns = current ? current.pieceTurns ?? current.turns : null;

  const overview = (
    <>
      {focus && (
        <div className="fa-card p-2" data-testid="city-focus">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="fa-label">Focus</span>
            <span className="text-[11px] text-fa-muted">food surplus, production, gold a turn</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {focus.rows.map((r) => (
              <button key={r.focus} type="button" onClick={() => dispatch({ type: ActionTypes.SET_CITY_FOCUS, payload: { cityId, focus: r.focus } })} aria-pressed={r.current} data-testid={`city-focus-${r.focus}`}
                className={`rounded-lg border px-1 py-1 min-h-[44px] text-[12px] leading-tight ${r.current ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line text-fa-muted'}`}>
                <span className="block font-semibold">{FOCUS_LABEL[r.focus]}</span>
                <span className="block fa-num text-[11px]">{signed(r.food)} · {r.production} · {r.gold}</span>
              </button>
            ))}
          </div>
          {focus.reason && <div className="text-[12px] leading-snug text-fa-muted mt-1.5" data-testid="city-focus-reason">Focus changes nothing here yet. {focus.reason}</div>}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5" data-testid="city-yields">
        <Stat value={`${yields.food >= 0 ? '+' : ''}${yields.food}`} label="Food" color="var(--fa-good)" title={`Food surplus after ${city.size * 2} eaten; ${Math.round(growth.bank)}/${growth.threshold} banked`} />
        <Stat value={`+${yields.production}`} label="Production" title="Production a turn" />
        <Stat value={`+${yields.gold}`} label="Gold" color="var(--fa-brass)" title="Gold a turn" />
        <Stat value={`+${yields.science}`} label="Science" color="var(--fa-science)" title={`Science a turn; culture +${yields.culture}`} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[12px]">
        <div className="fa-card px-2 py-1.5" data-testid="city-size">
          <div className="text-fa-muted">Size</div>
          <div className="fa-num text-[15px] font-semibold">{city.size}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{growthLine}</div>
          {growth.threshold > 0 && <div className="text-fa-muted text-[11px] leading-tight fa-num" title="Food banked toward the next citizen">food {Math.floor(growth.bank)}/{growth.threshold}</div>}
        </div>
        <div className="fa-card px-2 py-1.5">
          <div className="text-fa-muted flex items-center gap-1"><Home className="w-3 h-3" aria-hidden="true" />Housing</div>
          <div className={`fa-num text-[15px] font-semibold ${city.size >= housing ? 'text-fa-enemy' : ''}`}>{city.size}/{housing}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{growth.speed <= 0 ? 'full: no growth' : growth.speed < 0.95 ? `growth at ${Math.round(growth.speed * 100)}%` : 'room to grow'}{city.marketHousing ? ` · market +${city.marketHousing}` : ''}</div>
        </div>
        <div className="fa-card px-2 py-1.5">
          <div className="text-fa-muted flex items-center gap-1"><Smile className="w-3 h-3" aria-hidden="true" />Amenities</div>
          <div className={`fa-num text-[15px] font-semibold ${amen.net < 0 ? 'text-fa-danger-text' : amen.net >= 2 ? 'text-fa-good' : ''}`}>{amen.supply}/{amen.need}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{amen.net < 0 ? 'short: unrest rises' : amen.net >= 2 ? 'content: faster growth' : 'enough'}</div>
        </div>
      </div>
      <div className="fa-card p-2.5" data-testid="city-building-now">
        <div className="flex items-center justify-between gap-2">
          <span className="fa-label">Building now</span>
          {current && <span className="fa-num text-[13px] font-semibold">{turnsText(currentTurns)}</span>}
        </div>
        {current ? (
          <>
            <div className="text-[15px] font-semibold mt-0.5 truncate">{current.label}</div>
            <Meter value={current.progress} max={Math.max(1, current.cost)} color="#CDB27A" className="mt-1.5" label={`${current.label}: ${Math.round(current.progress)} of ${current.cost}`} />
            {queue.length > 1 && <div className="text-[12px] text-fa-muted mt-1 truncate">Then: {queue.slice(1).map((q) => q.label).join(', ')}</div>}
          </>
        ) : <div className="text-[13px] text-fa-muted mt-0.5">Nothing in production. Open Build to choose.</div>}
      </div>
      {(built.length > 0 || wondersHere.length > 0) && (
        <div className="flex flex-wrap gap-1.5" data-testid="city-built">
          {built.map((b) => <span key={b.id} className="fa-chip">{b.name}</span>)}
          {wondersHere.map((w) => <span key={w.id} className="fa-chip" title="A wonder">{w.name}</span>)}
        </div>
      )}
    </>
  );

  const shownGroups = group === 'All' ? GROUPS : [group];
  const build = (
    <>
      {/* The queue bar: pinned, always the same height, so adding to the queue moves nothing below it. */}
      <div className={`sticky top-0 z-10 -mx-3 ${showOverview ? '' : '-mt-3'} px-3 pt-2 pb-1.5 bg-fa-panel border-b border-fa-line`} data-testid="city-queue-bar">
        <div className="flex items-center gap-2 min-h-[44px]">
          {current ? <ItemIcon item={current.item} ageId={ageId} /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{current ? current.label : 'Nothing in production'}</div>
            <div className={`truncate text-[12px] h-[18px] ${flash ? (flash.ok ? 'text-fa-good' : 'text-fa-danger-text') : 'text-fa-muted'}`} aria-live="polite" data-testid="city-queue-status">
              {flash ? <>{flash.ok && <Check className="inline w-3.5 h-3.5 mr-0.5 -mt-0.5" aria-hidden="true" />}{flash.text}</>
                : current ? <><span className="fa-num">{Math.round(current.progress)}/{current.cost}</span> · {turnsText(currentTurns)}{queue.length > 1 ? ` · ${queue.length - 1} more queued` : ''}</>
                  : 'Pick something below.'}
            </div>
          </div>
          {mine && current?.rush?.gold > 0 && (
            <button type="button" onClick={() => setBuyAt((v) => (v === 0 ? null : 0))} aria-expanded={buyAt === 0} data-testid="city-rush-open"
              className={`fa-btn fa-btn-secondary min-h-[44px] px-2 shrink-0 ${current.rush.ok ? '' : 'opacity-60'}`} title={rushText(current)?.title}>
              <Coins className="w-4 h-4 mr-0.5" aria-hidden="true" /><span className="fa-num">{current.rush.gold}</span>
            </button>
          )}
          <button type="button" onClick={() => setQueueOpen((v) => !v)} disabled={!queue.length} aria-expanded={queueOpen} data-testid="city-queue-toggle"
            className="fa-btn fa-btn-secondary min-h-[44px] px-2.5 disabled:opacity-40 shrink-0" aria-label={queueOpen ? 'Hide the queue' : `Show the queue (${queue.length})`}>
            <span className="fa-num mr-1">{queue.length}</span>{queueOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {/* Always there, so the bar is the same height with and without something in production. */}
        <div className="mt-0.5 h-1">{current && <Meter value={current.progress} max={Math.max(1, current.cost)} color="#CDB27A" height={4} />}</div>
        {mine && buyAt != null && queue[buyAt]?.rush && (() => {
          const q = queue[buyAt]; const words = rushText(q);
          return (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-fa-line bg-fa-raised px-2.5 py-1.5 text-[12px] leading-snug" data-testid="city-rush-offer">
              <div className="min-w-0 flex-1">{q.rush.ok ? words.text : `${words.text} ${q.rush.reason}`}</div>
              <button type="button" disabled={!q.rush.ok} data-testid="city-rush-pay"
                onClick={() => { dispatch({ type: ActionTypes.RUSH_PRODUCTION, payload: { cityId, index: q.index } }); setBuyAt(null); }}
                className="fa-btn fa-btn-primary fa-btn-sm min-h-[44px] shrink-0 disabled:opacity-40">Pay {q.rush.gold}</button>
              <button type="button" onClick={() => setBuyAt(null)} className="fa-icon-btn min-w-[44px] min-h-[44px] shrink-0" aria-label="Close the offer"><X className="w-4 h-4" /></button>
            </div>
          );
        })()}
        {queueOpen && queue.length > 0 && (
          <div className="mt-1.5 max-h-[42vh] overflow-y-auto">
            <ol className="space-y-1" data-testid="city-queue">
              {queue.map((q) => (
                <li key={`${q.key}-${q.index}`} className="flex items-center gap-1 rounded-lg pl-2 min-h-[44px] text-[13px] fa-card">
                  <ItemIcon item={q.item} ageId={ageId} size={24} />
                  <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => openTile(q.tile)} onKeyDown={(e) => { if (e.key === 'Enter') openTile(q.tile); }}>
                    <div className="truncate">{q.index === 0 ? '' : `${q.index + 1}. `}{q.label}</div>
                    <div className="text-fa-muted text-[12px]"><span className="fa-num">{q.progress > 0 || q.index === 0 ? `${Math.round(q.progress)}/${q.cost}` : q.cost}</span> · {q.turns == null ? 'no production' : `done in ${turnsText(q.turns)}`}</div>
                  </div>
                  {mine && q.rush?.gold > 0 && (
                    <button type="button" onClick={() => setBuyAt(q.index)} className={`fa-icon-btn min-w-[44px] min-h-[44px] text-[11px] fa-num ${q.rush.ok ? '' : 'opacity-60'}`} aria-label={`Buy ${q.label} for ${q.rush.gold} gold`} title={rushText(q)?.title} data-testid="queue-rush">
                      {q.rush.gold}g
                    </button>
                  )}
                  {mine && q.index > 0 && (
                    <button type="button" onClick={() => dispatch({ type: ActionTypes.MOVE_PRODUCTION, payload: { cityId, index: q.index, to: 0 } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={`Build ${q.label} first`} title="Move to the front" data-testid="queue-front">
                      <ArrowUpToLine className="w-4 h-4" />
                    </button>
                  )}
                  {mine && q.index > 1 && (
                    <button type="button" onClick={() => dispatch({ type: ActionTypes.MOVE_PRODUCTION, payload: { cityId, index: q.index, to: q.index - 1 } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={`Move ${q.label} up`} title="Move up" data-testid="queue-up">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}
                  {mine && (
                    <button type="button" onClick={() => dispatch({ type: ActionTypes.DEQUEUE_PRODUCTION, payload: { cityId, index: q.index } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={`Remove ${q.label} from the queue`} title="Remove" data-testid="queue-remove">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <div className="text-[11px] text-fa-muted mt-1">Moving or removing an item never loses its progress: it is kept for that item and picked up when it is built again.</div>
          </div>
        )}
      </div>

      {mine && hint && (
        <div className="flex items-start gap-2 rounded-lg border border-fa-line bg-fa-raised px-2.5 py-2 text-[12px] leading-snug" data-testid="long-build-hint">
          <AlertTriangle className="w-4 h-4 text-fa-brass shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">{hint.text}</div>
          {hint.better && (
            <button type="button" onClick={() => dispatch({ type: ActionTypes.SET_CITY_FOCUS, payload: { cityId, focus: hint.better.focus } })} className="fa-btn fa-btn-secondary fa-btn-sm min-h-[44px] shrink-0" data-testid="long-build-focus">Production focus</button>
          )}
        </div>
      )}

      {mine && options.length > 0 && (
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none]" role="tablist" aria-label="Build lists">
          {GROUP_FILTERS.filter((g) => g === 'All' || options.some((o) => o.group === g)).map((g) => (
            <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} data-testid={`build-group-${g.toLowerCase()}`}
              className={`shrink-0 rounded-full border px-3 min-h-[36px] text-[12px] ${group === g ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line text-fa-muted'}`}>{g}</button>
          ))}
        </div>
      )}

      {mine && shownGroups.map((g) => {
        const rows = options.filter((o) => o.group === g);
        if (!rows.length) return null;
        return (
          <div key={g}>
            <div className="fa-label mb-1">{g}</div>
            <ul className="space-y-1">
              {rows.map((o) => {
                const open = openRow === o.id;
                const clip = open ? '' : 'truncate';
                return (
                  <li key={o.id} className={`flex items-center gap-2 rounded-lg pl-2 pr-1 py-1 min-h-[44px] text-[13px] border ${o.ok ? 'bg-fa-raised border-fa-line' : 'bg-transparent border-fa-line/60'}`} data-testid="build-row">
                    <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} aria-expanded={open} onClick={() => toggleRow(o)} onKeyDown={(e) => { if (e.key === 'Enter') toggleRow(o); }} title={o.tile != null ? 'Show the tile on the map and the details' : 'Show the details'}>
                      <ItemIcon item={o.item} ageId={ageId} />
                      <div className="min-w-0 flex-1">
                        <div className={clip}>{o.tile != null && <MapPin className="inline w-3 h-3 mr-0.5 -mt-0.5 text-fa-muted" aria-hidden="true" />}{o.label}</div>
                        {o.detail && <div className={`text-[12px] leading-snug text-fa-text/80 ${clip}`} data-testid="build-effect">{o.detail}</div>}
                        {open && o.note && <div className="text-[12px] leading-snug text-fa-muted">{o.note}.</div>}
                        <div className="text-fa-muted text-[12px]">
                          {o.queued > 0 && <span className="text-fa-good mr-1">{o.queued > 1 ? `${o.queued} in the queue` : 'In the queue'}{o.ok ? ' ·' : ''}</span>}
                          {o.ok ? <><span className="fa-num">{o.cost}</span> production · {turnsText(o.turns)}{o.stored > 0 ? ` · ${Math.round(o.stored)} already done` : ''}{o.long && <span className="text-fa-brass"> · slow here</span>}</>
                            : o.queued ? null
                              : o.needsName ? <>Needs {o.needsName} <button type="button" onClick={(e) => { e.stopPropagation(); dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId: o.needsTech } }); }} className="underline text-fa-you min-h-[24px]" data-testid="research-for-item">Research it</button></>
                                : o.note || o.reason}
                        </div>
                      </div>
                    </div>
                    <button type="button" disabled={!o.ok} onClick={() => queueNow(o)} className="fa-icon-btn min-w-[44px] min-h-[44px] shrink-0 disabled:opacity-40" aria-label={o.ok ? `Build ${o.label}` : `${o.label}: ${o.queued ? 'already in the queue' : o.needsName ? `needs ${o.needsName}` : o.reason}`} data-testid="queue-item">
                      {o.queued && !o.ok ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {mine && <ArmyTemplateEditor state={state} dispatch={dispatch} ageId={ageId} />}
    </>
  );

  return (
    <div className="space-y-3" data-testid="city-sheet">
      {showOverview && overview}
      {showBuild && build}
    </div>
  );
};

// Army templates (src/engine/armyTemplates.js): name a composition, the cities build it as one order.
const ArmyTemplateEditor = ({ state, dispatch, ageId }) => {
  const templates = templatesOf(state.nations[state.playerNationId]);
  const classes = getAvailableClasses(ageId).filter((c) => c !== 'naval');
  const [draft, setDraft] = React.useState(null);
  const edit = (t) => setDraft({ id: t?.id || null, name: t?.name || '', composition: { ...(t?.composition || {}) } });
  const bump = (c, d) => setDraft((x) => ({ ...x, composition: { ...x.composition, [c]: Math.max(0, (x.composition[c] | 0) + d) } }));
  return (
    <div className="mt-3 border-t border-fa-line pt-2" data-testid="army-templates">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-semibold text-fa-text">Army templates</div>
        <button type="button" onClick={() => edit(null)} className="text-[11px] text-fa-good min-h-[32px] px-2">New</button>
      </div>
      <ul className="space-y-1 text-xs">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 min-h-[40px] bg-fa-raised/40 border border-fa-line/60">
            <div className="min-w-0 flex-1 truncate text-fa-text">{t.name} <span className="text-fa-muted">({templateSize(t.composition)} units: {Object.entries(t.composition).map(([c, n]) => `${n} ${unitDisplayName(ageId, c)}`).join(', ')})</span></div>
            <button type="button" onClick={() => edit(t)} className="text-fa-text min-h-[32px] px-2">Edit</button>
            <button type="button" onClick={() => dispatch({ type: ActionTypes.DELETE_ARMY_TEMPLATE, payload: { id: t.id } })} aria-label={`Delete ${t.name}`} className="text-fa-danger-text min-h-[32px] px-2">Delete</button>
          </li>
        ))}
      </ul>
      {draft && (
        <div className="mt-2 rounded-lg border border-emerald-700/60 bg-fa-panel/60 p-2 space-y-2 text-xs" data-testid="army-template-editor">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Army name" className="w-full bg-fa-raised rounded px-2 min-h-[36px] text-fa-text" aria-label="Army name" />
          <div className="grid grid-cols-2 gap-1">
            {classes.map((c) => (
              <div key={c} className="flex items-center justify-between rounded bg-fa-raised/60 px-2 min-h-[36px]">
                <span className="text-fa-text inline-flex items-center gap-1 min-w-0" title={unitClassLabel(c)}><UnitIcon classId={c} ageId={ageId} size={18} /><span className="truncate">{unitDisplayName(ageId, c)}</span></span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => bump(c, -1)} className="min-w-[32px] min-h-[32px] rounded bg-fa-hover text-fa-text" aria-label={`Fewer ${c}`}>-</button>
                  <span className="w-5 text-center text-fa-text">{draft.composition[c] | 0}</span>
                  <button type="button" onClick={() => bump(c, 1)} className="min-w-[32px] min-h-[32px] rounded bg-fa-hover text-fa-text" aria-label={`More ${c}`}>+</button>
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { dispatch({ type: ActionTypes.SAVE_ARMY_TEMPLATE, payload: { template: draft } }); setDraft(null); }} disabled={!draft.name.trim() || templateSize(draft.composition) < 1} className="flex-1 min-h-[40px] rounded-lg bg-emerald-700 text-fa-text disabled:opacity-40" data-testid="save-army-template">Save</button>
            <button type="button" onClick={() => setDraft(null)} className="min-h-[40px] px-3 rounded-lg bg-fa-hover text-fa-text">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityPanel;
