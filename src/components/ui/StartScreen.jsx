// src/components/ui/StartScreen.jsx
// The new game screen (W01, plans/UI-DESIGN.md; plans/peoples-and-world-setup.md section 3, phase
// W0). Three columns on a phone held sideways (844x390) and on a desktop: the world size as radio
// cards with the number of peoples, the people picker (150 peoples, search, region chips, Random),
// and the chosen people with the options (explored world, speed, difficulty), the guided start and
// the one brass action, Begin. A phone held upright stacks them. Field Atlas look.
//
// The world seed is random and hidden (roadmap decision 11): pressing Begin draws one here, in the
// UI (crypto.getRandomValues, outside the engine, which stays pure), and passes it in
// `scenario.seed`; the game state keeps it, so a save or a replay rebuilds the same world.
import React, { useMemo, useRef, useState } from 'react';
import { Search, BookOpen, ArrowRight, Shuffle } from 'lucide-react';
import { GAME_SPEEDS } from '../../data/ages';
import { DIFFICULTIES } from '../../data/difficulty';
import { PEOPLES, PEOPLES_LIST, PEOPLE_REGION_GROUPS } from '../../data/peoples';
import { WORLD_SIZES, WORLD_SIZE_IDS, DEFAULT_WORLD_SIZE } from '../../data/worldSizes';
import { TUTORIAL_NATION, TUTORIAL_WORLD_SIZE } from '../../engine/tutorial';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { PeopleEmblem, ThemeIcon, THEME_LABELS, startArt, regionIcon } from './peopleArt';
import { Label } from './atlas';
import MapPicker from './MapPicker';
import { newWorldSeed } from './seeds';
import HOMES from '../../data/geo/peopleHomes.json';
import { currentWorldSpec } from '../../worldgen/worldLoader';

// "Home: a hot dry river land" from the people's home profile (plans/MAP-VARIATIONS-PLAN.md 6.5),
// shown instead of the real capital off the real Earth.
const CLIMATE_WORDS = { A: 'hot wet', B: 'dry', C: 'mild', D: 'cold-winter', E: 'polar' };
export const homeLine = (peopleId) => {
  const h = HOMES[peopleId];
  if (!h) return null;
  const hot = h.k[0] === 'B' ? (h.k[2] === 'h' ? 'hot ' : 'cool ') : '';
  return `Home: a ${hot}${CLIMATE_WORDS[h.k[0]] || 'mild'} ${h.v ? 'river ' : ''}${h.c ? 'coast' : 'land'}; it starts on the site that suits it best`;
};

const DEFAULT_PEOPLE_ID = 'akkad';

/** A fresh world seed for a new game, drawn in the UI (never in the engine): seeds.js. */
export { newWorldSeed };

/** Search over the people's name, adjective, capital and modern land ("iraq" finds Akkad). */
export const matchPeople = (people, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [people.name, people.adjective, people.capital.name, people.landName].some((s) => s.toLowerCase().includes(q));
};

// World size: three radio cards (role radiogroup, arrow keys move), the peoples count on the right.
const WorldSizeCards = ({ value, onChange }) => {
  const refs = useRef([]);
  const move = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + WORLD_SIZE_IDS.length) % WORLD_SIZE_IDS.length;
    onChange(WORLD_SIZE_IDS[next]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="World size" className="grid gap-2">
      {WORLD_SIZE_IDS.map((id, i) => {
        const size = WORLD_SIZES[id];
        const on = value === id;
        const art = startArt(`worldsize-${id}`);
        return (
          <button key={id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            ref={(el) => { refs.current[i] = el; }}
            onClick={() => onChange(id)} onKeyDown={(e) => move(e, i)} data-testid={`world-size-${id}`}
            className="fa-option relative overflow-hidden min-h-[56px] px-3 py-2 text-left flex items-center gap-2.5">
            {art && <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />}
            <span className={`relative w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-fa-text' : 'border-fa-muted'}`} aria-hidden="true">
              {on && <span className="w-2 h-2 rounded-full bg-fa-text" />}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block font-semibold text-[15px] leading-tight">{size.name}</span>
              <span className="block text-[12px] text-fa-muted leading-tight">{size.blurb}</span>
            </span>
            <span className="relative fa-num text-[18px] font-semibold" aria-label={`${size.majors} peoples`}>{size.majors}</span>
          </button>
        );
      })}
    </div>
  );
};

