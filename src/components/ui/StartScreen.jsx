// src/components/ui/StartScreen.jsx
// The new game screen (plans/peoples-and-world-setup.md section 3, phase W0): the world size as
// rounded radio cards, the people picker (150 peoples, search and a region filter), game speed,
// difficulty and the guided start. Mobile first: on a phone held sideways (844x390) the settings
// and the picker sit side by side, each scrolling on its own, with Begin always in the top bar.
//
// The world seed is random and hidden (roadmap decision 11): pressing Begin draws one here, in the
// UI (crypto.getRandomValues, outside the engine, which stays pure), and passes it in
// `scenario.seed`; the game state keeps it, so a save or a replay rebuilds the same world.
import React, { useMemo, useRef, useState } from 'react';
import { Globe2, Search, Play, BookOpen, Check } from 'lucide-react';
import { GAME_SPEEDS } from '../../data/ages';
import { DIFFICULTIES } from '../../data/difficulty';
import { PEOPLES, PEOPLES_LIST, PEOPLE_REGION_GROUPS } from '../../data/peoples';
import { WORLD_SIZES, WORLD_SIZE_IDS, DEFAULT_WORLD_SIZE } from '../../data/worldSizes';
import { TUTORIAL_NATION, TUTORIAL_WORLD_SIZE } from '../../engine/tutorial';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { PeopleEmblem, ThemeIcon, startArt, regionIcon } from './peopleArt';

const DEFAULT_PEOPLE_ID = 'akkad';

/** A fresh world seed for a new game, drawn in the UI (never in the engine). */
export const newWorldSeed = () => {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] || 1;
  } catch {
    return (Date.now() >>> 0) || 1;
  }
};

/** Search over the people's name, adjective, capital and modern land ("iraq" finds Akkad). */
export const matchPeople = (people, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [people.name, people.adjective, people.capital.name, people.landName].some((s) => s.toLowerCase().includes(q));
};

