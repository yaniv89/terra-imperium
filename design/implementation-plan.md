# Terra Imperium — Detailed Implementation Plan

> Companion to `design/code-review-fix-plan.md` (the *what* and *why*). This is the *how*: data
> shapes, function signatures, code fragments, migration, test strategy, and order of work.
> Code fragments are sketches against the real codebase (real file names, real functions); they
> show the shape of the change, not every line.

**Order of work**

| Phase | What | Size | Depends on |
|---|---|---|---|
| 0 | Quick wins (vassal cycle, war ids, tap feedback everywhere) | S | — |
| 1 | Relations matrix + wars derived from `state.wars` + multi-party wars | XL | 0 |
| 2 | Military: liberation, deep offensives, defender filtering, AI counter-attack | L | 1 |
| 3 | Alliances with teeth (call to arms) | M | 1 |
| 4 | Economy: AI treasuries in peace deals, war pressure | M | 1 |
| 5 | Mobile "see the action" UX + Nation hub | L | — (can run in parallel with 1) |
| 6 | Tests & invariants (built alongside every phase) | M | — |
| 7 | Later gameplay (CB variety, trade routes, espionage, RTS battles) | — | 1–3 |

---

## Phase 0 — Quick wins (ship first, independent)

### 0.1 Circular vassalage (`gameReducer.js` VASSALIZE, ~line 2357)

```js
// src/engine/vassals.js (new, tiny)
export const getOverlordChain = (nations, nationId) => {
  const chain = [];
  let cur = nations[nationId]?.vassalOf;
  while (cur && !chain.includes(cur)) { chain.push(cur); cur = nations[cur]?.vassalOf; }
  return chain;
};
```

```js
// gameReducer.js — VASSALIZE
if (player.vassalOf) return reject(state, "You can't take vassals while you're a vassal yourself");
if (getOverlordChain(state.nations, state.playerNationId).includes(nationId)) return reject(state, 'Target is your overlord');
```

`reject` is the helper introduced in 0.3.

### 0.2 Unique war ids (`diplomacy.js:166`)

```js
// declareWar
const warSeq = state.nextWarSeq || 1;
return {
  ...state,
  nextWarSeq: warSeq + 1,
  wars: [...state.wars, { id: `war_${warSeq}`, /* ... */ }]
};
```

`backfillDefaults` picks up `nextWarSeq` automatically once `createInitialState` sets it to `1`.
Existing saves' duplicate ids get fixed by the Phase 1 migration.

### 0.3 No more silent no-ops, engine-side (root fix for this session's diplomacy saga)

Every reducer guard currently does `return state;` — invisible to the player. Replace with a
helper that logs the reason, so UI and engine can never drift apart again:

```js
// src/engine/gameReducer.js
const reject = (state, message) => ({
  ...state,
  logs: [...state.logs, { year: state.year, message, type: LogTypes.ACTION }]
});

// e.g. TRADE_AGREEMENT
if (!target) return reject(state, 'Unknown nation');
if (areAtWar(state, target.id)) return reject(state, `${target.name} is at war`);
if (activePactCount >= cap) return reject(state, `Trade pact capacity reached (${activePactCount}/${cap})`);
if (!canAfford(state.resources, costs)) return reject(state, `Not enough resources — need ${describeShortfall(state.resources, costs)}`);
```

Then:
- Delete the duplicated client-side guard checks in `DiplomacyPanel.jsx` (they become redundant).
- `ActionButton.jsx`: drop the native `disabled` attribute the same way `IconButton` did, so
  Domestic/Military/Tech buttons also give feedback on tap instead of swallowing it.
- Rule going forward: **no reducer case returns `state` unchanged for a player action without a
  log line.** Enforce with a test that dispatches every `ActionTypes` value with junk payloads and
  asserts `state.logs` grew or state changed.

---

## Phase 1 — Relations matrix + wars as the single source of truth

### 1.1 New state shape

