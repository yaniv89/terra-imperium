// src/utils/metaProgression.js
// Cross-playthrough persistence for achievements + the selected starting doctrine. Deliberately
// a SEPARATE localStorage key from the per-save game state (rise-of-zion-save-v1) — resetting or
// overwriting a save must never erase progress earned in a previous run.

const META_KEY = 'rise-of-zion-meta-v1';

const DEFAULT_META = { unlockedAchievements: [], selectedDoctrine: 'none', difficulty: 'normal' };

export const loadMeta = () => {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw);
    return {
      unlockedAchievements: Array.isArray(parsed?.unlockedAchievements) ? parsed.unlockedAchievements : [],
      selectedDoctrine: typeof parsed?.selectedDoctrine === 'string' ? parsed.selectedDoctrine : 'none',
      // Difficulty select (Phase 10) — a fresh key on an old save falls back to 'normal'.
      difficulty: typeof parsed?.difficulty === 'string' ? parsed.difficulty : 'normal'
    };
  } catch (e) {
    return { ...DEFAULT_META };
  }
};

export const saveMeta = (meta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    // Storage unavailable or full — best-effort, never fatal.
  }
};
