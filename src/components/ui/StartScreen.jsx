// src/components/ui/StartScreen.jsx
// The new game screen (W01, plans/UI-DESIGN.md section 8; plans/peoples-and-world-setup.md section
// 3, phase W0), in four steps with one frame: 1 People (search, region chips, Random, the list, the
// chosen people's card, the guided start), 2 World (the Map block when generated worlds are on, the
// world size), 3 Rules (speed, difficulty, Explored world), 4 Ready (a summary, each row with
// Change). The step indicator on top opens any step (every choice has a default); the bottom bar
// holds Back and Next; the one brass action, Begin as <people>, is on the last step (Ready) only:
// the fast path is pick a people, Next (or the Ready step button) to Ready, then Begin. Enter outside a field goes on (and begins on Ready), Escape goes back. Every
// step stays mounted (hidden), so choices, the generated preview and scripts that flip a switch
// before Begin keep working. Field Atlas look; 844x390 landscape is the reference screen.
//
// The world seed is random and hidden (roadmap decision 11): pressing Begin draws one here, in the
// UI (crypto.getRandomValues, outside the engine, which stays pure), and passes it in
// `scenario.seed`; the game state keeps it, so a save or a replay rebuilds the same world.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, BookOpen, ArrowRight, ArrowLeft, Shuffle, Check, Pencil } from 'lucide-react';
import { GAME_SPEEDS, START_YEAR } from '../../data/ages';
import { DIFFICULTIES } from '../../data/difficulty';
import { PEOPLES, MAJOR_PEOPLES_LIST, PEOPLE_REGION_GROUPS } from '../../data/peoples';
import { WORLD_SIZES, WORLD_SIZE_IDS, DEFAULT_WORLD_SIZE, CITY_STATE_DENSITIES, DEFAULT_CITY_STATES, START_MIN_GAP_KM, cityStateCount } from '../../data/worldSizes';
import { TUTORIAL_NATION, TUTORIAL_WORLD_SIZE } from '../../engine/tutorial';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { PeopleEmblem, ThemeIcon, startArt, regionIcon } from './peopleArt';
import { Label } from './atlas';
import MapPicker, { generatedWorldsEnabled, mapFromUrl } from './MapPicker';
import { newWorldSeed } from './seeds';
import HOMES from '../../data/geo/peopleHomes.json';
import { currentWorldSpec } from '../../worldgen/worldLoader';
import LanguageSwitch from './LanguageSwitch';
import { useT } from '../../i18n/useT';
import { t as tNow } from '../../i18n';
import { rich } from '../../i18n/rich';

// "Home: a hot dry river land" from the people's home profile (plans/MAP-VARIATIONS-PLAN.md 6.5),
// shown instead of the real capital off the real Earth.
const CLIMATE_IDS = ['A', 'C', 'D', 'E'];
export const homeLine = (peopleId) => {
  const h = HOMES[peopleId];
  if (!h) return null;
  const k0 = h.k[0];
  const climate = tNow(k0 === 'B' ? (h.k[2] === 'h' ? 'start.climate.Bh' : 'start.climate.Bc') : `start.climate.${CLIMATE_IDS.includes(k0) ? k0 : 'C'}`);
  const kind = tNow(`start.homeKind.${h.v ? 'river' : ''}${h.c ? (h.v ? 'Coast' : 'coast') : (h.v ? 'Land' : 'land')}`);
  return tNow('start.home', { climate, kind });
};

const DEFAULT_PEOPLE_ID = 'akkad';

/** The four steps, in order. */
export const START_STEPS = [
  { id: 'people', name: 'People' },
  { id: 'world', name: 'World' },
  { id: 'rules', name: 'Rules' },
  { id: 'ready', name: 'Ready' }
];

/** A fresh world seed for a new game, drawn in the UI (never in the engine): seeds.js. */
export { newWorldSeed };

