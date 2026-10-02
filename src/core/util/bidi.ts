/**
 * Bidi formatting: whole values for a page that may be right-to-left (spec 380 F24/F26,
 * measured in 378 §2–§3). The rule these serve is `.claude/rules/bidi.md`.
 *
 * Two kinds of helper, and they never mix:
 *
 * - **Formatters** (`formatRange`, `formatPair`, `formatCount`) build a range, a
 *   `code · name` pair or an `n / m` as ONE plain string, so the caller can isolate it
 *   once. Isolating each end separately reverses it under RTL: the two isolates are laid
 *   out right-to-left, and `18:00–21:00` reads `21:00–18:00`. Their output is plain text
 *   and is safe for grid values and exports.
 * - **`fsi`** wraps a whole value in FIRST STRONG ISOLATE … POP DIRECTIONAL ISOLATE for a
 *   sink that takes only a string: `title`, `placeholder`, a native `<option>`, a toast,
 *   `document.title`, an AG Grid header name, or a value interpolated into a `t()`
 *   sentence. It is **never** used in a grid value or an export, because its invisible
 *   characters would reach Ctrl+C and the CSV/xlsx. `stripIsolates` is the export side's
 *   guard for the one string sink that does reach a file: a header name.
 *
 * Pure: no React, no DOM.
 */

/** U+2068 FIRST STRONG ISOLATE: the value takes the direction of its first strong letter. */
export const FSI = '⁨'
/** U+2069 POP DIRECTIONAL ISOLATE: closes the isolate `FSI` opened. */
export const PDI = '⁩'

type Part = string | number | null | undefined

const text = (value: Part): string => (value == null ? '' : String(value))

/**
 * A range as one string: `18:00–21:00`.
 *
 * The en dash closes up between plain ends and is spaced when either end already
 * carries a space or a hyphen (`2026-09-05 – 2026-09-12`), so a dash inside a date is
 * never mistaken for the range's own. A blank end yields the other end alone, and two
 * blank ends yield `''`. Equal ends are kept: collapsing them is the caller's call.
 */
export function formatRange(from: Part, to: Part): string {
  const start = text(from)
  const end = text(to)
  if (start === '' || end === '') return start || end
  const spaced = /[\s-]/.test(start) || /[\s-]/.test(end)
  return spaced ? `${start} – ${end}` : `${start}–${end}`
}

/**
 * A pair as one string, the two sides joined by a middle dot: a `code · name`
 * (`1001 · Riyadh`), and the same shape for a date · time or a phone · city. A blank
 * side yields the other side alone.
 */
export function formatPair(code: Part, name: Part): string {
  return [text(code), text(name)].filter((side) => side !== '').join(' · ')
}

/** `n / m` as one string: `40 / 200`. */
export function formatCount(count: Part, of: Part): string {
  return `${text(count)} / ${text(of)}`
}

/**
 * The whole value wrapped once in FSI…PDI, for a string-only sink. A blank value stays
 * blank (an empty isolate is still two characters), and a value already wrapped is
 * returned as it is, so a second pass never nests.
 *
 * ⚠️ Never in a grid value or an export — see the module note.
 */
export function fsi(value: Part): string {
  const whole = text(value)
  if (whole === '') return ''
  if (whole.startsWith(FSI) && whole.endsWith(PDI) && whole.indexOf(FSI, 1) === -1) return whole
  return FSI + whole + PDI
}

/** The text with every directional isolate (U+2066–U+2069) removed, for a file a sink fed. */
export function stripIsolates(value: string): string {
  return value.replace(/[⁦-⁩]/g, '')
}
