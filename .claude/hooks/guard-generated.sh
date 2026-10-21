#!/bin/bash
# PreToolUse (Edit|Write): generated files are rebuilt by scripts, never hand-edited (exit 2 blocks).
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */src/data/geo/tiles.json|*/src/data/geo/tiles.bin*) s='npm run build:tiles' ;;
  */src/data/geo/hexLand.json) s='node scripts/geo/build-hex-coast.mjs' ;;
  */src/data/townLayouts.json) s='npm run build:town-layouts' ;;
  */src/data/geo/peopleCapitals.json) s='npm run build:peoples' ;;
  */public/map/rivers.bin.gz) s='npm run build:rivers' ;;
  */public/map/*) s='npm run build:raster / build:pyramid / build:raster-detail' ;;
  *) exit 0 ;;
esac
echo "$f is generated; rebuild it with: $s (do not edit it by hand)." >&2
exit 2
