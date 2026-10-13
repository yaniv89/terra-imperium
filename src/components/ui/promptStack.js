// src/components/ui/promptStack.js
// The "needs you" chips stack by kind (playtest audit I157, the user's request): several idle
// armies and waiting settlers are ONE chip, "Idle 4", and each tap goes to the next one in a
// stable order; cities with nothing to build, restless cities and armies low on supply stack the
// same way. Pure, over the list nextPromptModel.js builds (it decides what is idle; this only
// groups, so a change to that rule, such as a Hold flag or "besieging is not idle", needs no
// change here).
//
// What N counts: one per prompt, so an army stack on one tile is one (as nextPromptModel lists
// it) and every settler unit is one.

const IDLE_KINDS = new Set(['army', 'settler']);
const STACKED_KINDS = new Set(['city', 'unrest', 'supply']);

/** The stack a prompt belongs to: 'idle' for armies and settlers, the kind for the other stacked
 *  kinds, and the prompt's own id for the ones that stand alone (research, a peace offer...). */
export const stackKeyOf = (p) => (IDLE_KINDS.has(p.kind) ? 'idle' : STACKED_KINDS.has(p.kind) ? p.kind : p.id);

/**
 * Group prompts into chips, each at the place of its first prompt:
 * [{ key, kind, count, items }] where `kind` is 'idle' for the idle stack, else the prompts' kind.
 */
export const stackPrompts = (prompts) => {
  const out = [];
  const byKey = new Map();
  (prompts || []).forEach((p) => {
    const key = stackKeyOf(p);
    let stack = byKey.get(key);
    if (!stack) { stack = { key, kind: key === 'idle' ? 'idle' : p.kind, count: 0, items: [] }; byKey.set(key, stack); out.push(stack); }
    stack.items.push(p);
    stack.count += 1;
  });
  return out;
};

/** The prompt a tap on the chip goes to: the one after the last one visited (wrapping), or the
 *  first when that one is gone or nothing was visited yet. */
export const nextInStack = (stack, lastId = null) => {
  if (!stack?.items?.length) return null;
  const at = stack.items.findIndex((p) => p.id === lastId);
  return stack.items[(at + 1) % stack.items.length];
};

/** The chip's words: `single(prompt)` names one; several read as a count. */
export const stackLabel = (stack, single) => {
  if (stack.count === 1) return single(stack.items[0]);
  if (stack.kind === 'idle') return `Idle ${stack.count}`;
  if (stack.kind === 'city') return `${stack.count} cities can build`;
  if (stack.kind === 'unrest') return `${stack.count} cities restless`;
  if (stack.kind === 'supply') return `${stack.count} armies low on supply`;
  return `${single(stack.items[0])} +${stack.count - 1} more`;
};

/** What the chip says to a screen reader or on hover: what it holds and what a tap does. */
export const stackHint = (stack, single) => {
  if (stack.count === 1) return null;
  const armies = stack.items.filter((p) => p.kind === 'army').length;
  const settlers = stack.items.filter((p) => p.kind === 'settler').length;
  const what = stack.kind === 'idle'
    ? [armies ? `${armies} ${armies === 1 ? 'army' : 'armies'} can still move` : null, settlers ? `${settlers} ${settlers === 1 ? 'settler waits' : 'settlers wait'} for a destination` : null].filter(Boolean).join(', ')
    : stackLabel(stack, single);
  return `${what}. Each tap goes to the next one`;
};