/** Search over the people's name, adjective, capital and modern land ("iraq" finds Akkad). */
export const matchPeople = (people, query, shownNames = []) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [people.name, people.adjective, people.capital.name, people.landName, ...shownNames].some((s) => s && s.toLowerCase().includes(q));
};

/** What a key does on the start screen: 'next', 'back' or null. Enter in a field or on a button,
 * Escape in a field, and keys with a modifier keep their own meaning. */
export const startKeyAction = (key, target, { modifier = false } = {}) => {
  if (modifier) return null;
  const tag = target?.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable;
  if (key === 'Enter') return inField || tag === 'BUTTON' || tag === 'A' ? null : 'next';
  if (key === 'Escape') return inField ? null : 'back';
  return null;
};

// Radio cards (role radiogroup, arrow keys move): world size and game speed.
const RadioCards = ({ label, items, value, onChange, testIdPrefix, className = 'grid gap-2' }) => {
  const refs = useRef([]);
  const move = (e, i) => {
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {items.map((item, i) => {
        const on = value === item.id;
        return (
          <button key={item.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            ref={(el) => { refs.current[i] = el; }}
            onClick={() => onChange(item.id)} onKeyDown={(e) => move(e, i)} data-testid={`${testIdPrefix}-${item.id}`}
            className="fa-option relative overflow-hidden min-h-[52px] px-3 py-2 text-start flex items-center gap-2.5">
            {item.art && <img src={item.art} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />}
            <span className={`relative w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-fa-text' : 'border-fa-muted'}`} aria-hidden="true">
              {on && <span className="w-2 h-2 rounded-full bg-fa-text" />}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block font-semibold text-[15px] leading-tight">{item.name}</span>
              <span className="block text-[12px] text-fa-muted leading-tight">{item.blurb}</span>
            </span>
            {item.count != null && <span className="relative fa-num text-[18px] font-semibold" aria-label={item.countLabel}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

const RegionChips = ({ value, onChange, bare = false }) => {
  const { t } = useT();
  const chips = [{ id: 'all' }, ...PEOPLE_REGION_GROUPS].map((r) => {
    const icon = r.id !== 'all' ? regionIcon(r.id) : null;
    return (
      <button key={r.id} type="button" onClick={() => onChange(r.id)} aria-pressed={value === r.id} className="fa-chip shrink-0 !min-h-[36px]">
        {icon && <img src={icon} alt="" className="w-3.5 h-3.5" />}{t(`start.region.${r.id}`)}
      </button>
    );
  });
  return bare ? <>{chips}</> : <ScrollRow label={t('start.region')}>{chips}</ScrollRow>;
};

// A row that scrolls sideways with a fade on the end that still has more (the overflow cue). The
// fade follows the row's end edge (Hebrew reads right to left).
const ScrollRow = ({ label, className = '', children }) => {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 2);
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const fade = `linear-gradient(to ${rtl ? 'left' : 'right'}, #000 calc(100% - 28px), transparent)`;
  return (
    <div ref={ref} onScroll={measure} role="group" aria-label={label} data-scroll-more={more ? 'true' : 'false'}
      className={`flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 shrink-0 ${className}`}
      style={more ? { WebkitMaskImage: fade, maskImage: fade } : undefined}>
      {children}
    </div>
  );
};

// The step indicator: numbered buttons, the current one raised, done ones checked.
const StepIndicator = ({ step, onGo, compact }) => {
  const { t } = useT();
  return (
  <nav aria-label={t('start.stepsNav')} className="ms-auto min-w-0">
    <ol className="flex items-center gap-0.5 sm:gap-1">
      {START_STEPS.map((s, i) => {
        const current = i === step;
        const done = i < step;
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onGo(i)} aria-current={current ? 'step' : undefined} data-testid={`start-step-${s.id}`}
              aria-label={t('start.stepAria', { i: i + 1, name: t(`start.step.${s.id}`) })}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 rounded-full px-2 sm:px-2.5 text-[13px] font-semibold border ${current ? 'bg-fa-raised border-fa-text text-fa-text' : 'border-transparent text-fa-muted hover:text-fa-text'}`}>
              <span className={`w-5 h-5 rounded-full border text-[11px] flex items-center justify-center shrink-0 ${done ? 'bg-fa-muted text-fa-ink border-fa-muted' : current ? 'border-fa-text' : 'border-fa-muted'}`} aria-hidden="true">
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className={compact && !current ? 'hidden min-[640px]:inline' : ''}>{t(`start.step.${s.id}`)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
  );
};

// One step's area: a heading for screen readers and focus; hidden (still mounted) when not current.
const StepPanel = ({ id, active, title, fill, children }) => (
  <section hidden={!active} aria-labelledby={`start-step-title-${id}`} data-step-panel={id} className={fill ? 'h-full min-h-0' : ''}>
    <h2 id={`start-step-title-${id}`} tabIndex={-1} className="sr-only" data-step-heading={id}>{title}</h2>
    {children}
  </section>
);

// `initialStep`: the step it opens on (tests; a player always starts on People).
const StartScreen = ({ onStart, initialStep = 0, onBackToTitle, headerExtra = null }) => {
  const { t, n, year, name: nm, lang } = useT();
  const layout = useLayoutMode();
  const wide = layout === 'desktop';
  const phone = layout === 'phone-landscape' || layout === 'phone-portrait';
  const shortPhone = layout === 'phone-landscape';
  const twoCols = layout !== 'phone-portrait' && layout !== 'tablet-portrait';
  const [step, setStep] = useState(() => Math.max(0, Math.min(START_STEPS.length - 1, initialStep | 0)));
  const [worldSize, setWorldSize] = useState(DEFAULT_WORLD_SIZE);
  const [cityStates, setCityStates] = useState(DEFAULT_CITY_STATES);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_PEOPLE_ID);
  const [gameSpeed, setGameSpeed] = useState('normal');
  const [difficultyId, setDifficultyId] = useState('prince');
  const [exploredWorld, setExploredWorld] = useState(false);
  const [crises, setCrises] = useState(true);
  const [explore, setExplore] = useState(false);
  // The map (MapPicker): a shared `?map=CODE`, else the page's own world, so a generated world's
  // next game stays on it.
  const [mapSpec, setMapSpec] = useState(() => { const shared = mapFromUrl(); if (shared) return shared; const w = currentWorldSpec(); return w.kind === 'generated' ? { kind: 'generated', generatorVersion: w.generatorVersion, seed: w.seed, params: w.params } : { kind: 'earth' }; });
  const generatedMap = mapSpec.kind === 'generated';
  const mapChoice = generatedWorldsEnabled() || generatedMap;

  // The picker lists the 50 major peoples (decision 42); the others are city-states.
  const peoples = useMemo(() => MAJOR_PEOPLES_LIST
    .filter((p) => (region === 'all' || p.regionGroup === region) && matchPeople(p, search, [nm('people', p.id, p.name), nm('city', null, p.capital.name), nm('land', null, p.landName)]))
    .sort((a, b) => (lang === 'he'
      ? nm('people', a.id, a.name).localeCompare(nm('people', b.id, b.name), 'he')
      : a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, '')))), [region, search, lang, nm]);
  const selected = PEOPLES[selectedId];
  const size = WORLD_SIZES[worldSize];
  const speed = GAME_SPEEDS[gameSpeed];
  const sizeName = (id) => t(`start.size.${id}.name`);
  const densityName = (id) => t(`start.density.${id}.name`);
  const speedName = (id) => t(`start.speed.${id}.name`);
  const diffName = (id) => t(`start.diff.${id}.name`);
  const peopleName = (p) => nm('people', p.id, p.name);
  const last = START_STEPS.length - 1;

  const begin = useCallback(() => onStart({ playerNationId: selectedId, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: worldSize, cityStates, seed: newWorldSeed(), map: mapSpec, band: true }, exploredWorld, crises: crises ? 'on' : 'off', explore }),
    [onStart, selectedId, gameSpeed, difficultyId, worldSize, cityStates, mapSpec, exploredWorld, crises, explore]);
  // The guided start teaches on the Nile: always the real Earth.
  const guided = () => onStart({ playerNationId: TUTORIAL_NATION, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: TUTORIAL_WORLD_SIZE, seed: newWorldSeed(), map: { kind: 'earth' } }, guided: true, exploredWorld, crises: crises ? 'on' : 'off', explore });
  const random = () => { const pool = peoples.length ? peoples : MAJOR_PEOPLES_LIST; setSelectedId(pool[Math.floor(Math.random() * pool.length)].id); };

  // Moving between steps puts the focus on the new step's heading (read out; Enter then goes on).
  const moved = useRef(false);
  const go = useCallback((i) => { moved.current = true; setStep(Math.max(0, Math.min(last, i))); }, [last]);
  useEffect(() => {
    if (!moved.current) return;
    document.querySelector(`[data-step-heading="${START_STEPS[step].id}"]`)?.focus({ preventScroll: true });
  }, [step]);

  // Enter goes on (begins on Ready), Escape goes back; fields and buttons keep their own keys.
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const action = startKeyAction(e.key, e.target, { modifier: e.altKey || e.ctrlKey || e.metaKey || e.shiftKey });
      if (action === 'next') { e.preventDefault(); if (step === last) begin(); else go(step + 1); }
      if (action === 'back' && step > 0) { e.preventDefault(); go(step - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, last, begin, go]);

  const background = startArt(wide ? 'background-wide' : 'background-phone') || startArt('background-wide');
  const backdrop = { backgroundImage: background ? `linear-gradient(rgba(16,20,26,0.84), rgba(16,20,26,0.94)), url(${background})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' };
  const fill = twoCols ? 'h-full min-h-0' : '';
  const scrollBox = 'min-h-0 overflow-y-auto overscroll-contain scrollbar-thin';
  const csCount = cityStateCount(worldSize, cityStates);
  const choicesLine = t('start.choices', { size: sizeName(worldSize), map: generatedMap ? t('start.choices.generated') : '', density: densityName(cityStates).toLowerCase(), speed: speedName(gameSpeed), difficulty: diffName(difficultyId), explored: exploredWorld ? t('start.choices.explored') : '' });

  const peopleCard = selected && (
    <div className="fa-panel p-3 flex gap-3 shrink-0" data-testid="selected-people">
      <PeopleEmblem slug={selected.id} color={selected.color} size={wide ? 64 : 44} />
      <div className="min-w-0">
        <div className={`fa-heading leading-tight truncate ${wide ? 'text-[26px]' : 'text-[20px]'}`}>{peopleName(selected)}</div>
        {generatedMap
          ? <div className="text-[13px] leading-snug" data-testid="home-line">{homeLine(selected.id)}</div>
          : <div className="text-[13px] leading-snug">{rich(t('start.capital', { land: nm('land', null, selected.landName) }), { city: <span className="font-semibold">{nm('city', null, selected.capital.name)}</span> })}</div>}
        <div className="text-[13px] text-fa-muted leading-snug flex items-center gap-1"><ThemeIcon theme={selected.theme} className="w-3.5 h-3.5" />{t('start.themeArt', { theme: t(`start.theme.${selected.theme}`) })}{selected.arrives != null ? t('start.latePeople') : ''}</div>
        <div className="text-[12px] text-fa-muted leading-snug mt-0.5">{t('start.worldLine', { size: sizeName(worldSize), others: size.majors - 1 })}</div>
      </div>
    </div>
  );

  // Step 1: the people. On a phone in landscape the search, Random and the region chips share one
  // sideways row so the list gets the height (50 majors, 44 px rows).
  const searchInput = (
    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('start.searchAria')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && peoples.length > 0) setSelectedId(peoples[0].id);
        if (e.key === 'Escape' && search) { e.preventDefault(); setSearch(''); }
      }}
      placeholder={shortPhone ? t('start.searchShort') : t('start.searchPlaceholder')}
      className="fa-input ps-9 !min-h-[40px]" />
  );
  const randomButton = (
    <button type="button" onClick={random} className="fa-chip !min-h-[40px] shrink-0" aria-label={t('start.randomAria')}><Shuffle className="w-3.5 h-3.5" aria-hidden="true" />{shortPhone ? null : t('start.random')}</button>
  );
  const peopleStep = (
    <div className={`${fill} grid gap-3 ${twoCols ? 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
      <section className={`fa-panel min-h-0 flex flex-col ${shortPhone ? 'p-1.5 gap-1.5' : 'p-2.5 gap-2'}`} aria-labelledby="choose-people">
        <h3 id="choose-people" className="sr-only">{t('start.choosePeople')}</h3>
        {shortPhone ? (
          <ScrollRow label={t('start.searchRegion')}>
            <div className="relative w-[9.5rem] shrink-0">
              <Search className="w-4 h-4 text-fa-muted absolute start-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              {searchInput}
            </div>
            {randomButton}
            <RegionChips value={region} onChange={setRegion} bare />
          </ScrollRow>
        ) : (
          <>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-fa-muted absolute start-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                {searchInput}
              </div>
              {randomButton}
            </div>
            <RegionChips value={region} onChange={setRegion} />
          </>
        )}
        <div className={`flex-1 ${scrollBox} -mx-1 px-1 grid content-start gap-1 ${wide ? 'grid-cols-2' : 'grid-cols-1'} ${twoCols ? '' : 'max-h-[55dvh]'}`} data-testid="people-list">
          {peoples.map((p) => (
            <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} data-people={p.id} data-people-name={p.name} aria-pressed={selectedId === p.id}
              className="fa-option w-full flex items-center gap-2.5 px-2.5 min-h-[44px] text-start border-transparent bg-transparent">
              <PeopleEmblem slug={p.id} color={p.color} size={16} />
              <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">{peopleName(p)}</span>
              <span className="text-[12px] text-fa-muted truncate max-w-[45%]">{nm('land', null, p.landName)}</span>
            </button>
          ))}
          {peoples.length === 0 && <div className="col-span-full text-center text-fa-muted text-[13px] py-4">{t('start.noMatch')}</div>}
        </div>
      </section>
      <section className={`${scrollBox} flex flex-col gap-2.5`} aria-label={t('start.yourPeople')} data-testid="start-details">
        {peopleCard}
        <p className="text-[12px] text-fa-muted leading-snug px-1" data-testid="start-defaults">
          {choicesLine} {t('start.defaultsHint')}
        </p>
        <button type="button" onClick={guided} data-testid="guided-start" className="fa-btn fa-btn-ghost w-full mt-auto !justify-start !px-2 !h-auto !py-2 !whitespace-normal text-start leading-snug shrink-0"
          title={t('start.guidedTip')}>
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="min-w-0">{t('start.guided', { people: nm('people', 'kemet', 'Kemet') })}</span>
        </button>
      </section>
    </div>
  );

  // Step 2: the world. Without the map choice, the world size alone as three wide cards.
  const sizeItems = WORLD_SIZE_IDS.map((id) => ({ ...WORLD_SIZES[id], name: sizeName(id), blurb: t(`start.size.${id}.blurb`), art: startArt(`worldsize-${id}`), count: WORLD_SIZES[id].majors, countLabel: t('start.peopleCount', { n: WORLD_SIZES[id].majors }) }));
  // City-states: Few / Normal / Many (decision 42). Beside the map when there is a map choice (it
  // fits there on a phone), else under the world size.
  const cityStatesBlock = (
    <div className="flex flex-col gap-2">
      <Label id="city-states-title" >{t('start.cityStates')}</Label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="city-states-title">
        {Object.values(CITY_STATE_DENSITIES).map((d) => (
          <button key={d.id} type="button" aria-pressed={cityStates === d.id} title={t(`start.density.${d.id}.blurb`)} onClick={() => setCityStates(d.id)} data-testid={`city-states-${d.id}`} className="fa-chip !min-h-[40px]">{densityName(d.id)}</button>
        ))}
      </div>
      <p className="text-[12px] text-fa-muted leading-snug" data-testid="city-states-line">{t('start.csLine', { n: csCount, km: START_MIN_GAP_KM })}</p>
    </div>
  );
  const sizeBlock = (
    <div className="flex flex-col gap-2">
      <Label id="world-size-title">{t('start.worldSize')}</Label>
      <RadioCards label={t('start.worldSize')} items={sizeItems} value={worldSize} onChange={setWorldSize} testIdPrefix="world-size"
        className={`grid gap-2 ${!mapChoice && twoCols ? 'grid-cols-3' : ''}`} />
      <p className="text-[12px] text-fa-muted leading-snug">{t('start.sizeHint')}</p>
      {!mapChoice && cityStatesBlock}
    </div>
  );
  const worldStep = mapChoice ? (
    <div className={`${fill} grid gap-3 ${twoCols ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <section className={`fa-panel p-2.5 ${scrollBox}`} aria-label={t('start.map')}>
        <MapPicker value={mapSpec} onChange={setMapSpec} />
        <p className="text-[12px] text-fa-muted leading-snug mt-2">{generatedMap ? t('start.mapHint.generated') : t('start.mapHint.earth')}</p>
        <div className="mt-3">{cityStatesBlock}</div>
      </section>
      <section className={`fa-panel p-2.5 ${scrollBox}`} aria-labelledby="world-size-title">{sizeBlock}</section>
    </div>
  ) : (
    <section className={`fa-panel p-2.5 ${fill} ${scrollBox}`} aria-labelledby="world-size-title">{sizeBlock}</section>
  );

  // Step 3: the rules.
  const speedItems = Object.values(GAME_SPEEDS).map((s) => ({ id: s.id, name: speedName(s.id), blurb: t(`start.speed.${s.id}.blurb`) }));
  const rulesStep = (
    <div className={`${fill} grid gap-3 ${twoCols ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <section className={`fa-panel p-2.5 ${scrollBox} flex flex-col gap-2`} aria-label={t('start.gameSpeed')}>
        <Label>{t('start.gameSpeed')}</Label>
        <RadioCards label={t('start.gameSpeed')} items={speedItems} value={gameSpeed} onChange={setGameSpeed} testIdPrefix="game-speed" />
      </section>
      <section className={`fa-panel p-2.5 ${scrollBox} flex flex-col gap-2`} aria-label={t('start.difficultyOptions')}>
        <Label>{t('start.difficulty')}</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('start.difficulty')}>
          {Object.values(DIFFICULTIES).map((d) => (
            <button key={d.id} type="button" onClick={() => setDifficultyId(d.id)} aria-pressed={difficultyId === d.id} data-testid={`difficulty-${d.id}`} className="fa-chip !min-h-[40px]">{diffName(d.id)}</button>
          ))}
        </div>
        <p className="text-[12px] text-fa-muted leading-snug">{t(`start.diff.${difficultyId}.desc`)}</p>
        <Label className="mt-1">{t('start.options')}</Label>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{t('start.explored')}</div>
            <div className="text-[12px] text-fa-muted leading-snug">{exploredWorld ? t('start.exploredOn') : t('start.exploredOff')}</div>
          </div>
          <button type="button" role="switch" aria-checked={exploredWorld} aria-label={t('start.explored')} onClick={() => setExploredWorld((v) => !v)} className="fa-switch before:content-[''] before:absolute before:-inset-y-[10px] before:-inset-x-1" data-testid="explored-world" />
        </div>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{t('start.crises')}</div>
            <div className="text-[12px] text-fa-muted leading-snug">{crises ? t('start.crisesOn') : t('start.crisesOff')}</div>
          </div>
          <button type="button" role="switch" aria-checked={crises} aria-label={t('start.crises')} onClick={() => setCrises((v) => !v)} className="fa-switch before:content-[''] before:absolute before:-inset-y-[10px] before:-inset-x-1" data-testid="crises-toggle" />
        </div>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{t('start.explore')}</div>
            <div className="text-[12px] text-fa-muted leading-snug">{explore ? t('start.exploreOn') : t('start.exploreOff')}</div>
          </div>
          <button type="button" role="switch" aria-checked={explore} aria-label={t('start.explore')} onClick={() => setExplore((v) => !v)} className="fa-switch before:content-[''] before:absolute before:-inset-y-[10px] before:-inset-x-1" data-testid="explore-toggle" />
        </div>
      </section>
    </div>
  );

  // Step 4: ready. One row per choice, each with Change.
  const summaryRows = [
    mapChoice && { key: 'map', label: t('start.map'), value: generatedMap ? t('start.sum.generated') : t('start.sum.earth'), to: 1 },
    { key: 'world', label: t('start.worldSize'), value: t('start.sum.world', { size: sizeName(worldSize), others: size.majors - 1 }), to: 1 },
    { key: 'cityStates', label: t('start.cityStates'), value: t('start.sum.cityStates', { density: densityName(cityStates), n: csCount }), to: 1 },
    { key: 'speed', label: t('start.gameSpeed'), value: t('start.sum.speed', { speed: speedName(gameSpeed), turns: n(speed?.turnLimit) }), to: 2 },
    { key: 'difficulty', label: t('start.difficulty'), value: diffName(difficultyId), to: 2 },
    { key: 'explored', label: t('start.explored'), value: exploredWorld ? t('start.on') : t('start.off'), to: 2 },
    { key: 'crises', label: t('start.crises'), value: crises ? t('start.on') : t('start.off'), to: 2 },
    { key: 'explore', label: t('start.explore'), value: explore ? t('start.on') : t('start.off'), to: 2 }
  ].filter(Boolean);
  const readyStep = (
    <div className={`${fill} grid gap-3 ${twoCols ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]' : 'grid-cols-1'}`}>
      <section className={`${scrollBox} flex flex-col gap-1.5`} aria-label={t('start.yourPeople')}>
        {peopleCard}
        <p className="text-[12px] text-fa-muted leading-snug px-1 flex items-center gap-2 flex-wrap">
          <span>{t('start.dawn', { year: year(START_YEAR) })}</span>
          <button type="button" className="fa-btn fa-btn-ghost !min-h-[40px] !px-2" onClick={() => go(0)} data-testid="change-people">{t('start.changePeople')}</button>
        </p>
      </section>
      <section className={`fa-panel px-3 py-1 ${scrollBox}`} aria-label={t('start.yourChoices')} data-testid="start-summary">
        <dl>
          {summaryRows.map((r) => (
            <div key={r.key} className="flex items-start gap-2 min-h-[44px] py-1.5 border-b border-fa-line last:border-b-0" data-summary={r.key}>
              <dt className="text-[12px] text-fa-muted w-24 shrink-0 pt-0.5">{r.label}</dt>
              <dd className="text-[14px] font-semibold min-w-0 flex-1 break-words leading-snug pt-px">{r.value}</dd>
              <button type="button" onClick={() => go(r.to)} className="fa-btn fa-btn-ghost !min-h-[44px] !min-w-[44px] !px-0 -my-1.5 shrink-0 self-center" aria-label={t('start.change', { what: r.label.toLowerCase() })} title={t('start.change', { what: r.label.toLowerCase() })}>
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );

  const next = START_STEPS[step + 1];
  const frame = `ps-[max(0.75rem,var(--safe-start))] pe-[max(0.75rem,var(--safe-end))] ${wide ? 'max-w-[1240px] w-full mx-auto' : ''}`;
  return (
    <div className="h-[100dvh] w-full bg-fa-ink text-fa-text flex flex-col overflow-hidden" style={backdrop} data-testid="start-screen" data-step={START_STEPS[step].id}>
      <header className={`flex items-center gap-3 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 shrink-0 ${frame}`}>
        {onBackToTitle && <button type="button" onClick={onBackToTitle} className="fa-btn fa-btn-ghost shrink-0 !min-h-[44px] !px-2" data-testid="start-back-to-title"><ArrowLeft className="rtl:-scale-x-100 w-4 h-4" aria-hidden="true" />{t('start.titleBack')}</button>}
        <h1 className="fa-heading text-[19px] shrink-0">{t('start.title')}</h1>
        {!phone && <span className="text-[13px] text-fa-muted truncate">{t('start.dawn', { year: year(START_YEAR) })}</span>}
        <StepIndicator step={step} onGo={go} compact={phone} />
        {headerExtra || <span className="ms-auto" />}
        <LanguageSwitch compact className="shrink-0" />
      </header>
      <main className={`flex-1 min-h-0 ${twoCols ? 'overflow-hidden' : 'overflow-y-auto'} ${frame}`}>
        <StepPanel id="people" active={step === 0} fill={twoCols} title={t('start.stepTitle', { i: 1, name: t('start.step.people') })}>{peopleStep}</StepPanel>
        <StepPanel id="world" active={step === 1} fill={twoCols} title={t('start.stepTitle', { i: 2, name: t('start.step.world') })}>{worldStep}</StepPanel>
        <StepPanel id="rules" active={step === 2} fill={twoCols} title={t('start.stepTitle', { i: 3, name: t('start.step.rules') })}>{rulesStep}</StepPanel>
        <StepPanel id="ready" active={step === 3} fill={twoCols} title={t('start.stepTitle', { i: 4, name: t('start.step.ready') })}>{readyStep}</StepPanel>
      </main>
      <footer className={`flex items-center gap-2 pt-2 [@media(max-height:320px)]:pt-1 shrink-0 ${wide ? 'pb-6' : 'pb-[max(0.5rem,env(safe-area-inset-bottom))] [@media(max-height:320px)]:pb-[max(0.25rem,env(safe-area-inset-bottom))]'} ${frame}`}>
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="fa-btn fa-btn-ghost shrink-0" data-testid="start-back">
            <ArrowLeft className="rtl:-scale-x-100 w-4 h-4" aria-hidden="true" />{t('start.back')}
          </button>
        )}
        <span className="flex-1" />
        {next && (
          <button type="button" onClick={() => go(step + 1)} className="fa-btn fa-btn-secondary shrink-0 !min-h-[48px] [@media(max-height:320px)]:!min-h-[44px]" data-testid="start-next">
            {t('start.next', { name: t(`start.step.${next.id}`) })}<ArrowRight className="rtl:-scale-x-100 w-4 h-4" aria-hidden="true" />
          </button>
        )}
        {step === last && (
          <button type="button" onClick={begin} data-testid="begin-game" className={`fa-btn fa-btn-primary fa-btn-hero min-w-0 !min-h-[48px] ${twoCols ? 'max-w-[55%]' : 'flex-1'}`}>
            <span className="truncate">{t('start.begin', { name: selected ? peopleName(selected) : '' })}</span><ArrowRight className="rtl:-scale-x-100 w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        )}
      </footer>
    </div>
  );
};

export default StartScreen;
