/**
 * Deposit **drift** — the one question the Deposits screen exists to answer
 * (ticket 256).
 *
 * A deposit claims a set of ACRs and freezes each one's `NetCollected` at the
 * moment it is banked. ACR_LINKED stamping is deliberately left un-gated after
 * that — collection traceability outranks deposit immutability — so a
 * late-syncing collection can raise an ACR's live total *after* its cash was
 * already handed to the bank. The gap between the frozen figure and the live one
 * is the **drift**, and a deposit carrying one is exactly what the accountant
 * opens this screen to find. That is why the detail region is stacked in place
 * rather than behind a modal: drift a click away is drift taken on faith.
 *
 * Pure — no React, no i18n, no network.
 *
 * 🚩 **Nothing here subtracts two amounts.** `drift` and `hasDrift` are get-only
 * C# properties on `DepositInquiryLineModel` and the serializer emits them, so
 * both are already on the wire, computed in `decimal`. Re-deriving them in the
 * browser would run the comparison in IEEE-754 doubles, where a deposit that
 * balances to the halala can come out non-zero — `1234.30 - 1234.10` is
 * `0.19999999999995` — and the screen would flag a line the server says is
 * clean. Manufacturing the very drift the design exists to surface is the worst
 * failure this module could have, so the rule is: **the server decides, this
 * module only asks.**
 */
import type { DepositInquiryLine } from '@/core/models/collection'

/**
 * Has this claimed ACR moved since it was banked?
 *
 * `=== true` and nothing looser, so a malformed line (`{}`, a string `"true"`, a
 * field the serializer dropped) reads as **not drifted** rather than as an
 * accident of truthiness. A false negative here is a line that looks ordinary; a
 * false positive is a red flag on a deposit that balances, which sends an
 * accountant hunting for a discrepancy that does not exist.
 */
export function lineHasDrift(line: DepositInquiryLine | null | undefined): boolean {
  return line?.hasDrift === true
}

/**
 * ⚠️ **One predicate, deliberately.** A `driftedLines(row)` and a
 * `depositHasDrift(row)` were both written here and both deleted before this
 * landed: nothing on the screen calls them. The detail region asks the question
 * line by line as it draws each row, which is the only place the answer is shown,
 * and an exported-and-tested function with no caller reads as a decided feature
 * rather than as the speculative generality it is. They come back when a caller
 * does — a grid-level drift mark would be the obvious one, and it is not this
 * ticket's.
 */
