// The repeatable-filter helpers of the list screens: a chip that switches one key on or off, and
// the keys a filter offers when its own read may be refused. Graduated from the Deliverect orders
// monitor (ticket 478) by ticket 556, the HungerStation orders monitor being its second reader.
// Pure: no React, no `t`.

/** A repeatable filter's value with one key switched on or off, the rest kept in order. */
export function toggled<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

/**
 * The keys a filter offers, sorted and distinct: its own read's keys when it answered, else the
 * keys seen on the rows. The selected keys are always kept, so a filtered list never hides the
 * value it is filtered by.
 */
export function keyChoices(
  read: readonly string[] | undefined,
  rowKeys: readonly string[],
  selected: readonly (string | null)[] = [],
): string[] {
  return [...new Set([...(read ?? rowKeys), ...selected].filter((k): k is string => !!k))].sort((a, b) => a.localeCompare(b))
}
