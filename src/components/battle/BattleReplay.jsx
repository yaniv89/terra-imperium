// src/components/battle/BattleReplay.jsx
// The auto-resolve "fight" (plan §6b): after an auto-resolved battle the result is already decided
// (same seed, same rules); this plays its REAL course back, round by round, from the report's
// strength timeline (src/engine/battle.js), then shows the result. No invented back-and-forth.
// Several battles at once (an end of turn with many assaults) play as a row of small bars
// together. Tap to skip; with reduced motion the result shows at once.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Swords, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { describeOutcome, formatMen, nationName, regionName, sidesFor, timelineFor } from './battleReportView';
import { MEN_PER_STRENGTH } from '../../engine/aftermath';

const OURS = '#3B82F6';
const THEIRS = '#F97316';
const TONE = { win: 'text-emerald-300', loss: 'text-red-300', draw: 'text-amber-300' };
// A round that costs a side this share of its starting strength flashes its bar; both: shake.
const HEAVY_ROUND = 0.08;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Progress 0..1 over `ms`, restartable, jumps to 1 on skip.
const useProgress = (ms, deps) => {
  const [p, setP] = useState(() => (prefersReducedMotion() ? 1 : 0));
  const skipRef = useRef(false);
  useEffect(() => {
    if (prefersReducedMotion()) { setP(1); return undefined; }
    skipRef.current = false;
    setP(0);
    let raf; const t0 = performance.now();
    const tick = (now) => {
      // rAF's timestamp is the frame's start, which can be a little before t0: clamp to 0..1.
      const next = skipRef.current ? 1 : Math.max(0, Math.min(1, (now - t0) / ms));
      setP(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [p, () => { skipRef.current = true; setP(1); }];
};

// The timeline point at progress p (linear between rounds), and the round index reached.
export const sample = (points, p) => {
  const x = Math.max(0, Math.min(1, p || 0)) * (points.length - 1);
  const i = Math.floor(x); const f = x - i;
  const a = points[i]; const b = points[Math.min(points.length - 1, i + 1)];
  return { round: i, mine: a.mine + (b.mine - a.mine) * f, theirs: a.theirs + (b.theirs - a.theirs) * f,
    mineAbs: a.mineAbs + (b.mineAbs - a.mineAbs) * f, theirsAbs: a.theirsAbs + (b.theirsAbs - a.theirsAbs) * f };
};

const Bar = ({ label, value, abs, color, hit, stamp }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[11px] text-slate-300">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatMen(abs * MEN_PER_STRENGTH)} men</span>
    </div>
    <div className="relative h-4 rounded bg-slate-800 overflow-visible">
      <div key={hit} className={`h-full rounded ${hit ? 'animate-hit-flash' : ''}`} style={{ width: `${Math.max(0, value) * 100}%`, background: color, transition: 'width 60ms linear' }} />
      {stamp && (
        <span className="absolute right-1 -top-1.5 px-1.5 rounded border-2 border-red-400 text-red-300 text-[11px] font-black uppercase tracking-wider bg-slate-900/80 animate-stamp-in">
          Routed!
        </span>
      )}
    </div>
  </div>
);

const SingleReplay = ({ entry, onOpen, onClose }) => {
  const { state } = useGame();
  const points = useMemo(() => timelineFor(entry), [entry]);
  const ms = Math.min(3200, Math.max(1600, (points.length - 1) * 450));
  const [p, skip] = useProgress(ms, [entry.id]);
  const now = sample(points, p);
  const done = p >= 1;
  const last = points[points.length - 1];
  // Which sides got hit hard in the round just reached, for the flash and the shake.
  const prev = points[Math.max(0, now.round - 1)]; const cur = points[now.round];
  const mineHit = now.round > 0 && prev.mine - cur.mine >= HEAVY_ROUND ? now.round : 0;
  const theirsHit = now.round > 0 && prev.theirs - cur.theirs >= HEAVY_ROUND ? now.round : 0;
  const { mine, theirs } = sidesFor(entry);
  const ourNation = nationName(state, entry[`${mine}NationId`]);
  const theirNation = nationName(state, entry[`${theirs}NationId`]);
  const result = describeOutcome(entry);
  const share = now.mineAbs / Math.max(1, now.mineAbs + now.theirsAbs);
  // The fighting rounds (the pursuit after a rout is a last point on the timeline, not a round).
  const rounds = entry.rounds ?? points.length - 1;

  return (
    <div onClick={done ? undefined : skip} data-testid="battle-replay"
      className={`w-[min(520px,92vw)] max-h-[92dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-slate-200 space-y-3
                  ${mineHit && theirsHit ? 'animate-battle-shake' : ''}`} key={mineHit && theirsHit ? `s${now.round}` : 'card'}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-white"><Swords className="w-4 h-4 text-orange-400 shrink-0" /> <span className="truncate">Battle of {regionName(entry.targetRegionId)}</span></div>
          <div className="text-[11px] text-slate-400 truncate">{ourNation} against {theirNation}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close battle" className="p-1 rounded hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
      </div>

      <Bar label={`Yours · ${ourNation}`} value={now.mine} abs={now.mineAbs} color={OURS} hit={mineHit} stamp={done && last.mineBroken} />
      <Bar label={`Theirs · ${theirNation}`} value={now.theirs} abs={now.theirsAbs} color={THEIRS} hit={theirsHit} stamp={done && last.theirsBroken} />

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Balance of strength</span>
          <span>{done ? `${rounds} round${rounds === 1 ? '' : 's'}` : `Round ${Math.min(rounds, now.round + 1)} of ${rounds}`}</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden flex bg-slate-800">
          <div style={{ width: `${share * 100}%`, background: OURS }} />
          <div className="w-0.5 bg-slate-900" />
          <div className="flex-1" style={{ background: THEIRS }} />
        </div>
      </div>

      {done ? (
        <div className="space-y-2 pt-1" data-testid="battle-replay-result">
          <div className={`text-base font-bold ${TONE[result.tone]}`}>{result.text}</div>
          <div className="text-xs text-slate-300">
            Fallen: <span className="font-semibold text-white">{formatMen(entry.fallen[mine])}</span> of yours ·{' '}
            <span className="font-semibold text-white">{formatMen(entry.fallen[theirs])}</span> of theirs
          </div>
          <div className="flex gap-2">
            <button onClick={() => onOpen(entry.id)} className="flex-1 min-h-[40px] rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Full report</button>
            <button onClick={onClose} className="flex-1 min-h-[40px] rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white">Continue</button>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-500 text-center">Tap to skip</div>
      )}
    </div>
  );
};

const MiniRow = ({ entry, p, onOpen }) => {
  const points = timelineFor(entry);
  const now = sample(points, p);
  const result = describeOutcome(entry);
  const { mine, theirs } = sidesFor(entry);
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-300">{regionName(entry.targetRegionId)}</span>
        {p >= 1 && <span className={`shrink-0 font-semibold ${TONE[result.tone]}`}>{result.tone === 'win' ? 'Won' : result.tone === 'loss' ? 'Lost' : 'Drawn'}</span>}
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${now.mine * 100}%`, background: OURS }} /></div>
        <div className="flex-1 rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${now.theirs * 100}%`, background: THEIRS }} /></div>
      </div>
      {p >= 1 && (
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Fallen {formatMen(entry.fallen[mine])} · {formatMen(entry.fallen[theirs])}</span>
          <button onClick={() => onOpen(entry.id)} className="text-blue-300 underline underline-offset-2">Report</button>
        </div>
      )}
    </div>
  );
};

const MultiReplay = ({ entries, onOpen, onClose }) => {
  const [p, skip] = useProgress(1500, [entries.map((e) => e.id).join()]);
  return (
    <div onClick={p >= 1 ? undefined : skip} data-testid="battle-replay"
      className="w-[min(520px,92vw)] max-h-[92dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-white"><Swords className="w-4 h-4 text-orange-400" /> {entries.length} battles this turn</div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: OURS }} />Yours</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: THEIRS }} />Theirs</span>
        </div>
      </div>
      {entries.map((e) => <MiniRow key={e.id} entry={e} p={p} onOpen={onOpen} />)}
      {p >= 1
        ? <button onClick={onClose} className="w-full min-h-[40px] rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white">Continue</button>
        : <div className="text-[10px] text-slate-500 text-center">Tap to skip</div>}
    </div>
  );
};

const BattleReplay = ({ entries, onOpen, onClose }) => {
  if (!entries?.length) return null;
  return (
    <div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-3">
      {entries.length === 1
        ? <SingleReplay entry={entries[0]} onOpen={onOpen} onClose={onClose} />
        : <MultiReplay entries={entries} onOpen={onOpen} onClose={onClose} />}
    </div>
  );
};

export default BattleReplay;
