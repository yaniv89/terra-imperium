// src/components/battle/TacticalBattleScreen.jsx
// The commanded battle (Tactical Battles plan ֲ§2, ֲ§11): a full-screen three.js battlefield driven
// by the sim in a Web Worker, with a thumb-friendly HUD on top. Mobile first: tap to select / tap to
// order, drag a line for a formation, double-tap-drag to lasso, long-press for attack-move or the
// squad menu, pinch to zoom ג€” plus a tactical pause that keeps accepting orders. It starts paused
// (deployment): give opening orders, then press Start.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isRtl } from '../../i18n';
import { deployZone } from '../../battle/sim/world';
import { BattleRenderer } from '../../battle/render/BattleRenderer';
import { createBattleClient } from '../../battle/worker/battleClient';
import { createGestureRecognizer, insidePolygon } from '../../battle/input/gestures';
import { decidePointer, isCycleClick, pickOwnBuilding, selectionAfter, BUILDING_PICK_TILES, BUILDING_PICK_PX, groundOrderType } from '../../battle/input/selection';
import { Q, TICK_HZ, battleLimitTicks } from '../../battle/sim/constants';
import BattleHud, { isIdleSquad } from './BattleHud';
import { BattleRotateGate } from '../ui/RotateOverlay';
import BattleResultScreen from './BattleResultScreen';
import BattleFailure from './BattleFailure';
import BattleLoading, { workingOn } from './BattleLoading';
import { createStartWatch } from '../../battle/worker/startWatch';
import { MAX_PATH_POINTS } from '../../battle/sim/orderSchema';
import { createBattleAudio } from '../../battle/audio/battleAudio';
import { useAudioSettings, setAudioSettings } from '../../audio/audioSettings';
import { startBattleMusic } from '../../audio/music';
import { playVoice } from '../../audio/sfx';
import { voiceForOrders, voiceForSelection } from '../../battle/audio/voiceLines';
import { needsUnitModels, preloadUnitModels } from '../../battle/render/unitModels';
import { prewarmBattleWorker } from '../../battle/worker/warmWorker';
import { isSoldierLodReady } from '../../battle/render/soldierLod';
import { createPerfMeter, formatPerf } from '../../battle/render/perfMeter';
import { getMapPrefs } from '../map/mapPrefs';
import { Check, X as XIcon, Ban, Hammer, Wrench } from 'lucide-react';
import GameIcon from '../ui/GameIcon';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useCornerSheet } from '../../hooks/useExclusivePanel';
import { BuildMenu, BuildingActions, InfoCard, HammerButton, WorkerAutoButtons } from './EconomyHud';
import { inspectInfo } from './inspectModel';
import { contextFor, refusedText, enemyObjectives, supplyRate } from './battleHudModel';
import BattleMinimap from './BattleMinimap';
import { updateSiteLabels } from './siteLabels';
import { updatePendingPins } from './pendingPins';
import { badgesFor, updateSquadBadges } from './squadBadges';
import { BUILDINGS, BUILD_RADIUS_HQ, BUILD_RADIUS_OWN } from '../../battle/data/economy';
import { placementCheck, footprintAt, legalArea, PLACEMENT_REASON } from '../../battle/input/placement';
import { buildFlowNext, BUILD_FLOW_CLOSED, closePrecedence } from './buildFlow';
import { preloadBattleIcons } from './battleIcons';
import { commandedSetup } from '../../battle/setup/buildBattleSetup';
import { arrivalNote } from '../../battle/input/orderFeedback';
import { t as tNow } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { abilityLabel, powerLabel, ecoLabel } from './battleText';
import { releaseWhenDetached } from '../../utils/glContext';
import { noteCrashEvent } from '../../utils/crashLog';
import { coachSeen, markCoachSeen, coachSteps, mouseFirst } from './battleCoach';

const cx = (...p) => p.filter(Boolean).join(' ');

const HUD_INTERVAL_MS = 150;
// The start is watched stage by stage (startWatch.js): it fails only when no new stage arrives for
// START_STALL_MS with the page in front, or on an error with nothing left to try (battleClient.js
// first replaces a worker that died or went silent). Checked this often (ms):
const START_CHECK_MS = 1000;
// A frame that throws is skipped; this many in a row means the battlefield cannot be drawn.
const RENDER_ERRORS_TO_FAIL = 3;
// How long a lost WebGL context may take to come back before the failure screen shows.
const CONTEXT_RESTORE_MS = 4000;
// `&perf` in the page URL, or the Performance overlay setting (W12, mapPrefs.js), shows the
// performance readout (works in a production build too). Read when the battle opens.
const PERF_URL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');
const perfOn = () => PERF_URL || !!getMapPrefs().perf;


// An order the battle did not take is said, not swallowed (CB02): the battle loop posts
// `ordersRefused` when the shared order schema turns an order down or the order log is full.
const REFUSED_MS = 4000;
const pausedOrderText = () => tNow('bt.screen.pausedOrder');
// Rank 6: the radial's top edge: above the finger when it fits under the top bar, else below it, kept
// between the top bar and the bottom buttons (a 44 px row of commands, abilities about four a row).
const radialTop = (y, h, abilities) => {
  const est = 44 + Math.ceil(abilities / 4) * 52;
  const top = y - 36 - est >= 52 ? y - 36 - est : y + 36;
  return Math.max(52, Math.min(top, h - est - 56));
};
// "2:35": a battle tick as minutes and seconds of battle time.
const battleClock = (tick) => { const sec = Math.max(0, Math.floor((tick || 0) / TICK_HZ)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const ORDER_NOTE_MS = 3500;
const OBJECTIVE_NOTE_MS = 7000; // the Enemy caption with its Attack it button: time to read and tap

// U03: the battle screen's usable rectangle. The safe-area insets (a notch or Dynamic Island on the
// left or right in landscape, the home bar below) as --sa-t/r/b/l for the HUD; `&safe=t,r,b,l` (css
// px) in the URL stands in for a notch where the browser has none (screenshots, desktop checks).
const SAFE_URL = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('safe') : null;
const safeVars = () => {
  const n = SAFE_URL ? SAFE_URL.split(',').map((v) => Math.max(0, Number(v) || 0)) : null;
  const side = (k, i) => (n ? `${n[i] ?? 0}px` : `env(safe-area-inset-${k}, 0px)`);
  return { '--sa-t': side('top', 0), '--sa-r': side('right', 1), '--sa-b': side('bottom', 2), '--sa-l': side('left', 3), '--sa-s': side(isRtl() ? 'right' : 'left', isRtl() ? 1 : 3), '--sa-e': side(isRtl() ? 'left' : 'right', isRtl() ? 3 : 1) };
};
// I196: the minimap's on/off is a per-device convenience, never game state.
const MINIMAP_KEY = 'ti.battle.minimap';
const readFlag = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage blocked */ } };
// I198: arrow keys and the mouse at the screen's edge move the camera (css px a second).
const KEY_PAN_PX_S = 700;
const EDGE_PAN_PX_S = 600;
const EDGE_PX = 14;
// I199: how fast the camera catches up with a followed selection (per second).
const FOLLOW_RATE = 4;
// Notes about orders sit just above the bottom bar, inside the safe area.
const NOTE_BOTTOM = 'calc(max(0.375rem, var(--sa-b, 0px)) + 3.75rem)';

