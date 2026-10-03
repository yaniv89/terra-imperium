// src/components/battle/TacticalBattleScreen.jsx
// The commanded battle (Tactical Battles plan §2, §11): a full-screen three.js battlefield driven
// by the sim in a Web Worker, with a thumb-friendly HUD on top. Mobile first: tap to select / tap to
// order, drag a line for a formation, double-tap-drag to lasso, long-press for attack-move or the
// squad menu, pinch to zoom — plus a tactical pause that keeps accepting orders. It starts paused
// (deployment): give opening orders, then press Start.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deployZone } from '../../battle/sim/world';
import { BattleRenderer } from '../../battle/render/BattleRenderer';
import { createBattleClient } from '../../battle/worker/battleClient';
import { createGestureRecognizer } from '../../battle/input/gestures';
import { Q, TICK_HZ, battleLimitTicks } from '../../battle/sim/constants';
import BattleHud from './BattleHud';
import { BattleRotateGate } from '../ui/RotateOverlay';
import BattleResultScreen from './BattleResultScreen';
import { ABILITIES } from '../../battle/sim/effects';
import { createBattleAudio } from '../../battle/audio/battleAudio';
import { needsUnitModels, preloadUnitModels } from '../../battle/render/unitModels';

const ABILITY_LABELS = Object.fromEntries(Object.entries(ABILITIES).map(([id, a]) => [id, a.label]));

const HUD_INTERVAL_MS = 150;