// World size: three rounded radio cards, one row on a landscape phone (plan 3.1).
const WorldSizeCards = ({ value, onChange, compact }) => {
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
    <div role="radiogroup" aria-label="World size" className="grid grid-cols-3 gap-2">
      {WORLD_SIZE_IDS.map((id, i) => {
        const size = WORLD_SIZES[id];
        const on = value === id;
        const art = startArt(`worldsize-${id}`);
        return (
          <button key={id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            ref={(el) => { refs.current[i] = el; }}
            onClick={() => onChange(id)} onKeyDown={(e) => move(e, i)} data-testid={`world-size-${id}`}
            className={`relative overflow-hidden min-h-[48px] rounded-2xl border text-left transition-all ${compact ? 'p-2' : 'p-3'} ${
              on ? 'bg-amber-500/20 border-amber-500/60 text-white' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'}`}>
            {art && <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />}
            <span className="relative flex items-start gap-2">
              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-amber-400' : 'border-slate-500'}`}>
                {on && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-sm leading-tight">{size.name}</span>
                <span className="block text-[11px] text-slate-300 leading-tight">{size.majors} nations</span>
                <span className={`block text-[10px] leading-tight ${on ? 'text-amber-200' : 'text-slate-400'} ${compact ? 'truncate' : ''}`}>{size.blurb}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const RegionChips = ({ value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Region">
    {[{ id: 'all', name: 'All' }, ...PEOPLE_REGION_GROUPS].map((r) => {
      const icon = r.id !== 'all' ? regionIcon(r.id) : null;
      return (
        <button key={r.id} type="button" onClick={() => onChange(r.id)} aria-pressed={value === r.id}
          className={`shrink-0 min-h-[32px] px-2.5 rounded-full border text-[11px] flex items-center gap-1 ${
            value === r.id ? 'bg-blue-500/30 border-blue-500/60 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60'}`}>
          {icon && <img src={icon} alt="" className="w-3.5 h-3.5" />}{r.name}
        </button>
      );
    })}
  </div>
);

const SectionTitle = ({ children }) => <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{children}</h2>;

const StartScreen = ({ onStart }) => {
  const layout = useLayoutMode();
  const compact = layout === 'phone-landscape' || layout === 'phone-portrait' || layout === 'tablet';
  const [worldSize, setWorldSize] = useState(DEFAULT_WORLD_SIZE);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_PEOPLE_ID);
  const [gameSpeed, setGameSpeed] = useState('normal');
  const [difficultyId, setDifficultyId] = useState('prince');
  const [exploredWorld, setExploredWorld] = useState(false);

  const peoples = useMemo(() => PEOPLES_LIST
    .filter((p) => (region === 'all' || p.regionGroup === region) && matchPeople(p, search))
    .sort((a, b) => a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, ''))), [region, search]);
  const selected = PEOPLES[selectedId];

  const begin = () => onStart({ playerNationId: selectedId, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: worldSize, seed: newWorldSeed() }, exploredWorld });
  const guided = () => onStart({ playerNationId: TUTORIAL_NATION, gameSpeed, difficultyId, scenario: { mode: 'peoples', size: TUTORIAL_WORLD_SIZE, seed: newWorldSeed() }, guided: true, exploredWorld });
  const background = startArt(compact ? 'background-phone' : 'background-wide') || startArt('background-wide');

  const settings = (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <section>
        <SectionTitle>World size</SectionTitle>
        <WorldSizeCards value={worldSize} onChange={setWorldSize} compact={compact} />
        {/* The full 240-nation world, commented out for new games (plans/peoples-and-world-setup.md
            3.2, roadmap decision 1); old full-world saves still load (engine mode 'full'). To bring
            it back, restore this option and pass scenario { mode: 'full' } from Begin.
        <button type="button" onClick={() => setWorldSize('full')}>Full world (240 nations)</button> */}
      </section>
      <section>
        <SectionTitle>Game speed</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(GAME_SPEEDS).map((speed) => (
            <button key={speed.id} type="button" onClick={() => setGameSpeed(speed.id)} aria-pressed={gameSpeed === speed.id}
              className={`min-h-[40px] p-1.5 rounded-xl text-center text-sm border transition-all ${gameSpeed === speed.id ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'}`}>
              <span className="block font-semibold leading-tight">{speed.name}</span>
              {!compact && <span className="block text-[10px] text-slate-400 leading-tight">{speed.blurb}</span>}
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Difficulty</SectionTitle>
        <div className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
          {Object.values(DIFFICULTIES).map((d) => (
            <button key={d.id} type="button" onClick={() => setDifficultyId(d.id)} aria-pressed={difficultyId === d.id}
              className={`${compact ? 'min-h-[36px] px-3 rounded-full' : 'w-full p-2 rounded-lg text-left'} text-xs border transition-all ${difficultyId === d.id ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'}`}>
              <div className="font-semibold">{d.name}</div>
              {!compact && <div className="text-slate-400 mt-0.5">{d.description}</div>}
            </button>
          ))}
        </div>
        {compact && <p className="mt-1 text-[11px] text-slate-400">{DIFFICULTIES[difficultyId]?.description}</p>}
      </section>
      {/* Fog of war (src/engine/fog.js): on by default; the explored world shows the whole map. */}
      <section>
        <SectionTitle>The map</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: false, name: 'Fog of war', blurb: 'You know your homeland; explore to find the rest and meet other peoples.' },
            { id: true, name: 'Explored world', blurb: 'The whole world is mapped and every people known from the start.' }].map((o) => (
            <button key={String(o.id)} type="button" onClick={() => setExploredWorld(o.id)} aria-pressed={exploredWorld === o.id}
              data-testid={o.id ? 'explored-world' : 'fog-of-war'}
              className={`min-h-[44px] p-2 rounded-xl text-left text-xs border transition-all ${exploredWorld === o.id ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'}`}>
              <span className="block font-semibold">{o.name}</span>
              {!compact && <span className="block text-[10px] text-slate-400 leading-tight">{o.blurb}</span>}
            </button>
          ))}
        </div>
      </section>
      <button type="button" onClick={guided} data-testid="guided-start"
        className="w-full flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-xl font-semibold text-sm bg-amber-700/60 hover:bg-amber-600/70 border border-amber-500/50 text-amber-100 transition-all active:scale-95"
        title="Ten turns of prompts on the Nile: settle, farm, build, research, meet a neighbour, fight.">
        <BookOpen className="w-4 h-4" /> New here? Play the guided start as Kemet
      </button>
    </div>
  );

  const picker = (
    <section className={`flex flex-col min-h-0 ${compact ? 'h-full' : ''}`} aria-labelledby="choose-people">
      <h2 id="choose-people" className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Choose Your Nation</h2>
      <div className="relative mb-1.5">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search peoples"
          onKeyDown={(e) => { if (e.key === 'Enter' && peoples.length > 0) setSelectedId(peoples[0].id); }}
          placeholder="Search 150 peoples, capitals or lands..."
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-8 pr-2 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
      </div>
      <RegionChips value={region} onChange={setRegion} />
      <div className={`mt-1.5 grid content-start auto-rows-min gap-1.5 overflow-y-auto pr-1 bg-slate-900/40 rounded-lg border border-slate-800 p-1.5 ${compact ? 'grid-cols-2 flex-1 min-h-0' : 'grid-cols-2 lg:grid-cols-3 max-h-[46vh]'}`} data-testid="people-list">
        {peoples.map((p) => (
          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} data-people={p.id} data-people-name={p.name} aria-pressed={selectedId === p.id}
            className={`flex items-center gap-2 px-2 py-1.5 min-h-[44px] rounded-lg text-left transition-all ${selectedId === p.id ? 'bg-blue-500/30 border border-blue-500/60 text-white' : 'bg-slate-800/60 border border-transparent hover:bg-slate-700/60 text-slate-300'}`}>
            <PeopleEmblem slug={p.id} color={p.color} size={18} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-semibold"><span className="truncate">{p.name}</span><ThemeIcon theme={p.theme} className="w-3 h-3 shrink-0" /></span>
              <span className="block text-[10px] text-slate-400 truncate">{p.capital.name}, in modern {p.landName}</span>
            </span>
          </button>
        ))}
        {peoples.length === 0 && <div className="col-span-full text-center text-slate-500 text-xs py-4">No people matches your search.</div>}
      </div>
    </section>
  );

  const beginButton = (
    <button type="button" onClick={begin} data-testid="begin-game"
      className={`flex items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 ${compact ? 'px-3 min-h-[40px] text-sm max-w-[46vw]' : 'w-full px-4 py-3 text-base'}`}>
      <Play className="w-4 h-4 shrink-0" /><span className="truncate">Begin as {selected?.name}</span>
    </button>
  );

  const summary = selected && (
    <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0" data-testid="selected-people">
      <PeopleEmblem slug={selected.id} color={selected.color} size={compact ? 18 : 24} />
      <div className="min-w-0">
        <div className="font-semibold text-white truncate">{selected.name}</div>
        <div className="text-[11px] text-slate-400 truncate">{selected.capital.name}, in modern {selected.landName}{selected.pinned ? ' ֲ· always in the world' : ''}{selected.arrives != null ? ' ֲ· a late people, playable from the start' : ''}</div>
      </div>
      <Check className="w-4 h-4 text-blue-300 shrink-0" />
    </div>
  );

  const backdrop = { backgroundImage: background ? `linear-gradient(rgba(2,6,23,0.72), rgba(2,6,23,0.9)), url(${background})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' };

  if (compact) {
    return (
      <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden" style={backdrop} data-testid="start-screen">
        <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1.5 border-b border-slate-800/80 shrink-0">
          <Globe2 className="w-5 h-5 text-blue-400 shrink-0" />
          <h1 className="text-base font-bold text-white shrink-0">Terra Imperium</h1>
          <div className="flex-1 min-w-0 px-2">{summary}</div>
          {beginButton}
        </header>
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <div className="min-h-0 overflow-y-auto pr-1">{settings}</div>
          <div className="min-h-0 flex flex-col">{picker}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-y-auto" style={backdrop} data-testid="start-screen">
      <div className="max-w-6xl mx-auto p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Globe2 className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold text-white">Terra Imperium</h1>
          <span className="ml-3 text-sm text-slate-400">2000 BCE. One city each. The world is yours to settle.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8">
          <div>{settings}</div>
          <div className="space-y-3">
            {picker}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
              {summary}
              {beginButton}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
