// src/hooks/useAgeTheme.js
// The player's age on <html data-age="…"> (eight ages plan U43), like data-layout: index.css
// paints a thin ornament strip under the top bar and sets --fa-age per age. CSS only, no rules.
import { useEffect } from 'react';

export const useAgeTheme = (ageId) => {
  useEffect(() => {
    if (ageId) document.documentElement.dataset.age = ageId;
    else delete document.documentElement.dataset.age;
  }, [ageId]);
};
