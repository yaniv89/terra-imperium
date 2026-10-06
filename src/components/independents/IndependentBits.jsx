// src/components/independents/IndependentBits.jsx
// Small shared pieces of the independents' UI (phase W4): the personality shield (the delivered
// SVG, or the placeholder the art plan allows: a plain dot in the personality's colour on an
// empty shield, never a letter), the meters, the tone colours and the look's few fixed colours
// (uidesign SPEC: independent violet, brass only for the one primary action). Field Atlas tokens
// (plans/UI-DESIGN.md section 2, U1 step 11).
import React from 'react';
import { shieldUrl, shieldColour } from './independentArt';

export const INDEPENDENT_VIOLET = '#9C8FD0';
export const BRASS = '#D8A444';

export const TONE_TEXT = { good: 'text-fa-good', bad: 'text-fa-danger-text', warn: 'text-fa-enemy', neutral: 'text-fa-text' };

/** The personality shield: the delivered icon, else the placeholder. */
export const ShieldMark = ({ personality, size = 28, className = '' }) => {
  const url = shieldUrl(personality);
  if (url) return <img src={url} width={size} height={size} alt="" draggable={false} className={`shrink-0 ${className}`} data-shield={personality} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`} data-shield={personality} data-placeholder="true">
      <path d="M12 2.5 4.5 5.2v5.9c0 4.7 3.2 8.6 7.5 10.4 4.3-1.8 7.5-5.7 7.5-10.4V5.2z" fill="#232C38" stroke={INDEPENDENT_VIOLET} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="11.5" r="3.6" fill={shieldColour(personality)} />
    </svg>
  );
};

/** A -100..100 meter with a mark at `value` (the attitude). */
export const AttitudeMeter = ({ value, tone }) => {
  const at = Math.max(0, Math.min(100, (value + 100) / 2));
  const fill = tone === 'good' ? 'bg-fa-good' : tone === 'bad' ? 'bg-fa-danger' : 'bg-fa-enemy';
  return (
    <div className="relative h-2 rounded-full bg-fa-hover/80 overflow-hidden" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={value} aria-label="Attitude toward you">
      <div className="absolute inset-y-0 left-1/2 w-px bg-fa-muted" />
      <div className={`absolute inset-y-0 ${fill}`} style={value >= 0 ? { left: '50%', width: `${at - 50}%` } : { left: `${at}%`, width: `${50 - at}%` }} />
    </div>
  );
};

/** A 0..max meter, with an optional hatched part from `value` to `after` (what a refusal adds). */
export const GrudgeMeter = ({ value, max = 100, after = null, label = 'Grudge' }) => {
  const v = Math.max(0, Math.min(100, (100 * value) / max));
  const a = after != null ? Math.max(v, Math.min(100, (100 * after) / max)) : v;
  return (
    <div className="relative h-2 rounded-full bg-fa-hover/80 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="absolute inset-y-0 left-0 bg-fa-indep" style={{ width: `${v}%` }} />
      {a > v && <div className="absolute inset-y-0" style={{ left: `${v}%`, width: `${a - v}%`, background: 'repeating-linear-gradient(135deg, #E5604D 0 3px, transparent 3px 6px)' }} data-after={after} />}
    </div>
  );
};

/** A caps label of a card. */
export const CardLabel = ({ children, right = null }) => (
  <div className="flex items-center justify-between gap-2 fa-label">
    <span>{children}</span>{right}
  </div>
);
