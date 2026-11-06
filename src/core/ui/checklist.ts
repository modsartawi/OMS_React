/**
 * The checklist picker's list logic (spec 805, ticket 806), kept pure (no React) beside
 * `./ChecklistPicker` so it is unit-tested.
 *
 * A pick is a value. Picks are the caller's and are never derived from what is shown, so they
 * survive a new query (and, in server mode, a new result set): a picked value the current options
 * do not hold is still picked.
 */

/**
 * One row the picker offers. `label` is built WHOLE by the caller and drawn isolated once:
 * `machine` in `Ltr` (a role code, an employee ID), free text in `<bdi>`. `description` is free text.
 */
export interface ChecklistOption {
  value: string
  label: string
  description?: string
  machine?: boolean
  /** Shown but not tickable (an "Already holds" row). Say why with `note`. */
  disabled?: boolean
  /** A translated word drawn beside a disabled row: why it cannot be ticked. */
  note?: string
  /** A translated tag drawn beside the row, tickable or not ("Inactive", a role's kind). */
  tag?: string
}

export interface ShownOptionsOptions {
  /** Values never shown (the target already holds them: a no-op pick). */
  exclude?: readonly string[]
  /**
   * Narrow by the query here (local mode, the default). `false` is server mode: the caller narrows
   * on query change and the options are drawn as given.
   */
  narrow?: boolean
}

/** The rows a query shows: the options minus `exclude`, narrowed by name and description (case-insensitive). */
export function shownOptions(
  options: readonly ChecklistOption[],
  query: string,
  { exclude = [], narrow = true }: ShownOptionsOptions = {},
): ChecklistOption[] {
  const out = new Set(exclude)
  const needle = narrow ? query.trim().toLowerCase() : ''
  return options.filter(
    (o) =>
      !out.has(o.value) &&
      (!needle ||
        o.label.toLowerCase().includes(needle) ||
        (o.description ?? '').toLowerCase().includes(needle)),
  )
}

/** Tick every shown, enabled row: appended after the existing picks, none doubled. */
export function selectAllShown(picks: readonly string[], shown: readonly ChecklistOption[]): string[] {
  const held = new Set(picks)
  return [...picks, ...shown.filter((o) => !o.disabled && !held.has(o.value)).map((o) => o.value)]
}

/** Whether Select all shown would tick anything. */
export function canSelectAllShown(picks: readonly string[], shown: readonly ChecklistOption[]): boolean {
  const held = new Set(picks)
  return shown.some((o) => !o.disabled && !held.has(o.value))
}

/**
 * A tick appends the value, an untick takes it out. Given the options, a disabled row's tick is
 * refused (the picks come back unchanged); an untick always goes through.
 */
export function togglePick(picks: readonly string[], value: string, options?: readonly ChecklistOption[]): string[] {
  if (picks.includes(value)) return picks.filter((v) => v !== value)
  if (options?.find((o) => o.value === value)?.disabled) return [...picks]
  return [...picks, value]
}

/** Clear: every pick goes, shown or not. */
export function clearPicks(): string[] {
  return []
}
