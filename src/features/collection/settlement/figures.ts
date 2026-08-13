import { roundMoney } from '@/core/money'
import type { SettlementFleetRow, SettlementLedgerRow } from '@/core/models/settlement'

/**
 * **Report figures** — the two totals this screen is allowed to draw, and the one
 * fold behind both (ticket 270, spec 267 D2: *"the estate headline is a report figure
 * and is not actionable — render it as such"*).
 *
 * 🚩 **Per currency, two magnitudes, never a net.** Three rules, and each of them is
 * a thing a "helpful" total would get wrong:
 *
 * 1. **Per currency.** The estate is KSA **and** Bahrain, and adding a dinar to a
 *    riyal produces a figure that is wrong in both — which `formatMoneyIn` would then
 *    draw at whichever precision the caller guessed (D10).
 * 2. **The two magnitudes stay apart.** 269's account headline may state a signed
 *    position for **one branch**, because a human reads it on one phone call. An
 *    estate-wide net is a number nobody owes and no till can consume, and drawing one
 *    invites exactly the settle-it-in-one-act reading the account headline already
 *    says out loud it does not support.
 * 3. ⚠️ **Sums of like figures, never a variance.** The rule 269 wrote at
 *    `account-projection.ts` holds here: nothing on this screen differences anything.
 *
 * The door's headline and the ledger's footer were **the same algorithm written
 * twice** until `/standards-review` said so; they are now one fold and two readings
 * of it, which is also what keeps the two from drifting into disagreeing about a
 * currency.
 *
 * 🚩 Pure: no React, no `t()`, no network.
 */

/** One currency's figures. `subjectCount` is *how many of the thing the caller
 *  counts* — branches on the door, matched entries in the ledger — named for the
 *  fold rather than for either reading, so neither borrows the other's noun. */
type Figures = {
  currencyKey: string
  subjectCount: number
  openCount: number
  shortageTotal: number
  surplusTotal: number
}

type Contribution = {
  currencyKey: string
  /** How many **open entries** this row stands for — `1` for an open ledger row, `0`
   *  for a closed one, and a branch's whole count for a fleet row, which is an
   *  aggregate rather than an entry. A cancelled entry never was, a consumed one is
   *  finished and a written-off remainder is forgiven, so none of them counts. */
  openCount: number
  shortage: number
  surplus: number
}

function foldByCurrency<T>(
  rows: readonly T[] | null | undefined,
  contribute: (row: T) => Contribution | null,
): Figures[] {
  const byCurrency = new Map<string, Figures>()
  for (const row of rows ?? []) {
    const c = contribute(row)
    if (!c) continue
    const key = (c.currencyKey || '').toUpperCase()
    const bucket = byCurrency.get(key) ?? {
      currencyKey: key,
      subjectCount: 0,
      openCount: 0,
      shortageTotal: 0,
      surplusTotal: 0,
    }
    bucket.subjectCount++
    bucket.openCount += c.openCount
    bucket.shortageTotal += c.shortage
    bucket.surplusTotal += c.surplus
    byCurrency.set(key, bucket)
  }
  return [...byCurrency.values()]
    .map((f) => ({
      ...f,
      shortageTotal: roundMoney(f.shortageTotal),
      surplusTotal: roundMoney(f.surplusTotal),
    }))
    .sort((a, b) => (a.currencyKey < b.currencyKey ? -1 : 1))
}

/** The estate's headline, over the fleet's aggregated rows. `branchCount` counts
 *  only branches actually holding an open entry — the ~two thirds that hold none are
 *  not a figure about money. */
export type EstateFigures = Omit<Figures, 'subjectCount'> & { branchCount: number }

export function estateFigures(
  rows: readonly SettlementFleetRow[] | null | undefined,
): EstateFigures[] {
  return foldByCurrency(rows, (row) =>
    // 🚩 A fleet row is an AGGREGATE — it carries its branch's whole open count and
    // its two totals already summed, so it contributes them rather than counting as
    // one entry. A branch holding nothing contributes nothing at all: two thirds of
    // the estate is square, and they are not a figure about money.
    row.openCount > 0
      ? {
          currencyKey: row.currencyKey,
          openCount: row.openCount,
          shortage: row.shortageTotal,
          surplus: row.surplusTotal,
        }
      : null,
  ).map(({ subjectCount, ...rest }) => ({ ...rest, branchCount: subjectCount }))
}

/** The ledger's footer, over the entries a filter actually found. `rowCount` is every
 *  row, open or closed — a fact about the answer rather than about the money. */
export type LedgerFigures = Omit<Figures, 'subjectCount'> & { rowCount: number }

export function ledgerFigures(
  rows: readonly SettlementLedgerRow[] | null | undefined,
): LedgerFigures[] {
  return foldByCurrency(rows, (row) => {
    const open = row.status === 'OPEN'
    return {
      currencyKey: row.currencyKey,
      openCount: open ? 1 : 0,
      shortage: open && row.entryKind === 'SHORTAGE' ? row.remainingAmount : 0,
      surplus: open && row.entryKind === 'SURPLUS' ? row.remainingAmount : 0,
    }
  }).map(({ subjectCount, ...rest }) => ({ ...rest, rowCount: subjectCount }))
}
