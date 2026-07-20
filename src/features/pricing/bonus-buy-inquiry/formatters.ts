// Pure display formatters for the BBY Inquiry grid (spec 061, ticket 063). Every
// function is DISPLAY-ONLY: it reads a raw row value and returns a string for the
// cell, never touching the row — so CSV export (065) still dumps the raw `yyyyMMdd`
// dates, `HHMMSS` times and single-letter codes verbatim.
//
// Dependency-free (no `@/` imports, no i18n, no network) so it runs in an in-memory
// node/tsx harness alongside `codeLabels` and `list-params`.

/** `yyyyMMdd → yyyy-MM-dd`; anything that isn't exactly 8 digits passes through
 *  untouched (empty string, a partial value, an already-formatted date). */
export function formatBbyDate(raw: string | null | undefined): string {
  const v = raw ?? ''
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v
}

/** `HHMMSS → HH:mm` (seconds dropped — the grid shows minute granularity, story 22);
 *  anything that isn't exactly 6 digits passes through untouched. */
export function formatBbyTime(raw: string | null | undefined): string {
  const v = raw ?? ''
  return /^\d{6}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2, 4)}` : v
}

/** A boolean flag as a ✓ (true) / – (false) glyph — colour-independent, screen-
 *  legible, and export-neutral (the raw boolean stays on the row). */
export function formatBool(raw: boolean | null | undefined): string {
  return raw === true ? '✓' : '–'
}

/** An ISO-8601 timestamp → its `yyyy-MM-dd` date portion (the audit `createdAt`
 *  column); anything shorter passes through. The raw ISO stays on the row for export. */
export function formatIsoDate(raw: string | null | undefined): string {
  return (raw ?? '').slice(0, 10)
}

/** A numeric cell value as a string; `null`/`undefined` → '' (a blank cell, never
 *  the literal "null"). The raw number stays on the row for export. */
export function formatNumber(raw: number | null | undefined): string {
  return raw == null ? '' : String(raw)
}
