/**
 * The currency-aware money formatter the Sales tab needs, and that the app does
 * not have (ticket 237).
 *
 * 🚩 **This is deliberately not `core/util/number-format`'s `formatMoney`, and
 * `formatMoney` is deliberately not widened.** That function is documented as
 * *"the single money formatter for the app"* and is fixed at 2 decimals; every
 * existing caller — deliveries, documents, simulation, call centre — means 2 dp,
 * because every one of them draws a SAR figure. Adding a currency parameter
 * there would put a decision on hundreds of call sites that none of them has to
 * make.
 *
 * So this lives **inside the feature**, per
 * [feature-structure](../../../../.claude/rules/feature-structure.md): one
 * consumer today, and it graduates up to `core/` the day a second one wants it.
 * Called out here so a reviewer reads it as the rule working, not as a duplicate.
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