```js
// state.relations: directional map, created for every pair lazily (240² eagerly would be 57k rows)
state.relations = {
  us: {
    ca: {
      opinion: 0,          // -100..100, how `us` feels about `ca`  (replaces ca.hostility, inverted)
      trust: 50,
      ae: 0,               // aggressive expansion `us` holds against `ca`
      truceUntil: 0,       // turn number
      treaty: false,       // peace treaty memory (hostility floor source)
      trade: false,        // mirrored
      alliance: false,     // mirrored
      rival: false,        // directional
      marriage: false      // mirrored
    }
  }
};

// state.wars: multi-party
{
  id: 'war_17',
  attackers: ['us', 'mx'],     // [0] is the war leader
  defenders: ['ca'],
  goal: { type: 'capture_region', regionId: 'ca-on', side: 'attackers' },
  cb: 'claim' | 'none' | 'liberation' | ...,
  startTurn, active, score,     // score from the attackers' perspective, -100..100
  battleScore, tickScore,
  peaceOfferCooldownTurn
}
```

**Deleted from `nation`:** `isAtWar`, `hostility`, `relationStatus`, `hasPeaceTreaty`,
`hasTradeAgreement`, `hasMilitaryPact`, `truces`, `ae`, `rivals`, `marriageWith`,
`hostilityFloor`. All move into `relations` or are derived.

### 1.2 Selectors — the only way anything reads relations/war state

New file `src/engine/relations.js`:

```js
const EMPTY = Object.freeze({ opinion: 0, trust: 50, ae: 0, truceUntil: 0, treaty: false,
  trade: false, alliance: false, rival: false, marriage: false });

export const getRel = (state, a, b) => state.relations?.[a]?.[b] || EMPTY;

export const setRel = (relations, a, b, patch) => ({
  ...relations,
  [a]: { ...(relations[a] || {}), [b]: { ...(relations[a]?.[b] || EMPTY), ...patch } }
});

// Mirrored flags (trade/alliance/marriage/treaty/truce) always written both ways:
export const setMutual = (relations, a, b, patch) => setRel(setRel(relations, a, b, patch), b, a, patch);

export const activeWarsOf = (state, id) =>
  state.wars.filter(w => w.active && (w.attackers.includes(id) || w.defenders.includes(id)));

export const isAtWar = (state, id) => activeWarsOf(state, id).length > 0;

export const areAtWar = (state, a, b) => state.wars.some(w => w.active && (
  (w.attackers.includes(a) && w.defenders.includes(b)) ||
  (w.defenders.includes(a) && w.attackers.includes(b))));

export const sideOf = (war, id) => war.attackers.includes(id) ? 'attackers'
  : war.defenders.includes(id) ? 'defenders' : null;

// Player-facing status is DERIVED, never stored:
export const relationStatus = (state, a, b) => {
  if (areAtWar(state, a, b)) return RelationStatus.WAR;
  const r = getRel(state, a, b);
  if (r.alliance) return RelationStatus.ALLIED;
  if (r.trade || r.opinion >= 40) return RelationStatus.FRIENDLY;
  if (r.truceUntil > state.turnNumber || r.treaty) return RelationStatus.COLD_PEACE;
  if (r.opinion <= -60) return RelationStatus.HOSTILE;
  return RelationStatus.NEUTRAL;
};

// Compatibility shim during migration (lets old call sites keep compiling for one PR):
export const hostility = (state, of, toward) => Math.round(50 - getRel(state, of, toward).opinion / 2);
```

Because "at war" is derived from `state.wars`, bugs 1.1, 1.2 and 1.5 **can't happen**: ending
a war removes it from the derived set; there's no flag left behind to go stale.

### 1.3 `declareWar` / `joinWar` / `endWar` — one code path each

