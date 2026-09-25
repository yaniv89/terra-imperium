// src/components/modals/ConflictChooserModal.jsx
// Plan §M0.5: shown when src/hooks/useCloudSync.js's resolveSyncState finds this device and the
// cloud autosave both moved on since their last common sync point. There is no silent merge — the
// player picks a side and the other is overwritten.
import React from 'react';
import { Laptop, Cloud } from 'lucide-react';

const ConflictChooserModal = ({ conflict, onChoose }) => {
  if (!conflict) return null;
  const { local, cloud } = conflict;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border-2 border-amber-500/50 max-w-lg w-full shadow-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-1">Which game do you want to keep?</h2>
        <p className="text-slate-400 text-sm mb-4">
          This device and your cloud save have both moved on since they last matched. Pick one — the other will be overwritten.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChoose('useLocal')}
            className="text-left p-4 rounded-lg border-2 border-slate-700 bg-slate-800 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
              <Laptop className="w-4 h-4" /> This device
            </div>
            <p className="text-xs text-slate-400">Turn {local?.turnNumber ?? '?'}</p>
          </button>
          <button
            onClick={() => onChoose('useCloud')}
            className="text-left p-4 rounded-lg border-2 border-slate-700 bg-slate-800 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
              <Cloud className="w-4 h-4" /> Cloud
            </div>
            <p className="text-xs text-slate-400">
              {cloud?.nation_name || cloud?.nation_id || 'Unknown nation'} · Turn {cloud?.turn_number ?? '?'}
              {cloud?.saved_at ? ` · ${new Date(cloud.saved_at).toLocaleString()}` : ''}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictChooserModal;
