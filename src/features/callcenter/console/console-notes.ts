/**
 * The three grounds a short note can sit on inside the console, in one place.
 *
 * They are spelled as class strings rather than as a component because what the
 * five call sites share is the GROUND, not the element: they differ in tag, in
 * data attribute (each is a drive's handle on a different fact) and in whether
 * they hold a list or a sentence. A wrapper component would have had to grow a
 * pass-through for all three to say the same thing.
 *
 * The tones are the console's existing vocabulary and not a new one: `danger` is
 * a refusal (§7 — something did not happen), `attention` is something that
 * happened and the agent must read, `quiet` is a fact with no stakes.
 */
export const NOTE = {
  danger: 'rounded-md border border-danger-border bg-danger-050 p-2 text-xs text-danger-800',
  attention:
    'rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800',
  quiet: 'rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground',
} as const
