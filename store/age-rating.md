# Content rating questionnaire — recommended answers

Both stores compute the final age rating themselves from a questionnaire (Apple's own form;
Google's is the IARC questionnaire, shared across other stores too). What follows is an honest
read of what's actually in the game today, to answer those questionnaires accurately — not a
claimed final rating, since only the platforms' own systems produce that.

## What's actually in the game

- **Violence**: Combat is entirely abstract/statistical (numbers, a battle report) plus stylized
  visual effects (`src/components/globe/GlobeEffectsOverlay.jsx`) — arcing projectiles, expanding
  ring bursts, a flash for a nuclear detonation. No blood, no gore, no depiction of injury or death
  of a person, no realistic weapon models.
- **War themes**: Central to the game — declaring war, invasions, casus belli, rebellions. Handled
  as historical/strategic subject matter, the same register as a Civilization-style game.
- **Nuclear weapons**: The Modern Age's missile system (`src/data/missiles.js`) includes nuclear
  warheads. Using one triggers in-game diplomatic consequences (global condemnation, hostility) —
  it's modeled as a serious, costly choice, not a neutral option, but the theme itself (nuclear war)
  is present.
- **No sexual content, no profanity, no drug/alcohol/tobacco references, no gambling** (the
  in-game "resources/gold" economy is a strategy-game currency, never wagered against chance for a
  payout), **no horror content**, **no user-generated content** (no chat, no shared media — Phase G
  multiplayer, when live, is turn/action data only, not free text).
- **No in-app purchases exist in the codebase today.** If that changes later, both questionnaires
  need re-answering — this document reflects the game as currently built, not a future roadmap
  item.

## Recommended answers

**Apple (App Store Connect's Age Rating questionnaire):**
- Cartoon or Fantasy Violence: Infrequent/Mild
- Realistic Violence: None
- Mature/Suggestive Themes: Infrequent/Mild (war and nuclear conflict as subject matter)
- Horror/Fear Themes, Profanity, Sexual Content, Alcohol/Tobacco/Drugs, Gambling: None
- Unrestricted Web Access: No
- Likely resulting rating: **9+** (comparable to other historical grand-strategy games in this
  genre on the App Store)

**Google Play (IARC questionnaire):**
- Violence: Mild, non-realistic (strategic/abstract combat, no blood or gore)
- Themes of war/conflict: present, historical/strategic framing
- No sexual content, profanity, controlled substances, or gambling
- No user-generated content, no unrestricted internet browsing in-app
- Likely resulting rating: **PEGI 7-12 / ESRB Everyone 10+** range, similar territory to other
  turn-based historical strategy titles

## Before actually submitting

Answer both questionnaires directly inside App Store Connect / Play Console yourselves — this
document is prep material to make that five-minute form fast and accurate, not a substitute for
it.
