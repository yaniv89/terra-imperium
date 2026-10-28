// src/components/battle/BattleHud.jsx
// The commanded battle's HUD in the Field Atlas look (plans/UI-DESIGN.md B01, B05, B06; Tactical
// Battles plan 11.1), phone first (844x390 and 844x340 with Safari's bars), the battlefield owns the
// screen (CB19: I201, U03). Everything sits inside the usable rectangle: the screen's safe-area
// insets (the notch or Dynamic Island on the left or right in landscape, the home bar below) come in
// as --sa-t, --sa-r, --sa-b, --sa-l on the battle screen (TacticalBattleScreen.jsx), and its height
// follows the visible area (--app-height, src/utils/appViewport.js).
//   top bar      the battle's name (it shrinks first), the clock, food, wood, stone, gold, Battle
//                Supply now/cap (U12, in every battle), population / housing (on a narrow phone, under
//                760 px, these fold into one Stocks button and its card: RTS-02), the enemy squads left,
//                the alert history once there is one (I203), speed and pause. Speed and pause never
//                move (I206): the same two 44 px squares before Start, while paused and in battle
//   bottom left  small buttons only (B10, UI08): All (selects the army, the camera stays: I188),
//                Find (the camera to the selection or the army), Enemy (the camera to the enemy's
//                objective as far as you know it: I196, I197), Base (your camp), Idle n (a laborer), Steward (the economy AI runs your base),
//                Map (the minimap on or off: I196); on a narrow phone Find, Enemy, Base and Map fold
//                behind one View button (RTS-02)
//   bottom right the context panel (B10, AoE style): the actions of the selection only. The wand
//                (U09) is one round button for the selection's abilities and the commander's powers;
//                army: Follow (I199), Attack, Hold, Formation, Retreat; laborers, buildings and
//                placing bring their own `panel`. It scrolls rather than run under the top bar
//   top row      one row under the bar, so nothing in it can overlap (B09): the performance readout
//                when it is on (I205), alerts and the info card (left), the objective, the base count
//                and the selection pill or the deploy card (centre), the city card and the minimap
//                (right)
//   alerts (B06) at most two, each for 8 seconds, with Go; all of them in the history (I203)
//   coach        the first battle on this device: three short steps on the controls, Next or Skip,
//                never a modal and never holding the clock (RTS-01, battleCoach.js)
//   pause (B06)  a narrow sheet on the right (I207): Resume, speed, Switch to Auto and Retreat set
//                apart, sound, the powers, the tally
//   city (B05)   in a city assault: the defender's housing as houses burn (folded at first: I202)
// Every control is at least 44 px.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Crosshair, Hand, Rows, Columns, Flag, Castle, X, Zap, Hammer, Tent, BoxSelect, AlertTriangle, Undo2, Volume2, VolumeX, Home, ChevronUp, ChevronDown, Swords, Wand2, Target, Map as MapIcon, Navigation, Spline, Bell, Users, LocateFixed, Package, Compass, UserCog } from 'lucide-react';
import { ResIcon, resName, HammerButton } from './EconomyHud';
import GameIcon from '../ui/GameIcon';
import { RESOURCES } from '../../battle/data/economy';
import { ASSIMILATION_TICKS } from '../../battle/sim/objectives';
import { BATTLE_TYPES } from '../../battle/setup/battleType';
import { TICK_HZ } from '../../battle/sim/constants';
import { selectionSummary, cityAssaultView, nextAlerts, visibleAlerts, minutesLeft, armyTally, armyTallyText, supplyView, strengthShare, lootView, objectiveLine } from './battleHudModel';
import { menText } from '../../engine/battleLedger';
import { deployHelp, cameraHelp } from './battleCoach';
import { useT } from '../../i18n/useT';
import { useCornerSheet } from '../../hooks/useExclusivePanel';
import { abilityLabel, powerLabel, structureLabel, battleTypeText, battleGoal, buildingEffect } from './battleText';
import { structureName } from './inspectModel';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cx = (...p) => p.filter(Boolean).join(' ');
const SPEEDS = [1, 2, 3];
const STRUCTURE_WORD = { keep: 'keep', tower: 'tower', gate: 'gate', wall: 'wall', house: 'house', building: 'building', palace: 'palace', wonder: 'wonder', landmark: 'landmark', townhall: 'town hall' };

// The usable rectangle (U03): the safe-area insets, never less than a small gutter.
const SAFE_L = 'max(0.5rem, var(--sa-s, 0px))'; // the start side (left, right in Hebrew)
const SAFE_R = 'max(0.5rem, var(--sa-e, 0px))'; // the end side
const SAFE_B = 'max(0.375rem, var(--sa-b, 0px))';
const TOP_BAR = 'calc(2.875rem + var(--sa-t, 0px))';
const UNDER_BAR = 'calc(3.25rem + var(--sa-t, 0px))';
const ABOVE_BOTTOM = 'calc(max(0.375rem, var(--sa-b, 0px)) + 3.6rem)';

const useMedia = (q) => {
  const [hit, setHit] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q); if (!m) return undefined;
    const on = () => setHit(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [q]);
  return hit;
};
/** A short screen (a phone in landscape, Safari's bars showing): sheets get the room first. */
const useShortScreen = () => useMedia('(max-height: 480px)');
/** A narrow phone (667 px and the like, RTS-02): the stocks and the camera buttons fold away. */
export const NARROW_QUERY = '(max-width: 760px)';
/** Rank 6: a fighting squad of yours with nothing to do (no order, no target, not in a building). */
export const isIdleSquad = (q) => q.classId !== 'worker' && q.order === 'idle' && q.target < 0 && !q.routed && !(q.inside >= 0);

/** A labelled command button (B01: always a text label), 48 px. */
const Cmd = ({ icon: Icon, glyph, label, onClick, active, danger, disabled, testId, className, ariaLabel }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} aria-pressed={active === undefined ? undefined : !!active} aria-label={ariaLabel}
    className={cx('shrink-0 min-w-[46px] h-11 px-1.5 rounded-[10px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold border shadow-lg disabled:opacity-40',
      active ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text text-fa-text' : danger ? 'bg-fa-panel/95 border-fa-danger text-fa-danger-text' : 'bg-fa-panel/95 border-fa-line text-fa-text', className)}>
    {glyph || (Icon && <Icon className="w-4 h-4" aria-hidden="true" />)}
    <span className="leading-none whitespace-nowrap">{label}</span>
  </button>
);

/** Rank 6: a control group slot: tap selects (an empty one saves the selection), a hold saves it. */
const HOLD_MS = 450;
const GroupSlot = ({ n, count, onUse, label }) => {
  const timer = useRef(null); const held = useRef(false);
  const down = () => { held.current = false; timer.current = setTimeout(() => { held.current = true; onUse(true); }, HOLD_MS); };
  const up = () => clearTimeout(timer.current);
  return (
    <button type="button" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()} onClick={() => { if (!held.current) onUse(false); }}
      aria-label={label} data-testid={`battle-group-${n}`}
      className={cx('shrink-0 w-11 h-11 rounded-[10px] flex flex-col items-center justify-center border shadow-lg leading-none', count ? 'bg-fa-panel/95 border-fa-brass text-fa-text' : 'bg-fa-panel/70 border-dashed border-fa-line text-fa-muted')}>
      <span className="text-[15px] font-bold fa-num">{n}</span>
      <span className="text-[10px] fa-num">{count ? count : '+'}</span>
    </button>
  );
};

/** Why a power cannot be used now, or null. */
const powerBlock = (pw, supply, t) => (pw.usesLeft <= 0 ? t('bt.hud.noneLeft')
  : pw.readyIn > 0 ? t('bt.hud.readyIn', { s: Math.ceil(pw.readyIn / TICK_HZ) })
    : supply < pw.cost ? t('bt.hud.needsSupply', { cost: pw.cost, have: Math.floor(supply) }) : null);

