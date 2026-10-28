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
import { isolateLtr } from '../../i18n';
import { nameNow } from '../../i18n/names';
import GlossaryLink from '../glossary/GlossaryLink';
import { unitName as unitDisplayName, unitClassName } from '../../i18n/gameText';
import { unitClassLabel as unitClassLabelEn } from '../../data/unitNames';
import { buildingTierName, wonderName, improvementName, districtName, tileResourceName } from '../../i18n/gameText';
const unitClassLabel = (c) => unitClassName(c, unitClassLabelEn(c));
import { useScrollHint } from '../../hooks/useScrollHint';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Unlock, X, Plus, Coins, Wheat, Hammer, Home, Smile, ArrowUp, ArrowUpToLine, ChevronDown, ChevronUp, MapPin, AlertTriangle, Check } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { getTiles } from '../../data/geo/tiles';
import { advisorPick } from '../../engine/productionAdvisor';
import { shortItemLabel } from './cityRailModel';
import { getResearched, ageOf } from '../../engine/nationState';
import { stonePhaseOf } from '../../engine/stonePhase';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getUnlockedClasses } from '../../data/unitClasses';
import { IMPROVEMENTS, tileFacts, tileYields } from '../../data/tileYields';
import { DISTRICTS } from '../../engine/districts';
import { templatesOf, nextTemplateUnit, templateSize } from '../../engine/armyTemplates';
import { GREAT_PROJECTS } from '../../data/greatProjects';
import { cityLive, growthView, landQuotes, focusPreview } from '../../engine/cityEconomy';
import { outpostTurnsLeft, OUTPOST_DONE } from '../../engine/settlers';
import { GROUPS, groupLabel, templateName, describeTile, tileBearing, buildOptions, buildQueue, focusHint, turnsText, rushText } from './cityBuildModel';
import { focusPlace, pointAtTile } from '../map/marchEvents';
import { BuildingIcon, UnitIcon, WonderIcon, ImprovementIcon, ResourceIcon } from '../ui/icons';
import { Meter, Stat } from '../ui/atlas';
import { useWhy } from '../ui/WhyTip';
import { useT } from '../../i18n/useT';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { replaceImprovementConfirm } from '../ui/confirmSpecs';
import { logText, reasonText } from '../../i18n/messageText';
import { rich } from '../../i18n/rich';
import { t as tNow } from '../../i18n/core';

