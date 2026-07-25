import type { ReactNode } from 'react'

/**
 * Bidi isolation for a left-to-right value inside a paragraph that may be
 * right-to-left (ticket 095, measured in the 080 mirroring audit).
 *
 * A value **breaks only when it contains a space and begins or ends with a
 * digit**: the browser's bidi algorithm treats the digits as a weak run and
 * reorders the space-separated fragments, so `+966 55 810 2177` renders as
 * `7712 018 55 966+` under `dir="rtl"`. `tabular-nums` does nothing here — it
 * sets glyph advance width, not character order. Measured safe and deliberately
 * untouched: `ERX-77120934`, `1180-4471`, `240.70`, `1000000393`.
 *
 * The rule for reviewers is deliberately dumb: **a server value that mixes
 * digits and spaces gets wrapped.** Over-application is free — isolating an
 * already-correct value never breaks it.
 *
 * **Wrap a whole value, never a fragment.** The audit created a fault by
 * isolating just the id inside `↗ Track SMSA-91180442`: that split an all-Latin
 * run, and the RTL paragraph then ordered the halves right-to-left, putting the
 * id before its verb.
 *
 * `<bdi>` is the isolate — `dir="ltr"` makes the direction explicit rather than
 * leaving it to `auto`'s first-strong-character heuristic, which a value that
 * opens with a digit has nothing to give. It is inline and carries no style, so
 * it is **byte-identical under LTR**: nothing on today's shipping screen moves.
 *
 * It doubles as an AG Grid cell renderer (`{ component: Ltr }`): the grid passes
 * the cell's `value` as a prop, and a cell is exactly the same job as a wrapped
 * value. `children` wins when both are present.
 */
export default function Ltr({ children, value }: { children?: ReactNode; value?: ReactNode }) {
  return <bdi dir="ltr">{children ?? value}</bdi>
}
