// src/components/glossary/GlossaryLink.jsx
// A term the player can tap to learn about it (differentiation plan U30): opens the glossary sheet.
// The ::before inset widens the tap area to about 44 px without moving the line.
import React from 'react';
import { openGlossary } from '../ui/uiEvents';
import { useT } from '../../i18n/useT';
import { glossaryEntry } from '../../data/glossary';
import { rich } from '../../i18n/rich';
import { techUnlockRefs } from '../panels/researchView';

const GlossaryLink = ({ kind, id, children, className = '' }) => {
  const { t } = useT();
  if (!glossaryEntry(kind, id)) return <>{children}</>; // a founded city has no entry
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); openGlossary(kind, id); }}
      aria-label={t('gloss.open', { name: typeof children === 'string' ? children : id })}
      className={`relative before:content-[''] before:absolute before:-inset-y-3 before:-inset-x-0.5 underline decoration-dotted underline-offset-2 hover:text-fa-text ${className}`} data-testid="glossary-link" data-help={`${kind}:${id}`}>
      {children}
    </button>
  );
};

/** "Unlocks: Spearmen, Barracks, Mine" with each name a link to its entry; nothing when the tech unlocks nothing. */
export const UnlocksLine = ({ techId, className, testId = 'tech-unlocks' }) => {
  const { t } = useT();
  const refs = techUnlockRefs(techId);
  if (!refs.length) return null;
  const list = refs.flatMap((r, i) => [i ? ', ' : null, r.kind ? <GlossaryLink key={r.id} kind={r.kind} id={r.id}>{r.name}</GlossaryLink> : r.name]).filter((x) => x !== null);
  return <div className={className} data-testid={testId}>{rich(t('p2.tr.unlocks'), { list })}</div>;
};

export default GlossaryLink;