```js
// src/engine/diplomacy.js
export const declareWar = (state, attackerId, defenderId, { goal, cb } = {}) => {
  if (attackerId === defenderId || areAtWar(state, attackerId, defenderId)) return state;
  const seq = state.nextWarSeq || 1;
  let relations = state.relations;
  const brokeTreaty = getRel(state, defenderId, attackerId).treaty;
  relations = setRel(relations, defenderId, attackerId, {
    opinion: Math.min(getRel(state, defenderId, attackerId).opinion, -80),
    treaty: false
  });
  const war = {
    id: `war_${seq}`, attackers: [attackerId], defenders: [defenderId],
    goal: goal || assignDefaultWarGoal(state, defenderId, attackerId),
    cb: cb || (hasClaim(state, attackerId, defenderId) ? 'claim' : 'none'),
    startTurn: state.turnNumber, active: true, score: 0, battleScore: 0, tickScore: 0,
    peaceOfferCooldownTurn: 0, brokeTreaty
  };
  const next = { ...state, relations, nextWarSeq: seq + 1, wars: [...state.wars, war] };
  return callAllies(next, war);   // Phase 3 — no-op until then
};

export const joinWar = (state, warId, nationId, side) => ({
  ...state,
  wars: state.wars.map(w => w.id !== warId || sideOf(w, nationId) ? w
    : { ...w, [side]: [...w[side], nationId] })
});

// The ONLY way a war ends — every peace path (SUE_FOR_PEACE, OFFER_PEACE, ACCEPT_PENDING_PEACE,
// AI concludeWar, events' peaceWith, elimination) calls this.
export const endWar = (state, warId, { terms = [], offererId } = {}) => {
  const war = state.wars.find(w => w.id === warId && w.active);
  if (!war) return state;
  let s = applyPeace(state, war, offererId ?? war.attackers[0], terms); // cedes/gold/vassal
  s = liftOccupations(s, war);                  // every region occupiedBy one side, owned by the other
  let relations = s.relations;
  for (const a of war.attackers) for (const d of war.defenders) {
    relations = setMutual(relations, a, d, { truceUntil: s.turnNumber + TRUCE_DURATION_TURNS, treaty: true });
  }
  return { ...s, relations, wars: s.wars.map(w => w.id === warId ? { ...w, active: false } : w) };
};

// A nation leaving a war (separate peace, or eliminated) without ending it for everyone:
export const leaveWar = (state, warId, nationId) => {
  const war = state.wars.find(w => w.id === warId);
  const side = sideOf(war, nationId);
  const remaining = war[side].filter(id => id !== nationId);
  if (remaining.length === 0) return endWar(state, warId, { offererId: otherSideLeader(war, side) });
  return { ...liftOccupationsBy(state, nationId, war), wars: state.wars.map(w => w.id === warId ? { ...w, [side]: remaining } : w) };
};
```

```js
// src/engine/elimination.js — replaces closeWarsForEliminatedNation
export const removeFromAllWars = (state, deadId) =>
  activeWarsOf(state, deadId).reduce((s, w) => leaveWar(s, w.id, deadId), state);
// + clear occupiedBy === deadId everywhere (return control to owner)
```

### 1.4 Call-site migration (the actual work list)

Measured current reads of `isAtWar`: gameReducer.js (17), diplomacy.js (11), DiplomacyPanel.jsx
(11), aiLogic.js (8), applyEventEffects.js (5), resolveTurn.js (3), MilitaryPanel.jsx (3),
ActionPanelTabs.jsx (3), RegionInfoModal.jsx (2), elimination.js, events.js, achievements.js (1
each). Plus ~10 files reading `hasPeaceTreaty`/`hasTradeAgreement`/`hasMilitaryPact`/
`relationStatus`.

Mechanical replacements:

| Old | New |
|---|---|
| `nation.isAtWar` | `isAtWar(state, nation.id)` |
| `isAtWarWithPlayer(state, id)` | `areAtWar(state, state.playerNationId, id)` |
| `nation.hostility` (UI, toward player) | `hostility(state, id, playerId)` |
| `nation.relationStatus` | `relationStatus(state, playerId, id)` |
| `nation.hasTradeAgreement` | `getRel(state, playerId, id).trade` |
| `nation.hasMilitaryPact` | `getRel(state, playerId, id).alliance` |
| `nation.truces[x]` / `isInTruce` | `getRel(state, a, b).truceUntil > turn` |
| `war.aggressor` / `war.enemy` | `war.attackers[0]` / `war.defenders[0]` (leaders) |

Do it with a temporary ESLint `no-restricted-properties` rule banning `.isAtWar`, `.hostility`,
`.relationStatus`, etc. on nations — the linter finds every remaining call site, and stops them
coming back.

### 1.5 AI rewired onto the matrix (`aiLogic.js`)