const signed = (v) => isolateLtr(`${v > 0 ? '+' : ''}${v}`); // Hebrew keeps "+5" and "-5" in order
const focusLabel = (f) => tNow(`cy.fn.${f}`);

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
  <span className="inline-flex items-center gap-0.5 me-1 align-middle">
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
  const ageId = ageOf(state, state.playerNationId);
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
  const [hintOpen, setHintOpen] = useState(false); // the long-build advice: one line, the rest on a tap
  const [group, setGroup] = useState('All');
  const keepRow = useScrollHint();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const advisorItem = useMemo(() => (city && !city.production?.current && city.owner === state.playerNationId ? advisorPick(state, cityId) : null), [state, cityId]);
  const groupRow = useScrollHint();
  const [openRow, setOpenRow] = useState(null);
  const [tap, setTap] = useState(null);
  // The order whose rush offer is open (I019): a tap on Buy shows the quote, a second pays.
  const [buyAt, setBuyAt] = useState(null);
  const { t, lang } = useT();
  const R = (key, nodes, vars) => rich(t(key, vars), nodes);
  const [why, whyBubble] = useWhy(); // a greyed "+" says why on tap
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
      ? { ok: true, text: tNow('cp.added', { label: tap.label, n: queue.length }) }
      : state.logs.length > tap.logs ? { ok: false, text: tNow('cp.notAdded', { reason: logText(state.logs[state.logs.length - 1], lang) }) } : null)
    : null;
  // The map flies to the row's tile and outlines it (I042).
  const openTile = (tile) => { if (tile != null) { focusPlace([{ tile }, { regionId: cityId }]); pointAtTile(tile); } };
  const toggleRow = (o) => { setOpenRow((id) => (id === o.id ? null : o.id)); openTile(o.tile); };

  if (view === 'tiles') {
    return (
      <div className="space-y-3" data-testid="city-tiles">
        <div className="text-[11px] text-fa-muted">
          {t('cy.tilesIntro', { size: city.size, worked: Math.min(city.size, city.tiles.length - 1), total: city.tiles.length - 1, focus: focusLabel(city.focus) })}
        </div>
        <ul className="space-y-1">
          {tileRows.map(({ tile, facts, y, worked, locked, centre }) => (
            <li key={tile} className={`flex items-center gap-2 rounded-lg px-2 min-h-[44px] text-xs ${worked ? 'bg-fa-raised border border-fa-good/50' : 'bg-transparent border border-fa-line'}`}>
              <div className="min-w-0 flex-1">
                <div className="text-fa-text truncate capitalize"><TileMarks facts={facts} />{centre ? t('cy.centreOf', { name: nameNow('city', null, city.name) }) : describeTile(facts)}{facts.resource ? ` · ${tileResourceName(facts.resource)}` : ''}{facts.improvement ? ` · ${improvementName(facts.improvement, IMPROVEMENTS[facts.improvement]?.name)}${facts.pillaged ? ` ${t('cy.pillaged')}` : ''}` : ''}{facts.district ? ` · ${districtName(facts.district, DISTRICTS[facts.district]?.name)}${facts.pillaged ? ` ${t('cy.pillaged')}` : ''}` : ''}{centre ? '' : <span className="text-fa-muted normal-case"> · {tileBearing(tiles, city.tile, tile).text}</span>}</div>
                <div className="text-fa-muted flex gap-2">
                  <Yield icon={Wheat} value={y.food} title={t('cy.food')} className="text-fa-good" />
                  <Yield icon={Hammer} value={y.production} title={t('cy.production')} className="text-fa-text" />
                  <Yield icon={Coins} value={y.gold} title={t('cy.gold')} className="text-fa-brass" />
                  {worked && !centre && <span className="text-fa-good">{t('cy.worked')}</span>}
                </div>
              </div>
              {mine && !centre && (
                <button type="button" onClick={() => dispatch({ type: ActionTypes.TOGGLE_TILE_LOCK, payload: { cityId, tile } })} className={`fa-icon-btn ${locked ? 'fa-selected' : ''}`} aria-label={locked ? t('cy.unlockTile') : t('cy.lockTile')} title={locked ? t('cy.unlockTitle') : t('cy.lockTitle')}>
                  {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
        {mine && land.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-fa-text mb-1">{t('cy.buyLand', { what: city.cultureBank != null ? t('cy.cultureBanked', { n: Math.round(city.cultureBank) }) : t('cy.cultureAuto') })}</div>
            <ul className="space-y-1" data-testid="buy-land">
              {land.map((q) => (
                <li key={q.tile} className="flex items-center gap-2 rounded-lg px-2 py-1 min-h-[44px] text-xs fa-card">
                  <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => openTile(q.tile)} onKeyDown={(e) => { if (e.key === 'Enter') openTile(q.tile); }} title={t('cy.showTile')}>
                    <div className="text-fa-text capitalize"><TileMarks facts={q.facts} />{describeTile(q.facts)}{q.facts.resource ? ` · ${tileResourceName(q.facts.resource)}` : ''} <span className="text-fa-muted normal-case">· {tileBearing(tiles, city.tile, q.tile).text}</span></div>
                    <div className="text-fa-muted flex gap-2">
                      <Yield icon={Wheat} value={q.yields.food} title={t('cy.food')} className="text-fa-good" />
                      <Yield icon={Hammer} value={q.yields.production} title={t('cy.production')} className="text-fa-text" />
                      <Yield icon={Coins} value={q.yields.gold} title={t('cy.gold')} className="text-fa-brass" />
                    </div>
                    {q.need && !q.need.built && <div className="text-[11px] leading-snug text-fa-muted" data-testid="land-resource-need">{q.need.text}</div>}
                  </div>
                  <button type="button" disabled={!q.affordable} onClick={() => dispatch({ type: ActionTypes.BUY_TILE, payload: { cityId, tile: q.tile } })} className="fa-btn fa-btn-secondary fa-num disabled:opacity-40 min-h-[44px]" data-testid="buy-tile" title={q.affordable ? t('cy.buyFor', { cost: q.cost }) : t('cy.needsGold', { cost: q.cost })} aria-label={t('cy.buyTileAria', { cost: q.cost })}>
                    {t('cy.goldShort', { n: q.cost })}
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
    .map(([category, tier]) => ({ id: category, name: buildingTierName(category, tier, BUILDING_CATEGORIES[category]?.tiers[tier]?.name) }));
  const wondersHere = Object.entries(state.greatProjects || {}).filter(([, e]) => e?.regionId === cityId).map(([id]) => ({ id, name: wonderName(id, GREAT_PROJECTS[id]?.name) }));
  // An outpost says what the site card promised (I054): it holds its land now, and builds and
  // yields as a city in about N turns (settlers.js, the same progress a turn as the engine's).
  const outpostLeft = outpostTurnsLeft(state, city, ageId);
  const growthLine = growth.state === 'growing' ? t('cy.growsIn', { count: growth.turns })
    : growth.state === 'starving' ? t('cy.starving') : growth.state === 'full' ? t('cy.housingFull') : growth.state === 'max' ? t(stonePhaseOf(state, city.owner) === 'village' ? 'cy.maxVillage' : 'cy.maxSize')
      : growth.state === 'outpost' ? t('cy.outpostIn', { count: outpostLeft ?? 2, n: outpostLeft ?? '?' }) : t('cy.notGrowing');
  const currentTurns = current ? current.pieceTurns ?? current.turns : null;
  const currentStatus = current?.waitText || turnsText(currentTurns); // a held order says why, never "1 turn"

  const overview = (
    <>
      {city.outpost && (
        <div className="fa-card p-2.5" data-testid="city-outpost">
          <div className="flex items-center justify-between gap-2">
            <span className="fa-label">{t('cy.outpost')}</span>
            {outpostLeft != null && <span className="fa-num text-[13px] font-semibold">{turnsText(outpostLeft)}</span>}
          </div>
          <div className="text-[12px] leading-snug mt-0.5">
            {t('cy.outpostHolds', { count: outpostLeft ?? 2, n: outpostLeft ?? '?' })}
          </div>
          <Meter value={city.outpost.progress || 0} max={OUTPOST_DONE} color="var(--fa-text)" className="mt-1.5" label={t('cy.outpostMeter', { n: Math.round(city.outpost.progress || 0), max: OUTPOST_DONE })} />
        </div>
      )}
      {focus && (
        <div className="fa-card p-2" data-testid="city-focus">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="fa-label">{t('cy.focus')}</span>
            <span className="text-[11px] text-fa-muted">{t('cy.focusLegend')}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {focus.rows.map((r) => (
              <button key={r.focus} type="button" onClick={() => dispatch({ type: ActionTypes.SET_CITY_FOCUS, payload: { cityId, focus: r.focus } })} aria-pressed={r.current} data-testid={`city-focus-${r.focus}`}
                className={`rounded-lg border px-1 py-1 min-h-[44px] text-[12px] leading-tight ${r.current ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line text-fa-muted'}`}>
                <span className="block font-semibold">{focusLabel(r.focus)}</span>
                <span className="block fa-num text-[11px]">{signed(r.food)} · {r.production} · {r.gold}</span>
              </button>
            ))}
          </div>
          {focus.reason && <div className="text-[12px] leading-snug text-fa-muted mt-1.5" data-testid="city-focus-reason">{t('cy.focusNothing', { reason: focus.reason })}</div>}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5" data-testid="city-yields">
        <Stat value={`${yields.food >= 0 ? '+' : ''}${yields.food}`} label={t('cy.food')} color="var(--fa-good)" title={t('cy.foodSurplus', { eaten: city.size * 2, bank: Math.round(growth.bank), threshold: growth.threshold })} />
        <Stat value={`+${yields.production}`} label={t('cy.production')} title={t('cy.productionTurn')} />
        <Stat value={`+${yields.gold}`} label={t('cy.gold')} color="var(--fa-brass)" title={t('cy.goldTurn')} />
        <Stat value={`+${yields.science}`} label={t('cy.science')} color="var(--fa-science)" title={t('cy.scienceTurn', { culture: yields.culture })} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[12px]">
        <div className="fa-card px-2 py-1.5" data-testid="city-size">
          <div className="text-fa-muted">{t('cy.size')}</div>
          <div className="fa-num text-[15px] font-semibold">{city.size}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{growthLine}</div>
          {growth.threshold > 0 && <div className="text-fa-muted text-[11px] leading-tight fa-num" title={t('cy.foodBanked')}>{t('cy.foodBank', { bank: Math.floor(growth.bank), threshold: growth.threshold })}</div>}
        </div>
        <div className="fa-card px-2 py-1.5">
          <div className="text-fa-muted flex items-center gap-1"><Home className="w-3 h-3" aria-hidden="true" />{t('cy.housing')}</div>
          <div className={`fa-num text-[15px] font-semibold ${city.size >= housing ? 'text-fa-enemy' : ''}`}>{city.size}/{housing}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{growth.speed <= 0 ? t('cy.fullNoGrowth') : growth.speed < 0.95 ? t('cy.growthAt', { n: Math.round(growth.speed * 100) }) : t('cy.roomToGrow')}{city.marketHousing ? ` · ${t('cy.marketHousing', { n: city.marketHousing })}` : ''}</div>
        </div>
        <div className="fa-card px-2 py-1.5">
          <div className="text-fa-muted flex items-center gap-1"><Smile className="w-3 h-3" aria-hidden="true" />{t('cy.amenities')}</div>
          <div className={`fa-num text-[15px] font-semibold ${amen.net < 0 ? 'text-fa-danger-text' : amen.net >= 2 ? 'text-fa-good' : ''}`}>{amen.supply}/{amen.need}</div>
          <div className="text-fa-muted text-[11px] leading-tight">{amen.net < 0 ? t('cy.amenShort') : amen.net >= 2 ? t('cy.amenContent') : t('cy.amenEnough')}</div>
        </div>
      </div>
      <div className="fa-card p-2.5" data-testid="city-building-now">
        <div className="flex items-center justify-between gap-2">
          <span className="fa-label">{t('cy.buildingNow')}</span>
          {current && <span className={`fa-num text-[13px] font-semibold ${current.waitText ? 'text-fa-enemy' : ''}`} data-testid="city-current-status">{currentStatus}</span>}
        </div>
        {current ? (
          <>
            <div className="text-[15px] font-semibold mt-0.5 truncate">{current.label}</div>
            <Meter value={current.progress} max={Math.max(1, current.cost)} color="#CDB27A" className="mt-1.5" label={t('cy.progressOf', { label: current.label, n: Math.round(current.progress), cost: current.cost })} />
            {queue.length > 1 && <div className="text-[12px] text-fa-muted mt-1 truncate">{t('cy.then', { list: queue.slice(1).map((q) => q.label).join(', ') })}</div>}
          </>
        ) : <div className="text-[13px] text-fa-muted mt-0.5">{t('cy.nothingOpen')}</div>}
      </div>
      {(built.length > 0 || wondersHere.length > 0) && (
        <div className="flex flex-wrap gap-1.5" data-testid="city-built">
          {built.map((b) => <span key={b.id} className="fa-chip">{b.name}</span>)}
          {wondersHere.map((w) => <span key={w.id} className="fa-chip" title={t('cy.wonder')}>{w.name}</span>)}
        </div>
      )}
    </>
  );

  const shownGroups = group === 'All' ? GROUPS : [group];
  const build = (
    <>
      {whyBubble}
      {/* The queue bar: pinned, always the same height, so adding to the queue moves nothing below it. */}
      <div className={`sticky -top-3 z-10 -mx-3 ${showOverview ? '' : '-mt-3'} px-3 pt-2 pb-1.5 bg-fa-panel border-b border-fa-line`} data-testid="city-queue-bar">
        <div className="flex items-center gap-2 min-h-[44px]">
          {current ? <ItemIcon item={current.item} ageId={ageId} /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{current ? current.label : t('cy.nothingProd')}</div>
            <div className={`truncate text-[12px] h-[18px] ${flash ? (flash.ok ? 'text-fa-good' : 'text-fa-danger-text') : 'text-fa-muted'}`} aria-live="polite" data-testid="city-queue-status">
              {flash ? <>{flash.ok && <Check className="inline w-3.5 h-3.5 me-0.5 -mt-0.5" aria-hidden="true" />}{flash.text}</>
                : current ? <><span className="fa-num">{Math.round(current.progress)}/{current.cost}</span> · {currentStatus}{queue.length > 1 ? ` · ${t('cy.moreQueued', { n: queue.length - 1 })}` : ''}</>
                  : t('cy.pickBelow')}
            </div>
          </div>
          {/* Nothing in production: the advisor names one buildable thing, one tap queues it (warmonger
              playtest step 18: "Choose production does nothing, hard to know what I can build"). */}
          {mine && !current && advisorItem && (
            <button type="button" onClick={() => dispatch({ type: ActionTypes.ADVISOR_PRODUCTION, payload: { cityId } })} data-testid="city-advisor-pick"
              className="fa-btn fa-btn-primary min-h-[44px] px-2.5 shrink min-w-0 max-w-[55%] gap-1.5 text-[12px]">
              <Hammer className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="truncate">{t('cy.advisorPick', { name: shortItemLabel(advisorItem, getTiles(), ageId) })}</span>
            </button>
          )}
          {mine && current?.rush?.gold > 0 && (
            <button type="button" onClick={() => setBuyAt((v) => (v === 0 ? null : 0))} aria-expanded={buyAt === 0} data-testid="city-rush-open"
              className={`fa-btn fa-btn-secondary min-h-[44px] px-2 shrink-0 ${current.rush.ok ? '' : 'opacity-60'}`} title={rushText(current)?.title}>
              <Coins className="w-4 h-4 me-0.5" aria-hidden="true" /><span className="fa-num">{current.rush.gold}</span>
            </button>
          )}
          <button type="button" onClick={() => setQueueOpen((v) => !v)} disabled={!queue.length} aria-expanded={queueOpen} data-testid="city-queue-toggle"
            className="fa-btn fa-btn-secondary min-h-[44px] px-2.5 disabled:opacity-40 shrink-0" aria-label={queueOpen ? t('cy.hideQueue') : t('cy.showQueue', { n: queue.length })}>
            <span className="fa-num me-1">{queue.length}</span>{queueOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {/* Always there, so the bar is the same height with and without something in production. */}
        <div className="mt-0.5 h-1">{current && <Meter value={current.progress} max={Math.max(1, current.cost)} color="#CDB27A" height={4} />}</div>
        {/* The buy offer rides in the pinned bar: below it, a scrolled list hid it and the gold button
            seemed to do nothing (Opus playtest step 244). */}
        {mine && buyAt != null && queue[buyAt]?.rush && (() => {
          const q = queue[buyAt]; const words = rushText(q);
          return (
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-fa-line bg-fa-raised px-2.5 py-1.5 text-[12px] leading-snug" data-testid="city-rush-offer">
              <div className="min-w-0 flex-1">{q.rush.ok ? words.text : `${words.text} ${reasonText(q.rush, lang)}`}</div>
              <button type="button" disabled={!q.rush.ok} data-testid="city-rush-pay"
                onClick={() => { dispatch({ type: ActionTypes.RUSH_PRODUCTION, payload: { cityId, index: q.index } }); setBuyAt(null); }}
                className="fa-btn fa-btn-primary fa-btn-sm min-h-[44px] shrink-0 disabled:opacity-40">{t('cy.pay', { n: q.rush.gold })}</button>
              <button type="button" onClick={() => setBuyAt(null)} className="fa-icon-btn min-w-[44px] min-h-[44px] shrink-0" aria-label={t('cy.closeOffer')}><X className="w-4 h-4" /></button>
            </div>
          );
        })()}
      </div>
      {/* Below the bar, in the scroll: the queue list never covers the rows (BUILD-01). */}
      {queueOpen && queue.length > 0 && (
        <div className="mt-1.5 max-h-[42vh] overflow-y-auto">
          <ol className="space-y-1" data-testid="city-queue">
            {queue.map((q) => (
              <li key={`${q.key}-${q.index}`} className="flex items-center gap-1 rounded-lg ps-2 min-h-[44px] text-[13px] fa-card">
                <ItemIcon item={q.item} ageId={ageId} size={24} />
                <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => openTile(q.tile)} onKeyDown={(e) => { if (e.key === 'Enter') openTile(q.tile); }}>
                  <div className="truncate">{q.index === 0 ? '' : `${q.index + 1}. `}{q.label}</div>
                  <div className="text-fa-muted text-[12px]"><span className="fa-num">{q.progress > 0 || q.index === 0 ? `${Math.round(q.progress)}/${q.cost}` : q.cost}</span> · {q.waitText || (q.turns == null ? t('cy.noProduction') : t('cy.doneIn', { turns: turnsText(q.turns) }))}</div>
                </div>
                {mine && q.rush?.gold > 0 && (
                  <button type="button" onClick={() => setBuyAt(q.index)} className={`fa-icon-btn min-w-[44px] min-h-[44px] text-[11px] fa-num ${q.rush.ok ? '' : 'opacity-60'}`} aria-label={t('cy.buyItemAria', { label: q.label, gold: q.rush.gold })} title={rushText(q)?.title} data-testid="queue-rush">
                    {t('cy.goldShort', { n: q.rush.gold })}
                  </button>
                )}
                {mine && q.index > 0 && (
                  <button type="button" onClick={() => dispatch({ type: ActionTypes.MOVE_PRODUCTION, payload: { cityId, index: q.index, to: 0 } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={t('cy.buildFirst', { label: q.label })} title={t('cy.moveFront')} data-testid="queue-front">
                    <ArrowUpToLine className="w-4 h-4" />
                  </button>
                )}
                {mine && q.index > 1 && (
                  <button type="button" onClick={() => dispatch({ type: ActionTypes.MOVE_PRODUCTION, payload: { cityId, index: q.index, to: q.index - 1 } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={t('cy.moveUpAria', { label: q.label })} title={t('cy.moveUp')} data-testid="queue-up">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                )}
                {mine && (
                  <button type="button" onClick={() => dispatch({ type: ActionTypes.DEQUEUE_PRODUCTION, payload: { cityId, index: q.index } })} className="fa-icon-btn min-w-[44px] min-h-[44px]" aria-label={t('cy.removeAria', { label: q.label })} title={t('cy.remove')} data-testid="queue-remove">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="text-[11px] text-fa-muted mt-1">{t('cy.queueNote')}</div>
        </div>
      )}

      {mine && (
        <div className="flex items-center gap-1.5 text-[12px]" data-testid="city-keep" title={t('cy.keepTip')}>
          <span className="text-fa-muted shrink-0">{t('cy.keep')}</span>
          <div ref={keepRow} className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="radiogroup" aria-label={t('cy.keep')}>
            {[[null, 'cy.keepOff'], ['repeat', 'cy.keepRepeat'], ['advisor', 'cy.keepAdvisor']].map(([mode, key]) => {
              const on = (city.production?.keep || null) === mode;
              return (
                <button key={key} type="button" role="radio" aria-checked={on} data-testid={`city-keep-${mode || 'off'}`}
                  onClick={() => dispatch({ type: ActionTypes.SET_PRODUCTION_KEEP, payload: { cityId, keep: mode } })}
                  className={`shrink-0 rounded-full border px-2.5 min-h-[36px] whitespace-nowrap ${on ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line text-fa-muted'}`}>{t(key)}</button>
              );
            })}
          </div>
        </div>
      )}

      {mine && hint && (
        <div className="rounded-lg border border-fa-line bg-fa-raised px-2.5 py-1 text-[12px] leading-snug" data-testid="long-build-hint">
          <div className="flex flex-wrap items-center gap-x-2 min-h-[36px]">
            <AlertTriangle className="w-4 h-4 text-fa-brass shrink-0" aria-hidden="true" />
            <div className={`min-w-0 ${hintOpen ? 'order-last basis-full pb-1' : 'flex-1 truncate'}`} data-testid="long-build-text">{hintOpen ? hint.text : hint.short}</div>
            <button type="button" onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen} className="underline text-fa-you min-h-[44px] px-1 shrink-0" data-testid="long-build-more">{hintOpen ? t('cy.less') : t('cy.more')}</button>
            {hint.better && (
              <button type="button" onClick={() => dispatch({ type: ActionTypes.SET_CITY_FOCUS, payload: { cityId, focus: hint.better.focus } })} className="fa-btn fa-btn-secondary fa-btn-sm min-h-[44px] shrink-0" data-testid="long-build-focus">{t('cy.productionFocus')}</button>
            )}
          </div>
        </div>
      )}

      {mine && options.length > 0 && (
        <div ref={groupRow} className="flex gap-1 overflow-x-auto -mx-1 px-1 [scrollbar-width:none]" role="tablist" aria-label={t('cy.buildLists')}>
          {GROUP_FILTERS.filter((g) => g === 'All' || options.some((o) => o.group === g)).map((g) => (
            <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} data-testid={`build-group-${g.toLowerCase()}`}
              className={`shrink-0 rounded-full border px-3 min-h-[44px] text-[12px] ${group === g ? 'border-fa-brass bg-fa-raised text-fa-text' : 'border-fa-line text-fa-muted'}`}>{groupLabel(g)}</button>
          ))}
        </div>
      )}

      {mine && shownGroups.map((g) => {
        const rows = options.filter((o) => o.group === g);
        if (!rows.length) return null;
        return (
          <div key={g}>
            <div className="fa-label mb-1">{groupLabel(g)}</div>
            <ul className="space-y-1">
              {rows.map((o) => {
                const open = openRow === o.id;
                const clip = open ? '' : 'truncate';
                return (
                  <li key={o.id} className={`flex items-center gap-2 rounded-lg ps-2 pe-1 py-1 min-h-[44px] text-[13px] border ${o.ok ? 'bg-fa-raised border-fa-line' : 'bg-transparent border-dashed border-fa-line/60 opacity-75'}`} data-testid="build-row">
                    <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} aria-expanded={open} onClick={() => toggleRow(o)} onKeyDown={(e) => { if (e.key === 'Enter') toggleRow(o); }} title={o.tile != null ? t('cy.showTileDetails') : t('cy.showDetails')}>
                      <ItemIcon item={o.item} ageId={ageId} />
                      <div className="min-w-0 flex-1">
                        <div className={clip}>{o.tile != null && <MapPin className="inline w-3 h-3 me-0.5 -mt-0.5 text-fa-muted" aria-hidden="true" />}{o.item.kind === 'unit' && o.item.classId !== 'naval' && !o.item.explorer ? <GlossaryLink kind="unit" id={`${ageId}_${o.item.classId}`}>{o.label}</GlossaryLink> : o.label}</div>
                        {o.detail && <div className={`text-[12px] leading-snug text-fa-text/80 ${clip}`} data-testid="build-effect">{o.detail}</div>}
                        {o.tag && <div className={`text-[12px] leading-snug text-fa-brass ${clip}`} data-testid="build-tag">{o.tag}</div>}
                        {open && o.note && <div className="text-[12px] leading-snug text-fa-muted">{o.note}.</div>}
                        <div className="text-fa-muted text-[12px]">
                          {o.queued > 0 && <span className="text-fa-good me-1">{o.queued > 1 ? t('cy.nInQueue', { n: o.queued }) : t('cy.inQueue')}{o.ok ? ' ·' : ''}</span>}
                          {o.ok ? <>{R('cy.prodCost', { cost: <span className="fa-num">{o.cost}</span> })} · {turnsText(o.turns)}{o.stored > 0 ? ` · ${t('cy.alreadyDone', { n: Math.round(o.stored) })}` : ''}{o.long && <span className="text-fa-brass" data-testid="build-slow"> · {t('cy.slowWhy', { production: o.production, gold: o.buyGold })}</span>}</>
                            : o.queued ? null
                              : o.needsName ? <>{t('cy.needs', { name: o.needsName })}{o.needsEta && <span data-testid="build-needs-eta">, {o.needsEta}</span>} {!o.needsPlanned && <button type="button" onClick={(e) => { e.stopPropagation(); dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId: o.needsTech } }); }} className="underline text-fa-you min-h-[24px]" data-testid="research-for-item">{t('cy.researchIt')}</button>}</>
                                : o.note || o.reason}
                          {/* a locked row shows no turn count: it read as buildable (Opus playtest step 185) */}
                          {!o.ok && o.cost > 0 && !o.needsName && <span className="text-fa-muted"> · {R('cy.prodCost', { cost: <span className="fa-num">{o.cost}</span> })}</span>}
                        </div>
                        {o.replaces && <div className="flex items-center gap-1 text-[12px] leading-snug text-fa-brass" data-testid="build-replaces"><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{t('cy.replaces', { name: o.replaces })}</div>}
                      </div>
                    </div>
                    <button type="button" {...why(!o.ok, o.queued ? t('cy.alreadyInQueue') : o.needsName ? `${t('cy.needsLower', { name: o.needsName })}${o.needsEta ? `, ${o.needsEta}` : ''}` : o.reason, () => (o.replaces ? askConfirm(replaceImprovementConfirm(o.label, o.replaces), () => queueNow(o)) : queueNow(o)))} className="fa-icon-btn min-w-[44px] min-h-[44px] shrink-0 disabled:opacity-40 aria-disabled:opacity-40" aria-label={o.ok ? t('cy.buildAria', { label: o.label }) : `${o.label}: ${o.queued ? t('cy.alreadyInQueue') : o.needsName ? t('cy.needsLower', { name: o.needsName }) : o.reason}`} data-testid="queue-item">
                      {o.queued && !o.ok ? <Check className="w-4 h-4" /> : o.ok ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" data-testid="build-locked" />}
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
  const { t } = useT();
  const templates = templatesOf(state.nations[state.playerNationId]);
  const classes = getUnlockedClasses(ageId, getResearched(state, state.playerNationId)).filter((c) => c !== 'naval');
  const [draft, setDraft] = React.useState(null);
  const edit = (tpl) => setDraft({ id: tpl?.id || null, name: tpl ? templateName(tpl.id, tpl.name) : '', composition: { ...(tpl?.composition || {}) } });
  const bump = (c, d) => setDraft((x) => ({ ...x, composition: { ...x.composition, [c]: Math.max(0, (x.composition[c] | 0) + d) } }));
  return (
    <div className="mt-3 border-t border-fa-line pt-2" data-testid="army-templates">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-semibold text-fa-text">{t('cy.tplTitle')}</div>
        <button type="button" onClick={() => edit(null)} className="text-[11px] text-fa-good min-h-[32px] px-2">{t('cy.tplNew')}</button>
      </div>
      <ul className="space-y-1 text-xs">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex items-center gap-2 rounded-lg px-2 min-h-[40px] bg-fa-raised/40 border border-fa-line/60">
            <div className="min-w-0 flex-1 truncate text-fa-text">{templateName(tpl.id, tpl.name)} <span className="text-fa-muted">({t('cy.tplUnits', { n: templateSize(tpl.composition), list: Object.entries(tpl.composition).map(([c, k]) => `${k} ${unitDisplayName(ageId, c)}`).join(', ') })})</span></div>
            <button type="button" onClick={() => edit(tpl)} className="text-fa-text min-h-[32px] px-2">{t('cy.tplEdit')}</button>
            <button type="button" onClick={() => dispatch({ type: ActionTypes.DELETE_ARMY_TEMPLATE, payload: { id: tpl.id } })} aria-label={t('cy.tplDeleteAria', { name: templateName(tpl.id, tpl.name) })} className="text-fa-danger-text min-h-[32px] px-2">{t('cy.tplDelete')}</button>
          </li>
        ))}
      </ul>
      {draft && (
        <div className="mt-2 rounded-lg border border-emerald-700/60 bg-fa-panel/60 p-2 space-y-2 text-xs" data-testid="army-template-editor">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('cy.tplName')} className="w-full bg-fa-raised rounded px-2 min-h-[36px] text-fa-text" aria-label={t('cy.tplName')} />
          <div className="grid grid-cols-2 gap-1">
            {classes.map((c) => (
              <div key={c} className="flex items-center justify-between rounded bg-fa-raised/60 px-2 min-h-[36px]">
                <span className="text-fa-text inline-flex items-center gap-1 min-w-0" title={unitClassLabel(c)}><UnitIcon classId={c} ageId={ageId} size={18} /><span className="truncate"><GlossaryLink kind="unit" id={`${ageId}_${c}`}>{unitDisplayName(ageId, c)}</GlossaryLink></span></span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => bump(c, -1)} className="min-w-[32px] min-h-[32px] rounded bg-fa-hover text-fa-text" aria-label={t('cy.fewer', { unit: unitDisplayName(ageId, c) })}>-</button>
                  <span className="w-5 text-center text-fa-text">{draft.composition[c] | 0}</span>
                  <button type="button" onClick={() => bump(c, 1)} className="min-w-[32px] min-h-[32px] rounded bg-fa-hover text-fa-text" aria-label={t('cy.moreUnits', { unit: unitDisplayName(ageId, c) })}>+</button>
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { dispatch({ type: ActionTypes.SAVE_ARMY_TEMPLATE, payload: { template: draft } }); setDraft(null); }} disabled={!draft.name.trim() || templateSize(draft.composition) < 1} className="flex-1 min-h-[40px] rounded-lg bg-emerald-700 text-fa-text disabled:opacity-40" data-testid="save-army-template">{t('cy.tplSave')}</button>
            <button type="button" onClick={() => setDraft(null)} className="min-h-[40px] px-3 rounded-lg bg-fa-hover text-fa-text">{t('cy.tplCancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityPanel;
