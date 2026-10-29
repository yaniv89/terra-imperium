import { describe, it, expect } from 'vitest';
import { inSentence, translate } from './core';
import './index';
import { msgText, people } from '../engine/messages';

// Manual playtest 29 Oct: "Pylos stays The Dacian tribes's.", "Declare war on The Arvernian people?"
describe('a name that starts with "The" inside a sentence', () => {
  it('reads "the" mid-sentence and keeps "The" at a start', () => {
    expect(inSentence('The Dacian tribes', 'Pylos stays with ')).toBe('the Dacian tribes');
    expect(inSentence('The Dacian tribes', '')).toBe('The Dacian tribes');
    expect(inSentence('The Dacian tribes', 'War. ')).toBe('The Dacian tribes');
    expect(inSentence('Akkad', 'War on ')).toBe('Akkad');
  });
  it('applies in t() and in engine messages', () => {
    expect(translate('cf.war.title', { name: 'The Arvernian people' }, 'en')).toBe('Declare war on the Arvernian people?');
    expect(msgText('m.diplo.ownStaysTheirs', { city: 'Pylos', nation: people('dac', 'The Dacian tribes') })).toBe('Pylos stays with the Dacian tribes.');
  });
});