```js
// shouldDeclareWar — hostility toward THE TARGET, not toward the player
const shouldDeclareWar = (state, aiId, targetId, rng) => {
  const op = getRel(state, aiId, targetId).opinion;           // negative = dislikes
  const base = AI_WAR_BASE_CHANCE * state.difficultyMultiplier;
  const grudge = Math.max(0, -op) / 100;                       // 0..1
  return rng.next() < base * (0.5 + grudge);
};

// pickWarTarget — never an ally, never a truce partner; weigh the target's allies
const candidates = getBorderingNationIds(state.regions, aiId).filter(id =>
  !getRel(state, aiId, id).alliance &&
  getRel(state, aiId, id).truceUntil <= state.turnNumber &&
  !areAtWar(state, aiId, id));
const effectiveStrength = (id) => getEffectiveMilitaryPower(state, id)
  + alliesOf(state, id).reduce((s, a) => s + 0.6 * getEffectiveMilitaryPower(state, a), 0);

// Coalitions — opinion drops toward the actual runaway leader, not toward the player
for (const member of coalition) relations = setRel(relations, member, leaderId,
  { opinion: getRel(state, member, leaderId).opinion - COALITION_OPINION_DROP_PER_TURN });
```

Opinion decay each turn in `resolveTurn.js` iterates only rows that exist (sparse), so cost scales
with actual relationships, not 240².

### 1.6 Save migration (v4 → v5)

```js
// src/engine/saveMigrations.js
const migrate4to5 = (state) => {
  const p = state.playerNationId;
  let relations = {};
  let nations = {};
  for (const [id, n] of Object.entries(state.nations)) {
    const { isAtWar, hostility, relationStatus, hasPeaceTreaty, hasTradeAgreement,
            hasMilitaryPact, truces, ae, rivals, marriageWith, hostilityFloor, ...rest } = n;
    nations[id] = rest;
    if (id === p) continue;
    // Old flags only ever meant "toward the player" — so they only seed the player row.
    relations = setRel(relations, id, p, { opinion: 100 - 2 * (hostility ?? 50), treaty: !!hasPeaceTreaty });
    relations = setMutual(relations, p, id, {
      trade: !!hasTradeAgreement, alliance: !!hasMilitaryPact,
      truceUntil: Math.max(truces?.[p] || 0, state.nations[p]?.truces?.[id] || 0)
    });
    if (state.nations[p]?.rivals?.includes(id)) relations = setRel(relations, p, id, { rival: true });
  }
  let seq = 1;
  const wars = (state.wars || []).map(w => ({
    ...w, id: `war_${seq++}`,
    attackers: w.attackers || [w.aggressor].filter(Boolean),
    defenders: w.defenders || [w.enemy]
  }));
  return { ...state, nations, relations, wars, nextWarSeq: seq };
};
const MIGRATIONS = { 1: migrate1to2, 2: migrate2to3, 3: migrate3to4, 4: migrate4to5 };
export const CURRENT_SAVE_VERSION = 5;
```

Add `save-v4.json` fixture captured from a real mid-war game, and a test that migrates it and
runs 20 turns under the invariants from Phase 6.

---

## Phase 2 — Military fixes

### 2.1 Controller vs owner

```js
// src/engine/relations.js
export const controllerOf = (region) => region.occupiedBy ?? region.owner;
```

### 2.2 Liberation + deep offensives (`LAUNCH_INVASION`, `AMPHIBIOUS_ASSAULT`, `MOVE_ARMY`)

```js
case ActionTypes.LAUNCH_INVASION: {
  const { fromRegionId, targetRegionId } = action.payload;
  const me = state.playerNationId;
  const from = state.regions[fromRegionId];
  const target = state.regions[targetRegionId];
  if (controllerOf(from) !== me) return reject(state, 'You must control the launch region');
  const holder = controllerOf(target);
  if (holder === me) return reject(state, 'You already control that region');
  const liberating = target.owner === me;                 // retaking your own land
  const war = state.wars.find(w => w.active && areAtWar(state, me, holder));
  if (!war) return reject(state, `You are not at war with ${nameOf(state, holder)}`);

  const attackers = unitsIn(state, fromRegionId).filter(u => u.ownerId === me && u.domain === 'land');
  const hostileToMe = new Set(opposingSide(war, me));
  const defenders = unitsIn(state, targetRegionId)
    .filter(u => u.domain === 'land' && hostileToMe.has(u.ownerId));   // no more friendly/third-party defenders
  // ... resolveBattle unchanged ...
  if (captured) nextRegions[targetRegionId] = liberating
    ? { ...target, occupiedBy: null, control: Math.max(target.control, 50) }   // no AE, no unrest spike
    : { ...target, occupiedBy: me, control: 25, unrest: Math.max(target.unrest || 0, 50) };
}
```

`MOVE_ARMY` accepts any destination you **control** (own-and-not-occupied, or occupied by you),
so troops can stage forward and push toward a capital.

