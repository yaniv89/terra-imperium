// src/components/glossary/GlossaryLink.jsx
// A term the player can tap to learn about it (differentiation plan U30): opens the glossary sheet.
import React from 'react';
import { openGlossary } from '../ui/uiEvents';
import { useT } from '../../i18n/useT';
import { glossaryEntry } from '../../data/glossary';

const GlossaryLink = ({ kind, id, children, className = '' }) => {
  const { t } = useT();
  if (!glossaryEntry(kind, id)) return <>{children}</>; // a founded city has no entry
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); openGlossary(kind, id); }}
      aria-label={t('gloss.open', { name: typeof children === 'string' ? children : id })}
      className={`underline decoration-dotted underline-offset-2 hover:text-fa-text ${className}`} data-testid="glossary-link" data-help={`${kind}:${id}`}>
      {children}
    </button>
  );
};

export default GlossaryLink;
