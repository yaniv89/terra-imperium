# Plan: Civ-style research, landscape mobile UI, Clash-quality units

Date: 2026-10-01. Status: proposal for review, nothing implemented yet.
Builds on `plans/stabilization-and-depth-audit.md` (branch `audit/stabilization-and-battle-depth`).

---

## Part 1. Research like Civilization

### How Civilization does it (research summary)
- **Science accumulates into one current technology.** Each turn the empire's science is added
  to the tech being researched; when the cost is reached it completes, and overflow carries into
  the next one, so nothing is wasted (Civ VI and VII).
- **Turns to complete** is simply `ceil(remaining cost / science per turn)`, shown on every tech.
  More science means fewer turns.
- **Switching keeps progress.** Partial progress stays on the tech you left; players even pause a
  tech at about 60% while waiting for its boost.
- **A queue / path.** You can pick a far tech and the game queues its prerequisites in order.
- **Boosts (Civ VI "Eurekas").** Each tech has a gameplay trigger (build a quarry, kill a unit
  with a slinger, meet a civ…) that grants 40% of its cost. This is what ties research to play.
- **Cost scaling.** Costs rise by era. Civ V also raised costs about 5% per city (a brake on wide
  empires) and made a tech cheaper when civs you've met already know it (catch-up).
- **Optional depth (Civ VII "Masteries").** Each tech has an optional follow-up costing about
  80% of the base, never a prerequisite: a deliberate trade-off against advancing the tree.
  Civ VII also resets the tree per age while what you built carries over.

### Where Terra Imperium is today
- 50 techs: 5 linear lines (Military, Economy, Infrastructure, Governance, Science) x 2 per age.
- Research is an **instant purchase**: tech points (10 + 15 per age) **plus** an ADM/DIP/MIL power
  cost (40 + 30 per age). No turns, no progress, no overflow, no queue.
- Hard calendar gate per tech (`yearAvailable`); 6 of 10 techs in an age advance the tech age.
- Tech points: a flat 2/turn plus Science buildings (Library 2 … Research Lab 9).
- Already Civ-like: border diffusion (-6% per neighbour that has it, max -30%) and a +20%
  pioneer cost, the same idea as Civ V's catch-up.
- Turns per age at Normal speed: Bronze ~30, Classical ~65, Kingdoms ~100, Gunpowder ~100,
  Modern ~200 (Fast halves, Marathon doubles).

### Proposed design
1. **Science per turn** (the existing tech points, renamed Science in the UI):
   flat base + Science buildings + **population** (a small share of each province's development,
   so growing land means growing science) + modifiers. Shown as `+N science/turn`.
2. **One current research + a queue.** State: `research = { current, queue: [ids], progress:
   { techId: points } }`. Each turn science is added to `current`; on completion the overflow
   goes to the next queued tech. Switching keeps progress per tech. Picking a locked tech
   queues its missing prerequisites first (Civ's path).
3. **Cost** in science only: `cost = AGE_BASE[age] x speed x diffusion x agesBehind x sizeFactor`.
   - AGE_BASE calibrated so a typical nation finishes about 7 of 10 techs per age on time
     (target ~4 turns per Bronze tech, ~9 Classical, ~14 Kingdoms, ~14 Gunpowder, ~28 Modern),
     fitted with the balance-sim skill against measured median science per age, not guessed.
   - speed: costs scale with game speed exactly like the turn lengths do.
   - diffusion and pioneer: keep today's rule (it is Civ V's catch-up).
   - size factor (Civ V's per-city penalty): +0.5% per province above 10, capped at +30%,
     so a 100-province empire researches somewhat slower per point of science. Optional.
4. **Power pools leave research.** ADM/DIP/MIL stop paying for techs (they stay for laws,
   development, diplomacy, stability). Research becomes purely a science economy, as in Civ.
5. **Boosts (Eurekas), 40% of cost**, one per tech, triggered by real play we already track:
   own a copper/iron/oil deposit, win a battle or a siege, build a given building tier, meet N
   nations, reach a population, sign a trade pact, launch a ship… Data on each tech:
   `boost: { kind, params, text }`; checked in resolveTurn and in the relevant reducer cases.
6. **Calendar gate.** Replace the hard `yearAvailable` lock with a soft "ahead of its time" cost
   (+50% before its historical year, decision for the user), so a science-focused nation can
   really pull ahead while the calendar still shapes the world.
7. **AI uses the same system** (`nation.research`), choosing a target line by doctrine;
   deterministic, one addition per nation per turn (cheap).
8. **Later, optional:** a wider branching tree (8-12 techs per age with cross-line prerequisites
   instead of 5 linear lines) and Civ VII-style Masteries. Keep these out of the first slice.

### UI
- Research panel: current tech with a progress bar and "N turns", the queue as chips, each tech
  card with cost, turns, boost hint (and a tick when earned), diffusion/pioneer note.
- A compact "Researching X · 3 turns" pill in the top bar that opens the panel.
- Completion toast with the effect gained; boost toast ("Eureka: Bronze Working +40%").

### Implementation slices (each its own commit, tested)
1. Engine: research state, per-turn accumulation, overflow, switching, queue/path, completion
   effects (tech age advance unchanged); save migration (researched techs kept, new fields
   defaulted); remove power cost. Player and AI.
2. Cost model + calibration with balance-sim (median turns per tech per age, all 5 ages).
3. UI: panel, pill, toasts. Mobile first.
4. Boosts: data for all 50 techs + triggers + tests.
5. Soft calendar gate. 6. (Later) tree expansion / masteries.

### Acceptance
- Deterministic: same seed, same research results (longRun test unchanged in spirit).
- Calibrated: median AI and passive player finish 6-8 techs per age before the calendar age ends.
- No lost science: overflow and switching conserve points (unit tests).
- Save/load mid-research keeps progress.

---

## Part 2. Landscape-only on phones

### Recommendation: yes, landscape-first on phones, like Clash of Clans
Clash of Clans was designed landscape (it launched tablet-first); most top-grossing mobile games
are portrait, but deep strategy games with a map and many panels fit landscape better. Our case
for it: the globe, the 2D map and the battlefield are all wide; the battle renderer already
frames for landscape; side-docked panels stop covering half the map.

Trade-offs: no one-handed portrait play; landscape phones are only ~360-430 css px tall, so
vertical space becomes the scarce resource (compact top bar, scrolling panels, no tall sheets).

### How
- **Native app (Capacitor):** lock orientation. Android: `android:screenOrientation=
  "sensorLandscape"` on the main activity. iOS: landscape-only `UISupportedInterfaceOrientations`.
- **Web on phones:** browsers can't reliably lock orientation (iOS Safari doesn't support
  `screen.orientation.lock`), so show a "rotate your phone" screen in portrait on small devices.
  Desktop and tablets are unaffected.
