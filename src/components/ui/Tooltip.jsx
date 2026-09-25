// src/components/ui/Tooltip.jsx
// Plan §M20 "Tooltip v2": portal-based positioning with viewport flipping, multi-line/JSX content,
// and touch support (400ms long-press), replacing the old mouse-only, non-portal, whitespace-nowrap
// tooltip. Deliberate scope trims from the plan's full spec, documented here rather than half-built:
//   - No nested tooltips (a hover-within-a-tooltip re-tooltip, depth <= 2). Nothing in this codebase
//     needs it yet; Breakdown.jsx's rows are plain text, not further-tooltippable controls.
//   - No pinned "tap an (i) badge" popover affordance separate from the touch long-press. Long-press
//     already gives touch users access to the same content the badge would have opened.
// Both can be added later without changing this component's public props.
import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8; // px between the trigger and the tooltip bubble
const VIEWPORT_MARGIN = 8; // keep the bubble at least this far from the viewport edge
const LONG_PRESS_MS = 400;

// Computes a fixed-position {top, left} for the bubble, preferring `position` but flipping to the
// opposite side (and then clamping horizontally) whenever the preferred side would clip.
export const computePosition = (triggerRect, bubbleRect, preferred) => {
  const fits = {
    top: triggerRect.top - bubbleRect.height - GAP >= VIEWPORT_MARGIN,
    bottom: triggerRect.bottom + bubbleRect.height + GAP <= window.innerHeight - VIEWPORT_MARGIN,
    left: triggerRect.left - bubbleRect.width - GAP >= VIEWPORT_MARGIN,
    right: triggerRect.right + bubbleRect.width + GAP <= window.innerWidth - VIEWPORT_MARGIN
  };
  let side = preferred;
  if (!fits[side]) {
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[preferred];
    if (fits[opposite]) side = opposite;
  }

  let top;
  let left;
  if (side === 'top' || side === 'bottom') {
    top = side === 'top' ? triggerRect.top - bubbleRect.height - GAP : triggerRect.bottom + GAP;
    left = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
  } else {
    left = side === 'left' ? triggerRect.left - bubbleRect.width - GAP : triggerRect.right + GAP;
    top = triggerRect.top + triggerRect.height / 2 - bubbleRect.height / 2;
  }

  left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - bubbleRect.width - VIEWPORT_MARGIN);
  top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - bubbleRect.height - VIEWPORT_MARGIN);
  return { top, left, side };
};

const Tooltip = ({
  children,
  content,
  position = 'top', // preferred side; flips automatically when it would clip the viewport
  delay = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);
  const timeoutRef = useRef(null);
  const longPressRef = useRef(null);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(show, delay);
  };
  const handleMouseLeave = () => {
    clearTimers();
    hide();
  };
  const handleTouchStart = () => {
    longPressRef.current = setTimeout(show, LONG_PRESS_MS);
  };
  const handleTouchEnd = () => {
    clearTimers();
  };

  // Positions the bubble only once it's mounted (so bubbleRect is real), and keeps it pinned to the
  // trigger's viewport position on scroll/resize while visible.
  useLayoutEffect(() => {
    if (!isVisible) return undefined;
    const reposition = () => {
      if (!triggerRef.current || !bubbleRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const bubbleRect = bubbleRef.current.getBoundingClientRect();
      setCoords(computePosition(triggerRect, bubbleRect, position));
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isVisible, position]);

  if (!content) return children;

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          ref={bubbleRef}
          className="fixed z-[999] max-w-xs px-2.5 py-1.5 text-xs text-white bg-slate-800 rounded shadow-lg pointer-events-none whitespace-normal break-words"
          style={coords ? { top: coords.top, left: coords.left } : { top: -9999, left: -9999, visibility: 'hidden' }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
