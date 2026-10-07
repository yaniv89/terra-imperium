// src/components/battle/BattleHud.jsx
// The commanded battle's HUD in the Field Atlas look (plans/UI-DESIGN.md B01, B05, B06; Tactical
// Battles plan 11.1), phone first (844x390), the battlefield owns the screen:
//   top bar      the battle's name and clock, food, materials, gold and population / housing (or
//                Battle Supply without an economy), the enemy squads left, speed and pause
//   bottom left  regiment cards: All, Select (box select), the base and idle workers, one card per
//                kind with its men and a health bar (tap = select and bring into view), reserves
//   bottom right labelled ability cards with their cooldown (powers, a general's abilities), then
//                the commands: Build, Attack-move, Hold, Formation, Retreat
//   top row      one row under the bar, so nothing in it can overlap (B09): alerts and the info card
//                (left), the keep and the selection pill (centre: "Spearmen  3 squads, 146 men  74%",
//                Shaken with Rally Cry, the target it strikes), the city card (right)
//   alerts (B06) at most two, with Go (the camera jumps there and selects the squad when it is yours);
//                older ones fold into a count
//   pause (B06)  a sheet on the right: Resume, speed, the time left, Switch to Auto and Retreat set
//                apart, sound, and the powers, usable while paused
//   city (B05)   in a city assault: the defender's housing as houses burn and the 50% rule's line
// Every control is at least 44 px.
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Crosshair, Hand, Rows, Columns, Flag, Users, Castle, X, Zap, Sparkles, Hammer, Tent, BoxSelect, AlertTriangle, Undo2, Volume2, VolumeX, Home, ChevronUp, Swords, Coins } from 'lucide-react';
import GameIcon from '../ui/GameIcon';
import { unitIconUrl } from '../../data/icons';
import { ResIcon } from './EconomyHud';

import { ASSIMILATION_TICKS } from '../../battle/sim/objectives';
import { BUILDING_EFFECTS } from '../../battle/sim/buildings';
import { BATTLE_TYPES } from '../../battle/setup/battleType';
import { TICK_HZ } from '../../battle/sim/constants';
import { ecoName } from '../../battle/data/economy';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { regimentCards, selectionSummary, cityAssaultView, nextAlerts, visibleAlerts, minutesLeft } from './battleHudModel';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cx = (...p) => p.filter(Boolean).join(' ');
const SPEEDS = [1, 2, 3];
const STRUCTURE_WORD = { keep: 'keep', tower: 'tower', gate: 'gate', wall: 'wall', house: 'house', building: 'building', palace: 'palace', wonder: 'wonder', landmark: 'landmark', townhall: 'town hall' };

