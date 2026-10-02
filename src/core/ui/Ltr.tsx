import type { ReactNode } from 'react'

/**
 * Bidi isolation for a **machine value** inside text that may be right-to-left
 * (spec 380 F24, measured in ticket 378 §2; the rule is `.claude/rules/bidi.md`).
 *
 * **Isolate by kind, not by shape.** Every number, amount, code, date, time,
 * range, phone, count and key chord that comes from data is wrapped, wherever the
 * text around it can be RTL. This replaces 095's rule ("a value that mixes digits
 * and spaces"), which was right about its own shapes and still let these through
 * under `dir="rtl"`:
 *
 * - `15:00–18:00` reads `18:00–15:00`;
 * - `+966558102177` reads `966558102177+`, and `-5.00` reads `5.00-`;
 * - `40 / 200` reads `200 / 40`, and `1001 · Riyadh` reads `Riyadh · 1001`.
 *
 * There is no "safe shape" list to consult: over-application is free, because
 * isolating an already-correct value never breaks it.
 *
 * **Free text is not this component's.** A name, an address, a note or a server
 * message can be in either script, so it takes a plain `<bdi>` (dir auto) and
 * reads in its own direction.
 *
 * **Wrap the whole value, never its parts.** A range, a `code · name` pair or an
 * `n / m` is built as ONE string (`formatRange`, `formatPair`, `formatCount` in
 * `@/core/util/bidi`) and wrapped once. Wrapping each end separately reverses it:
 * the two isolates are laid out right-to-left. A string-only sink (`title`,
 * `placeholder`, a native `<option>`, a toast, a `t()` interpolation) takes that
 * module's `fsi()` instead.
 *
 * `<bdi>` is the isolate. `dir="ltr"` makes the direction explicit rather than
 * leaving it to `auto`'s first-strong-character heuristic, which a value that
 * opens with a digit has nothing to give. It is inline and carries no style, so
 * it is **byte-identical under LTR**: nothing moves on an English screen.
 *
 * It is **not** a grid cell renderer: one would read `value` and silently drop the
 * column's `valueFormatter`. Grid cells are isolated by the base renderer every
 * `defaultColDef` spreads (`@/core/theme/grid-base`, spec 380 F25).
 */
export default function Ltr({ children }: { children?: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>
}
