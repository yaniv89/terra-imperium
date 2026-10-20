// src/hooks/useExclusivePanel.js
// The one interaction registry (playtest audit X16): every card, sheet, dock and notice that wants
// the middle of the screen registers here while it is open, and the registry says which one shows
// (interactionModel.js holds the rules). It grew out of the two side panels taking turns (the tab
// dock and the city panel, which together covered 65 to 90% of a laptop or a landscape phone); now
// on a phone or a tablet a decision card that arrives tucks the dock, two cards never show
// together, and whatever waits is a chip (WaitingChips.jsx) that brings it back. A desktop keeps
// its panels beside the cards.
//
//   const { shown, tuck, promote } = useInteraction('defense', open, { priority, kind, label });
//   if (!shown) return null;   // it waits as a chip, or (a panel) simply stays closed
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { closePanels } from '../components/panels/panelEvents';
import { getLayoutMode } from './useLayoutMode';
import {
  emptyInteractions, openInteraction, closeInteraction, promoteInteraction, tuckInteraction,
  relabelInteraction, isShown, waitingChips, EXCLUSIVE_BELOW_WIDTH, PRIORITY
} from './interactionModel';

export { EXCLUSIVE_BELOW_WIDTH, PRIORITY };

const hasWindow = typeof window !== 'undefined';
const widthNow = () => (hasWindow ? window.innerWidth : EXCLUSIVE_BELOW_WIDTH);
// The one-card rule is for phones and tablets (useLayoutMode.js writes the layout on <html>).
const compactNow = () => hasWindow && getLayoutMode(window.innerWidth, window.innerHeight) !== 'desktop';

let model = emptyInteractions();
let chipsCache = null; // { model, width, chips }
const listeners = new Set();
// Overlays the player can dismiss (a sheet, the log, march mode): End Turn closes them all and acts.
const dismissers = new Set();
const openListeners = new Set();
let resizeBound = false;

const emit = () => listeners.forEach((fn) => fn());
const set = (next) => { if (next === model) return; model = next; emit(); };
const subscribe = (fn) => {
  listeners.add(fn);
  if (hasWindow && !resizeBound) { resizeBound = true; window.addEventListener('resize', emit); }
  return () => listeners.delete(fn);
};

/** The registry's actions, for the places that are not a component (End Turn's blockers, chips). */
export const interactions = {
  open: (entry, opts) => { const before = model; set(openInteraction(model, entry, opts)); if (model !== before) openListeners.forEach((fn) => fn(entry.id)); },
  close: (id) => set(closeInteraction(model, id)),
  promote: (id) => { set(promoteInteraction(model, id)); openListeners.forEach((fn) => fn(id)); },
  tuck: (id) => set(tuckInteraction(model, id)),
  relabel: (id, patch) => set(relabelInteraction(model, id, patch)),
  isShown: (id) => isShown(model, id, widthNow(), compactNow()),
  chips: () => {
    const width = widthNow();
    const compact = compactNow();
    if (!chipsCache || chipsCache.model !== model || chipsCache.width !== width || chipsCache.compact !== compact) chipsCache = { model, width, compact, chips: waitingChips(model, width, compact) };
    return chipsCache.chips;
  },
  /** Close every overlay that asked to be dismissable (useDismissOverlays), and the tab dock. */
  dismissOverlays: () => { [...dismissers].forEach((fn) => fn()); if (hasWindow) closePanels(); },
  /** Register a dismisser; returns the way to withdraw it. (useDismissOverlays calls this.) */
  addDismisser: (fn) => { dismissers.add(fn); emit(); return () => { dismissers.delete(fn); emit(); }; },
  /** For tests. */
  reset: () => { model = emptyInteractions(); chipsCache = null; dismissers.clear(); emit(); }
};

// On the server (the tests render components to a string) nothing registers: everything shows.
const useIsoLayoutEffect = hasWindow ? useLayoutEffect : useEffect;
const NO_CHIPS = [];

/**
 * Register `id` while `open`. Options: `priority` (interactionModel PRIORITY), `kind` ('card',
 * 'panel' or 'notice'), `label` (the chip's words while it waits), `testId` and `tone` for that
 * chip, `user` (the player opened it: it takes the screen from anything).
 * Returns `shown` (draw it now), `tuck()` (set it aside as a chip) and `promote()` (bring it up).
 */
export const useInteraction = (id, open, { priority = PRIORITY.sheet, kind = 'card', label = null, testId = null, tone = null, user = false } = {}) => {
  useIsoLayoutEffect(() => {
    if (!open) return undefined;
    interactions.open({ id, priority, kind, label, testId, tone }, { user });
    return () => interactions.close(id);
    // Not in the list on purpose: the words are kept fresh below, and `user` only matters at the
    // moment it opens.
  }, [id, open, priority, kind]);
  useEffect(() => { if (open) interactions.relabel(id, { label, testId, tone }); }, [id, open, label, testId, tone]);
  const shown = useSyncExternalStore(subscribe, () => interactions.isShown(id), () => true);
  return { shown: !!open && shown, tuck: () => interactions.tuck(id), promote: () => interactions.promote(id) };
};

/**
 * A corner sheet the player opened (an army, a tile, a nation): on a phone or tablet it is the one
 * sheet on screen and the others close or wait (mobile audit H-18: the army card used to sit
 * behind the Research dock); a desktop keeps its sheets beside each other. A sheet that has to
 * give way calls `onClose`. Returns { shown }: draw nothing while false.
 */
export const useCornerSheet = (id, open, onClose) => {
  const compact = useSyncExternalStore(subscribe, compactNow, () => false);
  const panel = useInteraction(id, open && compact, { kind: 'panel', priority: PRIORITY.panel, user: true });
  const tucked = open && compact && !panel.shown;
  useEffect(() => { if (tucked) onClose?.(); }, [tucked]); // eslint-disable-line react-hooks/exhaustive-deps
  return { shown: open && (!compact || panel.shown) };
};

/**
 * While `active`, `fn` closes this overlay when End Turn (or anything else) dismisses them all
 * (interactions.dismissOverlays). Decision cards never register: they stay until answered.
 */
export const useDismissOverlays = (fn, active = true) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    return interactions.addDismisser(() => ref.current());
  }, [active]);
};

/** Is any dismissable overlay open? End Turn rides above the sheets while one is. */
export const useOverlayOpen = () => useSyncExternalStore(subscribe, () => dismissers.size > 0, () => false);

/** The cards and notices that wait, for the chips. */
export const useWaitingChips = () => useSyncExternalStore(subscribe, interactions.chips, () => NO_CHIPS);

/** Call `fn(id)` whenever something opens or is brought up (a popover closes itself on it). */
export const useOnInteractionOpen = (fn) => {
  useEffect(() => { openListeners.add(fn); return () => openListeners.delete(fn); }, [fn]);
};
