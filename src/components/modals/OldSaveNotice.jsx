// src/components/modals/OldSaveNotice.jsx
// The save v7 screen (plans/civ-map-rework.md, workstream 13). Save version 7 is the tile world,
// a clean break: a save from the province map cannot be converted, so the game started fresh
// and the old save was set aside (GameContext OLD_SAVE_KEY). This card says so once, offers the
// old file for download, and is dismissed for good. 44 px targets, phone width first.
import React, { useState } from 'react';
import { Download, X, Archive } from 'lucide-react';
import { getPendingSaveProblem, dismissSaveProblem, getOldSaveText } from '../../context/GameContext';
import { SAVE_PROBLEM_TEXT } from '../../engine/saveMigrations';

const OldSaveNotice = () => {
  const [problem, setProblem] = useState(() => getPendingSaveProblem());
  if (!problem) return null;
  const download = () => {
    const text = getOldSaveText() || problem.raw;
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'terra-imperium-old-save.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const close = () => { dismissSaveProblem(); setProblem(null); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4" data-testid="old-save-notice">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl p-4 text-slate-100">
        <div className="flex items-start gap-3">
          <Archive className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold">Your old save was set aside</div>
            <p className="text-sm text-slate-300 mt-1">{SAVE_PROBLEM_TEXT[problem.reason] || SAVE_PROBLEM_TEXT.corrupt} A new game has started on the new world. The old save is kept on this device; download it if you want to keep a copy.</p>
          </div>
          <button type="button" onClick={close} aria-label="Dismiss" className="p-2 -mr-2 -mt-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 min-w-[44px] min-h-[44px]"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={download} className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-2" data-testid="old-save-download"><Download className="w-4 h-4" /> Download the old save</button>
          <button type="button" onClick={close} className="min-h-[44px] px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Continue</button>
        </div>
      </div>
    </div>
  );
};

export default OldSaveNotice;
