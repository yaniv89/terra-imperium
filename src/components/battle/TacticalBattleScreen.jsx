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
import { decidePointer, isCycleClick, pickOwnBuilding, selectionAfter, BUILDING_PICK_TILES, BUILDING_PICK_PX } from '../../battle/input/selection';
import { Q, TICK_HZ, battleLimitTicks } from '../../battle/sim/constants';
import BattleHud from './BattleHud';
import { BattleRotateGate } from '../ui/RotateOverlay';
import BattleResultScreen from './BattleResultScreen';
import BattleFailure from './BattleFailure';
import { ABILITIES } from '../../battle/sim/effects';
import { createBattleAudio } from '../../battle/audio/battleAudio';
import { useAudioSettings, setAudioSettings } from '../../audio/audioSettings';
import { startBattleMusic } from '../../audio/music';
import { playVoice } from '../../audio/sfx';
import { voiceForOrders, voiceForSelection } from '../../battle/audio/voiceLines';
import { needsUnitModels, preloadUnitModels } from '../../battle/render/unitModels';
import { createPerfMeter, formatPerf } from '../../battle/render/perfMeter';
import { getMapPrefs } from '../map/mapPrefs';
import { Check, X as XIcon, Ban } from 'lucide-react';
import { BuildMenu, BuildingActions, InfoCard } from './EconomyHud';
import { inspectInfo } from './inspectModel';
import { contextFor } from './battleHudModel';
import { updateSiteLabels } from './siteLabels';
import { BUILDINGS, ecoName } from '../../battle/data/economy';
import { placementCheck, footprintAt } from '../../battle/input/placement';
import { commandedSetup } from '../../battle/setup/buildBattleSetup';

const ABILITY_LABELS = Object.fromEntries(Object.entries(ABILITIES).map(([id, a]) => [id, a.label]));

const HUD_INTERVAL_MS = 150;
// The sim answers within a second or two; a resumed battle replays its log first (well under a
// second for 6 minutes on a laptop, a few on a slow phone). Past this, the battle failed to start.
export const FIRST_FRAME_TIMEOUT_MS = 25000;
// A frame that throws is skipped; this many in a row means the battlefield cannot be drawn.
const RENDER_ERRORS_TO_FAIL = 3;
// `&perf` in the page URL, or the Performance overlay setting (W12, mapPrefs.js), shows the
// performance readout (works in a production build too). Read when the battle opens.
const PERF_URL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');
const perfOn = () => PERF_URL || !!getMapPrefs().perf;

// One-time UI hints live in localStorage (per device, never in the save). Storage can be missing or
// blocked (private mode): then the hint simply shows again next time.
const SELECT_HINT_KEY = 'ti.hint.battleControls'; // was ti.hint.boxSelect: the controls changed, show it once more
const SELECT_HINT_MS = 9000;
const hintSeen = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const markHintSeen = (key) => { try { localStorage.setItem(key, '1'); } catch { /* storage blocked */ } };
// A mouse is the main pointer (desktop): the hints speak of clicks instead of taps.
const MOUSE_POINTER = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

