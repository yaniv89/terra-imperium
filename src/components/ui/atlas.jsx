// src/components/ui/atlas.jsx
// The shared "Field Atlas" primitives (plans/UI-DESIGN.md section 2, plans/ui/SPEC-REVISION.md):
// thin React wrappers over the .fa-* classes in index.css, so every world screen has the same
// buttons, chips, tabs, sheet header, switches and bars.
//   Button variant 'primary' = brass: the ONE primary action on a screen. 'secondary', 'ghost',
//   'danger' for the rest. `hero` sets the Spectral SC label of the big actions (End Turn, Begin).
//   Selection is never brass: chips, options and tabs show a raised fill with a light outline or
//   underline through aria-pressed / aria-checked / aria-selected.
import React from 'react';
import { X } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export const Button = React.forwardRef(({ variant = 'secondary', size, hero, className, type = 'button', children, ...rest }, ref) => (
  <button ref={ref} type={type} className={cx('fa-btn', `fa-btn-${variant}`, size === 'sm' && 'fa-btn-sm', hero && 'fa-btn-hero', className)} {...rest}>
    {children}
  </button>
));
Button.displayName = 'Button';

/** A square 44 px icon button; `label` is its accessible name. */
export const IconButton = ({ label, icon: Icon, className, children, ...rest }) => (
  <button type="button" aria-label={label} title={label} className={cx('fa-icon-btn', className)} {...rest}>
    {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : children}
  </button>
);

export const CloseButton = ({ onClick, label = 'Close', className }) => <IconButton label={label} icon={X} onClick={onClick} className={className} />;

/** A pill. As a button it toggles (`pressed`); otherwise a static tag. */
export const Chip = ({ pressed, onClick, className, children, tone, ...rest }) => {
  const toneClass = tone === 'danger' ? 'text-fa-danger-text border-fa-danger' : tone === 'good' ? 'text-fa-good border-fa-good/60' : tone === 'you' ? 'text-fa-you border-fa-you/60' : tone === 'enemy' ? 'text-fa-enemy border-fa-enemy/60' : tone === 'indep' ? 'text-fa-indep border-fa-indep/60 border-dashed' : '';
  if (!onClick) return <span className={cx('fa-chip', toneClass, className)} {...rest}>{children}</span>;
  return <button type="button" onClick={onClick} aria-pressed={pressed === undefined ? undefined : !!pressed} className={cx('fa-chip', toneClass, className)} {...rest}>{children}</button>;
};

/** Small caps label above a group. */
export const Label = ({ as: Tag = 'div', className, children, ...rest }) => <Tag className={cx('fa-label', className)} {...rest}>{children}</Tag>;

/** The header of every sheet: a Spectral SC title, a muted subtitle, extra content, a close button. */
export const SheetHeader = ({ title, subtitle, icon: Icon, onClose, children, className, titleId }) => (
  <div className={cx('flex items-start gap-3 px-4 pt-3 pb-2', className)}>
    {Icon && <Icon className="w-5 h-5 mt-1 text-fa-muted shrink-0" aria-hidden="true" />}
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 id={titleId} className="fa-heading text-[19px] leading-tight">{title}</h2>
        {subtitle && <span className="text-[12px] text-fa-muted">{subtitle}</span>}
      </div>
      {children}
    </div>
    {onClose && <CloseButton onClick={onClose} />}
  </div>
);

/** Underlined tabs (role tablist). `tabs` = [{ id, label, dot }]. */
export const Tabs = ({ tabs, value, onChange, className, label = 'Sections' }) => (
  <div role="tablist" aria-label={label} className={cx('flex border-b border-fa-line overflow-x-auto scrollbar-none', className)}>
    {tabs.map((t) => (
      <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className="fa-tab flex-1 shrink-0" data-testid={t.testId}>
        {t.label}
        {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-fa-danger" aria-label={t.dotLabel || 'needs attention'} />}
      </button>
    ))}
  </div>
);

/** An on/off switch with its label and an optional hint (a real button with role switch). */
export const Switch = ({ checked, onChange, label, hint, testId, disabled }) => (
  <div className="flex items-center justify-between gap-3 min-h-[44px]">
    <div className="min-w-0">
      <div className="text-[14px] font-semibold text-fa-text leading-tight">{label}</div>
      {hint && <div className="text-[12px] text-fa-muted leading-snug">{hint}</div>}
    </div>
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="fa-switch disabled:opacity-40" data-testid={testId} />
  </div>
);

/** A row of options, one chosen (radio semantics), drawn as a segmented control. */
export const Segmented = ({ options, value, onChange, label, className }) => (
  <div role="radiogroup" aria-label={label} className={cx('flex gap-1 p-1 rounded-[10px] border border-fa-line bg-fa-ink/40', className)}>
    {options.map((o) => (
      <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={cx('fa-option flex-1 min-h-[40px] px-2 text-[13px] font-semibold border-transparent bg-transparent', value === o.id && 'fa-selected')} data-testid={o.testId}>
        <span className="block leading-tight">{o.label}</span>
        {o.sub && <span className={cx('block text-[11px] font-normal leading-tight', o.subClass || 'text-fa-muted')}>{o.sub}</span>}
      </button>
    ))}
  </div>
);

/** A thin progress bar; `extra` draws a second, striped part (e.g. a waiting research boost). */
export const Meter = ({ value, max = 1, color = 'var(--fa-good)', extra = 0, extraColor = 'var(--fa-good)', className, height = 6, label }) => {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const extraShare = max > 0 ? Math.max(0, Math.min(1 - share, extra / max)) : 0;
  return (
    <span className={cx('fa-bar flex', className)} style={{ height }} role={label ? 'meter' : undefined} aria-label={label} aria-valuenow={label ? Math.round(value) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? Math.round(max) : undefined}>
      <span style={{ width: `${share * 100}%`, background: color, borderRadius: extraShare ? '999px 0 0 999px' : undefined }} />
      {extraShare > 0 && <span style={{ width: `${extraShare * 100}%`, borderRadius: 0, background: `repeating-linear-gradient(90deg, ${extraColor} 0 3px, transparent 3px 5px)` }} />}
    </span>
  );
};

/** The nation shield (the sketch's banner shape) in a colour. */
export const Shield = ({ color = 'var(--fa-you)', size = 16, className, children }) => (
  <span className={cx('fa-shield relative', className)} style={{ width: Math.round(size * 0.875), height: size, background: color }} aria-hidden="true">{children}</span>
);

/** A small stat tile: a big number over a label (city yields, war score parts). */
export const Stat = ({ value, label, color, onClick, title }) => {
  const body = (
    <>
      <span className="fa-num block text-[15px] font-semibold leading-tight" style={{ color }}>{value}</span>
      <span className="block text-[11px] text-fa-muted leading-tight">{label}</span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} title={title} className="fa-card px-2 py-1.5 text-center hover:bg-fa-hover min-h-[44px]">{body}</button>
    : <div className="fa-card px-2 py-1.5 text-center" title={title}>{body}</div>;
};

export const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
