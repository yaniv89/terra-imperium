// src/audio/uiSounds.js
// The interface's sounds in one place instead of in every button: one click listener on the
// document (taps, tabs, toggles) and one observer for sheets and dialogs opening and closing.
// Opt out or override on any element with data-sound="none" | "ui-click" | "ui-tab" | ...
// The tactical battle has its own order sounds (battleAudio.js), so taps inside it are left alone.
import { playSound } from './sfx';

const PRESSABLE = 'button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], a[href], input[type="checkbox"], input[type="radio"], select, summary';
export const SHEET_SELECTOR = '.sheet-panel, [role="dialog"]';
const BATTLE_ROOT = '[data-testid="tactical-battle"]';

/** The sound a tap on this element asks for, or null (pure over the DOM). */
export const uiSoundForElement = (target) => {
  const el = target?.closest?.(`[data-sound], ${PRESSABLE}`);
  if (!el) return null;
  const own = el.getAttribute('data-sound');
  if (own) return own === 'none' ? null : own;
  if (el.closest(BATTLE_ROOT)) return null;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
  const role = el.getAttribute('role');
  if (role === 'tab' || el.hasAttribute('aria-selected')) return 'ui-tab';
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (role === 'switch' || type === 'checkbox' || type === 'radio' || el.hasAttribute('aria-pressed')) return 'ui-toggle';
  return 'ui-click';
};

/** Does this added or removed node carry a sheet or a dialog? (pure over the DOM) */
export const carriesSheet = (node) => {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches?.(SHEET_SELECTOR)) return true;
  return node.childElementCount > 0 && !!node.querySelector?.(SHEET_SELECTOR);
};

/** Install the listeners on `doc` (a browser document); returns the uninstall function. */
export const installUiSounds = (doc = typeof document !== 'undefined' ? document : null) => {
  if (!doc?.addEventListener) return () => {};
  const onClick = (e) => { const id = uiSoundForElement(e.target); if (id) playSound(id); };
  doc.addEventListener('click', onClick, true);
  let observer = null;
  const MO = typeof window !== 'undefined' ? window.MutationObserver : null;
  if (MO && doc.body) {
    observer = new MO((records) => {
      let opened = false; let closed = false;
      for (const r of records) {
        for (const n of r.addedNodes) if (!opened && carriesSheet(n)) opened = true;
        for (const n of r.removedNodes) if (!closed && carriesSheet(n)) closed = true;
        if (opened && closed) break;
      }
      if (opened) playSound('ui-open');
      else if (closed) playSound('ui-close');
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }
  return () => { doc.removeEventListener('click', onClick, true); observer?.disconnect(); };
};
