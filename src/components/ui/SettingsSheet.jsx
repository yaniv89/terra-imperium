// src/components/ui/SettingsSheet.jsx
// Settings (W12, plans/UI-DESIGN.md): "saved as you change them". Opened from Menu on the tab rail.
//   Map       the globe view (hidden by default) and the old map drawing (mapPrefs.js, per browser)
//   Battles   the default mode the pre-battle screen preselects (Command, Auto or ask each time),
//             always Auto for defences, instant AI battles (state.battleSettings, per game)
//   Turns     warn me before End Turn while something waits
//   Saves     export, import, the cloud saves and account (AccountModal), a new game
// Battle size, graphics quality and the device check belong to the battle settings of phase R2.
import React, { useRef } from 'react';
import { Settings2, Download, Upload, Cloud, RotateCcw } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { SAVE_PROBLEM_TEXT } from '../../engine/saveMigrations';
import { useMapPrefs, setMapPrefs } from '../map/mapPrefs';
import { fogOn } from '../../engine/fog';
import { Button, Label, SheetHeader, Segmented, Switch } from './atlas';

const MODES = [
  { id: 'command', label: 'Command', testId: 'battle-mode-command' },
  { id: 'auto', label: 'Auto', testId: 'battle-mode-auto' },
  { id: 'ask', label: 'Ask each time', testId: 'battle-mode-ask' }
];

const SettingsSheet = ({ open, onClose, onOpenAccount, onReset, cloudLabel }) => {
  const { state, dispatch, exportSave, importSave } = useGame();
  const prefs = useMapPrefs();
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
        className="sheet-panel fa-sheet w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-[10px] border border-fa-line shadow-2xl">
        <SheetHeader title="Settings" subtitle="Saved as you change them" icon={Settings2} onClose={onClose} titleId="settings-title" />
        <div className="flex-1 overflow-y-auto px-4 pb-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
          <section className="space-y-1" aria-labelledby="settings-map">
            <Label id="settings-map">Map</Label>
            <Switch label="Globe view" hint="Hidden by default; the flat map is faster" checked={prefs.globe} onChange={(v) => setMapPrefs({ globe: v })} testId="map-show-globe" />
            <Switch label="Old map drawing" hint="The previous, slower map; only if the new one shows something wrong here" checked={prefs.renderer === 'svg'} onChange={(v) => setMapPrefs({ renderer: v ? 'svg' : 'webgl' })} testId="map-old-renderer" />
            <div className="text-[12px] text-fa-muted pt-1">Fog of war: {fogOn(state) ? 'on' : 'off, the explored world'} (chosen when the game began).</div>
          </section>
          <section className="space-y-2" aria-labelledby="settings-battles">
            <Label id="settings-battles">Battles, default mode</Label>
            <Segmented label="Battles, default mode" options={MODES} value={mode} onChange={(v) => setBattle({ defaultMode: v })} />
            <p className="text-[12px] text-fa-muted">{mode === 'ask' ? 'The pre-battle screen asks each time, Command or Auto.' : `The pre-battle screen starts on ${mode === 'command' ? 'Command' : 'Auto'}; you can still switch.`}</p>
            <Switch label="Always Auto for defences" hint="Assaults on your cities resolve at once when the turn ends" checked={bs.autoDefend === true} onChange={(v) => setBattle({ autoDefend: v })} testId="settings-auto-defend" />
            <Switch label="Instant AI battles" hint="Battles between other peoples skip the replay" checked={bs.instantBattles === true} onChange={(v) => setBattle({ instantBattles: v })} testId="settings-instant" />
          </section>
          <section className="space-y-1" aria-labelledby="settings-turns">
            <Label id="settings-turns">Turns</Label>
            <Switch label="Warn me before End Turn" hint="The first tap shows what still waits; the second ends the turn" checked={bs.warnEndTurn === true} onChange={(v) => setBattle({ warnEndTurn: v })} testId="settings-warn-end-turn" />
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