const TacticalBattleView = ({ setup, playerSide = 0, title, resume = null, onCheckpoint, onFinish, onAbandon, onSwitchAuto = null, onRetry = null, getCampaign = null, getReceipt = null, onEnded = null }) => {
  useT(); // redraw the screen's own texts when the language changes
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const clientRef = useRef(null);
  // Switch to Auto (H-01): Auto goes on from the battle as it stands. The worker is asked for its log
  // and tick (battleLoop.js snapshot), which go to the campaign (battleSwitch.js replays them).
  const switchRef = useRef({ asked: false, timer: null, checkpoint: resume?.log ? resume : null, to: null });
  switchRef.current.to = onSwitchAuto;
  const audioRef = useRef(null);
  const soundOn = useAudioSettings().sound; // the one Sound switch (also in Settings)
  const frames = useRef({ prev: null, cur: null, arrival: 0 });
  const selectedRef = useRef(new Set());
  const armedRef = useRef(null); // 'attackMove' ג€” the next ground order becomes an attack-move
  const formationRef = useRef('line');
  const speedRef = useRef(1);
  const [hud, setHud] = useState(null);
  const [selected, setSelected] = useState([]);
  const [paused, setPaused] = useState(true); // always open paused: deployment, or a resumed battle
  const pausedRef = useRef(true);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [started, setStarted] = useState(!!resume);
  const startedRef = useRef(!!resume);
  const [speed, setSpeed] = useState(1);
  const [armed, setArmed] = useState(null);
  const [formation, setFormation] = useState('line');
  const [dragLine, setDragLine] = useState(null);
  const [lasso, setLasso] = useState(null);
  const [radial, setRadial] = useState(null);
  useCornerSheet('battle-radial', !!radial, () => setRadial(null)); // one battle overlay at a time on a phone (BattleHud's sheets)
  const [ended, setEnded] = useState(null);
  const [failure, setFailure] = useState(null); // { message, detail }: BattleFailure
  // The start for the loading screen (BattleLoading): the stage reached, the bar, the seconds so far
  // and the last replacement of the worker; null once the first frame is on screen.
  const [start, setStart] = useState({ stage: 'field', fraction: 0, seconds: 0, retry: null });
  const [refused, setRefused] = useState(null); // the last `ordersRefused` message, shown a few seconds
  // The campaign's answer for the ended battle (battleReceipt.js): undefined outside a campaign,
  // { pending } while it is counted (the replay takes a moment), then the receipt or { failed }.
  const [receipt, setReceipt] = useState(undefined);
  // The battle economy (EconomyHud.jsx): the selected building, the build menu.
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const selectedBuildingRef = useRef(null);
  // The build sheet and the placement as one state machine (buildFlow.js; U02, U05, U13).
  const [flow, setFlowState] = useState(BUILD_FLOW_CLOSED);
  const flowRef = useRef(BUILD_FLOW_CLOSED);
  const flowTo = useCallback((event) => { const next = buildFlowNext(flowRef.current, event); flowRef.current = next; setFlowState(next); return next; }, []);
  const buildMenu = flow.sheet;
  // A build order sent and not yet seen as a site (I181: a refusal by the battle is said).
  const pendingBuildRef = useRef(null);
  const [buildNote, setBuildNote] = useState(null);
  // Anything else tapped on the field (UI-DESIGN B09): { kind: 'eco' | 'structure' | 'node', index }
  // for the info card; never together with selected squads or your own selected building.
  const [inspect, setInspect] = useState(null);
  // The placement ghost (B10): { building, size, tx, ty, ok, reason }, green or red with the reason.
  const [ghost, setGhost] = useState(null);
  const ghostRef = useRef(null);
  const siteLabelsRef = useRef(null); // "Building 43%" over your sites (siteLabels.js)
  const ghostLabelRef = useRef(null); // the reason over a red ghost
  const badgesRef = useRef(null); // flags over squads at the wide zoom and under cover (squadBadges.js)
  const pendingPinsRef = useRef(null); // pins over orders given while paused (RTS-03)
  const perfRef = useRef(null);
  const [showPerf] = useState(perfOn);
  // Touch box select (UI-DESIGN B04): while on, a one-finger drag draws the selection box.
  const [selectMode, setSelectMode] = useState(false);
  const selectModeRef = useRef(false);
  const setSelectModeOn = useCallback((on) => { selectModeRef.current = on; setSelectMode(on); }, []);
  // U38: Path mode (the HUD's Path button): a finger draws a route the selected squads walk in turn.
  const [pathMode, setPathMode] = useState(false);
  const pathModeRef = useRef(false);
  const setPathModeOn = useCallback((on) => { pathModeRef.current = on; setPathMode(on); if (!on) setDrawPath(null); }, []);
  const [drawPath, setDrawPath] = useState(null);
  // RTS-01: the words follow the pointer really in use (touch or mouse, as gestures.js maps them):
  // a guess from the device at first, then whatever last touched the battlefield.
  const [mouse, setMouse] = useState(mouseFirst);
  // The first-battle coach (battleCoach.js): the step shown, or -1. A UI hint, never game state.
  const [coachStep, setCoachStep] = useState(() => (coachSeen() ? -1 : 0));
  // I199: the camera follows the selection until the player moves it by hand.
  const [follow, setFollowState] = useState(false);
  const followRef = useRef(false);
  const setFollow = useCallback((on) => { followRef.current = on; setFollowState(on); }, []);
  // I196: the minimap, off until the player turns it on (remembered on this device).
  const [minimapOn, setMinimapOn] = useState(() => readFlag(MINIMAP_KEY));
  // I198: arrow keys held, and the edge the mouse rests at ({ x, y } in -1..1), for the render loop.
  const panKeysRef = useRef(new Set());
  const edgeRef = useRef(null);
  const objectiveIdxRef = useRef(0);
  const safeStyle = useMemo(safeVars, []);

  // The coach is remembered as soon as it shows (the HUD is up): once per device.
  const hudUp = !!hud;
  const coachOn = coachStep >= 0;
  useEffect(() => { if (coachOn && hudUp) markCoachSeen(); }, [coachOn, hudUp]);
  // The battle's clock waits while the first-battle tips are open after Start (playtest 40550085702
  // step 158: a squad was wiped out while tip 1 of 3 was still on screen). Next to the end, Skip,
  // or the player's own Pause and Resume let it run. The sim only stops ticking: no order or rule changes.
  const coachHold = started && coachOn && !ended;
  useEffect(() => {
    const c = clientRef.current; if (!c || !started) return;
    if (coachHold) c.pause(); else if (!pausedRef.current) c.resume();
  }, [coachHold, started]);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return undefined;
    const onDown = (e) => setMouse(e.pointerType !== 'touch');
    el.addEventListener('pointerdown', onDown, true);
    return () => el.removeEventListener('pointerdown', onDown, true);
  }, []);

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
  // U24: on a phone or tablet the laborers rebuild a fallen depot by themselves (a button turns it off).
  const rebuildDefault = useRef(false);
  const layout = useLayoutMode();
  useEffect(() => {
    if (started && !resume && layout !== 'desktop' && hud?.eco && !hud.eco.autoRebuild && !rebuildDefault.current) send([{ type: 'autoRebuild', on: true }]);
    // Rank 5: on a phone the steward runs the base from the start (the Steward button turns it off).
    if (started && !resume && layout.startsWith('phone') && hud?.eco && !hud.eco.steward && !rebuildDefault.current) send([{ type: 'steward', on: true }]);
    if (started && hud?.eco) rebuildDefault.current = true;
  }, [started, hud?.eco, layout, resume, send]);


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
      noteCrashEvent(`battle-start failed at field: ${err?.message || err}`);
      setFailure({ message: tNow('bt.screen.drawFail'), detail: err?.message || String(err) });
      return undefined;
    }
    rendererRef.current = renderer;
    // The start, stage by stage (startWatch.js): the battlefield is built, the worker comes next.
    const watch = createStartWatch({ now: () => performance.now(), first: 'field' });
    if (document.hidden) watch.hidden(true);
    let retryKind = null;
    const showStart = () => {
      if (watch.done()) { setStart(null); return; }
      setStart({ stage: watch.stage(), fraction: watch.fraction(), seconds: Math.floor(watch.elapsed() / 1000), retry: retryKind });
    };
    const startFailed = (detail, why) => {
      noteCrashEvent(`battle-start failed at ${watch.stage()}: ${why}`);
      noteCrashEvent(`battle-start stages: ${watch.summary()}`);
      setFailure({ message: tNow('bt.screen.couldNotStart'), detail });
    };
    const startStage = (stage) => {
      if (!watch.note(stage)) return;
      if (stage === 'drawn') noteCrashEvent(`battle-start ${(watch.elapsed() / 1000).toFixed(1)}s: ${watch.summary()}`.slice(0, 160));
      showStart();
    };
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

    startStage('worker'); // before the client: a warm worker hands over its stages at once
    let endedSeen = false; // the end record is kept by onEnded: no checkpoint may replace it
    let resumeRejected = false;
    const client = createBattleClient({
      setup, resume, paused: true,
      onMessage: (m) => {
        if (m.type === 'stage') {
          if (m.stage === 'retry') {
            // The worker failed or went silent: battleClient.js starts the next way to run it.
            retryKind = m.kind;
            noteCrashEvent(`battle-start retry ${m.kind} at ${watch.stage()}: ${m.reason}${m.detail ? ` (${m.detail})` : ''}`);
            watch.bump(`${m.kind}:${m.reason}`, 'worker');
            showStart();
          } else startStage(m.stage);
          return;
        }
        if (m.type === 'frame') {
          startStage('frame');
          const f = frames.current;
          if (m.sim) f.sim = m.sim;
          if (!f.cur || m.view.tick !== f.cur.tick) { f.prev = f.cur; f.cur = m.view; f.arrival = performance.now(); } else f.cur = m.view;
          // First frame: look straight at your own army.
          if (!f.centered) {
            const own = m.view.squads.filter((q) => q.side === playerSide && q.alive && q.onField);
            if (own.length) renderer.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / Q, own.reduce((a, q) => a + q.y, 0) / own.length / Q);
            f.centered = true;
            // Resumed: say where it picks up (playtest 4 H2); a rejected checkpoint says so instead.
            if (!resumeRejected && resume?.log && m.view.tick > 0) setOrderNote(tNow('bt.screen.resumedAt', { time: battleClock(m.view.tick) }));
          }
          try {
            if (m.events?.length) renderer.pushEvents(m.events, m.view);
            // Sound only where the camera looks (every frame: the ambience follows the fighting on screen).
            audio.setView(renderer.audioView());
            audio.events(m.events, m.view);
          } catch (err) { if (!f.fxWarned) { f.fxWarned = true; console.error('[battle] effects or sound failed', err); } }
        } else if (m.type === 'checkpoint') {
          switchRef.current.checkpoint = m;
          onCheckpoint?.(m);
        } else if (m.type === 'snapshot') {
          const sw = switchRef.current;
          if (sw.asked && sw.to) { clearTimeout(sw.timer); sw.to(m); }
          // Asked when the page was hidden (below): kept as the battle's latest checkpoint, so a
          // phone that drops the tab picks up here, not up to 10 s earlier (playtest 4 H2).
          else if (!endedSeen && m.tick > 0) { sw.checkpoint = m; onCheckpoint?.(m); }
        } else if (m.type === 'ended') { endedSeen = true; setEnded(m); }
        else if (m.type === 'ordersRefused') setRefused({ count: m.count, full: !!m.full });
        else if (m.type === 'resumeRejected') {
          // The saved checkpoint was not this battle's: it starts fresh, at deployment, and says so
          // until Start (never a silent restart: playtest 4 H2).
          switchRef.current.checkpoint = null;
          resumeRejected = true;
          setRestartNote(tNow('bt.screen.resumeRejected', { time: battleClock(m.tick) }));
          startedRef.current = false; setStarted(false); setPaused(true);
          renderer.setDeployZone(deployZone({ map: setup.map }, playerSide), playerSide);
        } else if (m.type === 'error') {
          console.error(`[battle] the battle stopped (${m.stage || 'sim'}): ${m.message}`, m.stack || '');
          if (frames.current.cur) {
            noteCrashEvent(`battle stopped (${m.stage || 'sim'}): ${m.message}`);
            setFailure({ message: tNow('bt.screen.stopped'), detail: m.message });
          } else {
            watch.fail('error');
            startFailed(m.message, `error in ${m.stage || 'sim'} after ${m.attempts || 1} tries: ${m.message}`);
          }
        }
      }
    });
    clientRef.current = client;
    if (import.meta.env.DEV) window.__battleOrders = (orders) => client.sendOrders(orders); // console / visual-test driving

    let raf; let lastT = performance.now(); let lastHud = 0; let lastPerf = 0;
    let renderErrors = 0;
    // The start's watch: a stall (no new stage for a long time, the page in front) fails the start.
    const startTimer = setInterval(() => {
      if (watch.done()) { clearInterval(startTimer); return; }
      const stalled = watch.check();
      if (stalled) {
        clearInterval(startTimer);
        const secs = Math.round(stalled.waitedMs / 1000);
        console.error(`[battle] the start stalled at ${stalled.stage} for ${secs} s`);
        // The card names the step in words, plus a short code (stage and how the sim ran) for a bug report.
        const code = `${stalled.stage}/${client.kind()}${client.warm() ? '/warm' : ''}`;
        startFailed(`${tNow('bt.screen.stalled', { stage: tNow(`bt.load.${workingOn(stalled.stage)}`), n: secs })} \u2066[${code}]\u2069`, `no progress for ${secs}s (${code})`);
        return;
      }
      if (!document.hidden) showStart(); // the seconds on the loading screen
    }, START_CHECK_MS);
    // `&perf` in the URL: an on-screen readout (perfMeter.js), also left in window.__battlePerf.
    const meter = perfOn() ? createPerfMeter() : null;
    const loop = (t) => {
      raf = requestAnimationFrame(loop); // first: one bad frame never stops the loop
      const rawMs = t - lastT;
      const dt = Math.min(0.1, rawMs / 1000); lastT = t;
      const f = frames.current;
      const alpha = f.prev ? Math.min(1, ((t - f.arrival) * speedRef.current) / (1000 / TICK_HZ)) : 1;
      // I198: arrow keys and the screen's edge pan (a hand on the camera ends a follow, I199).
      let px = 0; let py = 0;
      const keys = panKeysRef.current;
      if (keys.size) {
        const k = KEY_PAN_PX_S * dt;
        if (keys.has('ArrowLeft')) px += k;
        if (keys.has('ArrowRight')) px -= k;
        if (keys.has('ArrowUp')) py += k;
        if (keys.has('ArrowDown')) py -= k;
      }
      const edge = edgeRef.current;
      if (edge) { px -= edge.x * EDGE_PAN_PX_S * dt; py -= edge.y * EDGE_PAN_PX_S * dt; }
      if (px || py) { renderer.pan(px, py); if (followRef.current) setFollow(false); }
      // I199: the camera eases towards the followed squads.
      if (followRef.current && f.cur) {
        const list = [...selectedRef.current].map((i) => f.cur.squads[i]).filter((q) => q?.alive && q.onField && !q.fled);
        if (!list.length) setFollow(false);
        else {
          const k = 1 - Math.exp(-FOLLOW_RATE * dt);
          const gx = list.reduce((s, q) => s + q.x, 0) / list.length / Q; const gz = list.reduce((s, q) => s + q.y, 0) / list.length / Q;
          renderer.target.x += (gx - renderer.target.x) * k; renderer.target.z += (gz - renderer.target.z) * k;
          renderer.clampTarget();
        }
      }
      const r0 = meter ? performance.now() : 0;
      try {
        renderer.render(f.prev, f.cur, alpha, { selected: selectedRef.current }, dt);
        renderErrors = 0;
        if (f.cur && !watch.done()) startStage('drawn'); // the first frame is on screen: the start is over
      } catch (err) {
        renderErrors += 1;
        if (renderErrors === 1) console.error('[battle] drawing the battlefield failed', err);
        if (renderErrors === RENDER_ERRORS_TO_FAIL) setFailure({ message: tNow('bt.screen.couldNotDraw'), detail: err?.message || String(err) });
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
          updatePendingPins(pendingPinsRef.current, renderer);
          updateSquadBadges(badgesRef.current, renderer, badgesFor(f.prev, f.cur, alpha, { zoom: renderer.camera.zoom, playerSide, map: renderer.map, selected: selectedRef.current }));
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
    const onVis = () => {
      watch.hidden(document.hidden); // time in the background never counts against the start
      // The battle as it stands is saved at once (a snapshot kept as a checkpoint): the page may
      // never come back (a phone drops the tab, the site updates and reloads).
      if (document.hidden) { client.pause(); setPaused(true); if (startedRef.current && !endedSeen) client.snapshot?.(); }
    };
    document.addEventListener('visibilitychange', onVis);
    // A phone can take the graphics away (memory pressure, the app in the background): the battle
    // pauses, three.js rebuilds everything when the context comes back, and if it does not come
    // back the failure screen offers Auto or Try again instead of a black field.
    let lostTimer = 0;
    const onLost = (e) => {
      e.preventDefault();
      client.pause(); setPaused(true);
      noteCrashEvent('battle-context-lost');
      clearTimeout(lostTimer);
      lostTimer = setTimeout(() => setFailure({ message: tNow('bt.screen.couldNotDraw'), detail: tNow('bt.screen.graphicsLost') }), CONTEXT_RESTORE_MS);
    };
    const onRestored = () => { clearTimeout(lostTimer); noteCrashEvent('battle-context-restored'); };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      clearTimeout(lostTimer);
      clearInterval(startTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
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
  // The screen closed: its WebGL context (and GPU memory) goes now, not when collected (glContext.js).
  useEffect(() => { const canvas = canvasRef.current; return () => releaseWhenDetached(canvas); }, []);

  // The result screen covers the battlefield: its sounds stop (the victory or defeat sting has played).
  useEffect(() => { audioRef.current?.setVisible(!ended); }, [ended]);
  useEffect(() => {
    if (!refused) return undefined;
    const t = setTimeout(() => setRefused(null), REFUSED_MS);
    return () => clearTimeout(t);
  }, [refused]);
  // A short note about the order just given (CB17): why a tap gave no order (I189), or that fast
  // squads will arrive first (I192, X13).
  const [orderNote, setOrderNote] = useState(null);
  const [restartNote, setRestartNote] = useState(null); // a checkpoint that could not be resumed: shown until Start
  // The Enemy button's target while its caption shows: one tap on Attack it sends the army at it
  // (playtest 40550100958 steps 57 to 63: the caption showed the target but could not order it).
  const [objTarget, setObjTarget] = useState(null);
  useEffect(() => {
    if (!orderNote) { setObjTarget(null); return undefined; }
    const t = setTimeout(() => setOrderNote(null), objTarget ? OBJECTIVE_NOTE_MS : ORDER_NOTE_MS);
    return () => clearTimeout(t);
  }, [orderNote, objTarget]);
  // RTS-03: an order given while paused waits in the battle loop until Resume. It shows at once
  // anyway (a steady ring, a footprint), and a note says when it starts. Drawing only.
  const markPending = useCallback((mark) => {
    if (!startedRef.current || !pausedRef.current) return;
    rendererRef.current?.addPendingMark(mark);
    setOrderNote((n) => n || pausedOrderText());
  }, []);
  // The battle is over: the result screen opens at once, and the campaign counts the battle right
  // after (a tick later, so "counting" is on screen while the replay runs).
  useEffect(() => {
    if (!ended) return undefined;
    onEnded?.(ended);
    if (!getReceipt) return undefined;
    setReceipt({ pending: true });
    const t = setTimeout(() => {
      let r = null;
      try { r = getReceipt(ended); } catch (err) { console.error('[battle] the campaign result could not be read', err); }
      setReceipt(r || { failed: true });
    }, 40);
    return () => clearTimeout(t);
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const prev = ghostRef.current;
    if (!g) {
      // I180: a tap that does not reach the ground (the sky, past the land) is said, not ignored.
      if (prev) { const bad = { ...prev, ok: false, reason: PLACEMENT_REASON.outside }; ghostRef.current = bad; setGhost(bad); }
      return ghostRef.current;
    }
    const { size, tx, ty } = footprintAt(a.building, g.x, g.z);
    if (prev && prev.tx === tx && prev.ty === ty && prev.building === a.building && prev.tick === cur.tick) return prev;
    const v = placementCheck({ view: cur, setup, side: playerSide, type: a.building, tx, ty, fog: r.lastFog || cur.fog || null, stock: cur.eco?.stock, workers: cur.eco?.workers });
    const next = { building: a.building, size, tx, ty, ok: v.ok, reason: v.reason, tick: cur.tick };
    ghostRef.current = next;
    r.ecoLayer.setGhost({ size, tx, ty, ok: v.ok });
    if (!prev || prev.ok !== next.ok || prev.reason !== next.reason || prev.building !== next.building) setGhost(next);
    return next;
  }, [setup, playerSide]);
  // `how`: 'cancel' (Cancel, X, Esc, right click: back to where the placement came from) or
  // 'placed' (the site is down: the sheet comes back once, U13). Anything else armed just ends.
  const disarm = useCallback((how = 'cancel') => {
    const wasPlacing = armedRef.current?.type === 'place';
    rendererRef.current?.ecoLayer.setGhost(null);
    rendererRef.current?.ecoLayer.setPlacementOverlay(null);
    ghostRef.current = null; setGhost(null);
    armedRef.current = null; setArmed(null);
    if (wasPlacing) flowTo({ type: how });
  }, [flowTo]);
  // Who goes to build or mend at (cx, cz) tiles: the selected laborers, else idle ones, else the two nearest.
  const buildersFor = useCallback((cur, cx, cz) => {
    let workers = [...selectedRef.current].filter((i) => cur.squads[i]?.classId === 'worker');
    if (!workers.length) workers = (cur.eco?.idleWorkers || []).slice(0, 2);
    if (!workers.length) workers = cur.squads.filter((q) => q.side === playerSide && q.classId === 'worker' && q.alive && q.onField).sort((x, y) => ((x.x / Q - cx) ** 2 + (x.y / Q - cz) ** 2) - ((y.x / Q - cx) ** 2 + (y.y / Q - cz) ** 2)).slice(0, 2).map((q) => q.idx);
    return workers;
  }, [playerSide]);
  // Build at the ghost when it is green (Build here, or a mouse click on the ground).
  const placeGhost = useCallback(() => {
    const r = rendererRef.current; const cur = frames.current.cur; const gh = ghostRef.current;
    if (!r || !cur || !gh) return false;
    // Recheck now (things move); a red spot keeps the building in hand and says why.
    const v = placementCheck({ view: cur, setup, side: playerSide, type: gh.building, tx: gh.tx, ty: gh.ty, fog: r.lastFog || cur.fog || null, stock: cur.eco?.stock, workers: cur.eco?.workers });
    if (!v.ok) { const bad = { ...gh, ok: false, reason: v.reason }; ghostRef.current = bad; setGhost(bad); r.ecoLayer.setGhost({ size: gh.size, tx: gh.tx, ty: gh.ty, ok: false }); return false; }
    const cx = gh.tx + gh.size / 2; const cz = gh.ty + gh.size / 2;
    const workers = buildersFor(cur, cx, cz);
    send([{ type: 'build', squads: workers, building: gh.building, tx: gh.tx, ty: gh.ty }]);
    pendingBuildRef.current = { building: gh.building, tx: gh.tx, ty: gh.ty, tick: cur.tick, sites: (cur.eco?.buildings || []).length };
    setBuildNote(null);
    r.addMarker(cx, cz, '#a3e635');
    markPending({ kind: 'build', x: cx, z: cz, size: gh.size, tx: gh.tx, ty: gh.ty, color: '#facc15' });
    disarm('placed');
    return true;
  }, [setup, playerSide, send, disarm, buildersFor, markPending]);

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
        markPending({ kind: 'rally', x: g.x, z: g.z, color: '#facc15' });
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
        markPending({ kind: 'power', x: g.x, z: g.z, color: '#f97316' });
      }
      armedRef.current = null; setArmed(null);
      return true;
    }
    if (!r || !cur || !sel.length) return false;
    // An order tap looks past the player's own squads (I189, I190): at the enemy, the building or
    // the ground under them.
    const hit = r.pick(p.x, p.y, cur, 1.1, { enemyFirst: true, ignoreOwn: true });
    if (!hit) { setOrderNote(tNow('bt.order.noGround')); return true; } // said why, the selection stays
    const workers = sel.filter((i) => cur.squads[i]?.classId === 'worker');
    const onlyWorkers = workers.length === sel.length;
    const fighters = sel.filter((i) => !workers.includes(i));
    // While paused the "starts when you resume" note stays first (RTS-03).
    const noteFor = (type) => { const n = arrivalNote(fighters.map((i) => cur.squads[i]?.classId), type); if (n) setOrderNote((old) => (old?.startsWith(pausedOrderText()) ? `${pausedOrderText()} ${n}` : n)); };
    if (hit.kind === 'node') {
      // Workers to a resource: gather it (the others just go there).
      if (workers.length) send([{ type: 'gather', squads: workers, node: hit.index }]);
      if (!onlyWorkers) send([{ type: 'move', squads: sel.filter((i) => !workers.includes(i)), x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel.filter((i) => !workers.includes(i)), null);
      if (workers.length) r.setOrderTarget(workers, { kind: 'node', index: hit.index }, 'gather'); // the target ring (orderTarget.js)
      if (!onlyWorkers) { r.addMarker(hit.ground.x, hit.ground.z, '#fde047'); markPending({ kind: 'move', x: hit.ground.x, z: hit.ground.z, squads: fighters, color: '#fde047' }); }
    } else if (hit.kind === 'eco' && hit.side === playerSide) {
      // Workers to one of your buildings: help build it, or repair it; the others walk there.
      if (workers.length) send([{ type: 'assist', squads: workers, target: { kind: 'eco', index: hit.index } }]);
      if (!onlyWorkers) send([{ type: startedRef.current ? 'move' : 'deploy', squads: sel.filter((i) => !workers.includes(i)), x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel.filter((i) => !workers.includes(i)), null);
      if (workers.length) r.setOrderTarget(workers, { kind: 'eco', index: hit.index }, 'assist');
      if (!onlyWorkers) { r.addMarker(hit.ground.x, hit.ground.z, '#a3e635'); markPending({ kind: 'move', x: hit.ground.x, z: hit.ground.z, squads: fighters, color: '#a3e635' }); }
    } else if (hit.kind === 'eco') {
      send([{ type: 'attack', squads: sel, target: { kind: 'eco', index: hit.index } }]);
      r.setOrderTarget(sel, { kind: 'eco', index: hit.index }, 'attack');
      r.addMarker(hit.ground.x, hit.ground.z, '#ef4444');
      markPending({ kind: 'attack', x: hit.ground.x, z: hit.ground.z, squads: sel, color: '#ef4444' });
      noteFor('attack');
    } else if (hit.kind === 'structure' && playerSide === 1 && onlyWorkers) {
      send([{ type: 'repair', squads: workers, target: { kind: 'structure', index: hit.index } }]); // mend your city
      r.setOrderTarget(workers, { kind: 'structure', index: hit.index }, 'repair');
    } else if (hit.kind === 'squad' && hit.side !== playerSide) {
      send([{ type: 'attack', squads: sel, target: { kind: 'squad', index: hit.idx } }]);
      r.setOrderTarget(sel, { kind: 'squad', index: hit.idx }, 'attack'); // its ring holds while paused (orderTarget.js)
      markPending({ kind: 'attack', squads: sel, x: hit.ground.x, z: hit.ground.z, color: '#ef4444', ringless: true });
      noteFor('attack');
    } else if (hit.kind === 'structure' && playerSide === 1) {
      // Defending: tap your keep or a tower to man it (infantry and ranged; fortified buildings only).
      const eligible = sel.filter((i) => ['infantry', 'ranged'].includes(cur.squads[i]?.classId));
      if (eligible.length) {
        send([{ type: 'garrison', squads: eligible, structure: hit.index }]);
        r.setOrderTarget(eligible, { kind: 'structure', index: hit.index }, 'garrison');
      } else setOrderNote(tNow('bt.screen.onlyInfantry'));
    } else if (hit.kind === 'structure' && playerSide === 0) {
      send([{ type: 'attack', squads: sel, target: { kind: 'structure', index: hit.index } }]);
      r.setOrderTarget(sel, { kind: 'structure', index: hit.index }, 'attack');
      r.addMarker(hit.ground.x, hit.ground.z, '#ef4444');
      markPending({ kind: 'attack', x: hit.ground.x, z: hit.ground.z, squads: sel, color: '#ef4444' });
      noteFor('attack');
    } else {
      const type = groundOrderType({ started: startedRef.current, armed: armedRef.current, forceAttackMove, squads: sel.map((i) => cur.squads[i]) }); // before Start the ground order places the squads (plan D5)
      send([{ type, squads: sel, x: Math.round(hit.ground.x * Q), y: Math.round(hit.ground.z * Q), formation: formationRef.current }]);
      r.setOrderTarget(sel, null); // a plain move: the old target ring goes, the move marker shows
      r.addMarker(hit.ground.x, hit.ground.z, type === 'attackMove' ? '#fb923c' : '#a3e635');
      if (type !== 'deploy') markPending({ kind: type, x: hit.ground.x, z: hit.ground.z, squads: sel, color: type === 'attackMove' ? '#fb923c' : '#a3e635' });
      if (type !== 'deploy') noteFor(type);
    }
    armedRef.current = null; setArmed(null);
    return true;
  }, [playerSide, send, setGhostAt, placeGhost, markPending]);

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

  const clearSelection = useCallback(() => { updateSelection([]); selectBuilding(null); setInspect(null); setRadial(null); flowTo({ type: 'deselect' }); }, [updateSelection, selectBuilding, flowTo]);
  // U05: the X of a selection (and Esc): cancel what is armed first, else let go of the selection.
  // Never a Stop, a cancelled construction or a refund.
  const closeX = useCallback(() => { if (closePrecedence({ armed: armedRef.current }) === 'cancelArmed') disarm(); else clearSelection(); }, [disarm, clearSelection]);

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
        if (g) { send([{ type: 'rally', building: selectedBuildingInfo.idx, x: Math.round(g.x * Q), y: Math.round(g.z * Q) }]); r.addMarker(g.x, g.z, '#facc15'); markPending({ kind: 'rally', x: g.x, z: g.z, color: '#facc15' }); }
        break;
      }
      case 'armed': case 'order': if (!issueAt(p) && input === 'tap') clearSelection(); break;
      default:
    }
  }, [ownSquadAt, ownBuildingAt, inspectAt, inspectThing, updateSelection, selectBuilding, clearSelection, issueAt, send, disarm, markPending]);

  const tapMemory = useRef({ lastTapAt: -1000, lastTapPos: null });
  useEffect(() => {
    const el = canvasRef.current;
    return createGestureRecognizer(el, {
      isSelectMode: () => selectModeRef.current,
      isPathMode: () => pathModeRef.current && selectedRef.current.size > 0,
      pathDrag: (pts) => setDrawPath([...pts]),
      pathModeDone: () => setPathModeOn(false),
      pathEnd: (pts) => {
        const r = rendererRef.current;
        if (!r || !selectedRef.current.size || !startedRef.current) return;
        const keep = pts.length > MAX_PATH_POINTS ? Array.from({ length: MAX_PATH_POINTS }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (MAX_PATH_POINTS - 1))]) : pts; // thin an even sample, ends kept
        const path = keep.map((p) => r.screenToGround(p.x, p.y)).filter(Boolean).map((g) => ({ x: Math.round(g.x * Q), y: Math.round(g.z * Q) }));
        if (!path.length) return;
        const sel = [...selectedRef.current];
        send([{ type: 'movePath', squads: sel, path, formation: formationRef.current }]);
        r.setOrderTarget(sel, null);
        path.forEach((pt) => r.addMarker(pt.x / Q, pt.y / Q, '#a3e635'));
        const end = path[path.length - 1];
        markPending({ kind: 'move', x: end.x / Q, z: end.y / Q, squads: sel, color: '#a3e635' });
      },
      // Placing a building (B10, I177): a finger drags the ghost or taps it somewhere else; only the
      // Build here button builds on a touch screen (a tap is a preview, never a commitment).
      isPlacing: () => armedRef.current?.type === 'place',
      isOnGhost: (p) => {
        const gh = ghostRef.current; const g = rendererRef.current?.screenToGround(p.x, p.y);
        return !!gh && !!g && g.x >= gh.tx - 0.5 && g.x <= gh.tx + gh.size + 0.5 && g.z >= gh.ty - 0.5 && g.z <= gh.ty + gh.size + 0.5;
      },
      placeDrag: (p) => setGhostAt(p),
      placeEnd: () => {},
      selectModeDone: () => setSelectModeOn(false),
      isArmed: () => !!armedRef.current,
      isOnSelectedSquad: (p) => { const idx = ownSquadAt(p); return idx !== null && selectedRef.current.has(idx); },
      hasSelection: () => selectedRef.current.size > 0,
      tap: (p) => pointer('tap', p),
      click: (p, mods) => pointer('left', p, mods),
      order: (p) => pointer('right', p),
      longPress: (p) => { if (selectedRef.current.size) issueAt(p, true); },
      radial: (p) => setRadial({ x: p.x, y: p.y, at: performance.now() }),
      radialSelect: () => setRadial((r) => r && { ...r, at: performance.now() }), // the finger lifted: its click is swallowed (below)
      pan: (dx, dy) => { rendererRef.current?.pan(dx, dy); if (followRef.current && Math.abs(dx) + Math.abs(dy) > 2) setFollow(false); },
      zoom: (factor, x, y) => rendererRef.current?.zoomBy(factor, x, y),
      formationDrag: (s, p) => setDragLine({ x0: s.x, y0: s.y, x1: p.x, y1: p.y }),
      formationEnd: (s, p) => {
        setDragLine(null);
        const r = rendererRef.current;
        const a = r?.screenToGround(s.x, s.y); const b = r?.screenToGround(p.x, p.y);
        if (!a || !b || !selectedRef.current.size) return;
        send([{ type: 'formationLine', squads: [...selectedRef.current], x: Math.round(a.x * Q), y: Math.round(a.z * Q), x2: Math.round(b.x * Q), y2: Math.round(b.z * Q) }]);
        r.addMarker(a.x, a.z); r.addMarker(b.x, b.z);
        markPending({ kind: 'move', x: a.x, z: a.z, x2: b.x, z2: b.z, squads: [...selectedRef.current], color: '#a3e635' });
      },
      lassoDrag: (s, p, o) => setLasso({ poly: o?.polygon, x0: Math.min(s.x, p.x), y0: Math.min(s.y, p.y), x1: Math.max(s.x, p.x), y1: Math.max(s.y, p.y) }),
      lassoEnd: (s, p, mods) => {
        setLasso(null);
        const r = rendererRef.current; const cur = frames.current.cur;
        if (!r || !cur) return;
        const x0 = Math.min(s.x, p.x); const x1 = Math.max(s.x, p.x); const y0 = Math.min(s.y, p.y); const y1 = Math.max(s.y, p.y);
        const ids = cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled).filter((q) => {
          const sp = r.worldToScreen(q.x / Q, q.y / Q);
          return mods?.polygon ? insidePolygon(sp, mods.polygon) : sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1;
        }).map((q) => q.idx);
        updateSelection(mods?.shift ? [...new Set([...selectedRef.current, ...ids])] : ids);
      },
      cancel: () => { setDragLine(null); setLasso(null); setDrawPath(null); }
    }, tapMemory.current);
  }, [pointer, issueAt, ownSquadAt, playerSide, send, updateSelection, setSelectModeOn, setPathModeOn, setGhostAt, setFollow, markPending]);

  // I198: the mouse resting at the screen's edge moves the camera (a mouse only; the HUD's own
  // buttons are not the field, so pointing at them never pans).
  useEffect(() => {
    const el = canvasRef.current;
    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) { edgeRef.current = null; return; }
      const w = wrapRef.current; if (!w) return;
      const rect = w.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      const ex = x < EDGE_PX ? -1 : x > rect.width - EDGE_PX ? 1 : 0;
      const ey = y < EDGE_PX ? -1 : y > rect.height - EDGE_PX ? 1 : 0;
      edgeRef.current = ex || ey ? { x: ex, y: ey } : null;
    };
    const off = () => { edgeRef.current = null; };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', off);
    window.addEventListener('blur', off);
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', off); window.removeEventListener('blur', off); };
  }, []);

  // Keyboard (desktop): space pause, A attack-move, S stop, H hold, R retreat, F follow, Esc deselect,
  // arrow keys move the camera (I198).
  useEffect(() => {
    const keys = panKeysRef.current;
    const onUp = (e) => keys.delete(e.key);
    const clear = () => keys.clear();
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      const sel = [...selectedRef.current];
      if (e.key.startsWith('Arrow')) { e.preventDefault(); keys.add(e.key); }
      else if (e.key === 'f' && sel.length) setFollow(!followRef.current);
      else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (e.key === 'a') { armedRef.current = 'attackMove'; setArmed('attackMove'); }
      else if (e.key === 's' && sel.length) send([{ type: 'stop', squads: sel }]);
      else if (e.key === 'h' && sel.length) send([{ type: 'hold', squads: sel }]);
      else if (e.key === 'r' && sel.length) send([{ type: 'retreat', squads: sel }]);
      else if (e.key === 'Escape') closeX();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', clear); };
  });

  // --- HUD actions -----------------------------------------------------------------------------
  const togglePause = () => {
    const c = clientRef.current; if (!c) return;
    if (!started) { startedRef.current = true; setStarted(true); setPaused(false); rendererRef.current?.setDeployZone(null); audioRef.current?.battleStarted(); c.resume(); return; } // deployment ג†’ battle
    setPaused((p) => { if (p) c.resume(); else c.pause(); return !p; });
  };
  const toggleSound = () => setAudioSettings({ sound: !soundOn });
  const changeSpeed = (s) => { speedRef.current = s; setSpeed(s); clientRef.current?.setSpeed(s); };
  const arm = (mode) => { armedRef.current = armedRef.current === mode ? null : mode; setArmed(armedRef.current); };
  // Commander powers: instant ones fire now; targeted ones arm a crosshair for the next tap.
  const firePower = (power) => {
    if (!power.targeted) { send([{ type: 'power', power: power.id, x: 0, y: 0 }]); return; }
    const same = armedRef.current?.type === 'power' && armedRef.current.id === power.id;
    armedRef.current = same ? null : { type: 'power', id: power.id, label: powerLabel(power.id, power.label) };
    setArmed(armedRef.current);
  };
  const triggerSquadAbility = (abilityId) => {
    const cur = frames.current.cur; if (!cur) return;
    const squads = [...selectedRef.current].filter((i) => cur.squads[i]?.abilities?.some((a) => a.id === abilityId && a.readyIn === 0));
    if (squads.length) send([{ type: 'ability', squads, ability: abilityId }]);
    setRadial(null);
  };
  const cycleFormation = () => { const next = formationRef.current === 'line' ? 'column' : 'line'; formationRef.current = next; setFormation(next); };
  // Selecting by class leaves the camera where it is (I188: moving it made the next tap land
  // somewhere else); Find brings the army into view without touching the selection. Idle workers
  // are still shown, as they may be anywhere.
  const fightersOf = (cur) => cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled && !q.routed && q.classId !== 'worker');
  // Every camera jump from the HUD (Find, Go, the keep, Enemy, Base): a hand on the camera, so a
  // follow ends (I199).
  const lookAt = (x, z) => { rendererRef.current?.centerOn(x, z); setFollow(false); };
  const lookAtSquads = (list) => { if (list.length) lookAt(list.reduce((s, q) => s + q.x, 0) / list.length / Q, list.reduce((s, q) => s + q.y, 0) / list.length / Q); };
  const selectClass = (classId) => {
    const cur = frames.current.cur; if (!cur) return;
    const idle = classId === 'idle' ? new Set(cur.eco?.idleWorkers || []) : null;
    const picked = classId === 'all' ? fightersOf(cur) : classId === 'idleSquads' ? fightersOf(cur).filter(isIdleSquad) : cur.squads.filter((q) => q.side === playerSide && q.alive && q.onField && !q.fled && !q.routed && (idle ? idle.has(q.idx) : q.classId === classId));
    updateSelection(picked.map((q) => q.idx));
    if ((idle || classId === 'idleSquads') && picked.length) lookAtSquads(picked);
  };
  // Rank 6: four control groups. Hold a slot (or tap an empty one) to save the selection, tap to
  // select it, tap again while it is the selection to bring the camera to it. UI only: no orders.
  const [groups, setGroups] = useState([[], [], [], []]);
  const pickGroup = (i, save) => {
    const cur = frames.current.cur; if (!cur) return;
    const sel = [...selectedRef.current];
    if (save || (!groups[i].length && sel.length)) { if (sel.length) setGroups((g) => g.map((x, j) => (j === i ? sel : x))); return; }
    const live = groups[i].map((idx) => cur.squads[idx]).filter((q) => q?.alive && q.onField && !q.fled);
    if (live.length && live.length === sel.length && live.every((q) => selectedRef.current.has(q.idx))) lookAtSquads(live);
    else updateSelection(live.map((q) => q.idx));
  };
  const groupCounts = groups.map((g) => g.filter((idx) => { const q = hud?.squads[idx]; return q?.alive && q.onField && !q.fled; }).length);
  // Find army: the selection if there is one, else the whole army.
  const findArmy = () => {
    const cur = frames.current.cur; if (!cur) return;
    const sel = [...selectedRef.current].map((i) => cur.squads[i]).filter((q) => q?.alive && q.onField);
    lookAtSquads(sel.length ? sel : fightersOf(cur));
  };
  // I196, I197: Enemy: the camera to the enemy's objective as far as you know it (their keep, their
  // base buildings once seen, nearest your army first; each tap the next one), else says why not.
  const showObjective = () => {
    const cur = frames.current.cur; if (!cur) return;
    const own = fightersOf(cur);
    const from = own.length ? { x: own.reduce((s, q) => s + q.x, 0) / own.length / Q, y: own.reduce((s, q) => s + q.y, 0) / own.length / Q } : null;
    const { targets, note, fallback } = enemyObjectives(cur, setup, playerSide, from);
    if (!targets.length) { lookAt(fallback.x, fallback.y); setOrderNote(note); setObjTarget(null); return; }
    const i = objectiveIdxRef.current % targets.length; objectiveIdxRef.current = i + 1;
    const t = targets[i];
    lookAt(t.x, t.y);
    setObjTarget(t.target ? { target: t.target, label: t.label, x: t.x, y: t.y } : null);
    setOrderNote(note || (targets.length > 1 ? tNow('bt.screen.objectiveOf', { label: t.label, i: i + 1, n: targets.length }) : tNow('bt.screen.objectiveOne', { label: t.label })));
  };
  // Attack it: the selection (else the whole army) at the Enemy button's target, with the same
  // ring, marker and pending mark as a tap on it.
  const attackObjective = () => {
    const r = rendererRef.current; const cur = frames.current.cur; const o = objTarget;
    if (!r || !cur || !o) return;
    let sel = [...selectedRef.current].filter((i) => cur.squads[i]?.classId !== 'worker');
    if (!sel.length) sel = fightersOf(cur).map((q) => q.idx);
    if (!sel.length) return;
    send([{ type: 'attack', squads: sel, target: o.target }]);
    r.setOrderTarget(sel, o.target, 'attack');
    r.addMarker(o.x, o.y, '#ef4444', 1.6, 1.4);
    markPending({ kind: 'attack', x: o.x, z: o.y, squads: sel, color: '#ef4444' });
    if (!selectedRef.current.size) updateSelection(sel);
    setObjTarget(null);
    setOrderNote(tNow('bt.screen.attackingIt', { label: o.label }));
  };
  const toggleFollow = () => {
    if (followRef.current) { setFollow(false); return; }
    if (selectedRef.current.size) setFollow(true);
  };
  const toggleMinimap = () => setMinimapOn((on) => { writeFlag(MINIMAP_KEY, !on); return !on; });
  const getRenderer = useCallback(() => rendererRef.current, []);
  const commandSelected = (type) => { const sel = [...selectedRef.current]; if (sel.length) send([{ type, squads: sel }]); setRadial(null); };
  const retreatAll = () => send([{ type: 'retreatAll' }]);
  const switchToAuto = () => {
    const sw = switchRef.current; const c = clientRef.current;
    if (!sw.to || !c?.snapshot) { onAbandon?.(); return; }
    if (sw.asked) return;
    sw.asked = true;
    c.pause();
    c.snapshot();
    // No answer from the sim (it stopped): the last checkpoint, never the start, when there is one.
    sw.timer = setTimeout(() => { if (sw.checkpoint) sw.to(sw.checkpoint); else onAbandon?.(); }, 3000);
  };
  useEffect(() => () => clearTimeout(switchRef.current.timer), []);
  const focusKeep = () => { const k = setup.structures[0]; lookAt(k.x / Q, k.y / Q); };
  // The battle economy's actions.
  // `from`: 'sheet' (the build sheet: it comes back after) or 'panel' (a building's panel: the house
  // when training waits for housing).
  const pickBuilding = (id, from = 'sheet') => {
    flowTo({ type: 'pick', building: id, from });
    setBuildNote(null);
    armedRef.current = { type: 'place', building: id, label: ecoLabel(id, setup.sides[playerSide].ageId) }; setArmed(armedRef.current);
    ghostRef.current = null;
    const w0 = wrapRef.current;
    setGhostAt({ x: (w0?.clientWidth || 800) / 2, y: (w0?.clientHeight || 400) * 0.55 }); // seen at once, before any hover or drag
  };
  const ecoBuilding = hud?.eco && selectedBuilding !== null ? hud.eco.buildings.find((b) => b.idx === selectedBuilding && b.alive) || null : null;
  const ecoInfo = ecoBuilding ? inspectInfo(hud, setup, { kind: 'eco', index: ecoBuilding.idx }, playerSide) : null;
  const seenInfo = !ecoBuilding && inspect ? inspectInfo(hud, setup, inspect, playerSide) : null;
  // An alert's Go: the camera goes there; a squad of yours it is about is selected.
  const alertGo = (a) => {
    lookAt(a.x / Q, a.y / Q);
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
    lookAt(hq.x / Q, hq.y / Q);
  };
  // U12: Battle Supply gained a second, from the last few seconds of frames.
  const supplySamplesRef = useRef([]);
  const [supplyGain, setSupplyGain] = useState(null);
  useEffect(() => {
    if (!hud) return;
    const s = supplySamplesRef.current;
    if (s.length && hud.tick <= s[s.length - 1].tick) { if (hud.tick < s[s.length - 1].tick) s.length = 0; else return; }
    s.push({ tick: hud.tick, v: hud.supply[playerSide] });
    while (s.length > 2 && hud.tick - s[0].tick > 5 * TICK_HZ) s.shift();
    const rate = supplyRate(s);
    setSupplyGain((old) => (old === rate ? old : rate));
  }, [hud, playerSide]);

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
  // The sheet belongs to a selection with laborers: without them it closes (buildFlow.js).
  const hasWorkers = context === 'workers' || context === 'mixed';
  useEffect(() => { if (!hasWorkers && context !== 'place') flowTo({ type: 'noWorkers' }); }, [hasWorkers, context, flowTo]);
  const stopWorkers = () => { const cur = frames.current.cur; const ids = [...selectedRef.current].filter((i) => cur?.squads[i]?.classId === 'worker'); if (ids.length) send([{ type: 'stop', squads: ids }]); };
  // I184: laborers to a site or a damaged building of yours, from its panel (touch and mouse alike):
  // the selected laborers, else idle ones, else the two nearest.
  const sendLaborers = (b) => {
    const cur = frames.current.cur; if (!cur || !b) return;
    const workers = buildersFor(cur, b.x / Q, b.y / Q);
    if (!workers.length) { setBuildNote({ text: tNow('bt.screen.noLaborers'), bad: true }); return; }
    const target = b.proxy ? { kind: 'structure', index: 0 } : { kind: 'eco', index: b.idx };
    send([{ type: b.built ? 'repair' : 'assist', squads: workers, target }]);
    rendererRef.current?.setOrderTarget(workers, target, b.built ? 'repair' : 'assist');
    setBuildNote({ text: tNow('bt.screen.laborersOnWay', { count: workers.length }), bad: false });
  };
  // I173 to I175 (UI06): while a building is in hand, the legal ground for it is tinted (the same
  // rule as the ghost and the sim), the tiles resources take and the field's real edge show.
  const placingType = armed?.type === 'place' ? armed.building : null;
  useEffect(() => {
    if (!placingType) return undefined;
    const paint = () => {
      const r = rendererRef.current; const cur = frames.current.cur;
      if (!r || !cur?.eco) return;
      const own = cur.eco.buildings.filter((b) => b.side === playerSide && b.alive && b.built);
      if (!own.length) { r.ecoLayer.setPlacementOverlay({ cells: new Uint8Array(setup.map.w * setup.map.h) }); return; }
      // the box round every building's reach (the camp's 20 tiles, another building's 10)
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      own.forEach((b) => { const rr = BUILDINGS[b.type]?.hq ? BUILD_RADIUS_HQ : BUILD_RADIUS_OWN; x0 = Math.min(x0, b.x / Q - rr); x1 = Math.max(x1, b.x / Q + rr); y0 = Math.min(y0, b.y / Q - rr); y1 = Math.max(y1, b.y / Q + rr); });
      const cx0 = Math.round((x0 + x1) / 2); const cy0 = Math.round((y0 + y1) / 2);
      const radius = Math.ceil(Math.max(x1 - x0, y1 - y0) / 2);
      r.ecoLayer.setPlacementOverlay(legalArea({ view: cur, setup, side: playerSide, type: placingType, fog: r.lastFog || cur.fog || null, cx: cx0, cy: cy0, radius }));
    };
    paint();
    const t = setInterval(paint, 700);
    return () => { clearInterval(t); rendererRef.current?.ecoLayer.setPlacementOverlay(null); };
  }, [placingType, playerSide, setup]);
  // I186: the build sheet's pictures load with the battle, not on the sheet's first open.
  useEffect(() => { preloadBattleIcons(setup.sides[playerSide]?.ageId); }, [setup, playerSide]);
  // I181: a build order the battle did not take (something unseen stood there) is said.
  useEffect(() => {
    const p = pendingBuildRef.current; const eco = hud?.eco;
    if (!p || !eco) return;
    if (eco.buildings.some((b) => b.side === playerSide && b.type === p.building && b.tx === p.tx && b.ty === p.ty)) { pendingBuildRef.current = null; return; }
    if (hud.tick - p.tick > TICK_HZ) { pendingBuildRef.current = null; setBuildNote({ text: tNow('bt.screen.notPlaced', { unit: ecoLabel(p.building, setup.sides[playerSide].ageId), why: PLACEMENT_REASON.refused.toLowerCase() }), bad: true }); }
  }, [hud, playerSide, setup]);
  useEffect(() => { if (!buildNote) return undefined; const t = setTimeout(() => setBuildNote(null), 4000); return () => clearTimeout(t); }, [buildNote]);
  const note = buildNote ? <div className={`px-1 text-[11px] font-semibold ${buildNote.bad ? 'text-fa-danger-text' : 'text-fa-good'}`} role="status" data-testid="battle-build-note">{buildNote.text}</div> : null;
  let panel = null;
  if (hud?.eco && context === 'place' && ghost) {
    panel = (
      <div className="w-[min(19rem,100%)] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl text-[11.5px]" data-testid="battle-place-panel">
        <div className="px-1 leading-snug"><b>{ecoLabel(ghost.building, ageId)}</b><span className="text-fa-muted"> · {mouse ? tNow('bt.screen.mouseBuild') : tNow('bt.screen.touchBuild')}</span></div>
        <div className="flex items-center gap-1 mt-1">
          <div className={cx('flex-1 min-w-0 px-1 font-semibold leading-tight', ghost.ok ? 'text-fa-good' : 'text-fa-danger-text')} data-testid="battle-place-reason">{ghost.ok ? tNow('bt.screen.goodSpot') : ghost.reason}</div>
          <button type="button" onClick={placeGhost} disabled={!ghost.ok} aria-describedby="battle-place-why" data-testid="battle-place-confirm" className="shrink-0 min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-raised border border-fa-good text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:border-fa-line"><Check className="w-4 h-4" aria-hidden="true" /><span className="leading-none">{tNow('bt.screen.buildHere')}</span></button>
          <button type="button" onClick={() => disarm('cancel')} aria-label={tNow('bt.screen.cancelPlacement')} title={tNow('bt.screen.cancelPlacementEsc')} data-testid="battle-place-cancel" className="shrink-0 w-12 h-12 rounded-full bg-fa-panel border border-fa-line flex items-center justify-center"><GameIcon group="battle" id="close" size={22} fallback={<XIcon className="w-5 h-5" aria-hidden="true" />} /></button>
        </div>
        <span id="battle-place-why" className="sr-only">{ghost.ok ? '' : ghost.reason}</span>
      </div>
    );
  } else if (hud?.eco && hasWorkers && buildMenu) {
    panel = (
      <div className="flex flex-col items-end gap-1">
        <BuildMenu ageId={ageId} stock={hud.eco.stock} workers={hud.eco.workers} onPick={(id) => pickBuilding(id, 'sheet')} onClose={() => flowTo({ type: 'close' })} />
        {note}
      </div>
    );
  } else if (hud?.eco && context === 'workers') {
    // U02, I182: laborers alone: the round hammer opens the build sheet; Stop working is its own
    // glyph, set apart (it halts their work; closing anything never does).
    panel = (
      <div className="flex flex-col items-end gap-1">
        {note}
        <div className="flex items-center gap-3" data-testid="battle-worker-actions">
          <button type="button" onClick={stopWorkers} aria-label={tNow('bt.screen.stopWorking')} title={tNow('bt.screen.stopWorkingTitle')} data-testid="battle-workers-stop"
            className="w-12 h-12 rounded-full bg-fa-panel/95 border border-fa-danger/70 shadow-lg flex items-center justify-center text-fa-danger-text"><GameIcon group="battle" id="stop-working" size={24} fallback={<Ban className="w-5 h-5" aria-hidden="true" />} /></button>
          <WorkerAutoButtons preset={hud.eco.preset} autoRebuild={hud.eco.autoRebuild}
            onPreset={(preset) => send([{ type: 'workerPreset', preset }])} onRebuild={(on) => send([{ type: 'autoRebuild', on }])} />
          <HammerButton onClick={() => flowTo({ type: 'open' })} />
        </div>
      </div>
    );
  } else if (hud?.eco && context === 'building') {
    const damaged = ecoBuilding.hp < ecoBuilding.maxHp;
    panel = (
      <div className="flex flex-col items-end gap-1">
        <BuildingActions building={ecoBuilding} ageId={ageId} stock={hud.eco.stock} eco={hud.eco} paused={started && paused}
          onBuildHouse={() => pickBuilding('house', 'panel')}
          onTrain={(role) => send([{ type: 'train', building: ecoBuilding.idx, role }])}
          onCancel={(slot) => send([{ type: 'cancelTrain', building: ecoBuilding.idx, slot }])}
          rallyArmed={armed?.type === 'rally'}
          onRally={() => { armedRef.current = armedRef.current?.type === 'rally' ? null : { type: 'rally', building: ecoBuilding.idx, label: tNow('bt.screen.rally') }; setArmed(armedRef.current); }} />
        {note}
        {damaged && (
          <button type="button" onClick={() => sendLaborers(ecoBuilding)} data-testid="battle-repair"
            className="min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-panel/95 border border-fa-line text-[11px] font-semibold shadow-lg flex flex-col items-center justify-center gap-0.5">
            <Wrench className="w-4 h-4" aria-hidden="true" /><span className="leading-none">{tNow('bt.screen.repair')}</span>
          </button>
        )}
      </div>
    );
  } else if (hud?.eco && context === 'site') {
    panel = (
      <div className="flex flex-col items-end gap-1">
        {note}
        <div className="flex gap-2">
          <button type="button" onClick={() => sendLaborers(ecoBuilding)} data-testid="battle-site-assist"
            className="min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-panel/95 border border-fa-good text-[11px] font-semibold shadow-lg flex flex-col items-center justify-center gap-0.5">
            <Hammer className="w-4 h-4" aria-hidden="true" /><span className="leading-none">{tNow('bt.screen.sendLaborers')}</span>
          </button>
          <button type="button" onClick={() => { send([{ type: 'cancelBuild', building: ecoBuilding.idx }]); selectBuilding(null); }} data-testid="battle-cancel-build"
            className="min-w-[64px] h-12 px-2 rounded-[10px] bg-fa-panel/95 border border-fa-danger text-fa-danger-text text-[11px] font-semibold shadow-lg flex flex-col items-center justify-center gap-0.5">
            <Ban className="w-4 h-4" aria-hidden="true" /><span className="leading-none">{tNow('bt.screen.cancelConstruction')}</span>
          </button>
        </div>
      </div>
    );
  } else if (note) panel = note;
  // A phone in landscape: the minimap is smaller.
  const compactScreen = typeof window !== 'undefined' && window.innerHeight <= 500;

  return (
    <div ref={wrapRef} className="fixed inset-x-0 top-0 z-[80] bg-fa-ink text-fa-text select-none" style={{ touchAction: 'none', height: 'var(--app-height, 100%)', ...safeStyle }} data-testid="tactical-battle">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
      {/* B10: "Building 43%" over your sites and the reason over a red placement ghost, moved by the render loop */}
      <div ref={siteLabelsRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" />
      <canvas ref={badgesRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" data-testid="battle-squad-flags" />
      <div ref={pendingPinsRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" />
      <div ref={ghostLabelRef} className="absolute start-0 top-0 hidden px-2 py-0.5 rounded-md bg-fa-ink/90 border border-fa-danger text-fa-danger-text text-[11px] font-bold whitespace-nowrap pointer-events-none" data-testid="battle-ghost-reason" />
      {dragLine && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <line x1={dragLine.x0} y1={dragLine.y0} x2={dragLine.x1} y2={dragLine.y1} stroke="#a3e635" strokeWidth="4" strokeDasharray="10 6" strokeLinecap="round" />
        </svg>
      )}
      {drawPath && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full" data-testid="battle-draw-path">
          <polyline points={drawPath.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#a3e635" strokeWidth="4" strokeDasharray="10 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {lasso?.poly && <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"><polygon points={lasso.poly.map((q) => `${q.x},${q.y}`).join(' ')} fill="rgba(163,230,53,0.1)" stroke="#a3e635" strokeWidth="2" /></svg>}
      {lasso && !lasso.poly && <div className="absolute pointer-events-none border-2 border-lime-400 bg-lime-400/10 rounded" style={{ left: lasso.x0, top: lasso.y0, width: lasso.x1 - lasso.x0, height: lasso.y1 - lasso.y0 }} />}
      {radial && (
        // Rank 6: beside the finger and on the screen (radialTop): the commands that matter (attack arms
        // the next tap), then the abilities.
        <div className="absolute z-10 flex flex-col items-center gap-2 max-w-[92vw] -translate-x-1/2" data-testid="battle-radial"
          // the click a phone makes as the long-pressing finger lifts must not hit a button under it
          onClickCapture={(e) => { if (performance.now() - radial.at < 400) { e.stopPropagation(); e.preventDefault(); } }}
          style={{ left: Math.min(Math.max(radial.x, 160), (wrapRef.current?.clientWidth || 400) - 160), top: radialTop(radial.y, wrapRef.current?.clientHeight || 400, selectedAbilities.length) }}>
          <div className="flex flex-wrap justify-center gap-2">
            {[['attackMove', 'bt.hud.attack', () => { arm('attackMove'); setRadial(null); }], ['hold', 'bt.hud.hold'], ['stop', 'bt.hud.stop'],
              [formation, formation === 'line' ? 'bt.hud.line' : 'bt.hud.column', () => { cycleFormation(); setRadial(null); }], ['retreat', 'bt.hud.retreat']].map(([t, label, act]) => (
              <button key={t} type="button" onClick={act || (() => commandSelected(t))} data-testid={`battle-radial-${t}`} className="min-w-[64px] h-11 px-3 rounded-full bg-fa-panel/95 border border-fa-line text-fa-text text-sm font-semibold shadow-xl">{tNow(label)}</button>
            ))}
          </div>
          {selectedAbilities.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {selectedAbilities.map((a) => (
                <button key={a.id} type="button" onClick={() => triggerSquadAbility(a.id)} disabled={a.readyIn > 0}
                  className="min-w-[64px] h-11 px-3 rounded-full bg-fa-raised border border-fa-indep text-fa-text text-xs font-semibold shadow-xl disabled:opacity-40">
                  {abilityLabel(a.id)}{a.readyIn > 0 ? ` ${tNow('bt.hud.secShort', { s: Math.ceil(a.readyIn / TICK_HZ) })}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <BattleHud
        title={title} hud={hud} setup={setup} playerSide={playerSide} timeLeft={timeLeft}
        paused={paused} started={started} speed={speed} armed={armed} formation={formation}
        selectedSquads={selectedSquads}
        onTogglePause={togglePause} onSpeed={changeSpeed} onArm={arm} onFormation={cycleFormation}
        onSelectClass={selectClass} onFindArmy={findArmy} onCommand={commandSelected}
        onRetreatAll={retreatAll} onFocusKeep={focusKeep} onAbandon={onAbandon ? switchToAuto : null}
        onPower={firePower} onAbility={triggerSquadAbility} abilities={selectedAbilities}
        onCancelArmed={() => disarm()}
        onObjective={showObjective}
        follow={follow} onToggleFollow={toggleFollow}
        minimapOn={minimapOn} onToggleMinimap={toggleMinimap}
        minimap={hud ? <BattleMinimap setup={setup} hud={hud} playerSide={playerSide} getRenderer={getRenderer} onMoved={() => setFollow(false)} {...(compactScreen ? { maxW: 150, maxH: 92 } : { maxW: 220, maxH: 136 })} /> : null}
        supplyRate={supplyGain}
        perf={showPerf ? <pre ref={perfRef} className="pointer-events-none m-0 px-2 py-1 rounded bg-black/70 text-[10px] leading-tight text-lime-300 font-mono whitespace-pre overflow-hidden" data-testid="battle-perf" /> : null}
        onOpenBuild={() => flowTo({ type: 'toggle' })} buildOpen={buildMenu} onSelectHq={selectHq} onSteward={(on) => send([{ type: 'steward', on }])}
        groups={groupCounts} onGroup={pickGroup}
        soundOn={soundOn} onToggleSound={toggleSound}
        selectMode={selectMode} onToggleSelectMode={() => setSelectModeOn(!selectModeRef.current)}
        pathMode={pathMode} onTogglePathMode={() => setPathModeOn(!pathModeRef.current)}
        coach={coachOn && !ended ? { steps: coachSteps(mouse), step: coachStep, onNext: () => setCoachStep((s) => (s + 1 >= coachSteps(mouse).length ? -1 : s + 1)), onSkip: () => setCoachStep(-1), holding: coachHold && !paused } : null}
        onFocus={(x, y) => rendererRef.current?.centerOn(x / Q, y / Q)}
        onClearSelection={closeX} mouse={mouse}
        onAlertGo={alertGo} leftCard={leftCard}
        context={context} panel={panel}
        ended={!!ended}
      />
      {refused && !ended && (
        <div className="absolute left-1/2 -translate-x-1/2 z-30 max-w-[min(26rem,calc(100vw-2rem))] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-danger text-[12.5px] leading-snug text-fa-text shadow-xl pointer-events-none" style={{ bottom: NOTE_BOTTOM }} role="status" aria-live="polite" data-testid="battle-orders-refused">{refusedText(refused)}</div>
      )}
      {restartNote && !started && !ended && (
        <div className="absolute left-1/2 -translate-x-1/2 z-30 max-w-[min(26rem,calc(100vw-2rem))] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-danger text-[12.5px] leading-snug text-fa-text shadow-xl pointer-events-none" style={{ top: 56 }} role="status" aria-live="polite" data-testid="battle-resume-rejected">{restartNote}</div>
      )}
      {orderNote && !refused && !ended && (
        <div className="absolute left-1/2 -translate-x-1/2 z-30 max-w-[min(26rem,calc(100vw-2rem))] flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-line text-[12.5px] leading-snug text-fa-text shadow-xl pointer-events-none" style={{ bottom: NOTE_BOTTOM }} role="status" aria-live="polite" data-testid="battle-order-note">
          <span>{orderNote}</span>
          {objTarget && <button type="button" onClick={attackObjective} data-testid="battle-objective-attack" className="pointer-events-auto shrink-0 h-11 px-3 -my-1 rounded-full bg-fa-danger/90 text-white text-sm font-semibold">{tNow('bt.screen.attackIt')}</button>}
        </div>
      )}
      {ended && <BattleResultScreen ended={ended} setup={setup} playerSide={playerSide} title={title} getCampaign={getCampaign} receipt={receipt} onContinue={() => onFinish?.(ended)} />}
      {start && !failure && !ended && <BattleLoading stage={start.stage} fraction={start.fraction} seconds={start.seconds} retry={start.retry} onAuto={() => onAbandon?.()} />}
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
  const [ready, setReady] = useState(() => !needsUnitModels(props.setup) && isSoldierLodReady());
  useEffect(() => {
    prewarmBattleWorker(); // the sim's worker loads while the models do
    if (ready) return undefined;
    let live = true;
    preloadUnitModels(props.setup).then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [ready, props.setup]);
  // The soldiers' models first (each has its own time limit in preloadUnitModels), on the same
  // loading screen as the battlefield's start that follows.
  if (!ready) return <><BattleLoading stage="models" /><BattleRotateGate /></>;
  return <><TacticalBattleView {...props} setup={setup} /><BattleRotateGate /></>;
};

export default TacticalBattleScreen;
