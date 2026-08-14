/**
 * The currency-aware money formatter, born in the Loy member screen's Sales tab
 * (ticket 237) and moved up to `core/` at ticket 250 — a **prefactor**, landed
 * one slice ahead of the second consumer that licenses it, because a feature may
 * not import a feature and the collection screens are about to want it (the
 * actual second call site arrives with ticket 254). A pure move: not one line of
 * behaviour changed, and its suite came along with no assertion edited.
 *
 * 🚩 **This is deliberately not `core/util/number-format`'s `formatMoney`, and
 * `formatMoney` is deliberately not widened.** That function is documented as
 * *"the single money formatter for the app"* and is fixed at 2 decimals; every
 * existing caller — deliveries, documents, simulation, call centre — means 2 dp,
 * because every one of them draws a SAR figure. Adding a currency parameter
 * there would put a decision on hundreds of call sites that none of them has to
 * make.
 *
 * It began **inside the feature**, per
 * [feature-structure](../../.claude/rules/feature-structure.md) — one consumer,
 * so no shared layer — and it moved up here on the eve of a second one wanting
 * it, which is that rule's own escalation path rather than an exception to it.
 * Called out so a reviewer reads it as the rule working, not as a duplicate.
 *
 * Why the Sales tab needs it at all: `RetailTrxDetail.Currency` is **per-row
 * plant master data** (SAP `WAERS`), not a screen-level constant. **Bahrain
 * stores are live**, and BHD is the footprint's only 3-decimal currency — so
 * "always 2 decimals", which is true of points, is false of riyals and dinars
 * together, and a BHD line rendered at 2 dp is a misquoted price rather than an
 * untidy one.
 */

/**
 * The footprint's exceptions to two decimals, stated rather than derived.
 *
 * `Intl`'s own currency-digit table would answer this too, but its answers move
 * with the runtime's ICU build, and a price is not a thing to render differently
 * on two machines. The estate is KSA + Bahrain; when a third currency arrives it
 * arrives here, visibly, as one line.
 */
export const CURRENCY_DECIMALS: Record<string, number> = { BHD: 3 }

/** Two decimals unless the footprint says otherwise. */
const DEFAULT_DECIMALS = 2

/**
 * The distinct currencies a set of rows actually holds, upper-cased.
 *
 * 🚩 **An empty currency is not a currency.** The column is nullable in every
 * source that feeds this, so an old row genuinely arrives without one — and
 * counting that absence as a second currency is the defect this guards: it grows
 * the Loy member's Currency column for a pure-SAR member with one ancient line,
 * and it strips the header code off a pure-SAR collections day for the same
 * reason (244 §7).
 *
 * The estate is KSA **and** Bahrain and both are live, so a result genuinely can
 * mix — which is why the answer is derived from the rows on screen rather than
 * from the member, the store or the day. None of those has a currency; their
 * lines do.
 *
 * `pick` exists because the wire spells the field differently per contract
 * (`RetailTrxDetail.Currency` vs `CollectionInquiry.CurrencyKey`); the rule
 * about what counts as a currency is the shared part, and it is the part that
 * was getting copied.
 *
 * Born twice independently — `salesCurrencies` in the Loy member screen (237)
 * and `resultCurrencies` in the collection screens (254), arrived at separately
 * for the same reason — and graduated here on that second consumer, which is
 * [feature-structure](../../.claude/rules/feature-structure.md)'s own escalation
 * path rather than an exception to it. A feature may not import a feature, so
 * before this the only lawful options were "copy it" or "move it up"; this is
 * the move.
 */
export function distinctCurrencies<T>(
  rows: readonly T[],
  pick: (row: T) => string | null | undefined,
): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const code = pick(row)?.trim().toUpperCase()
    if (code) seen.add(code)
  }
  return [...seen]
}

/**
 * How many decimals one currency code draws.
 *
 * 🚩 **An absent code degrades to 2 rather than throwing.** `Currency` is
 * nullable in source, so old rows genuinely arrive without one — and the honest
 * reading of a missing currency on a KSA estate is "the default", not an error
 * an agent has to interpret mid-call.
 */
export function currencyDecimals(currency: string | null | undefined): number {
  const code = currency?.trim().toUpperCase()
  return (code && CURRENCY_DECIMALS[code]) || DEFAULT_DECIMALS
}

/**
 * The scale money is **held** at, as against drawn at.
 *
 * The GCC has 3-decimal currencies, so the settlement ledger's own columns are
 * `DECIMAL(18,3)` server-side (spec 267 D10) and every figure this app adds up is
 * rounded back to three places before it is compared or displayed.
 *
 * 🚩 Not cosmetic, and not the same decision as `currencyDecimals`: `0.1 + 0.2` is
 * `0.30000000000000004` in IEEE-754, so a total built by summing a branch's open
 * remainders carries that tail into the `=== 0` comparison that decides whether the
 * branch reads as **square**. A branch that is exactly level would otherwise read as
 * owing a millionth of a halala.
 *
 * Born in `features/collection/settlement/account-projection.ts` (269) and graduated
 * here at its **third** copy (270's two report-figure folds) — the escalation path
 * [feature-structure](../../.claude/rules/feature-structure.md) sets, and the same
 * trigger `ScreenGate` and `distinctCurrencies` each took.
 */
export const MONEY_SCALE = 1000

/** One figure at the scale money is held at — three decimals. See `MONEY_SCALE`. */
export function roundMoney(value: number): number {
  return Math.round(value * MONEY_SCALE) / MONEY_SCALE
}

/**
 * The locale the figures are drawn in. Pinned rather than left to the runtime:
 * the app is en-only and a grouped figure that changed separator with the
 * browser's locale would make two agents read the same line differently.
 */
const LOCALE = 'en-US'

/**
 * One money figure in its own row's currency — grouped, and to that currency's
 * decimals.
 *
 * 🚩 **The sign is the value's own.** `Qty` and `Amount` are signed on a return
 * and `UnitPrice` is not, so a return line reads `-1.00 · 12.00 · -12.00`. That
 * is the receipt; matching it beats tidying it, and this formatter therefore
 * neither forces a sign onto a sale nor strips one off a return.
 *
 * A non-numeric value renders blank — a `0.00` in a cell that has no figure
 * behind it reads as a fact about the line.
 */
export function formatMoneyIn(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const digits = currencyDecimals(currency)
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
