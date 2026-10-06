// src/components/battle/warAtlas.jsx
// Field Atlas pieces shared by the war screens (U1b, plans/UI-DESIGN.md): the two force cards
// (yours in the "you" blue, theirs in the enemy orange), the Command / Auto / Withdraw cards
// (rule 5: one tap, never buried; the chosen one is a raised fill with a light outline, never
// brass) and the box that says what the chosen way of fighting means.
import React from 'react';
import { Swords, Zap, Undo2, Crown } from 'lucide-react';
import { lineLabel } from './warModel';

const cx = (...p) => p.filter(Boolean).join(' ');

/** One side: "YOURS Host of Sargon 340", its lines and a footer (general, scouts' note). */
export const ForceCard = ({ tone = 'you', tag, name, total, lines = [], unknownLines = false, footer, children, testId, className }) => (
  <div data-testid={testId} className={cx('rounded-[10px] border p-2.5 min-w-0 flex flex-col bg-fa-ink/50', tone === 'you' ? 'border-fa-you' : 'border-fa-enemy', className)}>
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className={cx('text-[11px] font-bold tracking-[0.08em] shrink-0', tone === 'you' ? 'text-fa-you' : 'text-fa-enemy')}>{tag}</span>
      <span className="text-[13px] font-semibold truncate flex-1">{name}</span>
      {total != null && <span className="fa-num text-[13px] font-semibold shrink-0">{total}</span>}
    </div>
    {lines.length > 0 && (
      <ul className="mt-1 space-y-0.5">
        {lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-2 text-[12px] leading-tight">
            <span className="truncate">{lineLabel(l)}</span>
            <span className="fa-num text-fa-muted">{unknownLines ? '?' : l.men}</span>
          </li>
        ))}
      </ul>
    )}
    {children}
    {footer && <div className="mt-auto pt-1.5 text-[11px] text-fa-muted leading-snug">{footer}</div>}
  </div>
);

/** "General Sargon, skill 3" for a force card footer. */
export const GeneralsLine = ({ generals }) => (generals?.length ? (
  <span className="inline-flex items-center gap-1"><Crown className="w-3 h-3" aria-hidden="true" />{generals.map((g) => `General ${g.name}${g.skill != null ? `, skill ${g.skill}` : ''}`).join('; ')}. A general can fall in battle.</span>
) : null);

const MODES = {
  command: { icon: Swords, label: 'Command' },
  auto: { icon: Zap, label: 'Auto' },
  withdraw: { icon: Undo2, label: 'Withdraw' }
};

/**
 * The way to fight, as two or three cards. `options` = [{ id: 'command'|'auto'|'withdraw', sub,
 * disabled, title }]; picking a card only selects it, the screen's brass button acts.
 */
export const ModeCards = ({ options, value, onChange, className, compact = false }) => (
  <div role="radiogroup" aria-label="How to fight" className={cx('grid gap-2', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>
    {options.map((o) => {
      const M = MODES[o.id];
      return (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={o.disabled} title={o.title}
          onClick={() => onChange(o.id)} data-testid={o.testId}
          className={cx('fa-option text-left px-2.5 py-1.5 min-h-[52px] disabled:opacity-40', compact && 'pl:min-h-[44px] pl:py-1', value === o.id && 'fa-selected')}>
          <span className="flex items-center gap-1.5 fa-heading text-[15px] leading-tight"><M.icon className="w-4 h-4 shrink-0" aria-hidden="true" />{M.label}</span>
          {o.sub && <span className={cx('block text-[11px] text-fa-muted leading-tight mt-0.5', compact && 'pl:hidden')}>{o.sub}</span>}
        </button>
      );
    })}
  </div>
);

/** What the chosen way means, in one or two plain sentences. */
export const ModeExplain = ({ title, right, children, className, compact = false }) => (
  <div className={cx('fa-card px-2.5 py-1.5', className)} role="status">
    <div className={cx('flex justify-between gap-2', compact && 'pl:hidden')}><span className="fa-label">{title}</span>{right && <span className="text-[11px] font-semibold">{right}</span>}</div>
    <div className={cx('text-[12.5px] leading-snug mt-0.5', compact && 'pl:mt-0 pl:text-[12px]')}>{children}</div>
  </div>
);

/** A win / lose bar: your share in blue from the left, theirs in orange. */
export const OddsBar = ({ mine, labelLeft = 'they win', labelMid = 'even', labelRight = 'you win', band = null, compact = false }) => (
  <div aria-label={`${labelLeft} to ${labelRight}`}>
    <div className="relative h-2 rounded-full bg-fa-ink border border-fa-line overflow-hidden">
      {band
        ? <span className="absolute inset-y-0 rounded-full bg-fa-good" style={{ left: `${band[0] * 100}%`, width: `${Math.max(4, (band[1] - band[0]) * 100)}%` }} />
        : <span className="absolute inset-y-0 left-0 bg-fa-you" style={{ width: `${Math.round(mine * 100)}%` }} />}
      <span className="absolute inset-y-[-2px] left-1/2 w-px bg-fa-text/70" />
    </div>
    <div className={cx('flex justify-between text-[10px] text-fa-muted mt-0.5', compact && 'pl:hidden')}><span>{labelLeft}</span><span>{labelMid}</span><span>{labelRight}</span></div>
  </div>
);
