// src/components/ui/SettingsSheet.jsx
// Settings (W12, plans/UI-DESIGN.md): "saved as you change them". Opened from Menu on the tab rail.
//   Map       the globe view (hidden by default) and the old map drawing (mapPrefs.js, per browser)
//   Battles   the default mode the pre-battle screen preselects (Command, Auto or ask each time),
//             always Auto for defences, instant AI battles (state.battleSettings, per game)
//             and the battle size (300 a side, the one size today)
//   Sound     the Sound switch, effects volume, music volume (src/audio/audioSettings.js, per device)
//   Performance  the battle's performance overlay (mapPrefs.js perf, per browser) and the quality
//             (Auto: the battle adapts soldier detail to the frame time)
//   Turns     warn me before End Turn while armies or settlers can still move
//   Saves     export, import, the cloud saves and account (AccountModal), a new game
// Not here yet (no engine for them; plans/UI-DESIGN.md W12): the 500 and 1,000 battle sizes and the
// device check that measures them, a quality choice, a world-map overlay, a language choice.
import React, { useRef, useState } from 'react';
import { Settings2, Download, Upload, Cloud, RotateCcw } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { SAVE_PROBLEM_TEXT } from '../../engine/saveMigrations';
import { useMapPrefs, setMapPrefs } from '../map/mapPrefs';
import { fogOn } from '../../engine/fog';
import { Button, Label, SheetHeader, Segmented, Switch } from './atlas';
import { useAudioSettings, setAudioSettings } from '../../audio/audioSettings';
import { turnLogText } from '../../services/turnClient';

// The turn worker's recent events (turnClient.js) for a bug report: copied, or shown to copy by hand.
const TurnLogButton = () => {
  const [state, setState] = useState(null); // null | 'copied' | text shown
  const copy = async () => {
    const text = turnLogText();
    try { await navigator.clipboard.writeText(text); setState('copied'); } catch { setState(text); }
  };
  return (
    <div className="space-y-1">
      <Button onClick={copy} data-testid="settings-copy-turn-log">{state === 'copied' ? 'Turn log copied' : 'Copy turn log'}</Button>
      <p className="text-[12px] text-fa-muted">For a bug report when End Turn hangs: what the turn worker did in the last turns.</p>
      {state && state !== 'copied' && <textarea readOnly value={state} rows={6} className="w-full fa-num text-[11px] bg-fa-ink border border-fa-line rounded p-1" onFocus={(e) => e.target.select()} aria-label="Turn log" />}
    </div>
  );
};

// A 0..100% volume slider, saved as you drag (src/audio/audioSettings.js).
const Volume = ({ label, hint, value, onChange, disabled, testId }) => (
  <label className={`flex items-center justify-between gap-3 min-h-[44px] ${disabled ? 'opacity-50' : ''}`}>
    <span className="min-w-0">
      <span className="block text-[14px] font-semibold leading-tight">{label}</span>
      <span className="block text-[12px] text-fa-muted leading-snug">{hint}</span>
    </span>
    <input type="range" min="0" max="100" step="5" value={Math.round(value * 100)} disabled={disabled} aria-label={label} data-testid={testId}
      onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-32 shrink-0 accent-[var(--fa-good)]" />
  </label>
);

const MODES = [
  { id: 'command', label: 'Command', testId: 'battle-mode-command' },
  { id: 'auto', label: 'Auto', testId: 'battle-mode-auto' },
  { id: 'ask', label: 'Ask each time', testId: 'battle-mode-ask' }
];

