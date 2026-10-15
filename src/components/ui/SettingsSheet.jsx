// src/components/ui/SettingsSheet.jsx
// Settings (W12, plans/UI-DESIGN.md): "saved as you change them". Opened from Menu on the tab rail.
//   Map       the old map drawing (the globe switch is hidden, user answer Q8) (mapPrefs.js, per browser);
//             the game's map (MapCard.jsx: the map code, Clear cached worlds)
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
import MapCard from './MapCard';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import LanguageSwitch from './LanguageSwitch';
import FullscreenButton from './FullscreenButton';

// The turn worker's recent events (turnClient.js) for a bug report: copied, or shown to copy by hand.
const TurnLogButton = () => {
  const { t } = useT();
  const [state, setState] = useState(null); // null | 'copied' | text shown
  const copy = async () => {
    const text = turnLogText();
    try { await navigator.clipboard.writeText(text); setState('copied'); } catch { setState(text); }
  };
  return (
    <div className="space-y-1">
      <Button onClick={copy} data-testid="settings-copy-turn-log">{state === 'copied' ? t('menu.logCopied') : t('menu.copyLog')}</Button>
      <p className="text-[12px] text-fa-muted">{t('menu.logHint')}</p>
      {state && state !== 'copied' && <textarea readOnly value={state} rows={6} className="w-full fa-num text-[11px] bg-fa-ink border border-fa-line rounded p-1" onFocus={(e) => e.target.select()} aria-label={t('menu.logAria')} />}
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

const MODES = ['command', 'auto', 'ask'];

const SettingsSheet = ({ open, onClose, onOpenAccount, onReset, cloudLabel }) => {
  const { t, name } = useT();
  const { state, dispatch, exportSave, importSave } = useGame();
  const prefs = useMapPrefs();
  const audio = useAudioSettings();
  const fileRef = useRef(null);
  // A sheet the player opened: it takes the screen, and a decision card it covers waits as a chip
  // (useExclusivePanel.js).
  const turn = useInteraction('settings', open, { priority: PRIORITY.sheet, user: true, label: t('menu.title') });
  if (!open || !turn.shown) return null;
  const bs = state.battleSettings || {};
  const setBattle = (patch) => dispatch({ type: ActionTypes.SET_BATTLE_SETTINGS, payload: patch });
  const mode = bs.defaultMode === 'command' || bs.defaultMode === 'auto' ? bs.defaultMode : 'ask';
  const modeOptions = MODES.map((id) => ({ id, label: t(`menu.mode.${id}`), testId: `battle-mode-${id}` }));
  const cloudText = cloudLabel === 'Cloud saves: saved' ? t('menu.cloudSynced') : t('menu.cloud');

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
        <SheetHeader title={t('menu.title')} subtitle={t('menu.subtitle')} icon={Settings2} onClose={onClose} titleId="settings-title" />
        <div className="flex-1 overflow-y-auto px-4 pb-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
          <section className="md:col-span-2" data-testid="settings-language"><LanguageSwitch /></section>
          <FullscreenButton className="md:col-span-2 justify-self-start" testId="settings-fullscreen" />
          <section className="space-y-1" aria-labelledby="settings-map">
            <Label id="settings-map">{t('menu.map')}</Label>
            {/* The globe is hidden (user answer Q8, playtest audit I079): its code stays (mapPrefs.js
                `globe`, GlobeContainer), the switch is off the screen. Its fog is not kept up.
            <Switch label="Globe view" hint="Hidden by default; the flat map is faster" checked={prefs.globe} onChange={(v) => setMapPrefs({ globe: v })} testId="map-show-globe" /> */}
            <Switch label={t('menu.fog')} hint={fogOn(state) ? t('menu.fogOff') : t('menu.fogOn')} checked={!fogOn(state)} onChange={() => {}} disabled testId="settings-fog" />
            <Switch label={t('menu.oldMap')} hint={t('menu.oldMapHint')} checked={prefs.renderer === 'svg'} onChange={(v) => setMapPrefs({ renderer: v ? 'svg' : 'webgl' })} testId="map-old-renderer" />
            <MapCard map={state.scenario?.map} withCache className="pt-2" label={t('menu.thisWorld')} />
          </section>
          <section className="space-y-2" aria-labelledby="settings-battles">
            <Label id="settings-battles">{t('menu.battles')}</Label>
            <Segmented label={t('menu.battles')} options={modeOptions} value={mode} onChange={(v) => setBattle({ defaultMode: v })} />
            <p className="text-[12px] text-fa-muted">{t(`menu.modeHint.${mode}`)}</p>
            <Switch label={t('menu.autoDefend')} hint={t('menu.autoDefendHint')} checked={bs.autoDefend === true} onChange={(v) => setBattle({ autoDefend: v })} testId="settings-auto-defend" />
            <Switch label={t('menu.instant')} hint={t('menu.instantHint')} checked={bs.instantBattles === true} onChange={(v) => setBattle({ instantBattles: v })} testId="settings-instant" />
            <div className="flex items-center justify-between gap-3 min-h-[44px]" data-testid="settings-battle-size">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">{t('menu.battleSize')}</div>
                <div className="text-[12px] text-fa-muted leading-snug">{t('menu.battleSizeHint')}</div>
              </div>
              <span className="fa-chip shrink-0" aria-pressed="true">{t('menu.aSide', { n: 300 })}</span>
            </div>
          </section>
          <section className="space-y-1" aria-labelledby="settings-sound">
            <Label id="settings-sound">{t('menu.sound')}</Label>
            <Switch label={t('menu.sound')} hint={t('menu.soundHint')} checked={audio.sound} onChange={(v) => setAudioSettings({ sound: v })} testId="settings-sound" />
            <Switch label={t('menu.battleSounds')} hint={t('menu.battleSoundsHint')} checked={audio.effectsOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ effectsOn: v })} testId="settings-effects-on" />
            <Switch label={t('menu.music')} hint={t('menu.musicHint')} checked={audio.musicOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ musicOn: v })} testId="settings-music-on" />
            <Switch label={t('menu.uiSounds')} hint={t('menu.uiSoundsHint')} checked={audio.uiOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ uiOn: v })} testId="settings-ui-on" />
            <Switch label={t('menu.voices')} hint={t('menu.voicesHint')} checked={audio.voicesOn} disabled={!audio.sound} onChange={(v) => setAudioSettings({ voicesOn: v })} testId="settings-voices-on" />
            <Volume label={t('menu.effectsVolume')} hint={t('menu.effectsVolumeHint')} value={audio.effects} disabled={!audio.sound || (!audio.effectsOn && !audio.uiOn && !audio.voicesOn)} onChange={(v) => setAudioSettings({ effects: v })} testId="settings-effects-volume" />
            <Volume label={t('menu.musicVolume')} hint={t('menu.musicVolumeHint')} value={audio.music} disabled={!audio.sound || !audio.musicOn} onChange={(v) => setAudioSettings({ music: v })} testId="settings-music-volume" />
          </section>
          <section className="space-y-1" aria-labelledby="settings-perf">
            <Label id="settings-perf">{t('menu.performance')}</Label>
            <Switch label={t('menu.perfOverlay')} hint={t('menu.perfOverlayHint')} checked={prefs.perf} onChange={(v) => setMapPrefs({ perf: v })} testId="settings-perf-overlay" />
            <div className="flex items-center justify-between gap-3 min-h-[44px]">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">{t('menu.quality')}</div>
                <div className="text-[12px] text-fa-muted leading-snug">{t('menu.qualityHint')}</div>
              </div>
              <span className="fa-chip shrink-0" aria-pressed="true">{t('menu.qualityAuto')}</span>
            </div>
          </section>
          <section className="space-y-1" aria-labelledby="settings-turns">
            <Label id="settings-turns">{t('menu.turns')}</Label>
            <Switch label={t('menu.warnEnd')} hint={t('menu.warnEndHint')} checked={bs.warnEndTurn === true} onChange={(v) => setBattle({ warnEndTurn: v })} testId="settings-warn-end-turn" />
            <TurnLogButton />
          </section>
          <section className="space-y-2" aria-labelledby="settings-saves">
            <Label id="settings-saves">{t('menu.saves')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleExport}><Download className="w-4 h-4" aria-hidden="true" />{t('menu.export')}</Button>
              <Button onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" aria-hidden="true" />{t('menu.import')}</Button>
              <Button onClick={onOpenAccount} className="col-span-2"><Cloud className="w-4 h-4" aria-hidden="true" />{cloudText}</Button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" aria-label={t('menu.chooseFile')} />
            <p className="text-[12px] text-fa-muted">{t('menu.autosaveNote')}</p>
          </section>
          <section className="md:col-span-2 pt-2 border-t border-fa-line flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-fa-muted">{t('menu.turnLine', { turn: state.turnNumber, nation: name('people', state.playerNationId, state.nations[state.playerNationId]?.name) })}</span>
            <Button variant="danger" onClick={() => { onClose(); onReset(); }}><RotateCcw className="w-4 h-4" aria-hidden="true" />{t('menu.newGame')}</Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsSheet;