/** A labelled command button (B01: always a text label). */
const Cmd = ({ icon: Icon, label, onClick, active, danger, disabled, testId, className }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} aria-pressed={active || undefined}
    className={cx('shrink-0 min-w-[52px] h-12 px-1.5 rounded-[10px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold border shadow-lg disabled:opacity-40',
      active ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text text-fa-text' : danger ? 'bg-fa-panel/95 border-fa-danger text-fa-danger-text' : 'bg-fa-panel/95 border-fa-line text-fa-text', className)}>
    {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
    <span className="leading-none whitespace-nowrap">{label}</span>
  </button>
);

/** A regiment card: the class picture, name and men, a health bar; "shaken" when beaten down. */
const RegimentCard = ({ title, sub, share, onClick, active, testId, tone, classId, shaken = 0 }) => (
  <button type="button" onClick={onClick} data-testid={testId} aria-pressed={active || undefined}
    className={cx('shrink-0 w-[104px] lg:w-[120px] h-12 pl-1 pr-1.5 py-1 rounded-[10px] text-left border shadow-lg flex items-center gap-1',
      active ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-line')}>
    {classId && <GameIcon group="units" id={classId} url={unitIconUrl(classId)} size={22} fallback={null} />}
    <span className="min-w-0 flex-1 flex flex-col justify-center">
      <span className="block text-[11.5px] font-semibold leading-tight truncate">{title}</span>
      <span className={cx('block text-[10px] leading-tight truncate', shaken ? 'text-fa-brass font-semibold' : 'text-fa-muted')}>{shaken ? `${shaken} shaken` : sub}</span>
      {share != null && <span className="block h-1 mt-0.5 rounded-full bg-fa-ink overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: tone || (share < 0.35 ? 'var(--fa-danger)' : 'var(--fa-good)') }} /></span>}
    </span>
  </button>
);

/** A power or ability card: a label and its state (ready, a cooldown, the supply it costs). */
const PowerCard = ({ pw, armed, supply, onClick }) => {
  const disabled = pw.usesLeft <= 0 || pw.readyIn > 0 || supply < pw.cost;
  const state = pw.readyIn > 0 ? `${Math.ceil(pw.readyIn / TICK_HZ)}s` : pw.cost ? `${pw.cost} supply` : 'ready';
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={armed || undefined}
      className={cx('shrink-0 min-w-[72px] h-[50px] px-2 rounded-[10px] border shadow-lg flex flex-col items-center justify-center text-center disabled:opacity-45',
        armed ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : pw.id === 'nuclearStrike' ? 'bg-fa-panel/95 border-fa-danger' : 'bg-fa-panel/95 border-fa-line')}>
      <span className="text-[11px] font-semibold leading-tight flex items-center gap-1"><Zap className="w-3 h-3" aria-hidden="true" />{pw.label}</span>
      <span className={cx('fa-num text-[10px] leading-tight', pw.readyIn > 0 ? 'text-fa-muted' : 'text-fa-good')}>{state}{Number.isFinite(pw.usesLeft) ? `, ${pw.usesLeft} left` : ''}</span>
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
  onTogglePause, onSpeed, onArm, onFormation, onSelectClass, onCallReserve, onCommand, onRetreatAll, onFocusKeep, onAbandon,
  onPower, onOpenAbilities, hasAbilities, soundOn = true, onToggleSound,
  onOpenBuild, buildOpen = false, onSelectHq, // the battle economy (EconomyHud.jsx)
  selectMode = false, onToggleSelectMode, selectHint = false, // touch box select (UI-DESIGN B04)
  onFocus, // centre the camera on (x, y) in sim units: the alerts' Go
  onClearSelection, // the selection card's x: let go of every selected squad
  onAlertGo, // an alert's Go: centre on it, select the squad when it is yours (TacticalBattleScreen.jsx)
  leftCard = null, // the info card / building panel, under the alerts in the top row
  mouse = false, // a mouse is the main pointer: the hints speak of clicks
  ended = false // the battle is over: only the top bar stays (the result screen, B08, owns the rest)
}) => {
  const [showReserves, setShowReserves] = useState(false);
  const [confirmNuke, setConfirmNuke] = useState(null);
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  const [cityOpen, setCityOpen] = useState(true);
  // The pause sheet can be put aside to give orders while paused (a pill brings it back).
  const [sheetHidden, setSheetHidden] = useState(false);
  useEffect(() => { if (!paused) setSheetHidden(false); }, [paused]);
  const [alerts, setAlerts] = useState([]);
  const prevRef = useRef(null);
  const lastRef = useRef({});
  // B06: alerts from what changed since the last frame.
  useEffect(() => {
    if (!hud) return;
    const fresh = nextAlerts(prevRef.current, hud, playerSide, setup, lastRef.current);
    prevRef.current = hud;
    if (!fresh.length) return;
    fresh.forEach((a) => { if (a.kind === 'workers') lastRef.current.workers = a.tick; });
    setAlerts((list) => [...list.filter((a) => !fresh.some((f) => f.id === a.id)), ...fresh].slice(-12));
  }, [hud, playerSide, setup]);
  if (!hud) return null;

  const mine = hud.squads.filter((q) => q.side === playerSide && q.alive && !q.fled);
  const onField = mine.filter((q) => q.onField);
  const eco = hud.eco || null;
  const hasWorkers = selectedSquads.some((q) => q.classId === 'worker');
  const reserves = mine.filter((q) => q.reserve);
  const cards = regimentCards(hud, playerSide);
  const keep = hud.structures[0];
  const supply = hud.supply[playerSide];
  const enemyLeft = hud.squads.filter((q) => q.side !== playerSide && q.alive && !q.fled).length;
  const ageId = setup.sides[playerSide].ageId;
  const sel = selectionSummary(selectedSquads);
  const selClasses = new Set(selectedSquads.map((q) => q.classId));
  const target = selectedSquads.find((q) => q.targetKind === 'structure' && q.target >= 0);
  const targetSt = target ? hud.structures[target.target] : null;
  const city = cityAssaultView(hud, setup);
  const { shown: shownAlerts, older } = visibleAlerts(alerts, hud.tick);
  const pauseOpen = started && paused && !sheetHidden;
  const bt = BATTLE_TYPES[hud.battleType || 'field'];
  const allCount = onField.filter((q) => q.classId !== 'worker').length;
  const powerCards = hud.powers || [];
  // Rally Cry (a power the side brought): +30 morale for the whole army, the cure for Shaken.
  const rallyCry = powerCards.find((pw) => pw.id === 'rallyCry') || null;
  const rallyReady = !!rallyCry && rallyCry.readyIn <= 0 && rallyCry.usesLeft > 0 && supply >= rallyCry.cost;
  const firePower = (pw) => (pw.id === 'nuclearStrike' && !(armed?.type === 'power' && armed.id === pw.id) ? setConfirmNuke(pw) : onPower(pw));

  return (
    <>
      {/* Top bar (B01): name and clock, resources, speed and pause */}
      <div className="absolute top-0 inset-x-0 h-11 pt-[env(safe-area-inset-top)] px-2 flex items-center gap-3 bg-fa-ink/90 border-b border-fa-line text-fa-text pointer-events-auto" data-testid="battle-top-bar">
        <span className="fa-heading text-[15px] truncate min-w-0 max-w-[30vw] hidden min-[480px]:inline">{title || 'Battle'}</span>
        <span data-testid="battle-clock" title={`${bt.label}: ${bt[playerSide === 1 ? 'defender' : 'attacker']}`}
          className={cx('fa-num text-[15px] font-semibold shrink-0', timeLeft <= 30 ? 'text-fa-danger-text animate-pulse' : timeLeft <= 60 ? 'text-fa-brass' : '')}>{fmtTime(timeLeft)}</span>
        <span className="w-px h-5 bg-fa-line shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto scrollbar-none" data-testid="battle-resources">
          {eco ? (
            <>
              <Res icon={<ResIcon res="food" size={18} />} label="Food" value={eco.stock[0]} /><Res icon={<ResIcon res="materials" size={18} />} label="Materials" value={eco.stock[1]} /><Res icon={<ResIcon res="gold" size={18} />} label="Gold" value={eco.stock[2]} />
              <Res icon={<Users className="w-4 h-4 text-fa-you" aria-hidden="true" />} label="Population / housing" value={`${eco.pop}/${eco.cap}`} warn={eco.pop >= eco.cap} />
            </>
          ) : <Res icon={<Coins className="w-4 h-4 text-fa-brass" aria-hidden="true" />} label="Battle supply" value={Math.floor(supply)} />}
          <Res icon={<Swords className="w-4 h-4 text-fa-enemy" aria-hidden="true" />} label="Enemy squads left" value={enemyLeft} />
        </div>
        {pauseOpen && <span className="text-[11px] font-bold tracking-[0.08em] text-fa-muted shrink-0">PAUSED</span>}
        <button type="button" onClick={() => onSpeed(speed === 1 ? 2 : speed === 2 ? 3 : 1)} aria-label={`Speed ${speed}, tap for faster`} className="fa-icon-btn !w-11 !h-10 shrink-0 fa-num text-[13px] font-semibold">{speed}×</button>
        {started
          ? <button type="button" onClick={onTogglePause} aria-label={paused ? 'Resume' : 'Pause'} data-testid="battle-pause" className="fa-icon-btn !w-11 !h-10 shrink-0">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>
          : <button type="button" onClick={onTogglePause} data-testid="battle-pause" className="fa-btn fa-btn-primary !min-h-[36px] !px-4 shrink-0">Start</button>}
      </div>

      {!ended && <>
      {/* B09 top row: alerts and the info card (left), the keep and the selection (centre), the
          city (right), side by side in one row so they never cover each other */}
      <div className="absolute top-[3.1rem] inset-x-2 flex items-start gap-2 pointer-events-none" data-testid="battle-top-row">
        <div className="w-[min(15rem,32vw)] lg:w-[17rem] shrink-0 flex flex-col gap-1.5">
          {shownAlerts.length > 0 && !pauseOpen && (
            <div className="space-y-1.5" data-testid="battle-alerts">
              {shownAlerts.map((a) => (
                <div key={a.id} className={cx('pointer-events-auto flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-[10px] bg-fa-panel/95 border shadow-xl', a.tone === 'good' ? 'border-fa-good/70' : 'border-fa-danger/80')} role="status">
                  {a.tone === 'good' ? <Flag className="w-4 h-4 shrink-0 text-fa-good" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-fa-danger-text" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold leading-tight truncate">{a.title}</span>
                    <span className="block text-[10.5px] text-fa-muted leading-tight truncate">{a.detail} {Math.max(0, Math.round((hud.tick - a.tick) / TICK_HZ))} s ago</span>
                  </span>
                  {a.kind === 'shaken' && rallyCry && <button type="button" onClick={() => onPower(rallyCry)} disabled={!rallyReady} className="fa-btn fa-btn-secondary !min-h-[36px] !px-2 shrink-0 text-[11px]" data-testid="battle-alert-rally">Rally</button>}
                  {(onAlertGo || onFocus) && <button type="button" onClick={() => (onAlertGo ? onAlertGo(a) : onFocus(a.x, a.y))} className="fa-btn fa-btn-secondary !min-h-[36px] !px-2.5 shrink-0" data-testid="battle-alert-go">Go</button>}
                </div>
              ))}
              {older > 0 && <div className="text-[10.5px] text-fa-muted px-1">{older} older alert{older === 1 ? '' : 's'}</div>}
            </div>
          )}
          {leftCard && !pauseOpen && <div className="pointer-events-auto">{leftCard}</div>}
        </div>

        <div className="min-w-0 flex-1 flex flex-col items-center gap-1">
          {/* Objective: the keep (any battle with one) */}
          {keep && !city && (
            <button type="button" onClick={onFocusKeep} className="pointer-events-auto fa-chip !bg-fa-panel/95 !min-h-[30px] gap-1.5 max-w-full" data-testid="battle-keep">
              <Castle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {keep.alive
                ? <><span className="w-16 h-1.5 bg-fa-ink rounded-full overflow-hidden shrink-0"><span className="block h-full bg-fa-enemy" style={{ width: `${(keep.hp / keep.maxHp) * 100}%` }} /></span><span className="fa-num text-[10.5px]">{Math.round(keep.hp)}/{keep.maxHp}</span></>
                : <span className="text-fa-good">Breached{hud.assimilation > 0 ? `, taking ${Math.round((hud.assimilation / ASSIMILATION_TICKS) * 100)}%` : ''}</span>}
              {keep.alive && keep.garrisonSlots > 0 && <span className="text-fa-you truncate" title="Garrison: tap the keep with infantry or ranged selected">garrison {keep.garrison}/{keep.garrisonSlots}</span>}
            </button>
          )}
          {!started && (
          <div className="max-w-md text-center px-3 py-2 fa-panel !bg-fa-panel/95 text-[12px] shadow-xl max-h-[calc(100vh-9rem)] overflow-hidden" data-testid="battle-deploy-help">
            <div className="fa-heading text-[15px] mb-0.5">Deploy your army</div>
            {mouse
              ? 'Click a regiment card or a squad, then right click the ground inside your zone to place it. Right click an enemy to attack, right drag to draw a battle line. '
              : 'Tap a regiment card or a squad, then tap the ground inside your zone to place it. Tap an enemy to attack, drag from a selected squad to draw a battle line. '}
            The fight starts when you press <b>Start</b>.
            {setup.structures.some((st) => st.kind === 'building') && (
              <div className="mt-1 text-fa-you" data-testid="battle-buildings">
                {playerSide === 1 ? 'Your buildings here help you while they stand: ' : "The enemy's buildings help them; raze them for plunder: "}
                {setup.structures.filter((st) => st.kind === 'building').map((st) => `${st.name} (${BUILDING_EFFECTS[st.category] || 'landmark'})`).join(', ')}
              </div>
            )}
            <div className="mt-1 text-fa-brass">
              {fmtTime(timeLeft)} on the clock: {setup.battleType === 'raid' || setup.battleType === 'sack'
                ? `${BATTLE_TYPES[setup.battleType][playerSide === 1 ? 'defender' : 'attacker']}.`
                : playerSide === 1
                  ? 'hold out until it runs out and the defence is yours.'
                  : 'take the keep or break the defenders before it runs out, or the defender holds.'}
            </div>
          </div>
          )}
          {/* The selection and its target (B01); Shaken with Rally Cry (B09) */}
          {sel && !pauseOpen && (
            <div className={cx('max-w-full pl-3 py-1 rounded-full bg-fa-panel/95 border border-fa-line text-[12px] shadow-xl pointer-events-auto flex items-center gap-2', onClearSelection ? 'pr-0' : 'pr-3')} data-testid="battle-selection">
              <span className="font-semibold truncate min-w-[3rem]">{sel.name}</span>
              <span className="text-fa-muted whitespace-nowrap hidden min-[700px]:inline">{sel.squads} squad{sel.squads === 1 ? '' : 's'}, <span className="fa-num">{sel.men}</span> men</span>
              <span className={cx('fa-num', sel.share < 0.35 ? 'text-fa-danger-text' : 'text-fa-good')}>{Math.round(sel.share * 100)}%</span>
              {sel.shaken > 0 && <span className="px-1.5 rounded-md bg-fa-brass/20 text-fa-brass text-[11px] font-bold whitespace-nowrap" title="Beaten down: weaker blows, more hurt taken, until morale returns. Your squads never run." data-testid="battle-selection-shaken">Shaken{sel.squads > 1 ? ` ${sel.shaken}` : ''}</span>}
              {sel.routed && <span className="text-fa-danger-text font-semibold">routed</span>}
              {targetSt && <span className="text-fa-enemy whitespace-nowrap hidden min-[700px]:inline">Target: {STRUCTURE_WORD[targetSt.kind] || targetSt.kind} <span className="fa-num">{Math.round(targetSt.hp)}/{targetSt.maxHp}</span></span>}
              {sel.shaken > 0 && rallyCry && <button type="button" onClick={() => onPower(rallyCry)} disabled={!rallyReady} className="fa-btn fa-btn-secondary !min-h-[34px] !px-2.5 -my-1 shrink-0 text-[11px]" data-testid="battle-selection-rally" title={rallyReady ? 'Rally Cry: +30 morale for your whole army' : 'Rally Cry is not ready'}>Rally Cry</button>}
              {onClearSelection && (
                <button type="button" onClick={onClearSelection} aria-label="Clear selection" title="Clear selection (Esc)" data-testid="battle-clear-selection"
                  className="shrink-0 w-11 h-11 -my-2.5 flex items-center justify-center rounded-full text-fa-muted hover:text-fa-text">
                  <span className="w-7 h-7 rounded-full bg-fa-raised border border-fa-line flex items-center justify-center"><X className="w-4 h-4" aria-hidden="true" /></span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* B05: the city in a city assault, its housing as the houses burn, the 50% line */}
        {city && started && !pauseOpen && (
          <div className="w-[min(16.5rem,30vw)] shrink-0 pointer-events-auto" data-testid="battle-city">
            {cityOpen ? (
              <div className="fa-panel !bg-fa-panel/95 px-2.5 py-1.5 shadow-xl">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="fa-label">{playerSide === 1 ? 'Your city' : 'Defender'} housing</span>
                  <button type="button" onClick={() => setCityOpen(false)} aria-label="Fold the city card" className="-mr-1 p-1 text-fa-muted"><ChevronUp className="w-4 h-4" /></button>
                </div>
                <div className="flex items-baseline gap-2">
                  {city.housingNow < city.housingStart && <span className="fa-num text-[13px] text-fa-muted line-through">{city.housingStart}</span>}
                  <span className={cx('fa-num text-[17px] font-semibold', city.housingNow < city.housingStart ? 'text-fa-danger-text' : '')}>{city.housingNow}</span>
                  <span className="text-[11px] text-fa-muted">{city.ruined ? `${city.ruined} house${city.ruined === 1 ? '' : 's'} burned` : 'no house burned yet'}</span>
                </div>
                <div className="fa-label mt-1">The 50% rule</div>
                <div className="text-[11.5px] leading-snug">Ruined {city.ruined} of {city.total} houses. At most {city.maxLost} carry to the map: {playerSide === 1 ? 'you keep' : 'you take'} a city, not rubble.</div>
                <div className="relative h-1.5 mt-1 rounded-full bg-fa-ink overflow-hidden" role="meter" aria-label="Houses ruined" aria-valuenow={city.ruined} aria-valuemin={0} aria-valuemax={city.total}>
                  <span className="absolute inset-y-0 left-0 bg-fa-danger" style={{ width: `${(city.ruined / Math.max(1, city.total)) * 100}%` }} />
                  <span className="absolute inset-y-[-1px] w-0.5 bg-fa-text" style={{ left: `${(city.maxLost / Math.max(1, city.total)) * 100}%` }} />
                </div>
                <div className="flex gap-3 mt-1 text-[10.5px] text-fa-muted">
                  {city.gate && <span>Gate {city.gate.alive ? `${Math.round((city.gate.hp / city.gate.maxHp) * 100)}%` : 'open'}</span>}
                  {city.towers.total > 0 && <span>Towers {city.towers.standing}/{city.towers.total}</span>}
                  {city.keep && <button type="button" onClick={onFocusKeep} className="underline">Keep {city.keep.alive ? `${Math.round((city.keep.hp / city.keep.maxHp) * 100)}%` : 'taken'}</button>}
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCityOpen(true)} className="ml-auto flex fa-chip !bg-fa-panel/95 gap-1.5"><Home className="w-3.5 h-3.5" aria-hidden="true" />Housing <span className="fa-num">{city.housingNow}</span> · ruined <span className="fa-num">{city.ruined}/{city.maxLost}</span></button>
            )}
          </div>
        )}
      </div>

      {started && timeLeft > 0 && timeLeft <= 60 && timeLeft > 55 && (
        <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] inset-x-0 flex justify-center pointer-events-none px-4">
          <div className="px-3 py-1.5 rounded-full bg-fa-brass text-fa-ink text-xs font-bold shadow-xl">
            One minute left{playerSide === 1 ? ': hold on!' : ': take the keep now!'}
          </div>
        </div>
      )}
      {armed?.type === 'place' && (
        <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] inset-x-0 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-fa-panel/95 border border-fa-good text-xs font-semibold shadow-xl">Tap the ground to place: {ecoName(armed.building, ageId)}{hasWorkers ? '' : ' (the nearest workers go)'}</div>
        </div>
      )}
      {armed?.type === 'power' && (
        <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] inset-x-0 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-fa-panel/95 border border-fa-enemy text-xs font-semibold shadow-xl">Tap the battlefield to strike: {armed.label}</div>
        </div>
      )}

      {/* Bottom: regiment cards (left), abilities and commands (right) */}
      {!pauseOpen && (
        <div className="absolute bottom-0 inset-x-0 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] flex items-end justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex gap-1 min-w-0 max-w-[50%] overflow-x-auto scrollbar-none" data-testid="battle-chips">
            <button type="button" onClick={() => onSelectClass('all')} data-testid="battle-select-all"
              className="shrink-0 w-12 h-12 rounded-[10px] bg-fa-panel/95 border border-fa-line shadow-lg flex flex-col items-center justify-center">
              <Users className="w-3.5 h-3.5 text-fa-muted" aria-hidden="true" /><span className="text-[11px] font-semibold leading-tight">All</span><span className="fa-num text-[11px] leading-none">{allCount}</span>
            </button>
            {onToggleSelectMode && <Cmd icon={BoxSelect} label="Select" onClick={onToggleSelectMode} active={selectMode} testId="battle-select-mode" />}
            {eco && <Cmd icon={Tent} label="Base" onClick={onSelectHq} testId="battle-hq" />}
            {eco && eco.idleWorkers.length > 0 && <Cmd icon={Hammer} label={`Idle ${eco.idleWorkers.length}`} onClick={() => onSelectClass('idle')} testId="battle-idle-workers" />}
            {cards.map((c) => (
              <RegimentCard key={c.classId} classId={c.classId} shaken={c.shaken} title={c.name} sub={`${c.squads} sq, ${c.men}${c.routed ? `, ${c.routed} routed` : ''}`} share={c.share}
                active={selClasses.size === 1 && selClasses.has(c.classId)} onClick={() => onSelectClass(c.classId)} testId={`battle-regiment-${c.classId}`} />
            ))}
            {reserves.length > 0 && <Cmd icon={Flag} label={`Reserve ${reserves.length}`} onClick={() => setShowReserves((v) => !v)} active={showReserves} testId="battle-reserves" />}
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-1 shrink-0 max-w-[50%]">
            {(powerCards.length > 0 || hasAbilities) && (
              <div className="flex gap-1 max-w-full overflow-x-auto scrollbar-none [&>*:first-child]:ml-auto" data-testid="battle-powers">
                {hasAbilities && <Cmd icon={Sparkles} label="Abilities" onClick={onOpenAbilities} testId="battle-abilities" />}
                {powerCards.map((pw) => <PowerCard key={pw.id} pw={pw} supply={supply} armed={armed?.type === 'power' && armed.id === pw.id} onClick={() => firePower(pw)} />)}
              </div>
            )}
            <div className="flex gap-1 max-w-full overflow-x-auto scrollbar-none [&>*:first-child]:ml-auto" data-testid="battle-commands">
              {eco && <Cmd icon={Hammer} label="Build" onClick={onOpenBuild} active={buildOpen || armed?.type === 'place'} disabled={!eco.workers} testId="battle-build" />}
              <Cmd icon={Crosshair} label="Attack" onClick={() => onArm('attackMove')} active={armed === 'attackMove'} disabled={!selectedSquads.length} testId="battle-attack-move" />
              <Cmd icon={Hand} label="Hold" onClick={() => onCommand('hold')} disabled={!selectedSquads.length} testId="battle-hold" />
              <Cmd icon={formation === 'line' ? Rows : Columns} label={formation === 'line' ? 'Line' : 'Column'} onClick={onFormation} testId="battle-formation" />
              <Cmd icon={Undo2} label="Retreat" onClick={() => onCommand('retreat')} disabled={!selectedSquads.length} danger testId="battle-retreat-selected" />
            </div>
          </div>
        </div>
      )}

      {selectMode && !pauseOpen && (
        <div className="absolute left-2 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] max-w-[250px] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-good text-xs font-semibold shadow-xl pointer-events-none" data-testid="battle-select-mode-banner">
          Drag a box. Two fingers move the map.
        </div>
      )}
      {selectHint && !selectMode && !pauseOpen && (
        <div className="absolute left-2 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] max-w-[250px] px-3 py-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-line text-xs font-semibold shadow-xl pointer-events-none" data-testid="battle-select-hint">
          {mouse
            ? 'Left click selects (shift adds), click the ground to let go, drag a box. Right click orders; right drag draws a battle line.'
            : 'Tap a unit or building to select, tap it again to let go. Drag a box: tap Select, or double-tap and drag.'}
        </div>
      )}

      {showReserves && !pauseOpen && (
        <div className="absolute left-2 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] w-64 max-w-[calc(100vw-1rem)] p-2 fa-panel !bg-fa-panel shadow-2xl text-xs space-y-1.5">
          <div className="flex items-center justify-between"><span className="fa-label">Reserves and reinforcements</span><button type="button" onClick={() => setShowReserves(false)} aria-label="Close" className="p-1"><X className="w-4 h-4" /></button></div>
          {reserves.map((q) => (
            <button key={q.idx} type="button" disabled={q.enterTick >= 0 || supply < q.callCost}
              onClick={() => onCallReserve(q.idx)}
              className="w-full min-h-[44px] px-2 py-1 fa-option flex items-center justify-between gap-2 text-left disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate">{getSquadDisplayName(q.classId, ageId)}, <span className="fa-num">{q.strength}</span></span>
                {q.reinforcement && <span className="block text-[10px] text-fa-you truncate">from {q.reinforcement.name}</span>}
              </span>
              <span className="fa-num text-fa-brass shrink-0">{q.enterTick >= 0 ? 'Marching' : `${q.callCost} supply`}</span>
            </button>
          ))}
        </div>
      )}

      {/* B06 pause sheet: on the right; Retreat set apart from Switch to Auto */}
      {pauseOpen && (
        <div className="absolute right-0 top-11 bottom-0 w-[min(21rem,100vw)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-fa-panel border-l border-fa-line shadow-2xl overflow-y-auto pointer-events-auto flex flex-col gap-2.5" data-testid="battle-pause-sheet" role="dialog" aria-label="Paused">
          <div className="flex items-center justify-between"><h2 className="fa-heading text-[18px]">Paused</h2><button type="button" onClick={() => setSheetHidden(true)} className="fa-btn fa-btn-ghost !min-h-[36px] !px-2 text-[12px]" data-testid="battle-pause-orders">Give orders</button></div>
          <button type="button" onClick={onTogglePause} className="fa-btn fa-btn-primary fa-btn-hero !min-h-[48px] w-full" data-testid="battle-resume">Resume</button>
          <div>
            <div className="fa-label mb-1">Speed</div>
            <div role="radiogroup" aria-label="Speed" className="flex gap-1 p-1 rounded-[10px] border border-fa-line bg-fa-ink/40">
              {SPEEDS.map((s) => <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => onSpeed(s)} className={cx('fa-option flex-1 min-h-[40px] fa-num text-[14px] font-semibold border-transparent bg-transparent', speed === s && 'fa-selected')}>{s}×</button>)}
            </div>
            <div className="text-[11.5px] text-fa-muted mt-1">About {minutesLeft(timeLeft, 1)} minute{minutesLeft(timeLeft, 1) === 1 ? '' : 's'} of battle left at 1×{speed > 1 ? `, ${minutesLeft(timeLeft, speed)} at ${speed}×` : ''}.</div>
          </div>
          <div className="flex gap-2">
            {onAbandon && <button type="button" onClick={() => onAbandon()} className="fa-btn fa-btn-secondary flex-1 !min-h-[44px]" data-testid="battle-switch-auto">Switch to Auto</button>}
            <button type="button" onClick={() => setConfirmRetreat(true)} className="fa-btn fa-btn-danger flex-1 !min-h-[44px]" data-testid="battle-leave">Retreat</button>
            {onToggleSound && <button type="button" onClick={onToggleSound} aria-label={soundOn ? 'Mute the sound' : 'Turn the sound on'} className="fa-icon-btn shrink-0" data-testid="battle-sound">{soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>}
          </div>
          {powerCards.length > 0 && (
            <div>
              <div className="fa-label mb-1">Powers, usable while paused</div>
              <div className="grid grid-cols-3 gap-1.5">{powerCards.map((pw) => <PowerCard key={pw.id} pw={pw} supply={supply} armed={armed?.type === 'power' && armed.id === pw.id} onClick={() => firePower(pw)} />)}</div>
            </div>
          )}
          <div className="text-[11px] text-fa-muted mt-auto">Retreat asks once more. Your regiments leave by the nearest exit{bt === BATTLE_TYPES.assault ? '; the siege is lifted' : ''}. Switch to Auto finishes this battle by the same rules, at once.</div>
        </div>
      )}

      {started && paused && sheetHidden && (
        <button type="button" onClick={() => setSheetHidden(false)} className="absolute left-1/2 -translate-x-1/2 bottom-[calc(7.4rem+env(safe-area-inset-bottom))] fa-chip !bg-fa-panel/95 !min-h-[36px] pointer-events-auto" data-testid="battle-paused-pill">Paused: menu</button>
      )}

      {confirmNuke && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-sm fa-panel !bg-fa-panel !border-fa-danger p-4 text-sm space-y-3">
            <div className="fa-heading text-[17px] text-fa-danger-text">Launch a nuclear strike?</div>
            <p className="text-xs text-fa-muted">Everything within the blast, your own troops included, is destroyed. It uses one of your real nuclear missiles, and the whole world will condemn you: hostility from every nation, lost prestige, and pariah status.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmNuke(null)} className="fa-btn fa-btn-secondary">Cancel</button>
              <button type="button" onClick={() => { onPower(confirmNuke); setConfirmNuke(null); }} className="fa-btn fa-btn-danger">Choose target</button>
            </div>
          </div>
        </div>
      )}

      {confirmRetreat && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-sm fa-panel !bg-fa-panel p-4 text-sm space-y-3" data-testid="battle-retreat-confirm">
            <div className="fa-heading text-[17px]">Retreat from the battle?</div>
            <p className="text-xs text-fa-muted">Sound the retreat: your regiments march off the field and survive with the strength they have left. The battle counts as lost.</p>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => { setConfirmRetreat(false); onRetreatAll(); }} className="fa-btn fa-btn-danger !min-h-[44px]" data-testid="battle-retreat-all">Sound the retreat</button>
              {onAbandon && <button type="button" onClick={() => { setConfirmRetreat(false); onAbandon(); }} className="fa-btn fa-btn-secondary !min-h-[44px]">Switch to Auto instead</button>}
              <button type="button" onClick={() => setConfirmRetreat(false)} className="fa-btn fa-btn-ghost !min-h-[44px]">Keep fighting</button>
            </div>
          </div>
        </div>
      )}
      </>}
    </>
  );
};

export default BattleHud;