- **Layout (landscape phone):**
  - left: a slim vertical tab rail (Domestic, Military, Diplomacy, Research, Space);
  - right: a docked panel at ~36-40% width, collapsible to the rail, scrolling internally;
  - top: one compact resource bar; bottom-right: End Turn;
  - the map keeps the centre and stays interactive while a panel is open;
  - modals become side sheets (right) instead of bottom sheets;
  - safe areas on the left/right (notches) via `env(safe-area-inset-left/right)`.
- Tests: Playwright at 844x390 and 932x430 (common phones landscape) and the portrait overlay.

---

## Part 3. Units with Clash of Clans quality and smoothness

### How Clash of Clans does it
Its units are **pre-rendered 2D sprites**: artists model and animate them in 3D, then render each
animation frame from the game's fixed camera angles into sprite sheets. That is why they look
rich, animate smoothly and still run on cheap phones: the GPU draws flat pictures, not models.
The quality itself comes from professional character art and animation.

### What that means for us
Our battlefield already uses a fixed isometric orthographic camera, which is exactly the
situation where the sprite approach wins. The engine side is very doable; the look depends on
the art we feed it.

Options:
1. **Baked sprite sheets from animated 3D models (recommended).** An offline script renders each
   unit's animated model (idle, walk, attack, hit, death) from 8 directions into atlases; the
   battlefield draws them as instanced billboards with frame-by-frame animation. Cheap on phones,
   smooth, real death animations (fits the blood effects), team colour via a mask channel.
   Needs animated source models; works with today's fixed camera (rotation would need more angles).
2. **Real-time skinned 3D with GPU animation textures.** Keeps true 3D (camera rotation, dynamic
   lighting); more shader work and heavier on phones. The audit notes the current baker keeps
   only an idle pose, so animation clips need a new GPU path either way.
3. **Keep the procedural rig, improve models.** Least work, lowest ceiling.

**Art source** decides the quality: CC0 animated packs (e.g. Quaternius, Kenney) are free but
stylised and not a full historical roster; AI-generated models + auto-rigging speed up a
prototype but need a licence check per tool; real "Clash quality" means an artist or a
purchased consistent pack. Start with one age (Classical: infantry, archers, cavalry, siege),
judge it on a phone, then expand (the audit's recommended first visual milestone).

---

## Decisions for the user
1. Remove ADM/DIP/MIL from research (science only)? Recommended: yes.
2. Hard year gates, or the soft "+50% before its time" cost?
3. Add the per-province size penalty?
4. Landscape: native app lock + web rotate overlay (recommended), or web lock attempt too?
5. Units: sprite-sheet path (recommended)? Art source and budget: free CC0 packs, AI-assisted
   prototypes, or a purchased/commissioned pack?

## Sources
- Civ VII research, overflow, masteries: https://civfanatics.com/civ7/civ-vii-gameplay-mechanics/civilization-vii-the-tech-tree/ ,
  https://civilization.fandom.com/wiki/Technology_(Civ7)
- Civ VI Eureka 40%: https://civ6.fandom.com/wiki/Eureka ,
  https://theahura.substack.com/p/on-towards-the-stars-eurekas-and
- Civ V cost per city and tech spread: https://forums.civfanatics.com/threads/exact-mechanics-of-technology-cost-and-number-of-cities.683966/ ,
  https://forums.civfanatics.com/threads/formula-behind-getting-cheaper-techs-when-meeting-civs.441686/ ,
  https://www.carlsguides.com/strategy/civilization5/science.php
- Clash of Clans sprites from 3D: https://discussions.unity.com/t/what-is-secret-of-clash-of-clans-animation/569101 ,
  https://www.adobe.com/products/substance3d/magazine/supercell-helsinki-creating-stylized-content-for-clash-of-clans-and-clash-royale.html
- Orientation: https://www.pocketgamer.biz/comment-and-opinion/62882/how-portrait-mode-trumped-tablet-first-gaming/
