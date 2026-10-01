// src/components/ui/RotateOverlay.jsx
// A phone held upright gets "rotate your phone": the game is laid out for landscape (a wide map,
// a tab rail, side panels). Browsers can't lock orientation reliably (iOS Safari has no
// screen.orientation.lock), so the web build asks; the native app locks itself (AndroidManifest
// screenOrientation, iOS Info.plist). "Play in portrait anyway" keeps the original phone layout
// (bottom tab bar and sheets) and is remembered per browser (useLayoutMode.js allowPortrait).
import React from 'react';
import { RotateCw, Smartphone } from 'lucide-react';
import { useLayoutMode, allowPortrait } from '../../hooks/useLayoutMode';

const RotateOverlay = () => {
  if (useLayoutMode() !== 'phone-portrait') return null;
  return (
    <div
      data-testid="rotate-overlay"
      className="fixed inset-0 z-[200] bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-5 p-8 text-center
                 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]"
    >
      <div className="relative w-24 h-24 flex items-center justify-center">
        <Smartphone className="w-16 h-16 text-blue-400 rotate-90 motion-safe:animate-pulse" />
        <RotateCw className="absolute -top-1 -right-1 w-8 h-8 text-slate-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Rotate your phone</h2>
        <p className="text-sm text-slate-400 max-w-xs">Terra Imperium is made for landscape: the whole map in view, with your panels at the side.</p>
      </div>
      <button
        onClick={allowPortrait}
        className="mt-2 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200 p-2"
      >
        Play in portrait anyway
      </button>
    </div>
  );
};

export default RotateOverlay;
