// src/hooks/useAutoPeek.js
// Plan §5.2: while an action's animation plays, a mobile bottom sheet shrinks to a short "peek"
// height so the map above it — where the camera just flew to show the effect — is actually in view,
// then springs back. Without this, recruiting infantry from Manage Region -> Military played the
// whole recruit animation underneath the 65%-tall sheet.
//
// Returns `[peeking, cancelPeek]`. Only effects triggered AFTER the calling sheet mounted count
// (one already in flight when it opened isn't this sheet's doing), a tap on the sheet cancels the
// peek early (the player wants the panel back now), and reduced-motion users never peek — the
// globe skips its effects overlay for them entirely, so there'd be nothing to reveal.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEffects } from '../context/EffectsContext';
import { getEffectSpec } from '../data/effectRegistry';
import { ARC_EFFECT_DURATION_MS, PULSE_EFFECT_DURATION_MS } from '../components/globe/GlobeEffectsOverlay';

// The camera's framing move runs before the effect's own animation starts (GlobeView.jsx); a
// little slack on top so the sheet doesn't spring back over the effect's final frames.
const CAMERA_LEAD_MS = 520;
const SLACK_MS = 300;

export const getEffectPeekDuration = (actionType) =>
  (getEffectSpec(actionType)?.primitive === 'arc' ? ARC_EFFECT_DURATION_MS : PULSE_EFFECT_DURATION_MS) + CAMERA_LEAD_MS + SLACK_MS;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const useAutoPeek = (enabled = true) => {
  const { effects } = useEffects();
  const [peeking, setPeeking] = useState(false);
  // Initialised to whatever is newest at mount, so an effect already playing when the sheet opened
  // doesn't immediately collapse it.
  const lastSeenId = useRef(effects.length ? effects[effects.length - 1].id : null);
  const timer = useRef(null);

  useEffect(() => {
    const latest = effects[effects.length - 1];
    if (!latest || latest.id === lastSeenId.current) return;
    lastSeenId.current = latest.id;
    if (!enabled || prefersReducedMotion()) return;
    setPeeking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPeeking(false), getEffectPeekDuration(latest.actionType));
  }, [effects, enabled]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cancelPeek = useCallback(() => {
    clearTimeout(timer.current);
    setPeeking(false);
  }, []);

  return [peeking, cancelPeek];
};
