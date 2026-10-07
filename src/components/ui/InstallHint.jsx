// src/components/ui/InstallHint.jsx
// A one-time hint on an iPhone or iPad in the browser (plans/ui/safari): "Add to Home Screen" opens
// the game full screen, without Safari's address and tab bars taking the height. Shown once, a few
// seconds into a game, never in the home screen app itself; it goes away by itself or with X, and
// either way it is not shown again in this browser.
import React, { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

export const INSTALL_HINT_STORAGE_KEY = 'terra-imperium-install-hint-seen';
const SHOW_AFTER_MS = 6000;
const HIDE_AFTER_MS = 20000;

/** True on iOS / iPadOS in a browser tab (not the home screen app). Pure over its inputs. */
export const wantsInstallHint = ({ userAgent = '', maxTouchPoints = 0, platform = '', standalone = false, displayModeApp = false, seen = false } = {}) => {
  if (seen || standalone || displayModeApp) return false;
  const iPhoneOrIPad = /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  return iPhoneOrIPad;
};

const readSeen = () => { try { return localStorage.getItem(INSTALL_HINT_STORAGE_KEY) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(INSTALL_HINT_STORAGE_KEY, '1'); } catch { /* storage off: this session only */ } };

const shouldShowHere = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const app = (q) => { try { return window.matchMedia?.(q).matches; } catch { return false; } };
  return wantsInstallHint({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    platform: navigator.platform || '',
    standalone: navigator.standalone === true,
    displayModeApp: app('(display-mode: standalone)') || app('(display-mode: fullscreen)'),
    seen: readSeen()
  });
};

const InstallHint = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!shouldShowHere()) return undefined;
    const show = setTimeout(() => { setOpen(true); markSeen(); }, SHOW_AFTER_MS);
    return () => clearTimeout(show);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const hide = setTimeout(() => setOpen(false), HIDE_AFTER_MS);
    return () => clearTimeout(hide);
  }, [open]);
  if (!open) return null;
  return (
    <div role="status" data-testid="install-hint"
      className="fixed z-[25] left-1/2 -translate-x-1/2 top-[calc(var(--header-height,2.25rem)+0.5rem)] w-[min(24rem,calc(100vw-2rem))] fa-panel !bg-fa-panel shadow-2xl flex items-center gap-3 pl-3 pr-1 py-1 text-xs text-fa-text">
      <Share className="w-5 h-5 text-fa-you shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">Play full screen:</span> tap Share, then <span className="font-semibold">Add to Home Screen</span>. No Safari bars over the game.
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-fa-muted hover:text-fa-text hover:bg-fa-raised"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default InstallHint;