const TacticalBattleView = ({ setup, playerSide = 0, title, resume = null, onCheckpoint, onFinish, onAbandon }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const clientRef = useRef(null);
  const audioRef = useRef(null);
  const [soundOn, setSoundOn] = useState(true);
  const frames = useRef({ prev: null, cur: null, arrival: 0 });
  const selectedRef = useRef(new Set());
  const armedRef = useRef(null); // 'attackMove' — the next ground order becomes an attack-move
  const formationRef = useRef('line');
  const speedRef = useRef(1);
  const [hud, setHud] = useState(null);
  const [selected, setSelected] = useState([]);
  const [paused, setPaused] = useState(true); // always open paused: deployment, or a resumed battle
  const [started, setStarted] = useState(!!resume);
  const startedRef = useRef(!!resume);
  const [speed, setSpeed] = useState(1);
  const [armed, setArmed] = useState(null);
  const [formation, setFormation] = useState('line');
  const [dragLine, setDragLine] = useState(null);
  const [lasso, setLasso] = useState(null);
  const [radial, setRadial] = useState(null);
  const [ended, setEnded] = useState(null);

  const updateSelection = useCallback((ids) => {
    selectedRef.current = new Set(ids);
    setSelected([...selectedRef.current]);
  }, []);

  const send = useCallback((orders) => {
    audioRef.current?.orderConfirmed();
    clientRef.current?.sendOrders(orders.map((o) => ({ side: playerSide, ...o })));
  }, [playerSide]);

  // --- mount: renderer + sim client + render loop ------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const renderer = new BattleRenderer(canvas, setup, { playerSide });
    rendererRef.current = renderer;
    if (!resume) renderer.setDeployZone(deployZone({ map: setup.map }, playerSide), playerSide); // the zone shows until Start (plan E7)
    if(window.__E2E_BATTLE_TEST__)window.__battleTest={diagnostics:()=>renderer.diagnostics(),tick:()=>frames.current.cur?.tick};
    if (import.meta.env.DEV) window.__battleRenderer = renderer; // for debugging in the console
    const audio = createBattleAudio({ ageIds: setup.sides.map((sd) => sd.ageId), playerSide });
    audioRef.current = audio;
    setSoundOn(audio.isEnabled());
    // Browsers only start audio from a user gesture: the first touch anywhere unlocks it.
    const unlock = () => audio.unlock();
    wrap.addEventListener('pointerdown', unlock, { once: true });
    const resize = () => renderer.resize(wrap.clientWidth, wrap.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const client = createBattleClient({
      setup, resume, paused: true,
      onMessage: (m) => {
        if (m.type === 'frame') {
          const f = frames.current;
          if (!f.cur || m.view.tick !== f.cur.tick) { f.prev = f.cur; f.cur = m.view; f.arrival = performance.now(); } else f.cur = m.view;
          // First frame: look straight at your own army.
          if (!f.centered) {
            const own = m.view.squads.filter((q) => q.side === playerSide && q.alive && q.onField);
            if (own.length) renderer.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / Q, own.reduce((a, q) => a + q.y, 0) / own.length / Q);
            f.centered = true;
          }
          if (m.events?.length) {
            renderer.pushEvents(m.events, m.view);
            audio.events(m.events, m.view, (x, y) => renderer.screenPan(x, y));
          }
        } else if (m.type === 'checkpoint') onCheckpoint?.(m);
        else if (m.type === 'ended') setEnded(m);
      }
    });
    clientRef.current = client;
    if (import.meta.env.DEV) window.__battleOrders = (orders) => client.sendOrders(orders); // console / visual-test driving

    let raf; let lastT = performance.now(); let lastHud = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
      const f = frames.current;
      const alpha = f.prev ? Math.min(1, ((t - f.arrival) * speedRef.current) / (1000 / TICK_HZ)) : 1;
      renderer.render(f.prev, f.cur, alpha, { selected: selectedRef.current }, dt);
      if (t - lastHud > HUD_INTERVAL_MS && f.cur) { lastHud = t; setHud(f.cur); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Backgrounding the app (phone call, app switch) pauses the battle immediately.
    const onVis = () => { if (document.hidden) { client.pause(); setPaused(true); } };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      client.destroy();
      renderer.dispose();
      if(window.__E2E_BATTLE_TEST__)delete window.__battleTest;
      wrap.removeEventListener('pointerdown', unlock);
      audio.dispose();
      audioRef.current = null;
      rendererRef.current = null; clientRef.current = null;
    };
    // setup/resume are fixed for the life of a battle screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- input --------------------------------------------------------------------------------
  const ownSquadAt = useCallback((p) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    if (!r || !cur) return null;
    const hit = r.pick(p.x, p.y, cur, 1.1, { enemyFirst: selectedRef.current.size > 0 });
    return hit?.kind === 'squad' && hit.side === playerSide ? hit.idx : null;
  }, [playerSide]);

  const issueAt = useCallback((p, forceAttackMove = false) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    const sel = [...selectedRef.current];
    // A targeted commander power is armed: this tap is where it lands (no selection needed).
    if (r && cur && armedRef.current?.type === 'power') {
      const g = r.screenToGround(p.x, p.y);
      if (g) {
        send([{ type: 'power', power: armedRef.current.id, x: Math.round(g.x * Q), y: Math.round(g.z * Q) }]);
        r.addMarker(g.x, g.z, '#f97316');
      }
      armedRef.current = null; setArmed(null);
      return true;
    }
    if (!r || !cur || !sel.length) return false;
    const hit = r.pick(p.x, p.y, cur, 1.1, { enemyFirst: true });
    if (!hit) return false;
    if (hit.kind === 'squad' && hit.side !== playerSide) {
      send([{ type: 'attack', squads: sel, target: { kind: 'squad', index: hit.idx } }]);
      r.addMarker(hit.ground.x, hit.ground.z, '#f87171');
    } else if (hit.kind === 'structure' && playerSide === 1) {
      // Defending: tap your keep or a tower to man it (infantry and ranged; fortified buildings only).
      const eligible = sel.filter((i) => ['infantry', 'ranged'].includes(cur.squads[i]?.classId));
      if (eligible.length) {
        send([{ type: 'garrison', squads: eligible, structure: hit.index }]);
        r.addMarker(hit.ground.x, hit.ground.z, '#60a5fa');
      }
    } else if (hit.kind === 'structure' && playerSide === 0) {
      send([{ type: 'attack', squads: sel, target: { kind: 'structure', index: hit.index } }]);
      r.addMarker(hit.ground.x, hit.ground.z, '#f87171');
    } else {
      const type = !startedRef.current ? 'deploy' : forceAttackMove || armedRef.current === 'attackMove' ? 'attackMove' : 'move'; // before Start the ground order places the squads (plan D5)
      send([{ type, squads: sel, x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.addMarker(hit.ground.x, hit.ground.z, type === 'attackMove' ? '#fb923c' : '#a3e635');
    }
    armedRef.current = null; setArmed(null);
    return true;
  }, [playerSide, send]);

  useEffect(() => {
    const el = canvasRef.current;
    return createGestureRecognizer(el, {
      isOnSelectedSquad: (p) => { const idx = ownSquadAt(p); return idx !== null && selectedRef.current.has(idx); },
      tap: (p) => {
        setRadial(null);
        const own = ownSquadAt(p);
        if (own !== null && !armedRef.current) { updateSelection([own]); return; }
        if (armedRef.current?.type === 'power') { issueAt(p); return; }
        if (!issueAt(p)) updateSelection([]);
      },
      order: (p) => { setRadial(null); issueAt(p); },
      longPress: (p) => { if (selectedRef.current.size) issueAt(p, true); },
      radial: (p) => setRadial({ x: p.x, y: p.y }),
      pan: (dx, dy) => rendererRef.current?.pan(dx, dy),
      zoom: (factor, x, y) => rendererRef.current?.zoomBy(factor, x, y),
      formationDrag: (s, p) => setDragLine({ x0: s.x, y0: s.y, x1: p.x, y1: p.y }),
      formationEnd: (s, p) => {
        setDragLine(null);
        const r = rendererRef.current;
        const a = r?.screenToGround(s.x, s.y); const b = r?.screenToGround(p.x, p.y);
        if (!a || !b || !selectedRef.current.size) return;
        send([{ type: 'formationLine', squads: [...selectedRef.current], x: Math.round(a.x * Q), y: Math.round(a.z * Q), x2: Math.round(b.x * Q), y2: Math.round(b.z * Q) }]);
        r.addMarker(a.x, a.z); r.addMarker(b.x, b.z);
      },
      lassoDrag: (s, p) => setLasso({ x0: Math.min(s.x, p.x), y0: Math.min(s.y, p.y), x1: Math.max(s.x, p.x), y1: Math.max(s.y, p.y) }),
      lassoEnd: (s, p) => {
        setLasso(null);
        const r = rendererRef.current; const cur = frames.current.cur;
        if (!r || !cur) return;
        const x0 = Math.min(s.x, p.x); const x1 = Math.max(s.x, p.x); const y0 = Math.min(s.y, p.y); const y1 = Math.max(s.y, p.y);
        const ids = cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled).filter((q) => {
          const sp = r.worldToScreen(q.x / Q, q.y / Q);
          return sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1;
        }).map((q) => q.idx);
        updateSelection(ids);
      },
      cancel: () => { setDragLine(null); setLasso(null); }
    });
  }, [issueAt, ownSquadAt, playerSide, send, updateSelection]);

  // Keyboard (desktop): space pause, A attack-move, S stop, H hold, R retreat, Esc deselect.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      const sel = [...selectedRef.current];
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (e.key === 'a') { armedRef.current = 'attackMove'; setArmed('attackMove'); }
      else if (e.key === 's' && sel.length) send([{ type: 'stop', squads: sel }]);
      else if (e.key === 'h' && sel.length) send([{ type: 'hold', squads: sel }]);
      else if (e.key === 'r' && sel.length) send([{ type: 'retreat', squads: sel }]);
      else if (e.key === 'Escape') updateSelection([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- HUD actions -----------------------------------------------------------------------------
  const togglePause = () => {
    const c = clientRef.current; if (!c) return;
    if (!started) { startedRef.current = true; setStarted(true); setPaused(false); rendererRef.current?.setDeployZone(null); c.resume(); return; } // deployment → battle
    setPaused((p) => { if (p) c.resume(); else c.pause(); return !p; });
  };
  const toggleSound = () => { const on = !soundOn; audioRef.current?.setEnabled(on); setSoundOn(on); };
  const changeSpeed = (s) => { speedRef.current = s; setSpeed(s); clientRef.current?.setSpeed(s); };
  const arm = (mode) => { armedRef.current = armedRef.current === mode ? null : mode; setArmed(armedRef.current); };
  // Commander powers: instant ones fire now; targeted ones arm a crosshair for the next tap.
  const firePower = (power) => {
    if (!power.targeted) { send([{ type: 'power', power: power.id, x: 0, y: 0 }]); return; }
    const same = armedRef.current?.type === 'power' && armedRef.current.id === power.id;
    armedRef.current = same ? null : { type: 'power', id: power.id, label: power.label };
    setArmed(armedRef.current);
  };
  const triggerSquadAbility = (abilityId) => {
    const cur = frames.current.cur; if (!cur) return;
    const squads = [...selectedRef.current].filter((i) => cur.squads[i]?.abilities?.some((a) => a.id === abilityId && a.readyIn === 0));
    if (squads.length) send([{ type: 'ability', squads, ability: abilityId }]);
    setRadial(null);
  };
  const cycleFormation = () => { const next = formationRef.current === 'line' ? 'column' : 'line'; formationRef.current = next; setFormation(next); };
  // Selecting by class also brings those squads into view — on a phone, finding your army after
  // panning away should never take more than one tap.
  const selectClass = (classId) => {
    const cur = frames.current.cur; if (!cur) return;
    const picked = cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled && !q.routed && (classId === 'all' || q.classId === classId));
    updateSelection(picked.map((q) => q.idx));
    if (picked.length) rendererRef.current?.centerOn(picked.reduce((s, q) => s + q.x, 0) / picked.length / Q, picked.reduce((s, q) => s + q.y, 0) / picked.length / Q);
  };
  const callReserve = (idx) => send([{ type: 'callReserve', squads: [idx] }]);
  const commandSelected = (type) => { const sel = [...selectedRef.current]; if (sel.length) send([{ type, squads: sel }]); setRadial(null); };
  const retreatAll = () => send([{ type: 'retreatAll' }]);
  const focusKeep = () => { const k = setup.structures[0]; rendererRef.current?.centerOn(k.x / Q, k.y / Q); };

  const timeLeft = hud ? Math.max(0, Math.ceil((battleLimitTicks(setup) - hud.tick) / TICK_HZ)) : 0;
  const selectedSquads = useMemo(() => (hud ? selected.map((i) => hud.squads[i]).filter((q) => q && q.alive) : []), [hud, selected]);
  // Abilities the selection can use (a general's, or legendary archers' Volley), best cooldown first.
  const selectedAbilities = useMemo(() => {
    const byId = new Map();
    selectedSquads.forEach((q) => (q.abilities || []).forEach((a) => { const cur = byId.get(a.id); if (!cur || a.readyIn < cur.readyIn) byId.set(a.id, a); }));
    return [...byId.values()];
  }, [selectedSquads]);

  return (
    <div ref={wrapRef} className="fixed inset-0 z-[80] bg-slate-950 select-none" style={{ touchAction: 'none' }} data-testid="tactical-battle">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
      {dragLine && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <line x1={dragLine.x0} y1={dragLine.y0} x2={dragLine.x1} y2={dragLine.y1} stroke="#a3e635" strokeWidth="4" strokeDasharray="10 6" strokeLinecap="round" />
        </svg>
      )}
      {lasso && <div className="absolute pointer-events-none border-2 border-lime-400 bg-lime-400/10 rounded" style={{ left: lasso.x0, top: lasso.y0, width: lasso.x1 - lasso.x0, height: lasso.y1 - lasso.y0 }} />}
      {radial && (
        <div className="absolute z-10 flex flex-wrap justify-center gap-2 max-w-[92vw] -translate-x-1/2 -translate-y-[130%]" style={{ left: Math.min(Math.max(radial.x, 160), (wrapRef.current?.clientWidth || 400) - 160), top: radial.y }} data-testid="battle-radial">
          {selectedAbilities.map((a) => (
            <button key={a.id} onClick={() => triggerSquadAbility(a.id)} disabled={a.readyIn > 0}
              className="min-w-[64px] h-12 px-3 rounded-full bg-purple-900/95 border border-purple-400 text-purple-100 text-xs font-semibold shadow-xl disabled:opacity-40">
              {ABILITY_LABELS[a.id] || a.id}{a.readyIn > 0 ? ` ${Math.ceil(a.readyIn / TICK_HZ)}s` : ''}
            </button>
          ))}
          {[['hold', 'Hold'], ['stop', 'Stop'], ['retreat', 'Retreat']].map(([t, label]) => (
            <button key={t} onClick={() => commandSelected(t)} className="min-w-[64px] h-12 px-3 rounded-full bg-slate-900/95 border border-slate-600 text-slate-100 text-sm font-semibold shadow-xl">{label}</button>
          ))}
        </div>
      )}
      <BattleHud
        title={title} hud={hud} setup={setup} playerSide={playerSide} timeLeft={timeLeft}
        paused={paused} started={started} speed={speed} armed={armed} formation={formation}
        selectedSquads={selectedSquads}
        onTogglePause={togglePause} onSpeed={changeSpeed} onArm={arm} onFormation={cycleFormation}
        onSelectClass={selectClass} onCallReserve={callReserve} onCommand={commandSelected}
        onRetreatAll={retreatAll} onFocusKeep={focusKeep} onAbandon={onAbandon}
        onPower={firePower} onOpenAbilities={() => { const w0 = wrapRef.current; setRadial({ x: (w0?.clientWidth || 400) / 2, y: (w0?.clientHeight || 800) - 150 }); }}
        hasAbilities={selectedAbilities.length > 0}
        soundOn={soundOn} onToggleSound={toggleSound}
      />
      {ended && <BattleResultScreen ended={ended} setup={setup} playerSide={playerSide} onContinue={() => onFinish?.(ended)} />}
    </div>
  );
};

// Artist unit models (src/assets/units/*.glb) are fetched and baked before the battlefield mounts,
// so the renderer builds its instanced layers from the final geometry. With no model files (the
// default) there is nothing to wait for and the battle opens immediately.
const TacticalBattleScreen = (props) => {
  const [ready, setReady] = useState(() => !needsUnitModels(props.setup));
  useEffect(() => {
    if (ready) return undefined;
    let live = true;
    preloadUnitModels(props.setup).then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [ready, props.setup]);
  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center text-slate-300 text-sm" data-testid="battle-loading">
        Mustering the troops…
      </div>
    );
  }
  return <><TacticalBattleView {...props} /><BattleRotateGate /></>;
};

export default TacticalBattleScreen;