const SettingsSheet = ({ open, onClose, onOpenAccount, onReset, cloudLabel }) => {
  const { state, dispatch, exportSave, importSave } = useGame();
  const prefs = useMapPrefs();
  const audio = useAudioSettings();
  const fileRef = useRef(null);
  if (!open) return null;
  const bs = state.battleSettings || {};
  const setBattle = (patch) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: patch });
  const mode = bs.defaultMode === 'command' || bs.defaultMode === 'auto' ? bs.defaultMode : 'ask';

  const handleExport = () => {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terra-imperium-${state.playerNationId}-${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importSave(String(reader.result));
      if (ok !== true) window.alert(SAVE_PROBLEM_TEXT[ok] || SAVE_PROBLEM_TEXT.corrupt);
      else onClose();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3 sheet-backdrop" onClick={onClose} data-testid="settings-sheet">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}
        className="sheet-panel sheet-wide fa-sheet w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title="Settings" subtitle="Saved as you change them" icon={Settings2} onClose={onClose} titleId="settings-title" />
        <div className="flex-1 overflow-y-auto px-4 pb-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
          <section className="space-y-1" aria-labelledby="settings-map">
            <Label id="settings-map">Map</Label>
            <Switch label="Globe view" hint="Hidden by default; the flat map is faster" checked={prefs.globe} onChange={(v) => setMapPrefs({ globe: v })} testId="map-show-globe" />
            <Switch label="Fog: explored world" hint={fogOn(state) ? 'Off: chosen when the game began' : 'On: chosen when the game began'} checked={!fogOn(state)} onChange={() => {}} disabled testId="settings-fog" />
            <Switch label="Old map drawing" hint="The previous, slower map; only if the new one shows something wrong here" checked={prefs.renderer === 'svg'} onChange={(v) => setMapPrefs({ renderer: v ? 'svg' : 'webgl' })} testId="map-old-renderer" />
          </section>
          <section className="space-y-2" aria-labelledby="settings-battles">
            <Label id="settings-battles">Battles, default mode</Label>
            <Segmented label="Battles, default mode" options={MODES} value={mode} onChange={(v) => setBattle({ defaultMode: v })} />
            <p className="text-[12px] text-fa-muted">{mode === 'ask' ? 'The pre-battle screen asks each time, Command or Auto.' : `The pre-battle screen starts on ${mode === 'command' ? 'Command' : 'Auto'}; you can still switch.`}</p>
            <Switch label="Always Auto for defences" hint="Assaults on your cities resolve at once when the turn ends" checked={bs.autoDefend === true} onChange={(v) => setBattle({ autoDefend: v })} testId="settings-auto-defend" />
            <Switch label="Instant AI battles" hint="Battles between other peoples skip the replay" checked={bs.instantBattles === true} onChange={(v) => setBattle({ instantBattles: v })} testId="settings-instant" />
            <div className="flex items-center justify-between gap-3 min-h-[44px]" data-testid="settings-battle-size">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">Battle size</div>
                <div className="text-[12px] text-fa-muted leading-snug">Bigger armies fight in waves. Larger sizes come with a device check.</div>
              </div>
              <span className="fa-chip shrink-0" aria-pressed="true"><span className="fa-num">300</span> a side</span>
            </div>
          </section>
          <section className="space-y-1" aria-labelledby="settings-sound">
            <Label id="settings-sound">Sound</Label>
            <Switch label="Sound" hint="All sound (battle, interface, voices, music) and vibration; the speaker button in a battle is the same switch" checked={audio.sound} onChange={(v) => setAudioSettings({ sound: v })} testId="settings-sound" />
            <Switch label="Battle sounds" hint="Sounds in RTS battles; off mutes them only" checked={audio.effectsOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ effectsOn: v })} testId="settings-effects-on" />
            <Switch label="Music" hint="Background music on the map; off mutes it only" checked={audio.musicOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ musicOn: v })} testId="settings-music-on" />
            <Switch label="Interface sounds" hint="Taps, panels and the news of the world map (a city founded, war declared)" checked={audio.uiOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ uiOn: v })} testId="settings-ui-on" />
            <Switch label="Unit voices" hint="A short shout when you select or order troops in a battle" checked={audio.voicesOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ voicesOn: v })} testId="settings-voices-on" />
            <Volume label="Effects volume" hint="Battle sounds, interface sounds and unit voices" value={audio.effects} disabled={!audio.sound || (!audio.effectsOn && !audio.uiOn && !audio.voicesOn)} onChange={(v) => setAudioSettings({ effects: v })} testId="settings-effects-volume" />
            <Volume label="Music volume" hint="Music and ambience on the map; off in battles" value={audio.music} disabled={!audio.sound || !audio.musicOn} onChange={(v) => setAudioSettings({ music: v })} testId="settings-music-volume" />
          </section>
          <section className="space-y-1" aria-labelledby="settings-perf">
            <Label id="settings-perf">Performance</Label>
            <Switch label="Performance overlay" hint="Frames a second and ms a frame in battles, top centre" checked={prefs.perf} onChange={(v) => setMapPrefs({ perf: v })} testId="settings-perf-overlay" />
            <div className="flex items-center justify-between gap-3 min-h-[44px]">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">Quality</div>
                <div className="text-[12px] text-fa-muted leading-snug">The battle lowers soldier detail on slow frames and raises it again when frames are fast.</div>
              </div>
              <span className="fa-chip shrink-0" aria-pressed="true">Auto</span>
            </div>
          </section>
          <section className="space-y-1" aria-labelledby="settings-turns">
            <Label id="settings-turns">Turns</Label>
            <Switch label="Warn me before End Turn" hint="Armies and settlers that can still move: the first tap shows them, the second ends the turn" checked={bs.warnEndTurn === true} onChange={(v) => setBattle({ warnEndTurn: v })} testId="settings-warn-end-turn" />
            <TurnLogButton />
          </section>
          <section className="space-y-2" aria-labelledby="settings-saves">
            <Label id="settings-saves">Saves</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleExport}><Download className="w-4 h-4" aria-hidden="true" />Export save</Button>
              <Button onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" aria-hidden="true" />Import save</Button>
              <Button onClick={onOpenAccount} className="col-span-2"><Cloud className="w-4 h-4" aria-hidden="true" />{cloudLabel || 'Cloud saves and account'}</Button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" aria-label="Choose a save file" />
            <p className="text-[12px] text-fa-muted">The game also saves itself on this device after every turn.</p>
          </section>
          <section className="md:col-span-2 pt-2 border-t border-fa-line flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-fa-muted">Turn {state.turnNumber}, {state.nations[state.playerNationId]?.name}</span>
            <Button variant="danger" onClick={() => { onClose(); onReset(); }}><RotateCcw className="w-4 h-4" aria-hidden="true" />New game</Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsSheet;