### 2.3 AI counter-attacks (`diplomacy.js` resolveWarProgress)

Replace the "only the AI aggressor rolls captures" trim:

```js
for (const side of ['attackers', 'defenders']) {
  for (const aiId of war[side].filter(id => id !== state.playerNationId)) {
    const lost = regionsOwnedBy(aiId).filter(r => r.occupiedBy && sideOf(war, r.occupiedBy) !== side);
    const target = lost[0]                                   // priority 1: liberate own land
      ?? findCaptureTarget(regions, enemyLeader(war, side), aiId);   // priority 2: advance
    if (target && rng.next() < captureChance(state, aiId, controllerOf(target))) { /* flip control */ }
  }
}
```

---

## Phase 3 — Alliances with teeth

```js
// src/engine/alliances.js
export const alliesOf = (state, id) =>
  Object.entries(state.relations[id] || {}).filter(([, r]) => r.alliance).map(([other]) => other);

export const callAllies = (state, war) => {
  let s = state;
  // Defensive calls are automatic for AI allies (refusing breaks the alliance + trust hit)
  for (const d of war.defenders) for (const ally of alliesOf(s, d)) {
    if (sideOf(war, ally) || areAtWar(s, ally, d)) continue;
    if (ally === s.playerNationId) { s = queueCallToArms(s, war.id, ally, 'defenders'); continue; }
    s = aiAcceptsCall(s, ally, war) ? joinWar(s, war.id, ally, 'defenders') : breakAlliance(s, ally, d, 'refused call');
  }
  return s;
};
```

- Player gets a `pendingCallToArms` prompt (same pattern as `pendingPeaceOffer`): Join / Decline
  (decline = −trust, alliance broken).
- `MILITARY_ALLIANCE` acceptance weighs a shared rival/threat, not only hostility.
- Royal marriage: +opinion, and a `succession` casus belli when the partner's ruler dies heirless.
- Trade pact: real per-turn gold both ways, auto-cancelled by `declareWar` between the partners.

---

## Phase 4 — Economy

- **AI treasury in peace terms** (`peace.js`): `gold`/`reparations` terms move gold between
  `nation.economy.gold` of both sides (AI) or `state.resources.gold` (player) via one helper:

```js
const moveGold = (s, from, to, amt) => withTreasury(withTreasury(s, from, -amt), to, +amt);
const withTreasury = (s, id, delta) => id === s.playerNationId
  ? { ...s, resources: { ...s.resources, gold: Math.max(0, s.resources.gold + delta) } }
  : { ...s, nations: { ...s.nations, [id]: { ...s.nations[id],
      economy: { ...s.nations[id].economy, gold: Math.max(0, (s.nations[id].economy?.gold || 0) + delta) } } } };
```

- AI acceptance of a gold demand checks it can actually pay.
- **War pressure:** occupied regions cut the owner's manpower regen; a naval blockade (enemy navy
  in an adjacent sea zone) halves a coastal region's trade income; war exhaustion adds unrest.

---

## Phase 5 — Mobile: "I can't see what my action does"

### 5.0 The concrete problem

Flow: tap region → **Manage Region** → Military tab → **Recruit Infantry**.
`ProvinceModal.jsx:186` fires `triggerEffect('recruit_unit', { region })`, and `GlobeView.jsx`
(lines ~80–100) flies the camera so the region sits at **the centre of the whole screen**. But on
mobile the Manage Region bottom sheet covers the bottom ~65% (`max-h-[65vh]`) and the header covers
the top ~15%. The screen centre (50%) is **under the sheet** — the animation plays, you just can't
see it. The flat map is worse: it has no effects overlay at all.

### 5.1 Fix A — the map knows how much of it is covered ("visible map rect")

Any sheet/header publishes how much of the screen it covers; the map centres things in the
**uncovered** band instead of the full screen.

