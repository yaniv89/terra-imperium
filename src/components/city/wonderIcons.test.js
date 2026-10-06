// src/components/city/wonderIcons.test.js
import { describe, it, expect } from 'vitest';
import { Landmark } from 'lucide-react';
import { GREAT_PROJECT_IDS } from '../../data/greatProjects';
import { WONDER_ICONS, wonderIcon } from './wonderIcons';

describe('wonder icons', () => {
  it('every wonder has its own icon', () => {
    GREAT_PROJECT_IDS.forEach((id) => expect(WONDER_ICONS[id], id).toBeTruthy());
    expect(Object.keys(WONDER_ICONS).sort()).toEqual([...GREAT_PROJECT_IDS].sort());
    expect(wonderIcon('nope')).toBe(Landmark);
  });
});