/** A power card (the pause sheet): a label and its state. */
const PowerCard = ({ pw, armed, supply, onClick }) => {
  const { t } = useT();
  const block = powerBlock(pw, supply, t);
  const state = pw.readyIn > 0 ? t('bt.hud.secShort', { s: Math.ceil(pw.readyIn / TICK_HZ) }) : pw.cost ? t('bt.hud.costSupply', { cost: pw.cost }) : t('bt.hud.ready');
  return (
    <button type="button" disabled={!!block} onClick={onClick} aria-pressed={armed || undefined} title={block || undefined}
      className={cx('min-w-0 min-h-[48px] px-2 rounded-[10px] border shadow-lg flex flex-col items-center justify-center text-center disabled:opacity-45',
        armed ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-line')}>
      <span className="text-[11px] font-semibold leading-tight flex items-center gap-1"><Zap className="w-3 h-3" aria-hidden="true" />{powerLabel(pw.id, pw.label)}</span>
      <span className={cx('fa-num text-[10px] leading-tight', pw.readyIn > 0 ? 'text-fa-muted' : 'text-fa-good')}>{state}{Number.isFinite(pw.usesLeft) ? t('bt.hud.usesLeft', { n: pw.usesLeft }) : ''}</span>
    </button>
  );
};

/** U09: the round wand (no visible text) for the selection's abilities and the commander's powers;
 * a dot says something is ready. */
const WandButton = ({ open, ready, onClick }) => {
  const { t } = useT();
  return (
  <button type="button" onClick={onClick} aria-label={ready ? t('bt.hud.wandReady', { n: ready }) : t('bt.hud.wand')} title={t('bt.hud.wand')} aria-expanded={open} data-testid="battle-wand"
    className={cx('relative shrink-0 w-11 h-11 rounded-full shadow-lg flex items-center justify-center border', open ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-indep text-fa-text')}>
    <Wand2 className="w-6 h-6" aria-hidden="true" />
    {ready > 0 && <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-fa-good text-fa-ink text-[10px] font-bold leading-[18px] text-center fa-num" aria-hidden="true">{ready}</span>}
  </button>
  );
};

/** A top-bar number with its picture (B09: icons, not words, on a phone). */
const Res = ({ icon, label, value, warn, testId }) => (
  <span className={cx('flex items-center gap-1 shrink-0', warn && 'text-fa-danger-text')} title={label} aria-label={`${label} ${value}`} data-testid={testId}>
    {icon}<span className="fa-num text-[13px] font-semibold">{value}</span>
  </span>
);

const BattleHud = ({
  title, hud, setup, playerSide, timeLeft, paused, started, speed, armed, formation, selectedSquads,
  onTogglePause, onSpeed, onArm, onFormation, onSelectClass, onFindArmy, onCommand, onRetreatAll, onFocusKeep, onAbandon,
  onPower, onAbility, abilities = [], soundOn = true, onToggleSound,
  onOpenBuild, buildOpen = false, onSelectHq, onSteward, // the battle economy (EconomyHud.jsx)
  context = 'none', panel = null, // the context panel (B10): battleHudModel contextFor, and its content for laborers, buildings and placing
  selectMode = false, onToggleSelectMode, // touch box select (UI-DESIGN B04)
  pathMode = false, onTogglePathMode, // touch: draw a path for the selected squads (U38)
  coach = null, // RTS-01: { steps: [{ title, text }], step, onNext, onSkip, holding (the clock waits) } in the first battle on this device
  onFocus, // centre the camera on (x, y) in sim units: the alerts' Go
  onClearSelection, // the selection card's x: let go of every selected squad
  onAlertGo, // an alert's Go: centre on it, select the squad when it is yours (TacticalBattleScreen.jsx)
  onCancelArmed, // the armed power's X
  onObjective, // I196: the camera to the enemy's objective
  follow = false, onToggleFollow, // I199: the camera follows the selection
  minimap = null, minimapOn = false, onToggleMinimap, // I196
  supplyRate = null, // U12: Battle Supply gained a second
  perf = null, // I205: the performance readout, given a slot of its own
  leftCard = null, // the info card / building panel, under the alerts in the top row
  groups = null, onGroup, // rank 6: the control groups' live squad counts; onGroup(i, save)
  mouse = false, // a mouse is the main pointer: the hints speak of clicks
  narrow: narrowProp, // tests: force the narrow phone layout (else the screen's width decides)
  ended = false // the battle is over: only the top bar stays (the result screen, B08, owns the rest)
}) => {
  const { t } = useT();
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  // I202: the city's housing card starts folded (a chip); the player opens it when it matters.
  const [cityOpen, setCityOpen] = useState(false);
  // The pause sheet can be put aside to give orders while paused (a pill brings it back).
  const [sheetHidden, setSheetHidden] = useState(false);
  useEffect(() => { if (!paused) setSheetHidden(false); }, [paused]);
  const [wandOpen, setWandOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deployFolded, setDeployFolded] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false); // the attrition chip's why, on a tap (a phone has no hover title)
  const [stocksOpen, setStocksOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  // On a phone one battle overlay shows at a time (the radial too, TacticalBattleScreen): the one opened last.
  useCornerSheet('battle-wand', wandOpen, () => setWandOpen(false));
  useCornerSheet('battle-supply', supplyOpen, () => setSupplyOpen(false));
  useCornerSheet('battle-history', historyOpen, () => setHistoryOpen(false));
  useCornerSheet('battle-stocks', stocksOpen, () => setStocksOpen(false));
  useCornerSheet('battle-view', viewOpen, () => setViewOpen(false));
  useCornerSheet('battle-pause', !!hud && !ended && started && paused && !sheetHidden, () => setSheetHidden(true));
  const short = useShortScreen();
  const narrowMedia = useMedia(NARROW_QUERY);
  const narrow = narrowProp ?? narrowMedia;
  const [alerts, setAlerts] = useState([]);
  const prevRef = useRef(null);
  const lastRef = useRef({});
  const baseMaxRef = useRef([1, 1]); // the most base buildings each side (yours, theirs) has had: the base bars' full width
  // B06: alerts from what changed since the last frame.
  useEffect(() => {
    if (!hud) return;
    const fresh = nextAlerts(prevRef.current, hud, playerSide, setup, lastRef.current);
    prevRef.current = hud;
    if (!fresh.length) return;
    fresh.forEach((a) => { if (a.kind === 'workers') lastRef.current.workers = a.tick; });
    setAlerts((list) => [...list.filter((a) => !fresh.some((f) => f.id === a.id)), ...fresh].slice(-20));
  }, [hud, playerSide, setup]);
  // Esc closes the open sheet first (the wand, the supply card, the history) before the battle
  // screen's own Esc (let go of the selection) sees it.
  const anySheet = wandOpen || supplyOpen || historyOpen || stocksOpen || viewOpen;
  useEffect(() => {
    if (!anySheet) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setWandOpen(false); setSupplyOpen(false); setHistoryOpen(false); setStocksOpen(false); setViewOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [anySheet]);
  if (!hud) return null;

  const mine = hud.squads.filter((q) => q.side === playerSide && q.alive && !q.fled);
  const onField = mine.filter((q) => q.onField);
  const eco = hud.eco || null;
  // Base buildings standing (sim/base.js): [yours, theirs], null in a battle without bases.
  const base = hud.base ? [hud.base[playerSide], hud.base[1 - playerSide]] : null;
  if (base) baseMaxRef.current = [Math.max(1, baseMaxRef.current[0], base[0]), Math.max(1, baseMaxRef.current[1], base[1])];
  const baseMax = baseMaxRef.current;
  // Allied reinforcements still marching in on their own (U10: nobody calls them).
  const marching = mine.filter((q) => q.reinforcement && !q.onField && q.enterTick >= 0);
  const keep = setup?.battleType === 'naval' ? null : hud.structures[0]; // a sea battle's anchorage is no objective
  const supply = hud.supply[playerSide];
  const sup = supplyView(hud, setup, playerSide, supplyRate);
  const enemyLeft = hud.squads.filter((q) => q.side !== playerSide && q.alive && !q.fled).length;
  const sel = selectionSummary(selectedSquads);
  const target = selectedSquads.find((q) => q.targetKind === 'structure' && q.target >= 0);
  const targetSt = target ? hud.structures[target.target] : null;
  const city = cityAssaultView(hud, setup);
  const { shown: shownAlerts, history } = visibleAlerts(alerts, hud.tick, short ? 1 : 2); // a phone keeps one on the field at a time
  const pauseOpen = started && paused && !sheetHidden;
  const bt = BATTLE_TYPES[hud.battleType || 'field'];
  const youPct = Math.round(strengthShare(hud, playerSide) * 100);
  const themPct = Math.round(strengthShare(hud, 1 - playerSide) * 100);
  const objective = objectiveLine(hud, setup, playerSide, battleGoal);
  const loot = lootView(hud, setup);
  const lootWarn = !!loot && loot.burned >= loot.needed - 1;
  const allCount = onField.filter((q) => q.classId !== 'worker').length;
  const idleSquads = started ? onField.filter(isIdleSquad).length : 0;
  const powerCards = hud.powers || [];
  // Rally Cry (a power the side brought): +30 morale for the whole army, the cure for Shaken.
  const rallyCry = powerCards.find((pw) => pw.id === 'rallyCry') || null;
  const rallyReady = !!rallyCry && rallyCry.readyIn <= 0 && rallyCry.usesLeft > 0 && supply >= rallyCry.cost;
  // The context panel (B10): which group of actions shows.
  const armyCtx = context === 'army' || context === 'mixed';
  const idleCtx = context === 'none' || context === 'inspect';
  const wandItems = (armyCtx ? abilities.length : 0) + ((armyCtx || idleCtx) ? powerCards.length : 0);
  const showWand = (armyCtx || idleCtx) && wandItems > 0;
  const wandReady = (armyCtx ? abilities.filter((a) => a.readyIn <= 0).length : 0) + powerCards.filter((pw) => !powerBlock(pw, supply, t)).length;
  const firePower = (pw) => { setWandOpen(false); onPower(pw); };
  // The minimap gives way to a tall sheet on a short screen.
  const bigSheet = buildOpen || ['building', 'site', 'place'].includes(context) || wandOpen;
  const showMinimap = minimapOn && minimap && !pauseOpen && !(short && bigSheet);
  // Find, Enemy, Base and Map (the camera and the minimap): in a row, or behind View on a narrow phone.
  const viewButtons = [
    onFindArmy && { glyph: <GameIcon group="battle" id="find-army" size={18} halo={false} fallback={<LocateFixed className="w-4 h-4" aria-hidden="true" />} />, label: t('bt.hud.find'), onClick: onFindArmy, disabled: !allCount && !selectedSquads.length, testId: 'battle-find-army', ariaLabel: t('bt.hud.findAria') },
    onObjective && { icon: Target, label: t('bt.hud.enemy'), onClick: onObjective, testId: 'battle-objective', ariaLabel: t('bt.hud.enemyAria') },
    eco && { icon: Tent, label: t('bt.hud.baseBtn'), onClick: onSelectHq, testId: 'battle-hq', ariaLabel: t('bt.hud.yourCamp') },
    onToggleMinimap && { icon: MapIcon, label: t('bt.hud.map'), onClick: () => (minimapOn && !showMinimap && wandOpen ? setWandOpen(false) : onToggleMinimap()), active: showMinimap, testId: 'battle-minimap-toggle', ariaLabel: t('bt.hud.minimap') }
  ].filter(Boolean);
  const naval = setup.battleType === 'naval';
  const goal = naval ? t('bt.hud.goalSea') : setup.battleType === 'raid' || setup.battleType === 'sack'
    ? `${battleGoal(setup.battleType, playerSide)}.`
    : setup.economy
      ? (playerSide === 1 ? t('bt.hud.goalEcoDef') : t('bt.hud.goalEcoAtk'))
      : playerSide === 1 ? t('bt.hud.goalDef') : t('bt.hud.goalAtk');
  const supplyText = sup.cap ? t('bt.hud.supplyLine', { now: sup.now, cap: sup.cap }) : t('bt.hud.supplyLineNoCap', { now: sup.now });
  const supplyPays = `${sup.costs.length ? t('bt.hud.paysFor', { list: sup.costs.map((c) => `${powerLabel(c.id, c.label)} ${c.cost}`).join(', ') }) : t('bt.hud.noPowers')} ${t('bt.hud.risesOn')}`;
  const supplyOf = sup.cap ? t('bt.hud.supplyOf', { now: sup.now, cap: sup.cap }) : String(sup.now);

  // The deploy card sits on the far side from your army, above the bottom row, in either language (playtest 40651418969
  // steps 3, 103, 255: in the centre it covered the fleet). The field never mirrors, so the side is physical.
  const deployCard = !started && (
            // The deploy card (playtest 40651418969 step 3): Start never scrolls or folds away; the chevron folds the words to a slim bar.
            <div className="absolute pointer-events-auto w-[min(20rem,calc(100vw-1rem))] px-3 py-2 fa-panel !bg-fa-panel/95 text-[12px] leading-snug shadow-xl flex flex-col" style={{ bottom: ABOVE_BOTTOM, ...(playerSide === 1 ? { left: 'max(0.5rem, var(--sa-l, 0px))' } : { right: 'max(0.5rem, var(--sa-r, 0px))' }), maxHeight: `calc(var(--app-height, 100vh) - ${short ? '9.5rem' : '11rem'} - var(--sa-t, 0px) - var(--sa-b, 0px))` }} data-testid="battle-deploy-help">
              <div className="flex items-center gap-2 shrink-0">
                <div className="min-w-0 flex-1">
                  {title && <div className="fa-label truncate lg:hidden" data-testid="battle-deploy-title">{title}</div>}
                  <div className="fa-heading text-[15px] truncate">{t(naval ? 'bt.hud.deploySea' : 'bt.hud.deploy')}</div>
                </div>
                {deployFolded && <button type="button" onClick={onTogglePause} className="fa-btn fa-btn-primary !min-h-[44px] !px-3 shrink-0" data-testid="battle-start">{t('bt.hud.start')}</button>}
                <button type="button" onClick={() => setDeployFolded((v) => !v)} aria-expanded={!deployFolded} aria-label={deployFolded ? t('bt.hud.moreAbout') : t('bt.hud.foldDeploy')} data-testid="battle-deploy-more"
                  className="w-11 h-11 -my-2 -me-2 shrink-0 flex items-center justify-center text-fa-muted">{deployFolded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
              </div>
              {!deployFolded && <>
                <div className={cx('min-h-0 overflow-y-auto overscroll-contain', short && 'max-h-[6.75rem]')} data-testid="battle-deploy-details">
                  <div data-testid="battle-deploy-controls">{deployHelp(mouse, naval)}</div>
                  <div className="mt-1 text-fa-brass"><span className="fa-num">{fmtTime(timeLeft)}</span>: {goal}</div>
                  {setup.economy && <div className="mt-1 text-fa-you" data-testid="battle-recruit-hint">{t('bt.hud.recruitHint')}</div>}
                  {setup.structures.some((st) => st.kind === 'building') && (
                    <div className="mt-1 text-fa-you" data-testid="battle-buildings">
                      {playerSide === 1 ? t('bt.hud.yourBuildings') : t('bt.hud.theirBuildings')}
                      {setup.structures.filter((st) => st.kind === 'building').map((st) => `${structureName(st)} (${buildingEffect(st.category, t('bt.hud.landmark'))})`).join(', ')}
                    </div>
                  )}
                  {setup.economy && <div className="mt-1 text-fa-muted">{t('bt.hud.baseNote', { what: playerSide === 1 ? t('bt.hud.keepWord') : t('bt.hud.campWord') })}</div>}
                  <div className="mt-1 text-fa-muted">{cameraHelp(mouse)} {t(naval ? 'bt.hud.everyShip' : 'bt.hud.everyRegiment')}</div>
                </div>
                <button type="button" onClick={onTogglePause} className="fa-btn fa-btn-primary w-full !min-h-[44px] mt-1.5 shrink-0" data-testid="battle-start">{t('bt.hud.start')}</button>
              </>}
            </div>
  );
  return (
    <>
      {/* Top bar (B01): name and clock, resources, speed and pause (I206: fixed slots on the right) */}
      <div className="absolute top-0 inset-x-0 flex items-center gap-2 bg-fa-ink/90 border-b border-fa-line text-fa-text pointer-events-auto" style={{ height: TOP_BAR, paddingTop: 'var(--sa-t, 0px)', paddingLeft: SAFE_L, paddingRight: SAFE_R }} data-testid="battle-top-bar">
        <span className="fa-heading text-[15px] truncate min-w-[8rem] hidden lg:inline" style={{ flex: '0 1000 auto' }} data-testid="battle-title">{title || t('bt.hud.battle')}</span>
        {!ended && <><span data-testid="battle-clock" title={`${battleTypeText(hud.battleType || 'field', 'label')}: ${battleGoal(hud.battleType || 'field', playerSide)}`}
          className={cx('fa-num text-[15px] font-semibold shrink-0', timeLeft <= 30 ? 'text-fa-danger-text animate-pulse' : timeLeft <= 60 ? 'text-fa-brass' : '')}>{fmtTime(timeLeft)}</span>
        <span className="w-px h-5 bg-fa-line shrink-0" aria-hidden="true" /></>}
        {!ended && <div className="min-w-0 flex items-center gap-2.5 lg:gap-3 overflow-x-auto scrollbar-none" style={{ flex: '1 1 auto' }} data-testid="battle-resources">
          {narrow ? (
            // RTS-02: on a narrow phone the stocks, supply and housing are one button and a card.
            <button type="button" onClick={() => { setStocksOpen((v) => !v); setSupplyOpen(false); }} aria-expanded={stocksOpen} data-testid="battle-logistics"
              aria-label={`${t('bt.hud.stocksAria', { supply: supplyOf })}${sup.low ? `, ${t('bt.hud.lowTag')}` : ''}${eco && eco.pop >= eco.cap ? `, ${t('bt.hud.housingFullTag')}` : ''}`}
              className={cx('relative shrink-0 h-11 -my-1 min-w-[44px] flex items-center gap-1 px-1.5 rounded-md', stocksOpen && 'bg-fa-raised', sup.low && 'text-fa-danger-text')}>
              <Package className="w-4 h-4" aria-hidden="true" />
              <ResIcon res="supply" size={16} />
              <span className="fa-num text-[13px] font-semibold">{sup.now}</span>
              {((eco && eco.pop >= eco.cap) || sup.low) && <span className="absolute top-1 end-0.5 w-2 h-2 rounded-full bg-fa-danger" aria-hidden="true" />}
            </button>
          ) : <>
          {eco && RESOURCES.map((r, i) => <Res key={r} icon={<ResIcon res={r} size={18} />} label={resName(r)} value={eco.stock[i]} testId={`battle-stock-${r}`} />)}
          {/* U12: Battle Supply in every battle, now and the cap; a tap explains it */}
          <button type="button" onClick={() => setSupplyOpen((v) => !v)} aria-expanded={supplyOpen} data-testid="battle-supply"
            aria-label={`${t('bt.hud.supplyAria', { supply: supplyOf })}${sup.low ? `, ${t('bt.hud.lowTag')}` : ''}`} title={t('bt.hud.battleSupply')}
            className={cx('shrink-0 h-11 -my-1 flex items-center gap-1 px-1 rounded-md', sup.low && 'text-fa-danger-text', supplyOpen && 'bg-fa-raised')}>
            <ResIcon res="supply" size={18} />
            <span className="fa-num text-[13px] font-semibold">{sup.now}{sup.cap ? <span className="text-fa-muted font-normal">/{sup.cap}</span> : null}</span>
          </button>
          {eco && <Res icon={<ResIcon res="population" size={18} />} label={t('bt.hud.popHousing')} value={`${eco.pop}/${eco.cap}`} warn={eco.pop >= eco.cap} />}
          </>}
          <Res icon={<Swords className="w-4 h-4 text-fa-enemy" aria-hidden="true" />} label={t('bt.hud.enemyLeft', { tally: armyTallyText(armyTally(hud, 1 - playerSide)) })} value={enemyLeft} />
        </div>}
        {history.length > 0 && !ended && (
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-label={t('bt.hud.alertsCount', { n: history.length })} aria-expanded={historyOpen} data-testid="battle-alert-history"
            className={cx('fa-icon-btn !w-11 !h-11 shrink-0 relative', historyOpen && '!bg-fa-raised')}>
            <Bell className="w-4 h-4" aria-hidden="true" />
            <span className="absolute top-0.5 end-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-fa-raised border border-fa-line text-[9.5px] leading-[14px] fa-num" aria-hidden="true">{history.length}</span>
          </button>
        )}
        {ended ? null : narrow ? (
          <button type="button" onClick={() => onSpeed(speed === 1 ? 2 : speed === 2 ? 3 : 1)} aria-label={t('bt.hud.speedFaster', { n: speed })} data-testid="battle-speed" className="fa-icon-btn !w-11 !h-11 shrink-0 fa-num text-[13px] font-semibold">{speed}×</button>
        ) : (
          // Playtest 15: one cycling button overshot the speed you wanted; three buttons say it outright.
          <div role="radiogroup" aria-label={t('bt.hud.speed')} className="flex shrink-0" data-testid="battle-speed">
            {SPEEDS.map((s) => <button key={s} type="button" role="radio" aria-checked={speed === s} aria-label={t('bt.hud.speedN', { n: s })} onClick={() => onSpeed(s)} data-testid={`battle-speed-${s}`}
              className={cx('fa-icon-btn !w-11 !h-11 !rounded-none first:!rounded-s-[10px] last:!rounded-e-[10px] fa-num text-[13px] font-semibold', speed === s && '!bg-fa-raised !text-fa-text outline outline-2 -outline-offset-2 outline-fa-text')}>{s}×</button>)}
          </div>
        )}
        {/* a clear gap: a tap aimed at 3x must never open the pause sheet (playtest 40650979770 step 12) */}
        {!ended && <button type="button" onClick={onTogglePause} aria-label={!started ? t('bt.hud.start') : paused ? t('bt.hud.resume') : t('bt.hud.pause')} data-testid="battle-pause"
          className={cx('fa-icon-btn !w-11 !h-11 shrink-0 ms-3', !started && '!bg-fa-brass !text-fa-ink !border-transparent')}>
          {!started || paused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
        </button>}
      </div>

      {stocksOpen && narrow && !ended && (
        <div className="absolute z-20 w-[min(19rem,calc(100vw-2rem))] max-h-[calc(var(--app-height,100vh)-4rem)] overflow-y-auto fa-panel !bg-fa-panel/95 shadow-2xl p-2.5 pe-1 text-[12px] leading-snug pointer-events-auto" style={{ top: UNDER_BAR, insetInlineEnd: SAFE_R }} role="dialog" aria-label={t('bt.hud.stocksCard')} data-testid="battle-logistics-card">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {eco && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                  {RESOURCES.map((r, i) => <Res key={r} icon={<ResIcon res={r} size={18} />} label={resName(r)} value={eco.stock[i]} testId={`battle-stock-${r}`} />)}
                  <Res icon={<ResIcon res="population" size={18} />} label={t('bt.hud.popHousing')} value={`${eco.pop}/${eco.cap}`} warn={eco.pop >= eco.cap} />
                </div>
              )}
              {eco && eco.pop >= eco.cap && <div className="text-fa-danger-text font-semibold mb-1">{t('bt.hud.housingFull')}</div>}
              <div className="font-semibold flex items-center gap-1 fa-num" data-testid="battle-supply"><ResIcon res="supply" size={16} /><span>{supplyText}{sup.rate ? <span className="text-fa-good">{t('bt.hud.perSecond', { n: sup.rate })}</span> : null}</span></div>
              {sup.low && <div className="text-fa-danger-text font-semibold">{t('bt.hud.lowSupply')}</div>}
              <div className="mt-1">{supplyPays}</div>
            </div>
            <button type="button" onClick={() => setStocksOpen(false)} aria-label={t('bt.close')} className="w-11 h-11 -my-2 shrink-0 flex items-center justify-center text-fa-muted"><X className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {supplyOpen && !ended && (
        <div className="absolute z-20 w-[min(19rem,calc(100vw-2rem))] fa-panel !bg-fa-panel/95 shadow-2xl p-2.5 pe-1 text-[12px] leading-snug pointer-events-auto" style={{ top: UNDER_BAR, insetInlineEnd: SAFE_R }} role="dialog" aria-label={t('bt.hud.battleSupply')} data-testid="battle-supply-card">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold fa-num">{supplyText}{sup.rate ? <span className="text-fa-good">{t('bt.hud.perSecond', { n: sup.rate })}</span> : null}</div>
              {sup.low && <div className="text-fa-danger-text font-semibold">{t('bt.hud.lowSupply')}</div>}
              <div className="mt-1">{supplyPays}</div>
              <div className="mt-1 text-fa-muted">{t('bt.hud.notCampaignSupply')}</div>
            </div>
            <button type="button" onClick={() => setSupplyOpen(false)} aria-label={t('bt.close')} className="w-11 h-11 -my-2 shrink-0 flex items-center justify-center text-fa-muted"><X className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {!ended && <>
      {/* B09 top row: alerts and the info card (left), the objective and the selection (centre), the
          city and the minimap (right), side by side in one row so they never cover each other */}
      <div className="absolute flex items-start gap-2 pointer-events-none" style={{ top: UNDER_BAR, insetInlineStart: SAFE_L, insetInlineEnd: SAFE_R }} data-testid="battle-top-row">
        <div className="w-[min(15rem,32vw)] lg:w-[17rem] shrink-0 flex flex-col gap-1.5">
          {perf}
          {historyOpen && (
            <div className="pointer-events-auto fa-panel !bg-fa-panel/95 shadow-2xl p-1.5 max-h-[50vh] overflow-y-auto" data-testid="battle-alert-list" role="log" aria-label={t('bt.hud.alertsThisBattle')}>
              <div className="flex items-center justify-between ps-1"><span className="fa-label">{t('bt.hud.alerts')}</span>
                <button type="button" onClick={() => setHistoryOpen(false)} aria-label={t('bt.hud.closeAlerts')} className="w-11 h-11 -my-1.5 flex items-center justify-center text-fa-muted"><X className="w-4 h-4" aria-hidden="true" /></button></div>
              {history.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 ps-1 border-t border-fa-line/50">
                  <span className="min-w-0 flex-1 text-[11.5px] leading-tight py-1"><span className={cx('font-semibold', a.tone === 'good' ? 'text-fa-good' : 'text-fa-danger-text')}>{a.title}</span> <span className="text-fa-muted">{t('bt.ago', { time: fmtTime(Math.max(0, Math.round((hud.tick - a.tick) / TICK_HZ))) })}</span></span>
                  {(onAlertGo || onFocus) && <button type="button" onClick={() => (onAlertGo ? onAlertGo(a) : onFocus(a.x, a.y))} className="fa-btn fa-btn-ghost !min-h-[44px] !px-2.5 shrink-0">{t('bt.go')}</button>}
                </div>
              ))}
            </div>
          )}
          {shownAlerts.length > 0 && !pauseOpen && !historyOpen && (
            <div className="space-y-1" data-testid="battle-alerts">
              {shownAlerts.map((a) => (
                // The whole alert is its Go (playtest 40651418969 step 232: a tap beside the small Go missed it).
                <div key={a.id} onClick={() => (onAlertGo ? onAlertGo(a) : onFocus?.(a.x, a.y))} className={cx('pointer-events-auto flex items-center gap-1.5 ps-2 rounded-[10px] bg-fa-panel/95 border shadow-xl cursor-pointer', a.tone === 'good' ? 'border-fa-good/70' : 'border-fa-danger/80')} role="status">
                  {a.tone === 'good' ? <Flag className="w-4 h-4 shrink-0 text-fa-good" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-fa-danger-text" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 text-[12px] font-semibold leading-tight truncate" title={a.detail}>{a.title}</span>
                  {a.kind === 'shaken' && rallyCry && <button type="button" onClick={(e) => { e.stopPropagation(); onPower(rallyCry); }} disabled={!rallyReady} className="fa-btn fa-btn-secondary !min-h-[44px] !px-2 shrink-0 text-[11px]" data-testid="battle-alert-rally">{t('bt.hud.rally')}</button>}
                  {(onAlertGo || onFocus) && <button type="button" onClick={(e) => { e.stopPropagation(); if (onAlertGo) onAlertGo(a); else onFocus(a.x, a.y); }} className="shrink-0 min-w-[44px] h-11 px-2 text-[12px] font-semibold text-fa-text" data-testid="battle-alert-go">{t('bt.go')}</button>}
                </div>
              ))}
            </div>
          )}
          {leftCard && !pauseOpen && <div className="pointer-events-auto">{leftCard}</div>}
        </div>

        <div className="min-w-0 flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-full">
          {/* Objective: the keep (any battle with one); a 44 px target round a slim chip */}
          {keep && !city && (
            <button type="button" onClick={onFocusKeep} className="pointer-events-auto -my-2 min-h-[44px] max-w-full flex items-center" data-testid="battle-keep" aria-label={t('bt.hud.keepAria', { state: keep.alive ? `${Math.round((keep.hp / keep.maxHp) * 100)}%` : t('bt.hud.down') })}>
              <span className="fa-chip !bg-fa-panel/95 !min-h-[28px] !py-0.5 gap-1.5 max-w-full">
                <Castle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {keep.alive
                  ? <><span className="w-10 lg:w-16 h-1.5 bg-fa-ink rounded-full overflow-hidden shrink-0"><span className="block h-full bg-fa-enemy" style={{ width: `${(keep.hp / keep.maxHp) * 100}%` }} /></span><span className="fa-num text-[10.5px] lg:hidden">{Math.round((keep.hp / keep.maxHp) * 100)}%</span><span className="fa-num text-[10.5px] hidden lg:inline">{Math.round(keep.hp)}/{keep.maxHp}</span></>
                  : <span className="text-fa-good">{base ? t('bt.hud.keepDown') : hud.assimilation > 0 ? t('bt.hud.breachedTaking', { pct: Math.round((hud.assimilation / ASSIMILATION_TICKS) * 100) }) : t('bt.hud.breached')}</span>}
                {keep.alive && keep.garrisonSlots > 0 && <span className="text-fa-you truncate hidden lg:inline" title={t('bt.hud.garrisonTitle')}>{t('bt.hud.garrison', { a: keep.garrison, b: keep.garrisonSlots })}</span>}
              </span>
            </button>
          )}
          {/* Who is winning, the objective and the loot (playtest issues 3 to 5); the base rule in words (sim/base.js, UI16). */}
          <div className="pointer-events-auto fa-panel !bg-fa-panel/95 !rounded-[10px] px-2 py-0.5 text-[10.5px] leading-tight w-[min(20rem,100%)] shadow-xl" data-testid="battle-status">
            <div className="flex items-center gap-1.5" title={t('bt.status.title')} role="img" aria-label={t('bt.status.aria', { a: youPct, b: themPct })}>
              <span className="font-semibold text-fa-muted">{t('bt.status.army')}</span>
              <span className="font-semibold text-fa-you">{t('bt.status.you')}</span>
              <span className="fa-num text-fa-you" data-testid="battle-status-you">{youPct}%</span>
              <span className="flex-1 min-w-[1.5rem] h-1.5 rounded-full bg-fa-ink overflow-hidden flex justify-end" aria-hidden="true"><span className="h-full bg-fa-you" style={{ width: `${youPct}%` }} /></span>
              <span className="flex-1 min-w-[1.5rem] h-1.5 rounded-full bg-fa-ink overflow-hidden" aria-hidden="true"><span className="block h-full bg-fa-enemy" style={{ width: `${themPct}%` }} /></span>
              <span className="fa-num text-fa-enemy" data-testid="battle-status-them">{themPct}%</span>
              <span className="font-semibold text-fa-enemy">{t('bt.status.them')}</span>
            </div>
            <div className="line-clamp-2 text-fa-brass" title={objective} data-testid="battle-objective-line">{objective}</div>
            {/* What decides it (Q3): base buildings standing, each bar against the most that side has had (battle-engage). */}
            {base && (
              <div className="flex items-center gap-1.5 text-fa-muted" title={t('bt.hud.baseTitle')} role="img" aria-label={t('bt.status.buildings', { a: base[0], b: base[1] })} data-testid="battle-base">
                <span className="font-semibold">{t('bt.status.base')}</span>
                <span className="fa-num text-fa-you" data-testid="battle-base-you">{base[0]}</span>
                <span className="flex-1 min-w-[1.5rem] h-1.5 rounded-full bg-fa-ink overflow-hidden flex justify-end" aria-hidden="true"><span className="h-full bg-fa-you" style={{ width: `${(base[0] / baseMax[0]) * 100}%` }} /></span>
                <span className="flex-1 min-w-[1.5rem] h-1.5 rounded-full bg-fa-ink overflow-hidden" aria-hidden="true"><span className="block h-full bg-fa-enemy" style={{ width: `${(base[1] / baseMax[1]) * 100}%` }} /></span>
                <span className="fa-num text-fa-enemy" data-testid="battle-base-them">{base[1]}</span>
                {marching.length > 0 && <span className="text-fa-you whitespace-nowrap">{t('bt.hud.arriving', { n: marching.length })}</span>}
              </div>
            )}
            {loot && (
              <div data-testid="battle-loot">
                <div className={cx('flex items-center gap-1.5', lootWarn && 'text-fa-danger-text font-semibold')}>
                  <span className="whitespace-nowrap">{t('bt.status.loot', { a: Math.min(loot.burned, loot.needed), b: loot.needed })}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-fa-ink overflow-hidden" role="meter" aria-label={t('bt.status.loot', { a: Math.min(loot.burned, loot.needed), b: loot.needed })} aria-valuenow={Math.min(loot.burned, loot.needed)} aria-valuemin={0} aria-valuemax={loot.needed}>
                    <span className={cx('block h-full', lootWarn ? 'bg-fa-danger' : 'bg-fa-brass')} style={{ width: `${(Math.min(loot.burned, loot.needed) / loot.needed) * 100}%` }} />
                  </span>
                </div>
                {loot.taken && <div className="font-semibold text-fa-danger-text animate-pulse" data-testid="battle-loot-taken">{t(playerSide === 1 ? 'bt.status.lootTakenDef' : 'bt.status.lootTakenAtk', { n: loot.raidersLeft })}</div>}
              </div>
            )}
          </div>
          </div>
          {/* The selection and its target (B01); Shaken with Rally Cry (B09) */}
          {sel && !pauseOpen && started && (
            <div className={cx('max-w-full ps-3 py-1 rounded-full bg-fa-panel/95 border border-fa-line text-[12px] shadow-xl pointer-events-auto flex items-center gap-2', onClearSelection ? 'pe-0' : 'pe-3')} data-testid="battle-selection">
              <span className="font-semibold truncate min-w-[3rem] max-w-[9rem] lg:max-w-none">{sel.name}</span>
              <span className="text-fa-muted whitespace-nowrap hidden lg:inline fa-num">{t(naval ? 'bt.hud.shipsCrew' : 'bt.hud.squadsMen', { count: sel.squads, men: menText(sel.men) })}</span>
              <span className={cx('fa-num', sel.share < 0.35 ? 'text-fa-danger-text' : 'text-fa-good')}>{Math.round(sel.share * 100)}%</span>
              {sel.shaken > 0 && <span className="px-1.5 rounded-md bg-fa-brass/20 text-fa-brass text-[11px] font-bold whitespace-nowrap" title={t('bt.hud.shakenTitle')} data-testid="battle-selection-shaken">{sel.squads > 1 ? t('bt.hud.shakenN', { n: sel.shaken }) : t('bt.hud.shaken')}</span>}
              {sel.noPath > 0 && <span className="px-1.5 rounded-md bg-fa-danger/20 text-fa-danger-text text-[11px] font-bold whitespace-nowrap" title={t('bt.hud.noPathTitle')} data-testid="battle-selection-nopath">{t('bt.hud.noPath')}</span>}
              {sel.attrition > 0 && <button type="button" onClick={() => setAttrOpen((v) => !v)} aria-expanded={attrOpen} className="min-h-[44px] -my-2.5 text-fa-muted text-[11px] whitespace-nowrap fa-num underline decoration-dotted" title={t('bt.hud.attritionTitle')} data-testid="battle-selection-attrition">{t('bt.hud.attrition', { men: menText(sel.attrition) })}</button>}
              {sel.routed && <span className="text-fa-danger-text font-semibold">{t('bt.hud.routed')}</span>}
              {targetSt && <span className="text-fa-enemy whitespace-nowrap hidden lg:inline">{t('bt.hud.target', { word: structureLabel(targetSt.kind, STRUCTURE_WORD[targetSt.kind] || targetSt.kind), hp: `${Math.round(targetSt.hp)}/${targetSt.maxHp}` })}</span>}
              {sel.shaken > 0 && rallyCry && <button type="button" onClick={() => onPower(rallyCry)} disabled={!rallyReady} className="fa-btn fa-btn-secondary !min-h-[44px] !px-2.5 -my-2 shrink-0 text-[11px]" data-testid="battle-selection-rally" title={rallyReady ? t('bt.hud.rallyReadyTitle') : t('bt.hud.rallyNotReady')}>{t('bt.hud.rallyCry')}</button>}
              {onClearSelection && (
                <button type="button" onClick={onClearSelection} aria-label={t('bt.hud.clearSelection')} title={t('bt.hud.clearSelectionEsc')} data-testid="battle-clear-selection"
                  className="shrink-0 w-11 h-11 -my-2.5 flex items-center justify-center rounded-full text-fa-muted hover:text-fa-text">
                  <span className="w-7 h-7 rounded-full bg-fa-raised border border-fa-line flex items-center justify-center"><GameIcon group="battle" id="close" size={16} halo={false} fallback={<X className="w-4 h-4" aria-hidden="true" />} /></span>
                </button>
              )}
            </div>
          )}
          {sel && attrOpen && sel.attrition > 0 && !pauseOpen && started && (
            <div className="pointer-events-auto max-w-[min(20rem,100%)] px-2.5 py-1 rounded-[10px] bg-fa-panel/95 border border-fa-line text-[11.5px] leading-snug shadow-xl" data-testid="battle-attrition-why">{t('bt.hud.attritionTitle')}</div>
          )}
        </div>

        {/* B05: the city in a city assault, its housing as the houses burn; the minimap under it */}
        {((city && started && !pauseOpen) || showMinimap) && (
          <div className="shrink-0 flex flex-col items-end gap-1.5 max-w-[min(16.5rem,30vw)]">
            {city && started && !pauseOpen && (
              <div className="w-full pointer-events-auto" data-testid="battle-city">
                {cityOpen ? (
                  <div className="fa-panel !bg-fa-panel/95 px-2.5 py-1.5 shadow-xl">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="fa-label">{playerSide === 1 ? t('bt.hud.cityHousingYours') : t('bt.hud.cityHousingTheirs')}</span>
                      <button type="button" onClick={() => setCityOpen(false)} aria-label={t('bt.hud.foldCity')} className="-me-2 -my-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-fa-muted" data-testid="battle-city-fold"><ChevronUp className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-baseline gap-2">
                      {city.housingNow < city.housingStart && <span className="fa-num text-[13px] text-fa-muted line-through">{city.housingStart}</span>}
                      <span className={cx('fa-num text-[17px] font-semibold', city.housingNow < city.housingStart ? 'text-fa-danger-text' : '')}>{city.housingNow}</span>
                      <span className="text-[11px] text-fa-muted">{city.ruined ? t('bt.hud.housesBurned', { count: city.ruined }) : t('bt.hud.noHouseBurned')}</span>
                    </div>
                    <div className="text-[11.5px] leading-snug mt-1" data-testid="battle-city-houses">{t('bt.hud.ruinedOf', { a: city.ruined, b: city.total })}</div>
                    <div className="relative h-1.5 mt-1 rounded-full bg-fa-ink overflow-hidden" role="meter" aria-label={t('bt.hud.housesRuined')} aria-valuenow={city.ruined} aria-valuemin={0} aria-valuemax={city.total}>
                      <span className="absolute inset-y-0 start-0 bg-fa-danger" style={{ width: `${(city.ruined / Math.max(1, city.total)) * 100}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-[10.5px] text-fa-muted">
                      {city.gate && <span>{t('bt.hud.gate')} {city.gate.alive ? `${Math.round((city.gate.hp / city.gate.maxHp) * 100)}%` : t('bt.hud.gateOpen')}</span>}
                      {city.towers.total > 0 && <span>{t('bt.hud.towers')} {city.towers.standing}/{city.towers.total}</span>}
                      {city.keep && <button type="button" onClick={onFocusKeep} className="underline min-h-[44px] -my-3">{t('bt.hud.keep')} {city.keep.alive ? `${Math.round((city.keep.hp / city.keep.maxHp) * 100)}%` : base ? t('bt.hud.down') : t('bt.hud.keepTaken')}</button>}
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setCityOpen(true)} className="ms-auto flex fa-chip !bg-fa-panel/95 !min-h-[44px] gap-1.5" aria-expanded="false" data-testid="battle-city-open"><Home className="w-3.5 h-3.5" aria-hidden="true" />{t('bt.hud.housingChip')} <span className="fa-num">{city.housingNow}</span> · {t('bt.hud.ruinedChip')} <span className="fa-num">{city.ruined}/{city.total}</span></button>
                )}
              </div>
            )}
            {showMinimap && minimap}
          </div>
        )}
      </div>

      {started && timeLeft > 0 && timeLeft <= 60 && timeLeft > 55 && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none px-4" style={{ bottom: ABOVE_BOTTOM }}>
          <div className="px-3 py-1.5 rounded-full bg-fa-brass text-fa-ink text-xs font-bold shadow-xl">
            {setup?.battleType === 'naval' ? t('bt.hud.oneMinuteSea') : playerSide === 1 ? t('bt.hud.oneMinuteDef') : t('bt.hud.oneMinuteAtk')}
          </div>
        </div>
      )}
      {(armed?.type === 'power' || armed === 'attackMove') && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: ABOVE_BOTTOM }}>
          <div className="pointer-events-auto flex items-center gap-1 ps-3 rounded-full bg-fa-panel/95 border border-fa-enemy text-xs font-semibold shadow-xl" data-testid={armed === 'attackMove' ? 'battle-attack-armed' : 'battle-power-armed'}>
            {armed === 'attackMove' ? t(mouse ? 'bt.hud.clickAttack' : 'bt.hud.tapAttack') : t(mouse ? 'bt.hud.clickStrike' : 'bt.hud.tapStrike', { label: powerLabel(armed.id, armed.label) })}
            {onCancelArmed && <button type="button" onClick={onCancelArmed} aria-label={t('bt.hud.cancelStrike')} className="w-11 h-11 flex items-center justify-center text-fa-muted"><X className="w-4 h-4" aria-hidden="true" /></button>}
          </div>
        </div>
      )}

      {/* Bottom (B10): small buttons (left), the context panel (right); the column under the top row
          lets a tall sheet scroll instead of running under the top bar (U03) */}
      {wandOpen && !pauseOpen && <div className="absolute inset-x-0 bottom-0 pointer-events-auto" style={{ top: TOP_BAR }} onPointerDown={() => setWandOpen(false)} data-testid="battle-wand-backdrop" />}
      {!pauseOpen && (
        <div className="absolute flex items-end justify-between gap-2 pointer-events-none" style={{ top: UNDER_BAR, bottom: SAFE_B, insetInlineStart: SAFE_L, insetInlineEnd: SAFE_R }}>
          <div className="flex flex-col items-start gap-1 shrink-0">
          {started && groups && onGroup && (groups.some(Boolean) || selectedSquads.length > 0) && (
            // Rank 6: the filled control groups and one free slot while something is selected
            <div className="pointer-events-auto flex gap-1" data-testid="battle-groups">
              {groups.map((count, i) => (count || (selectedSquads.length && i === groups.findIndex((c) => !c))
                ? <GroupSlot key={i} n={i + 1} count={count} onUse={(save) => onGroup(i, save)} label={t(count ? 'bt.hud.groupAria' : 'bt.hud.groupSaveAria', { n: i + 1, count })} /> : null))}
            </div>
          )}
          <div className="pointer-events-auto flex gap-1 shrink-0" data-testid="battle-quick">
            <Cmd glyph={<GameIcon group="battle" id="select-all" size={18} halo={false} fallback={<Users className="w-4 h-4" aria-hidden="true" />} />} label={t('bt.hud.all', { n: allCount })} onClick={() => onSelectClass('all')} disabled={!allCount} testId="battle-select-all" ariaLabel={t(naval ? 'bt.hud.selectAllShips' : 'bt.hud.selectAll', { n: allCount })} />
            {narrow ? (
              // RTS-02: a narrow phone folds the camera buttons behind View (they open upwards).
              <div className="relative shrink-0">
                {viewOpen && (
                  <div className="absolute bottom-full mb-1 start-0 flex flex-col gap-1" data-testid="battle-view-menu">
                    {viewButtons.map((b) => <Cmd key={b.testId} {...b} onClick={() => { setViewOpen(false); b.onClick(); }} />)}
                  </div>
                )}
                <Cmd icon={Compass} label={t('bt.hud.view')} onClick={() => setViewOpen((v) => !v)} active={viewOpen} testId="battle-view-more" ariaLabel={t('bt.hud.viewAria')} />
              </div>
            ) : viewButtons.map((b) => <Cmd key={b.testId} {...b} />)}
            {eco && eco.idleWorkers.length > 0 && <Cmd icon={Hammer} label={t('bt.hud.idle', { n: eco.idleWorkers.length })} onClick={() => onSelectClass('idle')} testId="battle-idle-workers" />}
            {idleSquads > 0 && <Cmd icon={Swords} label={t('bt.hud.idleSquads', { n: idleSquads })} onClick={() => onSelectClass('idleSquads')} testId="battle-idle-squads" ariaLabel={t('bt.hud.idleSquadsAria', { n: idleSquads })} />}
            {eco && onSteward && <Cmd icon={UserCog} label={t('bt.hud.steward')} onClick={() => onSteward(!eco.steward)} active={!!eco.steward} testId="battle-steward" ariaLabel={t('bt.hud.stewardAria')} />}
          </div>
          </div>
          <div className="flex-1 min-w-0 max-h-full overflow-y-auto [&>*]:pointer-events-auto overscroll-contain scrollbar-none flex flex-col items-end gap-1" data-testid="battle-context" data-context={context}>
            <div className="flex-1" aria-hidden="true" />
            {wandOpen && showWand && (
              <div className="shrink-0 fa-panel !bg-fa-panel/95 shadow-2xl p-1.5 overflow-y-auto overscroll-contain" style={{ width: short ? 'min(30rem, 100%)' : 'min(19rem, 100%)', maxHeight: 'calc(var(--app-height, 100vh) - var(--sa-t, 0px) - max(0.375rem, var(--sa-b, 0px)) - 7.5rem)' }} role="dialog" aria-label={t('bt.hud.wand')} data-testid="battle-wand-sheet">
                <div className="flex items-center justify-between ps-1"><span className="fa-label">{t('bt.hud.wand')}</span>
                  <button type="button" onClick={() => setWandOpen(false)} aria-label={t('bt.close')} data-testid="battle-wand-close" className="w-11 h-11 -my-1 flex items-center justify-center text-fa-muted"><GameIcon group="battle" id="close" size={20} halo={false} fallback={<X className="w-4 h-4" aria-hidden="true" />} /></button></div>
                <div className={short ? 'grid grid-cols-2 gap-x-1' : undefined}>
                {armyCtx && abilities.map((a) => (
                  <button key={a.id} type="button" disabled={a.readyIn > 0} onClick={() => { setWandOpen(false); onAbility?.(a.id); }} data-testid={`battle-ability-${a.id}`}
                    className="w-full min-h-[44px] px-2 flex items-center gap-2 rounded-[8px] text-start hover:bg-fa-raised disabled:opacity-50">
                    <Wand2 className="w-4 h-4 shrink-0 text-fa-indep" aria-hidden="true" />
                    <span className="flex-1 min-w-0 text-[12px] font-semibold truncate">{abilityLabel(a.id, naval)}</span>
                    <span className={cx('text-[11px] fa-num shrink-0', a.readyIn > 0 ? 'text-fa-muted' : 'text-fa-good')}>{a.readyIn > 0 ? t('bt.hud.readyIn', { s: Math.ceil(a.readyIn / TICK_HZ) }) : t('bt.hud.readyCap')}</span>
                  </button>
                ))}
                {powerCards.map((pw) => {
                  const block = powerBlock(pw, supply, t);
                  return (
                    <button key={pw.id} type="button" disabled={!!block} onClick={() => firePower(pw)} aria-pressed={(armed?.type === 'power' && armed.id === pw.id) || undefined} data-testid={`battle-power-${pw.id}`}
                      className={cx('w-full min-h-[44px] px-2 flex items-center gap-2 rounded-[8px] text-start hover:bg-fa-raised disabled:opacity-60')}>
                      <Zap className="w-4 h-4 shrink-0 text-fa-brass" aria-hidden="true" />
                      <span className="flex-1 min-w-0"><span className="block text-[12px] font-semibold truncate">{powerLabel(pw.id, pw.label)}</span>
                        <span className="block text-[10.5px] text-fa-muted fa-num">{pw.cost ? t('bt.hud.costSupply', { cost: pw.cost }) : t('bt.hud.free')}{Number.isFinite(pw.usesLeft) ? t('bt.hud.usesLeft', { n: pw.usesLeft }) : ''}{pw.targeted ? t('bt.hud.aimIt') : ''}</span></span>
                      <span className={cx('text-[11px] shrink-0 text-end max-w-[8rem]', block ? 'text-fa-danger-text' : 'text-fa-good')}>{block || t('bt.hud.readyCap')}</span>
                    </button>
                  );
                })}
                </div>
              </div>
            )}
            {panel}
            {(armyCtx || idleCtx) && (
              <div className="flex gap-1 max-w-full shrink-0" data-testid="battle-commands">
                {showWand && <WandButton open={wandOpen} ready={wandReady} onClick={() => setWandOpen((v) => !v)} />}
                {armyCtx ? (
                  <>
                    {context === 'mixed' && eco && <HammerButton onClick={onOpenBuild} active={buildOpen} />}
                    {onToggleFollow && <Cmd icon={Navigation} label={t('bt.hud.follow')} onClick={onToggleFollow} active={follow} testId="battle-follow" ariaLabel={t('bt.hud.followAria')} />}
                    {onTogglePathMode && !mouse && started && <Cmd icon={Spline} label={t('bt.hud.path')} onClick={onTogglePathMode} active={pathMode} testId="battle-path-mode" />}
                    <Cmd icon={Crosshair} label={t('bt.hud.attack')} onClick={() => onArm('attackMove')} active={armed === 'attackMove'} testId="battle-attack-move" />
                    <Cmd icon={Hand} label={t('bt.hud.hold')} onClick={() => onCommand('hold')} testId="battle-hold" />
                    <Cmd icon={formation === 'line' ? Rows : Columns} label={formation === 'line' ? t('bt.hud.line') : t('bt.hud.column')} onClick={onFormation} testId="battle-formation" />
                    <Cmd icon={Undo2} label={t('bt.hud.retreat')} onClick={() => onCommand('retreat')} danger testId="battle-retreat-selected" />
                  </>
                ) : (
                  <>
                    {onToggleSelectMode && !mouse && <Cmd icon={BoxSelect} label={t('bt.hud.select')} onClick={onToggleSelectMode} active={selectMode} testId="battle-select-mode" />}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {deployCard}

      {selectMode && !pauseOpen && (
        <div className="absolute max-w-[250px] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-good text-xs font-semibold shadow-xl pointer-events-none" style={{ insetInlineStart: SAFE_L, bottom: ABOVE_BOTTOM }} data-testid="battle-select-mode-banner">
          {t('bt.hud.selectBanner')}
        </div>
      )}
      {pathMode && !pauseOpen && (
        <div className="absolute max-w-[250px] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-good text-xs font-semibold shadow-xl pointer-events-none" style={{ insetInlineStart: SAFE_L, bottom: ABOVE_BOTTOM }} data-testid="battle-path-mode-banner">
          {t('bt.hud.pathBanner')}
        </div>
      )}
      {coach && started && !selectMode && !pathMode && !pauseOpen && !viewOpen && !(started && paused && sheetHidden) && coach.steps[coach.step] && (
        // RTS-01: the first-battle coach. It never blocks the field or the clock: only its buttons take taps.
        <div className="absolute w-[min(16rem,calc(50vw-1rem))] px-3 pt-2 pb-1 rounded-[10px] bg-fa-panel/95 border border-fa-brass/70 text-[12px] leading-snug shadow-xl pointer-events-none" style={{ insetInlineStart: SAFE_L, bottom: ABOVE_BOTTOM }} role="status" aria-live="polite" data-testid="battle-coach">
          <div className="flex items-baseline gap-2">
            <span className="fa-label text-fa-brass flex-1 min-w-0 truncate">{coach.steps[coach.step].title}</span>
            <span className="fa-num text-[10.5px] text-fa-muted shrink-0">{t('bt.hud.stepOf', { a: coach.step + 1, b: coach.steps.length })}</span>
          </div>
          <div className="mt-0.5" data-testid="battle-coach-text">{coach.steps[coach.step].text}</div>
          {coach.holding && <div className="mt-1 text-[11px] text-fa-brass" data-testid="battle-coach-hold">{t('bt.coach.holding')}</div>}
          <div className="flex justify-end gap-1 -me-2">
            <button type="button" onClick={coach.onSkip} className="pointer-events-auto min-h-[44px] min-w-[44px] px-2 text-[12px] text-fa-muted" data-testid="battle-coach-skip">{t('bt.skip')}</button>
            <button type="button" onClick={coach.onNext} className="pointer-events-auto min-h-[44px] min-w-[44px] px-2 text-[12px] font-semibold text-fa-text" data-testid="battle-coach-next">{coach.step + 1 < coach.steps.length ? t('bt.hud.next') : t('bt.hud.gotIt')}</button>
          </div>
        </div>
      )}

      {/* B06 pause sheet: narrow, on the right (I207); Retreat set apart from Switch to Auto */}
      {pauseOpen && (
        <div className="absolute end-0 bottom-0 w-[min(18rem,46vw)] lg:w-[21rem] p-2.5 bg-fa-panel border-s border-fa-line shadow-2xl overflow-y-auto pointer-events-auto flex flex-col gap-2" style={{ top: TOP_BAR, paddingRight: 'max(0.625rem, var(--sa-r, 0px))', paddingBottom: 'max(0.625rem, var(--sa-b, 0px))' }} data-testid="battle-pause-sheet" role="dialog" aria-label={t('bt.hud.paused')}>
          <div className="flex items-center justify-between"><h2 className="fa-heading text-[16px]">{t('bt.hud.paused')}</h2><button type="button" onClick={() => setSheetHidden(true)} className="fa-btn fa-btn-ghost !min-h-[44px] !px-2 text-[12px]" data-testid="battle-pause-orders">{t('bt.hud.giveOrders')}</button></div>
          <button type="button" onClick={onTogglePause} className="fa-btn fa-btn-primary !min-h-[44px] w-full shrink-0" data-testid="battle-resume">{t('bt.hud.resume')}</button>
          <div>
            <div role="radiogroup" aria-label={t('bt.hud.speed')} className="flex gap-1 p-0.5 rounded-[10px] border border-fa-line bg-fa-ink/40">
              {SPEEDS.map((s) => <button key={s} type="button" role="radio" aria-checked={speed === s} aria-label={t('bt.hud.speedN', { n: s })} onClick={() => onSpeed(s)} className={cx('fa-option flex-1 min-h-[44px] fa-num text-[14px] font-semibold border-transparent bg-transparent', speed === s && 'fa-selected')}>{s}×</button>)}
            </div>
            <div className="text-[11px] text-fa-muted mt-0.5">{speed > 1 ? t('bt.hud.minLeftFast', { a: minutesLeft(timeLeft, 1), b: minutesLeft(timeLeft, speed), speed }) : t('bt.hud.minLeft', { a: minutesLeft(timeLeft, 1) })}</div>
          </div>
          <div className="flex gap-1.5">
            {onAbandon && <button type="button" onClick={() => onAbandon()} className="fa-btn fa-btn-secondary flex-1 !min-h-[44px] !px-1.5 text-[12px]" data-testid="battle-switch-auto">{t('bt.hud.switchAuto')}</button>}
            {onToggleSound && <button type="button" onClick={onToggleSound} aria-label={soundOn ? t('bt.hud.muteSound') : t('bt.hud.soundOn')} className="fa-icon-btn !w-11 !h-11 shrink-0" data-testid="battle-sound">{soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>}
          </div>
          {powerCards.length > 0 && (
            <div>
              <div className="fa-label mb-1">{t('bt.hud.powersPaused')}</div>
              <div className="grid grid-cols-2 gap-1.5">{powerCards.map((pw) => <PowerCard key={pw.id} pw={pw} supply={supply} armed={armed?.type === 'power' && armed.id === pw.id} onClick={() => firePower(pw)} />)}</div>
            </div>
          )}
          {/* I195: where each side's squads went, so a falling count is explained. */}
          <div className="text-[11px] leading-snug" data-testid="battle-tally">
            <div><span className="text-fa-you font-semibold">{t('bt.hud.yours')}</span> {armyTallyText(armyTally(hud, playerSide))}.</div>
            <div><span className="text-fa-enemy font-semibold">{t('bt.hud.theirs')}</span> {armyTallyText(armyTally(hud, 1 - playerSide))}.</div>
          </div>
          <div className="text-[10.5px] text-fa-muted leading-snug">{t('bt.hud.retreatHelp', { siege: bt === BATTLE_TYPES.assault ? t('bt.hud.siegeLifted') : '' })}</div>
          {/* Retreat sits apart from Switch to Auto: a tap meant for Auto landed on it (playtest 40650973042 step 86) */}
          <button type="button" onClick={() => setConfirmRetreat(true)} className="fa-btn fa-btn-danger w-full shrink-0 !min-h-[44px] mt-2 text-[12px]" data-testid="battle-leave">{t('bt.hud.retreat')}</button>
        </div>
      )}

      {started && paused && sheetHidden && (
        <button type="button" onClick={() => setSheetHidden(false)} className="absolute fa-chip !bg-fa-panel/95 !min-h-[44px] pointer-events-auto" style={{ insetInlineStart: SAFE_L, bottom: ABOVE_BOTTOM }} data-testid="battle-paused-pill">{t('bt.hud.pausedMenu')}</button>
      )}

      {confirmRetreat && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-sm fa-panel !bg-fa-panel p-4 text-sm space-y-3 max-h-full overflow-y-auto" data-testid="battle-retreat-confirm">
            <div className="fa-heading text-[17px]">{t('bt.hud.retreatTitle')}</div>
            <p className="text-xs text-fa-muted" data-testid="battle-retreat-consequences">{t('bt.hud.retreatBody', { count: allCount, siege: bt === BATTLE_TYPES.assault ? t('bt.hud.andSiegeLifted') : '' })}</p>
            <div className="grid grid-cols-1 gap-2">
              {/* the safe answers first, the rout last and apart (step 87 tapped the top button expecting Auto) */}
              <button type="button" onClick={() => setConfirmRetreat(false)} className="fa-btn fa-btn-secondary !min-h-[44px]" data-testid="battle-keep-fighting">{t('bt.hud.keepFighting')}</button>
              {onAbandon && <button type="button" onClick={() => { setConfirmRetreat(false); onAbandon(); }} className="fa-btn fa-btn-secondary !min-h-[44px]" data-testid="battle-auto-instead">{t('bt.hud.autoInstead')}</button>}
              <button type="button" onClick={() => { setConfirmRetreat(false); onRetreatAll(); }} className="fa-btn fa-btn-danger !min-h-[44px] mt-3" data-testid="battle-retreat-all">{t('bt.hud.soundRetreat')}</button>
            </div>
          </div>
        </div>
      )}
      </>}
    </>
  );
};

export default BattleHud;