```js
// src/context/MapInsetsContext.jsx (new)
const MapInsetsContext = createContext({ insets: { top: 0, bottom: 0 }, setInset: () => {} });

export const MapInsetsProvider = ({ children }) => {
  const [byKey, setByKey] = useState({});
  const setInset = useCallback((key, edge, px) =>
    setByKey(prev => (prev[key]?.[edge] === px ? prev : { ...prev, [key]: { edge, px } })), []);
  const insets = useMemo(() => Object.values(byKey).reduce((acc, { edge, px }) =>
    ({ ...acc, [edge]: Math.max(acc[edge], px) }), { top: 0, bottom: 0 }), [byKey]);
  return <MapInsetsContext.Provider value={{ insets, setInset }}>{children}</MapInsetsContext.Provider>;
};

// Any overlay reports its covered height with one hook:
export const useReportInset = (key, edge, ref, active = true) => {
  const { setInset } = useContext(MapInsetsContext);
  useLayoutEffect(() => {
    if (!active || !ref.current) { setInset(key, edge, 0); return undefined; }
    const ro = new ResizeObserver(([e]) => setInset(key, edge, Math.round(e.contentRect.height)));
    ro.observe(ref.current);
    return () => { ro.disconnect(); setInset(key, edge, 0); };
  }, [key, edge, ref, active, setInset]);
};
```

```jsx
// ProvinceModal.jsx (mobile sheet), PanelDrawer.jsx (mobile sheet), GameHeader.jsx
const sheetRef = useRef(null);
useReportInset('province-sheet', 'bottom', sheetRef, open && isMobile);
<div ref={sheetRef} className="absolute inset-x-0 bottom-0 ...">...</div>
```

**Globe:** instead of shrinking the canvas (which would reflow three.js every time a sheet
moves), shift the rendered globe up by half the imbalance so its centre sits in the visible band.
Every existing camera move (`focusRegionId`, effect framing, minimap navigation) then lands in the
visible area automatically, with zero changes to the camera math:

```jsx
// GlobeView.jsx
const { insets } = useMapInsets();
const shiftY = (insets.top - insets.bottom) / 2;   // negative = move up
<div style={{ transform: `translateY(${shiftY}px)`, transition: 'transform 280ms ease' }}>
  <Globe ... />
  <GlobeEffectsOverlay ... />
</div>
```

**Flat map** (`Map2DView.jsx` `focusOnLatLng`): centre on the visible band's midpoint:

```js
const visibleCenterY = insets.top + (height - insets.top - insets.bottom) / 2;
const desired = zoomIdentity.translate(width / 2 - px * k, visibleCenterY - py * k).scale(k);
```

Result: open Manage Region → the camera puts the region **just above the sheet**, and every
recruit/build/attack animation plays there, in view.

### 5.2 Fix B — auto-peek while an animation plays

Even with 5.1, a 65%-high sheet leaves a small window. So sheets collapse to "peek" height for the
duration of an effect, then restore:

```js
// src/hooks/useAutoPeek.js
export const useAutoPeek = () => {
  const { effects } = useEffects();
  const [peeking, setPeeking] = useState(false);
  const last = useRef(null);
  useEffect(() => {
    const latest = effects[effects.length - 1];
    if (!latest || latest.id === last.current) return undefined;
    last.current = latest.id;
    setPeeking(true);
    const t = setTimeout(() => setPeeking(false), getEffectDuration(latest.actionType) + 400);
    return () => clearTimeout(t);
  }, [effects]);
  return peeking;
};
```

```jsx
// ProvinceModal.jsx
const peeking = useAutoPeek();
<div ref={sheetRef}
  className={`absolute inset-x-0 bottom-0 rounded-t-2xl bg-slate-900 transition-[max-height] duration-300
    ${peeking ? 'max-h-[22vh]' : 'max-h-[65vh]'}`}>
```

- Honour `prefers-reduced-motion` (skip the peek, just show a toast).
- A setting "Auto-collapse panels during animations" (default on).
- Tapping the sheet during a peek cancels it and restores immediately.

### 5.3 Fix C — snap-point bottom sheets (one component, used everywhere)

Replace the three ad-hoc mobile sheets (ProvinceModal, PanelDrawer, RegionInfoModal) with one
`BottomSheet` component: **peek (~18vh) / half (~50vh) / full (~88vh)**, drag handle, swipe
between snaps, and it reports its inset via `useReportInset` automatically.

