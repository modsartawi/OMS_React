import { formatMoneyIn, formatMoneyOfUnknownCurrency } from '@/core/money'

/**
 * **How this screen draws a figure** — and the one place the currency hole found by
 * ticket 274 is handled.
 *
 * Spec 267 D10 requires every figure at **the branch's own precision**: three
 * decimals for a Bahraini branch, two for a Saudi one. 269 and 270 read that
 * precision off a `currencyKey` on the account and on each fleet row. 274 found the
 * live reads carry no such field — BackOffice spec 1173 D15 makes an entry's very
 * *granularity* depend on `Plant.CurrencyKey` at the **write**, and does not project
 * it onto the **reads** (`.afk/FINDINGS-274.md` §B6).
 *
 * 🔑 **So the currency is passed through exactly as before, and is simply empty
 * today.** That is deliberate: every call site still says which branch's currency it
 * means, the plumbing stays intact, and the day the reads carry a code this function
 * starts honouring it **with no call site changing**. A screen that had ripped the
 * parameter out would have to grow it back.
 *
 * ⚠️ **What it must never do is guess.** `formatMoneyIn` falls back to two decimals
 * when handed nothing, which would render a Bahraini branch's `150.755` as `150.76`
 * — losing a fils, silently, which is precisely the rounding D10 exists to forbid.
 * With no code, this defers to `formatMoneyOfUnknownCurrency`: minimum two decimals,
 * maximum three, so a SAR figure reads `151.00` exactly as it always did and a BHD
 * figure keeps its third digit. Nothing is invented and nothing is destroyed.
 *
 * 🚩 Pure: no React, no `t()`, no network.
 */
export function settlementMoney(
  value: number | null | undefined,
  currencyKey: string | null | undefined,
): string {
  const code = (currencyKey ?? '').trim()
  return code ? formatMoneyIn(value, code) : formatMoneyOfUnknownCurrency(value)
}
