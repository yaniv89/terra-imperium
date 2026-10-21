#!/bin/bash
# PostToolUse (Edit|Write): lint the edited .js/.jsx file; errors go back to Claude (exit 2).
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in *.js|*.jsx|*.mjs|*.cjs) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$root/.eslintrc.cjs" ] || exit 0
out=$(cd "$root" && npx eslint --max-warnings 0 "$f" 2>&1) && exit 0
# A file eslint is told to ignore is not a failure.
echo "$out" | grep -q "File ignored" && exit 0
echo "$out" >&2
exit 2
