/**
 * Two shapes the console's helpers share (the 462 session's out-of-slice cleanups): a chip toggle
 * that keeps the canonical order, and a door refusal's own sentence key.
 */

/**
 * `value` in or out of `chosen`, kept in `order` so the query string is the same however the chips
 * were clicked. `null` when `value` is not in `order`: an unknown value changes nothing, so the
 * console never provokes the door's `BAD_FILTER`.
 */
export function toggleInOrder<T extends string>(order: readonly T[], chosen: readonly T[], value: string): T[] | null {
  if (!(order as readonly string[]).includes(value)) return null
  const on = (chosen as readonly string[]).includes(value)
  return order.filter((v) => (v === value ? !on : chosen.includes(v)))
}

/** `<prefix>.errors.<code>` for a refusal the screen words itself, else `null` (show the envelope's message). */
export function refusalKey(prefix: string, refusals: readonly string[], code: string | null | undefined): string | null {
  return code && refusals.includes(code) ? `${prefix}.errors.${code}` : null
}