```jsx
// src/components/ui/BottomSheet.jsx
const SNAPS = { peek: 0.18, half: 0.5, full: 0.88 };
export const BottomSheet = ({ id, snap, onSnapChange, children, header }) => {
  const ref = useRef(null);
  const [dragY, setDragY] = useState(null);
  useReportInset(id, 'bottom', ref);
  const heightVh = dragY != null ? dragY : SNAPS[snap] * 100;
  const onPointerUp = () => {                 // settle on the nearest snap
    const nearest = Object.entries(SNAPS).sort((a, b) =>
      Math.abs(a[1] * 100 - heightVh) - Math.abs(b[1] * 100 - heightVh))[0][0];
    setDragY(null); onSnapChange(nearest);
  };
  return (
    <div ref={ref} style={{ height: `${heightVh}vh` }}
         className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl bg-slate-900 border-t border-slate-700
                    transition-[height] duration-200 flex flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="py-2 flex justify-center touch-none" onPointerDown={startDrag}
           onPointerMove={dragTo} onPointerUp={onPointerUp}>
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>
      {header}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
};
```

Default snap for Manage Region = **half**, so the map band above is always usable.

### 5.4 Fix D — effects on the flat map

The flat map (`Map2DView.jsx`) has no animation layer at all. Add a lightweight SVG overlay that
reuses the same `effects` stream:

```jsx
// src/components/map/Map2DEffectsOverlay.jsx
{effects.map(e => {
  const [x, y] = project(REGION_COORDINATES[e.toRegionId]);
  return (
    <g key={e.id} transform={`translate(${x},${y})`}>
      <circle r="6" className="fill-none stroke-amber-300 animate-[ping_900ms_ease-out_2]" />
      <text y="-10" textAnchor="middle" className="text-[10px] fill-white">{effectLabel(e)}</text>
    </g>
  );
})}
```

Arcs (`fromRegionId → toRegionId`) as an SVG quadratic path with a dash-offset animation.

### 5.5 Nation hub (tap a foreign region → manage everything with that nation)

Tapping a foreign region opens a **Nation sheet** (BottomSheet, half snap) instead of just a
region info card:

```
┌ Canada 🇨🇦  Neutral · Opinion −12 · Truce: none ───────────┐
│ [Relations] [War] [Trade] [Covert] [Vassal]                │
│  Declare War   300g 2 DIP   ✓ available                    │
│  Fabricate Claim 150g 11 DIP ✗ need 11 DIP (have 8)        │
│  ...                                                        │
│ Region: Ontario — [Attack from Michigan] [Blockade]         │
└─────────────────────────────────────────────────────────────┘
```

- **Relations:** opinion/trust/AE, treaties, truce timer, rival, marriage.
- **War:** every war you share, score bar, occupied provinces both ways, peace-terms builder,
  call-to-arms status of allies.
- **Trade / Covert / Vassal:** respective actions with cost + requirement lines.
- The region-specific actions (attack this province, blockade its coast) sit in a strip at the
  bottom, since you arrived by tapping a region.
- The Diplomacy tab becomes a directory with filters (At war / Neighbours / Allies / Rivals / All)
  that opens this **same** sheet — one component, one code path, no more drift between two UIs.
- Every action row shows cost and, if unavailable, **the exact reason** (from the same guard
  functions the reducer uses — export them from `diplomacy.js` so UI and engine share one source):

```js
// src/engine/diplomacyGuards.js — shared by reducer AND UI
export const canTradeAgreement = (state, a, b) => {
  if (areAtWar(state, a, b)) return { ok: false, reason: 'At war' };
  if (getRel(state, a, b).trade) return { ok: false, reason: 'Already trading' };
  const used = tradePartners(state, a).length, cap = getTradePactCapacity(state.nations[a]);
  if (used >= cap) return { ok: false, reason: `Trade capacity ${used}/${cap}` };
  return { ok: true };
};
// reducer:  const g = canTradeAgreement(state, me, id); if (!g.ok) return reject(state, g.reason);
// UI:       <ActionRow disabled={!g.ok} reason={g.reason} ... />
```

### 5.6 Smaller mobile items

- War chips floating on the map (`⚔ vs Egypt +23`) → tap opens that war in the Nation sheet.
- Event log → toast queue (3 s, stacked, tap to open the full log drawer).
- Header, legend, minimap auto-collapse while the user is panning/zooming; reappear on tap.
- Selected region keeps its highlight outline while any sheet is open.
- Label ADM / DIP / MIL on the resource bar (not icon-only) — most "I have resources but can't
  act" confusion came from not knowing which pool an action uses.

---

## Phase 6 — Tests & invariants (built alongside each phase)

### 6.1 Invariants, checked after every simulated turn