const TacticalBattleView = ({ setup, playerSide = 0, title, resume = null, onCheckpoint, onFinish, onAbandon, onRetry = null, getCampaign = null }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const clientRef = useRef(null);
  const audioRef = useRef(null);
  const soundOn = useAudioSettings().sound; // the one Sound switch (also in Settings)
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
  const [failure, setFailure] = useState(null); // { message, detail }: BattleFailure
  // The battle economy (EconomyHud.jsx): the selected building, the build menu.
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const selectedBuildingRef = useRef(null);
  const [buildMenu, setBuildMenu] = useState(false);
  // Anything else tapped on the field (UI-DESIGN B09): { kind: 'eco' | 'structure' | 'node', index }
  // for the info card; never together with selected squads or your own selected building.
  const [inspect, setInspect] = useState(null);
  // The placement ghost (B10): { building, size, tx, ty, ok, reason }, green or red with the reason.
  const [ghost, setGhost] = useState(null);
  const ghostRef = useRef(null);
  const siteLabelsRef = useRef(null); // "Building 43%" over your sites (siteLabels.js)
  const ghostLabelRef = useRef(null); // the reason over a red ghost
  const perfRef = useRef(null);
  const [showPerf] = useState(perfOn);
  // Touch box select (UI-DESIGN B04): while on, a one-finger drag draws the selection box.
  const [selectMode, setSelectMode] = useState(false);
  const selectModeRef = useRef(false);
  const setSelectModeOn = useCallback((on) => { selectModeRef.current = on; setSelectMode(on); }, []);
  // A one-time hint in the player's first commanded battle (a UI hint, never game state).
  const [selectHint, setSelectHint] = useState(() => !hintSeen(SELECT_HINT_KEY));

  // The hint is remembered as soon as it shows (the HUD is up), and fades on its own.
  const hudUp = !!hud;
  useEffect(() => {
    if (!selectHint || !hudUp) return undefined;
    markHintSeen(SELECT_HINT_KEY);
    const t = setTimeout(() => setSelectHint(false), SELECT_HINT_MS);
    return () => clearTimeout(t);
  }, [selectHint, hudUp]);

  const updateSelection = useCallback((ids) => {
    // A unit answers a new selection now and then (src/audio/sfx.js rate-limits the barks).
    const bark = voiceForSelection(ids, [...selectedRef.current], frames.current.cur?.squads);
    if (bark) playVoice(bark.classId, bark.kind);
    selectedRef.current = new Set(ids);
    setSelected([...selectedRef.current]);
    if (ids.length) { selectedBuildingRef.current = null; setSelectedBuilding(null); setInspect(null); }
  }, []);
  const selectBuilding = useCallback((idx) => {
    selectedBuildingRef.current = idx;
    setSelectedBuilding(idx);
    setInspect(null);
    if (idx !== null) { selectedRef.current = new Set(); setSelected([]); }
  }, []);
  const inspectThing = useCallback((target) => {
    selectedBuildingRef.current = null; setSelectedBuilding(null);
    selectedRef.current = new Set(); setSelected([]);
    setInspect(target);
  }, []);
  // The selected or inspected building shows its health bar and a ring on the field (renderer).
  useEffect(() => {
    const r = rendererRef.current; if (!r) return;
    const own = selectedBuilding !== null ? frames.current.cur?.eco?.buildings.find((b) => b.idx === selectedBuilding) : null;
    const eco = inspect?.kind === 'eco' ? frames.current.cur?.eco?.buildings.find((b) => b.idx === inspect.index) : null;
    if (own) r.setInspected(own.proxy ? { kind: 'structure', index: 0 } : { kind: 'eco', index: own.idx });
    else if (eco?.proxy) r.setInspected({ kind: 'structure', index: 0 });
    else r.setInspected(inspect);
  }, [selectedBuilding, inspect]);

  const send = useCallback((orders) => {
    audioRef.current?.orderConfirmed(orders);
    const bark = voiceForOrders(orders, frames.current.cur?.squads);
    if (bark) playVoice(bark.classId, bark.kind);
    clientRef.current?.sendOrders(orders.map((o) => ({ side: playerSide, ...o })));
  }, [playerSide]);

  // --- mount: renderer + sim client + render loop ------------------------------------------
  // Anything that goes wrong here (no WebGL, the sim failing to start or crashing, the drawing
  // throwing every frame) ends in `failure`: a readable message with the way back to the map
  // (BattleFailure below), never a frozen field without troops or buttons.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    let renderer;
    try {
      renderer = new BattleRenderer(canvas, setup, { playerSide });
    } catch (err) {
      console.error('[battle] the battlefield could not be drawn', err);
      setFailure({ message: 'This device could not draw the battlefield.', detail: err?.message || String(err) });
      return undefined;
    }
    rendererRef.current = renderer;
    if (!resume) renderer.setDeployZone(deployZone({ map: setup.map }, playerSide), playerSide); // the zone shows until Start (plan E7)
    if(window.__E2E_BATTLE_TEST__)window.__battleTest={diagnostics:()=>renderer.diagnostics(),tick:()=>frames.current.cur?.tick};
    // For debugging in the console, and for scripts/battle-phone-bench.mjs (which moves the camera) in a perf run.
    if (import.meta.env.DEV || PERF_URL) { window.__battleRenderer = renderer; window.__battleView = () => frames.current.cur; }
    const audio = createBattleAudio({ ageIds: setup.sides.map((sd) => sd.ageId), playerSide });
    audioRef.current = audio;
    if (import.meta.env.DEV) window.__battleAudio = audio; // voiceStats() in the console
    const releaseMusic = startBattleMusic(); // the battle playlist instead of the map's (src/audio/music.js)
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
          if (m.sim) f.sim = m.sim;
          if (!f.cur || m.view.tick !== f.cur.tick) { f.prev = f.cur; f.cur = m.view; f.arrival = performance.now(); } else f.cur = m.view;
          // First frame: look straight at your own army.
          if (!f.centered) {
            const own = m.view.squads.filter((q) => q.side === playerSide && q.alive && q.onField);
            if (own.length) renderer.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / Q, own.reduce((a, q) => a + q.y, 0) / own.length / Q);
            f.centered = true;
          }
          try {
            if (m.events?.length) renderer.pushEvents(m.events, m.view);
            // Sound only where the camera looks (every frame: the ambience follows the fighting on screen).
            audio.setView(renderer.audioView());
            audio.events(m.events, m.view);
          } catch (err) { if (!f.fxWarned) { f.fxWarned = true; console.error('[battle] effects or sound failed', err); } }
        } else if (m.type === 'checkpoint') onCheckpoint?.(m);
        else if (m.type === 'ended') setEnded(m);
        else if (m.type === 'resumeRejected') {
          // The saved checkpoint was not this battle's: it starts fresh, at deployment.
          startedRef.current = false; setStarted(false); setPaused(true);
          renderer.setDeployZone(deployZone({ map: setup.map }, playerSide), playerSide);
        } else if (m.type === 'error') {
          console.error(`[battle] the battle stopped (${m.stage || 'sim'}): ${m.message}`, m.stack || '');
          setFailure({ message: frames.current.cur ? 'The battle stopped unexpectedly.' : 'The battle could not start.', detail: m.message });
        }
      }
    });
    clientRef.current = client;
    if (import.meta.env.DEV) window.__battleOrders = (orders) => client.sendOrders(orders); // console / visual-test driving

    let raf; let lastT = performance.now(); let lastHud = 0; let lastPerf = 0;
    let renderErrors = 0;
    const openedAt = performance.now();
    // `&perf` in the URL: an on-screen readout (perfMeter.js), also left in window.__battlePerf.
    const meter = perfOn() ? createPerfMeter() : null;
    const loop = (t) => {
      raf = requestAnimationFrame(loop); // first: one bad frame never stops the loop
      const rawMs = t - lastT;
      const dt = Math.min(0.1, rawMs / 1000); lastT = t;
      const f = frames.current;
      // No first frame from the sim in time: say so rather than show an empty field forever.
      if (!f.cur && t - openedAt > FIRST_FRAME_TIMEOUT_MS && !f.timedOut) {
        f.timedOut = true;
        console.error('[battle] no frame from the battle sim');
        setFailure({ message: 'The battle could not start.', detail: `No answer from the battle after ${Math.round(FIRST_FRAME_TIMEOUT_MS / 1000)} seconds.` });
      }
      const alpha = f.prev ? Math.min(1, ((t - f.arrival) * speedRef.current) / (1000 / TICK_HZ)) : 1;
      const r0 = meter ? performance.now() : 0;
      try {
        renderer.render(f.prev, f.cur, alpha, { selected: selectedRef.current }, dt);
        renderErrors = 0;
      } catch (err) {
        renderErrors += 1;
        if (renderErrors === 1) console.error('[battle] drawing the battlefield failed', err);
        if (renderErrors === RENDER_ERRORS_TO_FAIL) setFailure({ message: 'The battlefield could not be drawn.', detail: err?.message || String(err) });
      }
      if (meter) {
        meter.push(rawMs, performance.now() - r0);
        if (t - lastPerf > 250) {
          lastPerf = t;
          const stats = { meter: meter.summary(), diag: renderer.diagnostics(), sim: f.sim || null, squads: f.cur ? f.cur.squads.filter((q) => q.alive && q.onField).length : 0 };
          window.__battlePerf = stats;
          if (perfRef.current) perfRef.current.textContent = formatPerf(stats);
        }
      }
      if (f.cur) {
        try {
          updateSiteLabels(siteLabelsRef.current, renderer, f.cur, playerSide);
          const gl = ghostLabelRef.current; const gh = ghostRef.current;
          if (gl) {
            if (gh && !gh.ok) {
              const sp = renderer.worldToScreen(gh.tx + gh.size / 2, gh.ty + gh.size / 2, 1.2);
              gl.textContent = gh.reason; gl.style.display = 'block';
              gl.style.transform = `translate(${Math.round(sp.x)}px, ${Math.round(sp.y)}px) translate(-50%, -100%)`;
            } else gl.style.display = 'none';
          }
        } catch { /* labels are a nicety */ }
      }
      if (t - lastHud > HUD_INTERVAL_MS && f.cur) { lastHud = t; setHud(f.cur); }
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
      releaseMusic();
      audioRef.current = null;
      rendererRef.current = null; clientRef.current = null;
    };
    // setup/resume are fixed for the life of a battle screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The result screen covers the battlefield: its sounds stop (the victory or defeat sting has played).
  useEffect(() => { audioRef.current?.setVisible(!ended); }, [ended]);

  // --- input --------------------------------------------------------------------------------
  // `enemyFirst` (a tap with troops selected): a visible enemy beside your squad wins, so a tap
  // meant as "attack that" never turns into "select this". A mouse left click only ever selects.
  const ownSquadAt = useCallback((p, enemyFirst = selectedRef.current.size > 0) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    if (!r || !cur) return null;
    const hit = r.pick(p.x, p.y, cur, 1.1, { enemyFirst });
    return hit?.kind === 'squad' && hit.side === playerSide ? hit.idx : null;
  }, [playerSide]);
  // Your own building under a screen point, with a generous margin (selection.js).
  const ownBuildingAt = useCallback((p) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    if (!r || !cur?.eco) return null;
    const g = r.screenToGround(p.x, p.y);
    if (!g) return null;
    const margin = Math.max(BUILDING_PICK_TILES, BUILDING_PICK_PX * r.worldPerPixel());
    const k = cur.structures[0];
    const keepHit = !!k?.alive && (k.x / Q - g.x) ** 2 + (k.y / Q - g.z) ** 2 <= (k.radius / Q + 0.6 + margin) ** 2;
    return pickOwnBuilding(g, cur, playerSide, { margin, keepHit });
  }, [playerSide]);
  const lastPickRef = useRef(null); // the last select click/tap, for cycling units -> building
  // Any building, structure (ruins too) or resource node under a screen point, for the info card.
  const inspectAt = useCallback((p) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    if (!r || !cur) return null;
    const g = r.screenToGround(p.x, p.y);
    if (!g) return null;
    const margin = Math.max(0.5, 16 * r.worldPerPixel());
    const eco = r.ecoLayer.pick(g, cur, margin);
    if (eco?.kind === 'eco') return { kind: 'eco', index: eco.index };
    let best = null; let bestD = Infinity;
    cur.structures.forEach((s, index) => {
      const rr = s.radius / Q + 0.6 + margin * 0.5;
      const d = ((s.x / Q - g.x) ** 2 + (s.y / Q - g.z) ** 2) / (rr * rr);
      if (d <= 1 && d < bestD) { bestD = d; best = { kind: 'structure', index }; }
    });
    if (best) return best;
    return eco?.kind === 'node' ? { kind: 'node', index: eco.index } : null;
  }, []);

  // The placement ghost (B10): where the building would stand under a screen point, and whether it can.
  const setGhostAt = useCallback((p) => {
    const a = armedRef.current; const r = rendererRef.current; const cur = frames.current.cur;
    if (!r || !cur || a?.type !== 'place') return null;
    const g = r.screenToGround(p.x, p.y);
    if (!g) return ghostRef.current;
    const { size, tx, ty } = footprintAt(a.building, g.x, g.z);
    const prev = ghostRef.current;
    if (prev && prev.tx === tx && prev.ty === ty && prev.building === a.building && prev.tick === cur.tick) return prev;
    const v = placementCheck({ view: cur, setup, side: playerSide, type: a.building, tx, ty, fog: r.lastFog || cur.fog || null });
    const next = { building: a.building, size, tx, ty, ok: v.ok, reason: v.reason, tick: cur.tick };
    ghostRef.current = next;
    r.ecoLayer.setGhost({ size, tx, ty, ok: v.ok });
    if (!prev || prev.ok !== next.ok || prev.reason !== next.reason || prev.building !== next.building) setGhost(next);
    return next;
  }, [setup, playerSide]);
  const disarm = useCallback(() => {
    rendererRef.current?.ecoLayer.setGhost(null);
    ghostRef.current = null; setGhost(null);
    armedRef.current = null; setArmed(null);
  }, []);
  // Build at the ghost when it is green: the selected laborers go, else idle ones, else the nearest.
  const placeGhost = useCallback(() => {
    const r = rendererRef.current; const cur = frames.current.cur; const gh = ghostRef.current;
    if (!r || !cur || !gh) return false;
    // Recheck now (things move); a red spot keeps the building in hand and says why.
    const v = placementCheck({ view: cur, setup, side: playerSide, type: gh.building, tx: gh.tx, ty: gh.ty, fog: r.lastFog || cur.fog || null });
    if (!v.ok) { const bad = { ...gh, ok: false, reason: v.reason }; ghostRef.current = bad; setGhost(bad); r.ecoLayer.setGhost({ size: gh.size, tx: gh.tx, ty: gh.ty, ok: false }); return false; }
    const cx = gh.tx + gh.size / 2; const cz = gh.ty + gh.size / 2;
    let workers = [...selectedRef.current].filter((i) => cur.squads[i]?.classId === 'worker');
    if (!workers.length) workers = (cur.eco?.idleWorkers || []).slice(0, 2);
    if (!workers.length) workers = cur.squads.filter((q) => q.side === playerSide && q.classId === 'worker' && q.alive && q.onField).sort((x, y) => ((x.x / Q - cx) ** 2 + (x.y / Q - cz) ** 2) - ((y.x / Q - cx) ** 2 + (y.y / Q - cz) ** 2)).slice(0, 2).map((q) => q.idx);
    send([{ type: 'build', squads: workers, building: gh.building, tx: gh.tx, ty: gh.ty }]);
    r.addMarker(cx, cz, '#a3e635');
    disarm();
    return true;
  }, [setup, playerSide, send, disarm]);

  const issueAt = useCallback((p, forceAttackMove = false) => {
    const r = rendererRef.current; const cur = frames.current.cur;
    const sel = [...selectedRef.current];
    // The battle economy: a building to place, or a building's rally point.
    if (r && cur && (armedRef.current?.type === 'place' || armedRef.current?.type === 'rally')) {
      const g = r.screenToGround(p.x, p.y);
      const a = armedRef.current;
      if (a.type === 'place') {
        // A click (or a tap) on the ground: build there when the spot is good; a red spot keeps the
        // building in hand and its reason shows (B10).
        if (g) { setGhostAt(p); placeGhost(); }
        return true;
      }
      if (g && a.type === 'rally') {
        send([{ type: 'rally', building: a.building, x: Math.round(g.x * Q), y: Math.round(g.z * Q) }]);
        r.addMarker(g.x, g.z, '#facc15');
      }
      r.ecoLayer.setGhost(null);
      armedRef.current = null; setArmed(null);
      return true;
    }
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
    const workers = sel.filter((i) => cur.squads[i]?.classId === 'worker');
    const onlyWorkers = workers.length === sel.length;
    if (hit.kind === 'node') {
      // Workers to a resource: gather it (the others just go there).
      if (workers.length) send([{ type: 'gather', squads: workers, node: hit.index }]);
      if (!onlyWorkers) send([{ type: 'move', squads: sel.filter((i) => !workers.includes(i)), x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel.filter((i) => !workers.includes(i)), null);
      if (workers.length) r.setOrderTarget(workers, { kind: 'node', index: hit.index }, 'gather'); // the target ring (orderTarget.js)
      if (!onlyWorkers) r.addMarker(hit.ground.x, hit.ground.z, '#fde047');
    } else if (hit.kind === 'eco' && hit.side === playerSide) {
      // Workers to one of your buildings: help build it, or repair it; the others walk there.
      if (workers.length) send([{ type: 'assist', squads: workers, target: { kind: 'eco', index: hit.index } }]);
      if (!onlyWorkers) send([{ type: startedRef.current ? 'move' : 'deploy', squads: sel.filter((i) => !workers.includes(i)), x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel.filter((i) => !workers.includes(i)), null);
      if (workers.length) r.setOrderTarget(workers, { kind: 'eco', index: hit.index }, 'assist');
      if (!onlyWorkers) r.addMarker(hit.ground.x, hit.ground.z, '#a3e635');
    } else if (hit.kind === 'eco') {
      send([{ type: 'attack', squads: sel, target: { kind: 'eco', index: hit.index } }]);
      r.setOrderTarget(sel, { kind: 'eco', index: hit.index }, 'attack');
    } else if (hit.kind === 'structure' && playerSide === 1 && onlyWorkers) {
      send([{ type: 'repair', squads: workers, target: { kind: 'structure', index: hit.index } }]); // mend your city
      r.setOrderTarget(workers, { kind: 'structure', index: hit.index }, 'repair');
    } else if (hit.kind === 'squad' && hit.side !== playerSide) {
      send([{ type: 'attack', squads: sel, target: { kind: 'squad', index: hit.idx } }]);
      r.setOrderTarget(sel, { kind: 'squad', index: hit.idx }, 'attack');
    } else if (hit.kind === 'structure' && playerSide === 1) {
      // Defending: tap your keep or a tower to man it (infantry and ranged; fortified buildings only).
      const eligible = sel.filter((i) => ['infantry', 'ranged'].includes(cur.squads[i]?.classId));
      if (eligible.length) {
        send([{ type: 'garrison', squads: eligible, structure: hit.index }]);
        r.setOrderTarget(eligible, { kind: 'structure', index: hit.index }, 'garrison');
      }
    } else if (hit.kind === 'structure' && playerSide === 0) {
      send([{ type: 'attack', squads: sel, target: { kind: 'structure', index: hit.index } }]);
      r.setOrderTarget(sel, { kind: 'structure', index: hit.index }, 'attack');
    } else {
      const type = !startedRef.current ? 'deploy' : forceAttackMove || armedRef.current === 'attackMove' ? 'attackMove' : 'move'; // before Start the ground order places the squads (plan D5)
      send([{ type, squads: sel, x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel, null); // a plain move: the old target ring goes, the move marker shows
      r.addMarker(hit.ground.x, hit.ground.z, type === 'attackMove' ? '#fb923c' : '#a3e635');
    }
    armedRef.current = null; setArmed(null);
    return true;
  }, [playerSide, send, setGhostAt, placeGhost]);

  // A building's footprint follows the mouse while one is being placed (B10: green or red; a finger
  // drags it, gestures.js 'place').
  useEffect(() => {
    const el = canvasRef.current;
    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || armedRef.current?.type !== 'place') return;
      const rect = el.getBoundingClientRect();
      setGhostAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [setGhostAt]);

  const clearSelection = useCallback(() => { updateSelection([]); selectBuilding(null); setInspect(null); setRadial(null); }, [updateSelection, selectBuilding]);

  // One click or tap on the battlefield: what it means is decided in selection.js.
  const pointer = useCallback((input, p, mods = {}) => {
    setRadial(null);
    const cur = frames.current.cur;
    const sel = [...selectedRef.current];
    const ownSquad = ownSquadAt(p, input === 'tap' && sel.length > 0);
    const building = ownBuildingAt(p);
    const now = performance.now();
    const cycle = isCycleClick(lastPickRef.current, p, now, ownSquad, sel);
    const bRow = selectedBuildingRef.current !== null ? cur?.eco?.buildings.find((b) => b.idx === selectedBuildingRef.current) : null;
    const selectedBuildingInfo = bRow ? { idx: bRow.idx, trains: !!bRow.built && (BUILDINGS[bRow.type]?.trains || []).length > 0 } : null;
    const act = decidePointer({
      input, shift: !!mods.shift, ownSquad, building, cycle, armed: armedRef.current, selectedBuilding: selectedBuildingInfo,
      selection: sel.map((i) => ({ idx: i, classId: cur?.squads[i]?.classId }))
    });
    lastPickRef.current = act.do === 'select' && ownSquad !== null ? { x: p.x, y: p.y, t: now, squad: ownSquad } : null;
    switch (act.do) {
      case 'select': case 'selectBuilding': case 'deselect': {
        // Nothing of yours there: whatever building, ruin or resource it is gets the info card.
        const seen = act.do === 'deselect' ? inspectAt(p) : null;
        if (seen) { inspectThing(seen); break; }
        const next = selectionAfter({ ids: sel, building: selectedBuildingRef.current }, act);
        if (next.building !== null) selectBuilding(next.building); else { updateSelection(next.ids); selectBuilding(null); }
        break;
      }
      case 'cancelArmed': disarm(); break;
      case 'rally': {
        const r = rendererRef.current; const g = r?.screenToGround(p.x, p.y);
        if (g) { send([{ type: 'rally', building: selectedBuildingInfo.idx, x: Math.round(g.x * Q), y: Math.round(g.z * Q) }]); r.addMarker(g.x, g.z, '#facc15'); }
        break;
      }
      case 'armed': case 'order': if (!issueAt(p) && input === 'tap') clearSelection(); break;
      default:
    }
  }, [ownSquadAt, ownBuildingAt, inspectAt, inspectThing, updateSelection, selectBuilding, clearSelection, issueAt, send, disarm]);

  useEffect(() => {
    const el = canvasRef.current;
    return createGestureRecognizer(el, {
      isSelectMode: () => selectModeRef.current,
      // Placing a building (B10): a finger drags the ghost; a still tap on it builds.
      isPlacing: () => armedRef.current?.type === 'place',
      isOnGhost: (p) => {
        const gh = ghostRef.current; const g = rendererRef.current?.screenToGround(p.x, p.y);
        return !!gh && !!g && g.x >= gh.tx - 0.5 && g.x <= gh.tx + gh.size + 0.5 && g.z >= gh.ty - 0.5 && g.z <= gh.ty + gh.size + 0.5;
      },
      placeDrag: (p) => setGhostAt(p),
      placeEnd: (p, { moved, onGhost, quick }) => { if (onGhost && !moved && quick) placeGhost(); },
      selectModeDone: () => setSelectModeOn(false),
      isOnSelectedSquad: (p) => { const idx = ownSquadAt(p); return idx !== null && selectedRef.current.has(idx); },
      hasSelection: () => selectedRef.current.size > 0,
      tap: (p) => pointer('tap', p),
      click: (p, mods) => pointer('left', p, mods),
      order: (p) => pointer('right', p),
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
      lassoEnd: (s, p, mods) => {
        setLasso(null);
        const r = rendererRef.current; const cur = frames.current.cur;
        if (!r || !cur) return;
        const x0 = Math.min(s.x, p.x); const x1 = Math.max(s.x, p.x); const y0 = Math.min(s.y, p.y); const y1 = Math.max(s.y, p.y);
        const ids = cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled).filter((q) => {
          const sp = r.worldToScreen(q.x / Q, q.y / Q);
          return sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1;
        }).map((q) => q.idx);
        updateSelection(mods?.shift ? [...new Set([...selectedRef.current, ...ids])] : ids);
      },
      cancel: () => { setDragLine(null); setLasso(null); }
    });
  }, [pointer, issueAt, ownSquadAt, playerSide, send, updateSelection, setSelectModeOn, setGhostAt, placeGhost]);

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
      else if (e.key === 'Escape') { if (armedRef.current) disarm(); else clearSelection(); }
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
  const toggleSound = () => setAudioSettings({ sound: !soundOn });
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
    const idle = classId === 'idle' ? new Set(cur.eco?.idleWorkers || []) : null;
    const picked = cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled && !q.routed && (classId === 'all' ? q.classId !== 'worker' : idle ? idle.has(q.idx) : q.classId === classId));
    updateSelection(picked.map((q) => q.idx));
    if (picked.length) rendererRef.current?.centerOn(picked.reduce((s, q) => s + q.x, 0) / picked.length / Q, picked.reduce((s, q) => s + q.y, 0) / picked.length / Q);
  };
  const callReserve = (idx) => send([{ type: 'callReserve', squads: [idx] }]);
  const commandSelected = (type) => { const sel = [...selectedRef.current]; if (sel.length) send([{ type, squads: sel }]); setRadial(null); };
  const retreatAll = () => send([{ type: 'retreatAll' }]);
  const focusKeep = () => { const k = setup.structures[0]; rendererRef.current?.centerOn(k.x / Q, k.y / Q); };
  // The battle economy's actions.
  const pickBuilding = (id) => {
    setBuildMenu(false);
    armedRef.current = { type: 'place', building: id, label: id }; setArmed(armedRef.current);
    ghostRef.current = null;
    const w0 = wrapRef.current;
    setGhostAt({ x: (w0?.clientWidth || 800) / 2, y: (w0?.clientHeight || 400) * 0.55 }); // seen at once, before any hover or drag
  };
  const ecoBuilding = hud?.eco && selectedBuilding !== null ? hud.eco.buildings.find((b) => b.idx === selectedBuilding && b.alive) || null : null;
  const ecoInfo = ecoBuilding ? inspectInfo(hud, setup, { kind: 'eco', index: ecoBuilding.idx }, playerSide) : null;
  const seenInfo = !ecoBuilding && inspect ? inspectInfo(hud, setup, inspect, playerSide) : null;
  // An alert's Go: the camera goes there; a squad of yours it is about is selected.
  const alertGo = (a) => {
    rendererRef.current?.centerOn(a.x / Q, a.y / Q);
    const q = a.squad != null ? frames.current.cur?.squads[a.squad] : null;
    if (q && q.side === playerSide && q.alive && q.onField && !q.fled) updateSelection([a.squad]);
  };
  const ageId = setup.sides[playerSide].ageId;
  const leftCard = ecoInfo ? <InfoCard info={ecoInfo} onClose={() => selectBuilding(null)} testId="battle-building-panel" />
    : seenInfo ? <InfoCard info={seenInfo} onClose={() => setInspect(null)} /> : null;
  const selectHq = () => {
    const hq = hud?.eco?.buildings.find((b) => b.side === playerSide && (b.type === 'camp' || b.type === 'hall') && b.alive);
    if (!hq) return;
    selectBuilding(hq.idx);
    rendererRef.current?.centerOn(hq.x / Q, hq.y / Q);
  };

  const timeLeft = hud ? Math.max(0, Math.ceil((battleLimitTicks(setup) - hud.tick) / TICK_HZ)) : 0;
  const selectedSquads = useMemo(() => (hud ? selected.map((i) => hud.squads[i]).filter((q) => q && q.alive) : []), [hud, selected]);
  // Abilities the selection can use (a general's, or legendary archers' Volley), best cooldown first.
  const selectedAbilities = useMemo(() => {
    const byId = new Map();
    selectedSquads.forEach((q) => (q.abilities || []).forEach((a) => { const cur = byId.get(a.id); if (!cur || a.readyIn < cur.readyIn) byId.set(a.id, a); }));
    return [...byId.values()];
  }, [selectedSquads]);

  // The context panel (B10): the actions of the selection only.
  const context = contextFor({ selectedSquads, building: ecoBuilding, inspect: seenInfo ? inspect : null, armed });
  useEffect(() => { if (context !== 'mixed') setBuildMenu(false); }, [context]);
  const stopWorkers = () => { const cur = frames.current.cur; const ids = [...selectedRef.current].filter((i) => cur?.squads[i]?.classId === 'worker'); if (ids.length) send([{ type: 'stop', squads: ids }]); };
  let panel = null;
  if (hud?.eco && context === 'place' && ghost) {
    panel = (
      <div className="w-[min(19rem,calc(100vw-11rem))] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl text-[11.5px]" data-testid="battle-place-panel">
        <div className="px-1 leading-snug"><b>{ecoName(ghost.building, ageId)}</b><span className="text-fa-muted"> · {MOUSE_POINTER ? 'click the ground to build' : 'drag to move, tap it to build'}</span></div>
        <div className={ghost.ok ? 'px-1 text-fa-good font-semibold' : 'px-1 text-fa-danger-text font-semibold'} data-testid="battle-place-reason">{ghost.ok ? 'Good spot' : ghost.reason}</div>
        <div className="flex gap-1 justify-end mt-1">
          <button type="button" onClick={placeGhost} disabled={!ghost.ok} data-testid="battle-place-confirm" className="min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-raised border border-fa-good text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:border-fa-line"><Check className="w-4 h-4" aria-hidden="true" /><span className="leading-none">Build here</span></button>
          <button type="button" onClick={disarm} data-testid="battle-place-cancel" className="min-w-[52px] h-12 px-2 rounded-[10px] bg-fa-panel border border-fa-line text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5"><XIcon className="w-4 h-4" aria-hidden="true" /><span className="leading-none">Cancel</span></button>
        </div>
      </div>
    );
  } else if (hud?.eco && (context === 'workers' || (context === 'mixed' && buildMenu))) {
    panel = <BuildMenu ageId={ageId} stock={hud.eco.stock} workers={hud.eco.workers} onPick={pickBuilding}
      onClose={context === 'mixed' ? () => setBuildMenu(false) : null}
      extra={context === 'workers' ? <button type="button" onClick={stopWorkers} data-testid="battle-workers-stop" className="h-11 px-2 text-[11px] font-semibold text-fa-muted hover:text-fa-text">Stop</button> : null} />;
  } else if (hud?.eco && context === 'building') {
    panel = <BuildingActions building={ecoBuilding} ageId={ageId} stock={hud.eco.stock} eco={hud.eco}
      onBuildHouse={() => pickBuilding('house')}
      onTrain={(role) => send([{ type: 'train', building: ecoBuilding.idx, role }])}
      onCancel={(slot) => send([{ type: 'cancelTrain', building: ecoBuilding.idx, slot }])}
      rallyArmed={armed?.type === 'rally'}
      onRally={() => { armedRef.current = armedRef.current?.type === 'rally' ? null : { type: 'rally', building: ecoBuilding.idx, label: 'rally' }; setArmed(armedRef.current); }} />;
  } else if (hud?.eco && context === 'site') {
    panel = (
      <button type="button" onClick={() => { send([{ type: 'cancelBuild', building: ecoBuilding.idx }]); selectBuilding(null); }} data-testid="battle-cancel-build"
        className="min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-panel/95 border border-fa-danger text-fa-danger-text text-[11px] font-semibold shadow-lg flex flex-col items-center justify-center gap-0.5">
        <Ban className="w-4 h-4" aria-hidden="true" /><span className="leading-none">Cancel build</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="fixed inset-0 z-[80] bg-fa-ink text-fa-text select-none" style={{ touchAction: 'none' }} data-testid="tactical-battle">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
      {/* B10: "Building 43%" over your sites and the reason over a red placement ghost, moved by the render loop */}
      <div ref={siteLabelsRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" />
      <div ref={ghostLabelRef} className="absolute left-0 top-0 hidden px-2 py-0.5 rounded-md bg-fa-ink/90 border border-fa-danger text-fa-danger-text text-[11px] font-bold whitespace-nowrap pointer-events-none" data-testid="battle-ghost-reason" />
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
              className="min-w-[64px] h-12 px-3 rounded-full bg-fa-raised border border-fa-indep text-fa-text text-xs font-semibold shadow-xl disabled:opacity-40">
              {ABILITY_LABELS[a.id] || a.id}{a.readyIn > 0 ? ` ${Math.ceil(a.readyIn / TICK_HZ)}s` : ''}
            </button>
          ))}
          {[['hold', 'Hold'], ['stop', 'Stop'], ['retreat', 'Retreat']].map(([t, label]) => (
            <button key={t} onClick={() => commandSelected(t)} className="min-w-[64px] h-12 px-3 rounded-full bg-fa-panel/95 border border-fa-line text-fa-text text-sm font-semibold shadow-xl">{label}</button>
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
        onOpenBuild={() => setBuildMenu((v) => !v)} buildOpen={buildMenu} onSelectHq={selectHq}
        soundOn={soundOn} onToggleSound={toggleSound}
        selectMode={selectMode} onToggleSelectMode={() => { setSelectModeOn(!selectModeRef.current); setSelectHint(false); }}
        selectHint={selectHint}
        onFocus={(x, y) => rendererRef.current?.centerOn(x / Q, y / Q)}
        onClearSelection={clearSelection} mouse={MOUSE_POINTER}
        onAlertGo={alertGo} leftCard={leftCard}
        context={context} panel={panel}
        ended={!!ended}
      />
      {showPerf && <pre ref={perfRef} className="absolute left-1/2 -translate-x-1/2 top-14 z-20 pointer-events-none m-0 px-2 py-1 rounded bg-black/70 text-[10px] leading-tight text-lime-300 font-mono whitespace-pre" data-testid="battle-perf" />}
      {ended && <BattleResultScreen ended={ended} setup={setup} playerSide={playerSide} title={title} getCampaign={getCampaign} onContinue={() => onFinish?.(ended)} />}
      {failure && !ended && <BattleFailure title={failure.message} detail={failure.detail} onAuto={() => onAbandon?.('screen_error')} onRetry={onRetry} />}
    </div>
  );
};

// Artist unit models (src/assets/units/*.glb) are fetched and baked before the battlefield mounts,
// so the renderer builds its instanced layers from the final geometry. With no model files (the
// default) there is nothing to wait for and the battle opens immediately.
const TacticalBattleScreen = (props) => {
  // The player's side never routs in a commanded battle (morale.js canRout); fixed for the battle.
  const setup = useMemo(() => commandedSetup(props.setup), [props.setup]);
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
  return <><TacticalBattleView {...props} setup={setup} /><BattleRotateGate /></>;
};

export default TacticalBattleScreen;
