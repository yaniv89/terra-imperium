# Screenshots — what to capture, and from where

No screenshots exist yet — they need a running build on a real or simulated device, which is
outside what this repo alone can produce (see the mobile CI workflows, which build debug/simulator
artifacts but don't drive the UI interactively). This is the shot list for whenever someone has a
device or simulator in hand to take them.

## Required sizes

**App Store Connect** (per device class actually supported — check the current
`capacitor.config.json` / native project targets before assuming both):
- 6.7" iPhone (1290×2796 or 2796×1290 landscape)
- 6.5" iPhone (1284×2778 or 2778×1284)
- 12.9" iPad, if iPad is a supported destination

**Google Play Console**:
- Phone: at least 2 screenshots, 16:9 or 9:16, minimum 320px on the short edge, maximum 3840px on
  the long edge
- Feature graphic: 1024×500 (separate from screenshots, required)
- 7"/10" tablet screenshots, if a tablet layout is supported

## Shot list (what actually sells this game)

1. **The globe, zoomed to show a handful of contested nations** — different owner colors visible,
   mid-game rather than turn 1's all-neutral start. This is the single most important shot: it's
   what makes "every one of 240 nations, one living Earth" a visible claim rather than a written one.
2. **The country-select / start screen** — communicates "any of 240 nations" in one glance
   (`src/components/ui/StartScreen.jsx`'s searchable grid).
3. **A combat effect mid-animation** — a missile arc or invasion pincer
   (`GlobeEffectsOverlay.jsx`) captured at a visually strong frame, not the very first or last.
4. **The Military tab** showing real unit composition, promotions, and the counter-triangle UI
   (`src/components/panels/MilitaryPanel.jsx`) — sells the "real army sim" claim.
5. **An event modal** with a meaningful historical choice and its effect preview
   (`EventModal.jsx`) — sells "history reacts to you."
6. **The Space tab** mid-mission-ladder, ideally with a satellite already launched
   (`SpacePanel.jsx`) — sells the late-game hook that's easy to undersell in text alone.
7. **A game-over / victory screen** naming which of the five victory conditions was achieved
   (`GameOverModal.jsx`) — shows there's a real endpoint, not an endless sandbox.

Capture at a point where the player's own empire looks strong (a few owned regions, a visible
army, positive resources) — a screenshot from an early, undeveloped turn undersells the game.