```js
// src/engine/__testUtils__/invariants.js
export const assertInvariants = (state) => {
  for (const [k, n] of Object.entries(state.nations)) expect(n.id).toBe(k);
  for (const [k, r] of Object.entries(state.regions)) {
    expect(r.id).toBe(k);
    if (r.occupiedBy) expect(state.nations[r.occupiedBy]?.eliminated).not.toBe(true);
  }
  for (const w of state.wars.filter(w => w.active)) {
    expect(w.attackers.length).toBeGreaterThan(0);
    expect(w.defenders.length).toBeGreaterThan(0);
    for (const id of [...w.attackers, ...w.defenders]) expect(state.nations[id]).toBeDefined();
    expect(w.attackers.some(a => w.defenders.includes(a))).toBe(false);
  }
  expect(new Set(state.wars.map(w => w.id)).size).toBe(state.wars.length);
  for (const id of Object.keys(state.nations)) expect(getOverlordChain(state.nations, id)).not.toContain(id);
};
```

### 6.2 Multi-turn action tests

This session's worst bug (AI economy deleting every nation's `id` after turn 1) survived because
every action test used a fresh turn-1 state. New helper:

```js
export const stateAfterTurns = (n, opts) => {
  let s = createInitialState(opts);
  for (let i = 0; i < n; i++) { s = gameReducer(s, { type: ActionTypes.ADVANCE_TURN }); assertInvariants(s); }
  return s;
};
```

Every player-action test file gets a `describe.each([0, 5, 30])('after %i turns', ...)` block.

### 6.3 Scenario tests for the fixed bugs

- Two simultaneous wars: player at war with A and B; peace with A → still at war with B, war
  exhaustion still accrues.
- Join an existing war: AI A vs AI B, player declares on B → joins A's war as attacker.
- Eliminate a nation mid-war → no zombie war state, its occupations lifted.
- AI-vs-AI war → the player's relations with both are unchanged.
- Liberation: enemy occupies your province; `LAUNCH_INVASION` from next door retakes it.
- Deep push: capture P, move into P, attack from P into the interior.
- Vassal cycle: vassalizing your overlord is rejected.
- Alliance: attack the player's ally → the ally (AI) joins or breaks the alliance.

### 6.4 Flaky perf benchmark

`aiQualityBenchmark` misses its 80 ms/turn budget by 2–5 ms under sandbox CPU contention, even on
unchanged code. Use a median of 5 runs and a 10% tolerance for local runs; keep the strict budget
only in CI (dedicated runners).

---

## Phase 7 — Later gameplay (after 1–3)

- **Casus belli variety** — claim, rivalry, liberation, humiliation, succession, holy war; each
  with its own war goal, AE multiplier and peace-term discount.
- **Trade routes** between regions, raidable by navies; blockades matter economically.
- **Espionage** — sabotage buildings, incite rebels, steal maps (fog of war), assassinate advisors.
- **Great powers** — top-N nations get extra diplomatic slots and can guarantee small nations.
- **Start options** — number of AIs, capital-only starts, unclaimed land to settle/conquer, free-land
  rebellions.
- **Real-time tactical battles** — `design/rts-invasion-battles-spec.md`; needs Phase 1's
  multi-party wars and Phase 2's invasion rules first.

---

## PR breakdown

1. `phase0-quick-wins` — vassal cycle, war seq ids, `reject()` + log on every guard, ActionButton
   tap feedback, reducer-feedback test.
2. `phase5a-visible-map-rect` — MapInsetsContext, globe translate, flat-map centring, auto-peek.
   (Independent of the engine work — fixes "I can't see my recruit animation" right away.)
3. `phase1a-relations-selectors` — `relations.js` selectors + shim, no behaviour change; lint rule.
4. `phase1b-multi-party-wars` — new war shape, declareWar/joinWar/endWar/leaveWar, migration v5,
   all call sites moved, invariants + multi-turn tests.
5. `phase1c-ai-on-relations` — AI war/coalition logic on the matrix.
6. `phase2-military` — controllerOf, liberation, deep offensives, defender filtering, AI counter.
7. `phase3-alliances` — call to arms, pending prompt, pact effects.
8. `phase5b-bottom-sheet-and-nation-hub` — BottomSheet, Nation sheet, flat-map effects, toasts.
9. `phase4-economy` — AI treasuries in peace, war pressure.