const RegionChips = ({ value, onChange }) => (
  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" role="group" aria-label="Region">
    {[{ id: 'all', name: 'All' }, ...PEOPLE_REGION_GROUPS].map((r) => {
      const icon = r.id !== 'all' ? regionIcon(r.id) : null;
      return (
        <button key={r.id} type="button" onClick={() => onChange(r.id)} aria-pressed={value === r.id} className="fa-chip shrink-0">
          {icon && <img src={icon} alt="" className="w-3.5 h-3.5" />}{r.name}
        </button>
      );
    })}
  </div>
);

const StartScreen = ({ onStart }) => {
  const layout = useLayoutMode();
  const wide = layout === 'desktop';
  const [worldSize, setWorldSize] = useState(DEFAULT_WORLD_SIZE);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_PEOPLE_ID);
  const [gameSpeed, setGameSpeed] = useState('normal');
  const [difficultyId, setDifficultyId] = useState('prince');
  const [exploredWorld, setExploredWorld] = useState(false);
  // The map (MapPicker): the page's own world by default, so a generated world's next game stays on it.
  const [mapSpec, setMapSpec] = useState(() => { const w = currentWorldSpec(); return w.kind === 'generated' ? { kind: 'generated', generatorVersion: w.generatorVersion, seed: w.seed, params: w.params } : { kind: 'earth' }; });
  const generatedMap = mapSpec.kind === 'generated';

  const peoples = useMemo(() => PEOPLES_LIST
    .filter((p) => (region === 'all' || p.regionGroup === region) && matchPeople(p, search))
    .sort((a, b) => a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, ''))), [region, search]);
  const selected = PEOPLES[selectedId];
  const size = WORLD_SIZES[worldSize];

  const begin = () => onStart({ playerNationId: selectedId, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: worldSize, seed: newWorldSeed(), map: mapSpec }, exploredWorld });
  // The guided start teaches on the Nile: always the real Earth.
  const guided = () => onStart({ playerNationId: TUTORIAL_NATION, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: TUTORIAL_WORLD_SIZE, seed: newWorldSeed(), map: { kind: 'earth' } }, guided: true, exploredWorld });
  const random = () => { const pool = peoples.length ? peoples : PEOPLES_LIST; setSelectedId(pool[Math.floor(Math.random() * pool.length)].id); };
  const background = startArt(wide ? 'background-wide' : 'background-phone') || startArt('background-wide');
  const backdrop = { backgroundImage: background ? `linear-gradient(rgba(16,20,26,0.84), rgba(16,20,26,0.94)), url(${background})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' };

  const sizeColumn = (
    <section className="min-h-0 flex flex-col gap-2 sm:overflow-y-auto scrollbar-none" aria-labelledby="world-size-title">
      <MapPicker value={mapSpec} onChange={setMapSpec} />
      <Label id="world-size-title" className="mt-1">World size</Label>
      <WorldSizeCards value={worldSize} onChange={setWorldSize} />
      <p className="text-[12px] text-fa-muted leading-snug">Peoples alive at the start. Others rise later as free cities split away.</p>
      <Label className="mt-1">Game speed</Label>
      <div className="flex flex-wrap gap-1.5">
        {Object.values(GAME_SPEEDS).map((speed) => (
          <button key={speed.id} type="button" onClick={() => setGameSpeed(speed.id)} aria-pressed={gameSpeed === speed.id} title={speed.blurb} className="fa-chip">{speed.name}</button>
        ))}
      </div>
      <Label className="mt-1">Difficulty</Label>
      <div className="flex flex-wrap gap-1.5">
        {Object.values(DIFFICULTIES).map((d) => (
          <button key={d.id} type="button" onClick={() => setDifficultyId(d.id)} aria-pressed={difficultyId === d.id} className="fa-chip">{d.name}</button>
        ))}
      </div>
      <p className="text-[12px] text-fa-muted leading-snug">{DIFFICULTIES[difficultyId]?.description}</p>
    </section>
  );

  const picker = (
    <section className="fa-panel min-h-0 flex flex-col p-2.5 gap-2" aria-labelledby="choose-people">
      <div className="flex items-center justify-between gap-2">
        <h2 id="choose-people" className="fa-label">Choose your people</h2>
        <button type="button" onClick={random} className="fa-chip" aria-label="Pick a random people"><Shuffle className="w-3.5 h-3.5" aria-hidden="true" />Random</button>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 text-fa-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search peoples"
          onKeyDown={(e) => { if (e.key === 'Enter' && peoples.length > 0) setSelectedId(peoples[0].id); }}
          placeholder="Search peoples, capitals or lands"
          className="fa-input pl-9" />
      </div>
      <RegionChips value={region} onChange={setRegion} />
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 max-h-[55dvh] sm:max-h-none space-y-1" data-testid="people-list">
        {peoples.map((p) => (
          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} data-people={p.id} data-people-name={p.name} aria-pressed={selectedId === p.id}
            className="fa-option w-full flex items-center gap-2.5 px-2.5 min-h-[40px] text-left border-transparent bg-transparent">
            <PeopleEmblem slug={p.id} color={p.color} size={16} />
            <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">{p.name}</span>
            <span className="text-[12px] text-fa-muted truncate max-w-[45%]">{p.landName}</span>
          </button>
        ))}
        {peoples.length === 0 && <div className="text-center text-fa-muted text-[13px] py-4">No people matches your search.</div>}
      </div>
    </section>
  );

  const chosen = selected && (
    <section className="min-h-0 flex flex-col gap-2.5" aria-label="Your people and the options">
      {/* The people and the options scroll on their own; Begin stays pinned under them, so on a
          short screen (a phone held sideways with Safari's bars) it is never below the fold. */}
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 sm:overflow-y-auto overscroll-contain scrollbar-thin" data-testid="start-details">
      <div className="fa-panel p-3 flex gap-3 shrink-0" data-testid="selected-people">
        <PeopleEmblem slug={selected.id} color={selected.color} size={wide ? 52 : 44} />
        <div className="min-w-0">
          <div className="fa-heading text-[20px] leading-tight truncate">{selected.name}</div>
          {generatedMap
            ? <div className="text-[13px] leading-snug" data-testid="home-line">{homeLine(selected.id)}</div>
            : <div className="text-[13px] leading-snug">Capital <span className="font-semibold">{selected.capital.name}</span>, in modern {selected.landName}</div>}
          <div className="text-[13px] text-fa-muted leading-snug flex items-center gap-1"><ThemeIcon theme={selected.theme} className="w-3.5 h-3.5" />{THEME_LABELS[selected.theme] || selected.theme} art{selected.arrives != null ? ' · a late people, playable from the start' : ''}</div>
          <div className="text-[12px] text-fa-muted leading-snug mt-0.5">{size.name} world: you and {size.majors - 1} other peoples</div>
        </div>
      </div>
      <div className="fa-panel p-3 shrink-0">
        <Label className="mb-1">Options</Label>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">Explored world</div>
            <div className="text-[12px] text-fa-muted leading-snug">{exploredWorld ? 'On: the whole map is known, every people met' : 'Off: start in the dark, explore to see'}</div>
          </div>
          <button type="button" role="switch" aria-checked={exploredWorld} aria-label="Explored world" onClick={() => setExploredWorld((v) => !v)} className="fa-switch" data-testid="explored-world" />
        </div>
        <button type="button" onClick={guided} data-testid="guided-start" className="fa-btn fa-btn-ghost w-full mt-1 !justify-start !px-1 !h-auto !py-2 !whitespace-normal text-left leading-snug"
          title="Ten turns of prompts on the Nile: settle, farm, build, research, meet a neighbour, fight.">
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="min-w-0">New here? Play the guided start as Kemet</span>
        </button>
      </div>
      </div>
      <button type="button" onClick={begin} data-testid="begin-game" className="fa-btn fa-btn-primary fa-btn-hero w-full !min-h-[52px] shrink-0">
        <span className="truncate">Begin as {selected.name}</span><ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
      </button>
    </section>
  );

  return (
    <div className="h-[100dvh] w-full bg-fa-ink text-fa-text flex flex-col overflow-y-auto sm:overflow-hidden" style={backdrop} data-testid="start-screen">
      <header className="flex items-baseline gap-3 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2 shrink-0 pl-[max(1rem,env(safe-area-inset-left))]">
        <h1 className="fa-heading text-[19px]">New game</h1>
        <span className="text-[13px] text-fa-muted">Dawn, 2000 BCE. One city each. Terra Imperium</span>
      </header>
      <div className={`flex-1 min-h-0 grid gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]
        grid-cols-1 sm:grid-rows-[minmax(0,1fr)] sm:grid-cols-[minmax(0,0.78fr)_minmax(0,1.2fr)_minmax(0,1.25fr)] ${wide ? 'max-w-[1240px] w-full mx-auto sm:gap-5 sm:pb-6' : ''}`}>
        {sizeColumn}
        {picker}
        {chosen}
      </div>
    </div>
  );
};

export default StartScreen;
