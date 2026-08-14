import type { SettlementFleetRow } from '@/core/models/settlement'

/**
 * **The estate headline** — what this screen is allowed to say about the whole
 * fleet at once (ticket 270, spec 267 D2: *"the estate headline is a report figure
 * and is not actionable — render it as such"*).
 *
 * 🚩 **274 removed the money from it, and that is not a tidy-up.** 270 drew two
 * magnitudes per currency, folded from each fleet row's `currencyKey`. The live
 * fleet row carries no currency (`.afk/FINDINGS-274.md` §B6), and the estate is
 * **KSA and Bahrain, both live** — so there is no honest way left to state an
 * estate-wide total:
 *
 * - folding them together adds dinars to riyals and produces a figure that is
 *   **wrong in both**, drawn at whichever precision the renderer guessed;
 * - splitting them needs the field that is missing;
 * - defaulting the lot to SAR is the silent rounding D10 exists to forbid.
 *
 * So the headline states **counts**, which no currency can corrupt: how many
 * branches are carrying open settlement, and how many open entries that is. Both
 * are true regardless of what money they are in, and both still answer the question
 * the headline exists for — *is the estate quiet, or is there a lot out there?*
 *
 * ⚠️ **The money is not gone from the screen, only from the fold.** A branch's own
 * figures are on its account (269), where they belong to one branch and one phone
 * call. What died is the cross-branch sum, which D2 already called a report figure
 * nobody owes and no till can consume.
 *
 * 🔑 Restore the two magnitudes the day `currencyKey` reaches the fleet row — the
 * fold was correct, it simply had nothing to fold on.
 *
 * The other half of this module was `ledgerFigures`, the cross-estate ledger's
 * footer. It went with the ledger door that does not exist (§B1).
 *
 * 🚩 Pure: no React, no `t()`, no network.
 */

/**
 * The estate's headline.
 *
 * `branchCount` counts only branches actually **holding** an open entry — the ~two
 * thirds that hold none are not a figure about anything. `openCount` is the entries
 * behind them, which is what makes *"47 across 9 branches"* readable as different
 * from *"47 on one"*.
 */
export type EstateFigures = {
  branchCount: number
  openCount: number
}

export function estateFigures(
  rows: readonly SettlementFleetRow[] | null | undefined,
): EstateFigures {
  let branchCount = 0
  let openCount = 0

  for (const row of rows ?? []) {
    // 🚩 A fleet row is an AGGREGATE — it carries its branch's whole open count
    // already summed, so it contributes that rather than counting as one entry.
    if (row.openCount <= 0) continue
    branchCount++
    openCount += row.openCount
  }

  return { branchCount, openCount }
}
