// src/components/ui/StartScreen.jsx
// Country-select + difficulty + game-speed start screen (plan §1/§3/§8.6). Shown for a
// brand-new player and whenever a new game is started — picking a nation is the single
// highest-leverage choice in the game, so it gets its own screen rather than a buried default.

import React, { useMemo, useState } from 'react';
import { Globe2, Search, Play } from 'lucide-react';
import { WORLD_NATIONS } from '../../data/worldNations';
import { GAME_SPEEDS } from '../../data/ages';
import { DIFFICULTIES } from '../../data/difficulty';

const DEFAULT_NATION_ID = 'us';

const StartScreen = ({ onStart }) => {
  const [search, setSearch] = useState('');
  const [selectedNationId, setSelectedNationId] = useState(DEFAULT_NATION_ID);
  const [gameSpeed, setGameSpeed] = useState('normal');
  const [difficultyId, setDifficultyId] = useState('prince');

  const sortedNations = useMemo(() => {
    return Object.values(WORLD_NATIONS)
      .filter(n => !search.trim() || n.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search]);

  const selectedNation = WORLD_NATIONS[selectedNationId];

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col items-center overflow-y-auto p-4 sm:p-8">
      <div className="flex items-center gap-2 mt-4 mb-6">
        <Globe2 className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Terra Imperium</h1>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Nation picker */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Choose Your Nation</h2>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sortedNations.length > 0) setSelectedNationId(sortedNations[0].id);
              }}
              placeholder="Search 240 nations..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-8 pr-2 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1 bg-slate-900/40 rounded-lg border border-slate-800 p-2">
            {sortedNations.map(nation => (
              <button
                key={nation.id}
                onClick={() => setSelectedNationId(nation.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition-all ${
                  selectedNationId === nation.id
                    ? 'bg-blue-500/30 border border-blue-500/60 text-white'
                    : 'bg-slate-800/60 border border-transparent hover:bg-slate-700/60 text-slate-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: nation.color }} />
                <span className="truncate">{nation.name}</span>
              </button>
            ))}
            {sortedNations.length === 0 && (
              <div className="col-span-full text-center text-slate-500 text-xs py-4">No nations match your search.</div>
            )}
          </div>
        </section>

        {/* Game speed */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Game Speed</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(GAME_SPEEDS).map(speed => (
              <button
                key={speed.id}
                onClick={() => setGameSpeed(speed.id)}
                className={`p-2 rounded-lg text-center text-sm border transition-all ${
                  gameSpeed === speed.id
                    ? 'bg-blue-500/20 border-blue-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 text-slate-300'
                }`}
              >
                {speed.name}
              </button>
            ))}
          </div>
        </section>

        {/* Difficulty */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Difficulty</h2>
          <div className="space-y-1.5">
            {Object.values(DIFFICULTIES).map(d => (
              <button
                key={d.id}
                onClick={() => setDifficultyId(d.id)}
                className={`w-full p-2 rounded-lg text-left text-xs border transition-all ${
                  difficultyId === d.id
                    ? 'bg-amber-500/20 border-amber-500/50'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60'
                }`}
              >
                <div className="font-semibold text-white">{d.name}</div>
                <div className="text-slate-400 mt-0.5">{d.description}</div>
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={() => onStart({ playerNationId: selectedNationId, gameSpeed, difficultyId })}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-base
                     bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                     text-white shadow-lg transition-all active:scale-95"
        >
          <Play className="w-5 h-5" />
          Begin as {selectedNation?.name}
        </button>
      </div>
    </div>
  );
};

export default StartScreen;
