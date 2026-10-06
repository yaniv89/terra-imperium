# Terra Imperium UI sketch spec (shared by every artboard)

Write each artboard as ONE self-contained `.dc.html` file in `project/` (this folder: the canvas root is the parent of `project/`). Do NOT publish anything; the lead publishes. Write only the files assigned to you.

## File format (exact, every rule fails silently if broken)
Copy the structure of `project/Main.dc.html` exactly:
- `<!doctype html>`, `<html lang="en">`, `<head>` with `<meta charset="utf-8">`, a short `<title>`, and EXACTLY `<script src="./support.js"></script>`.
- `<body><x-dc> ... </x-dc>` then the logic script:
  `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":844,"height":390}}'> class Component extends DCLogic { renderVals() { return {...}; } } </script>`
- Inside `<x-dc>`: a `<helmet>` with the same Google Fonts `<link>` lines as Main.dc.html (Spectral SC, Figtree, JetBrains Mono) and `<style>body{margin:0}</style>` plus `a` colors. Then ONE root `<div>` fixed at `width: 844px; height: 390px; box-sizing: border-box; overflow: hidden; position: relative`.
- All styling inline `style="..."`. Close every element, quote every attribute. `{{hole}}` = dotted lookup into renderVals() only, never an expression. Repeats: `<sc-for list="{{items}}" as="it" hint-placeholder-count="3">…{{it.name}}…</sc-for>`. Branches: `<sc-if value="{{flag}}" hint-placeholder-val="{{ true }}">`. Events: `onClick="{{pick}}"` with `pick` a function from renderVals(); per-item handlers precomputed in renderVals (`items: xs.map(x => ({...x, pick: () => this.setState({sel: x.id})}))`). State: `this.state` / `this.setState`, initialize with `state = {...}` class field or in constructor; read `this.state?.x ?? default`.
- No emoji, no images, no iframes, no `innerHTML`, no network except the fonts link. Icons: small inline stroke `<svg>` (viewBox 0 0 24 24, stroke currentColor, fill none, stroke-width 1.8). Map and battlefield art: draw with CSS shapes, gradients and inline SVG (hex outlines, rivers as paths, unit blobs), clearly a sketch, never photo-real.
- Real `<button>` for buttons (with `aria-label` when icon-only), touch targets at least 44px tall on the main actions (small chips may be 32px), real `<input>`/`<label>` where there is input.
- `data-props`: only `$preview` unless a tweak is truly useful (e.g. a boolean to show an alternate state). Copy is literal markup, not props.
- No lorem ipsum, no invented statistics presented as real; use plausible game values (it is a game mock).

## Look: "Field Atlas"
- Ink (screen ground behind UI) #10141A; panel #1A212B (90% alpha over map ok: rgba(26,33,43,0.92)); raised #232C38; line #33404F; text #ECE5D3; muted text #B9B19F (never darker on panels); brass accent #D8A444 (primary buttons: brass fill, ink text); you/ally #5B9BF0; enemy #EE8A3A; independent #9C8FD0 (muted violet, dashed borders); good #6CC28A; danger #E5604D; fog unexplored #0B0E12, explored-not-visible = grey wash rgba(16,20,26,0.55) with desaturated map.
- Map land colors (sketch): grassland #8FA36A, forest #5E7A4A, desert #CDB27A, mountains #8C8577, sea #2E4A63, coast #3E6280; rivers #6FA3C8.
- Type: headings 'Spectral SC' serif (600/700), body Figtree 13-15px, numbers 'JetBrains Mono' 12-13px. Labels in caps 11px letter-spacing 0.08em muted.
- Radii 10px panels, 8px buttons, 999px pills. 1px #33404F borders. No gradients washes, no left-border cards, no glow.
- Layout grammar on 844x390 (phone landscape): slim top bar 36px (resources and turn/date); tab rail on the RIGHT edge (52px wide, icon + 10px label buttons); side sheets slide from the right (width ~360px) over the map, with a close button; primary action bottom right (End Turn / Begin / Fight) 44-52px tall brass; the map always visible behind. Safe margins 10-12px.
- RTS: top bar shows battle name ("Siege of Kish"), timer, food/materials/gold, population "84 / 120"; bottom-left regiment cards strip (horizontal scroll); bottom-right command buttons; minimap top-left corner 120x80; markers ONLY for selected or damaged squads (rings, bars), one banner per regiment; units drawn as small dense blocks of dots in team color with subtle tint.

## Game facts to use (from the master plan)
- Peoples: Akkad (player in examples), Kemet, Elam, Assyria, Mitanni, Hatti, Israel; titles like "Kingdom of Akkad", "The Akkadian Empire", "The Elamite tribes". Cities: Kish, Uruk, Ur, Lagash, Nippur, Sippar. Year 2000 BCE start ("Dawn"), turn counter.
- World sizes: Small 24, Standard 36, Large 42 peoples; random seed; "Explored world" option (fog off).
- Fog: unexplored dark, explored grey "last seen T12", visible; unmet peoples show "Unknown people"; first contact event.
- Settling: cities at least 306 km apart; Settle lens red/green tiles with reasons ("Too close to Uruk", "Belongs to Elam").
- Independent cities: personalities Tribal, Raiders, Mercantile, Fortress; attack without war; raids and sacks; tribute; mercenaries for hire; peaceful joining; raze (one size a turn). Captives do NOT exist (units lost are gone).
- Armies on hex tiles, movement in km, rivers cost extra to cross, forts stop enemies next to them and start battles, zone of control.
- Battles: kinds Siege of <city>, Battle of <place>, Raid on <city>, Sack of <city>, Landing at <place>. Every battle offers Command or Auto, attacker or defender. Default 300 combat units a side (presets 500, 1,000). Waves when the army is bigger than the cap. Pre-battle shows odds or scouts' guess.
- RTS economy: three resources food, materials, gold; workers gather/build/repair; town hall (houses 20) or expedition camp (houses 20 + 10 per regiment brought); village houses +10; depots; towers; training queue; population = all living units + in training, may not exceed housing cap (never 300); the brought army enters even above the cap; destroying the defender's houses lowers its cap.
- Conquest keeps at least half the city (50% rule): result screen shows "Houses ruined 9 of 24 (capped at 50%)", repairs over turns.
- Field battles are decisive: the loser's units still on the field are destroyed; winners gain XP; units that left by an exit survive.
- Generals are units with an aura and can die. Powers: Rally Cry, Arrow Storm (later ages: artillery, air strike).
- Five ages now: Bronze, Classical, Kingdoms, Gunpowder, Modern.
