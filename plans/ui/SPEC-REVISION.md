# Revision 2 rules (apply on top of SPEC.md; these win where they differ)

## One consistent example story (use exactly these facts on every screen)
- Player: the Kingdom of Akkad (blue #5B9BF0). Capital Kish (size 4). Other Akkadian city: Uruk (size 3). General Sargon leads the Host of Sargon.
- Rival major: the Kingdom of Elam (orange #EE8A3A), capital Susa (size 6). Elamite fort at Der (a border town tile between Akkad and Elam). "The Elamite tribes" is WRONG for Elam (tribes = a small people or independent); in the first-contact card use "the Kingdom of Elam".
- Independent: Gutium (Raiders), violet dashed #9C8FD0, in the Zagros hills.
- War: Akkad declared war on Elam on turn 22. The attack: "Siege of Susa" (Akkad attacks Susa, held by Elam). Field battle: "Battle of Der". Never "Siege of Kish" (Kish is the player's own capital).
- Time: start 2000 BCE; turn 17 = 1984 BCE on peaceful screens; war screens turn 24 to 31 (1968 to 1940 BCE).
- Housing (city manifest rules: houses hold 5, 10 or 15 by size; town hall adds 20):
  - Susa: 24 houses holding 120, plus town hall 20 = battle housing 140. In the siege (B05) 3 houses burn: 140 to 110. After the conquest (B08): "Houses ruined 9 of 24 (at most 12 can be lost, the 50% rule); repairs in 6 turns".
  - Kish (W05): 18 houses holding 90, plus town hall 20 = battle housing 110; 3 houses ruined, repaired in 5 turns. No invented farm houses.
- Odds rule (one rule everywhere): an exact ratio only with a spy report or the target in full sight ("Odds 3 : 2, spy report"); otherwise the scouts' guess as a range band ("about 180 to 240", "Likely win"). W06 must follow it (Lagash is in sight: either show "Odds 3 : 2, in sight" or the range; pick one and label the source).
- Movement facts: 77 km between tiles; a river costs +0.5, +1 or +2 moves (stream, river, great river); a road on both banks halves it.

## Visual fixes
1. THE WORLD MAP LOOK (decided by the user): a realistic Earth painting, hexes only as a faint overlay. Draw the land as soft, varied natural colour (irregular patches of greens, olive, tan desert, darker forest masses, grey-brown hills, mountain ridges as soft shaded strokes), irregular coastlines, rivers as thin natural blue curves (wider for great rivers like the Tigris and Euphrates), sea in deep blue with a lighter coastal band. The hex grid is a very faint overlay (white or black lines at 6 to 8 percent opacity), never the dominant texture, and never a repeated hex wallpaper. Territories: a soft transparent fill in the nation colour (about 15 percent) with one crisp 2px border line in the nation colour; fog states as in W03. Use layered absolutely positioned divs with border-radius blobs, radial gradients and inline SVG paths for rivers, coasts and ridges; it should read as a map, not a board game.
2. ONE TOP BAR on every world screen (identical items, order and look): left: nation shield + "Akkad"; then Gold 142 +6, Food 38 +4, Science "9 Bronze Working 3t", Culture 4; right: "1984 BCE" and "TURN 17" (or the war turn), plus a war pill "AT WAR: ELAM" only when at war. 36px tall. Battle screens keep their own battle top bar but make it identical across B01 to B08 (battle name, timer, FOOD/MAT/GOLD, POP x / cap, speed, pause).
3. BRASS MEANS "DO THIS". Brass fill (#D8A444) only for the one primary action on a screen and for key numbers. Selection (chosen card, tab, radio, size, selected regiment card, selected build item) = raised fill #232C38 with a 2px #ECE5D3 outline (and for tabs a 2px #ECE5D3 underline). Remove brass outlines and brass fills used for "selected" everywhere.
4. Ability buttons always have a text label under or beside the icon ("Rally Cry", "Arrow Storm", plus cooldown "40s"); Rally Cry's icon is a raised banner, not a speaker.
5. Keep everything else that works: layouts, reasons on tap, Command/Auto cards, the 50% bar, the clean battle markers.
