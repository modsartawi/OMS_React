import { currencyDecimals, formatMoneyIn } from '@/core/money'

/**
 * **The amount, read back in words** — 🔑 the typo guard ticket 271 turns on, and the
 * one module its Proof names by hand (spec 267 D4).
 *
 * The guard is a **review step, not a cap**. A numeric threshold was rejected twice
 * and for two separate reasons: approval limits are deliberately unsettled, so any
 * number is invented; and a cap refuses the legitimate large entry while doing
 * nothing at all about a plausible wrong one. `50000` and `500` are one keystroke
 * apart as digit strings — *fifty thousand riyals* and *five hundred riyals* are not
 * one word apart as sentences, and a human reading the sentence catches what a human
 * skimming the digits does not.
 *
 * ⚠️ **The words describe what the branch can physically count, and that is not
 * client-side rounding** (the ticket's boundary). D10 already says every figure on
 * this screen renders at the *branch's own* precision — 2 decimals for SAR, 3 for
 * BHD — and this module applies exactly that same rendering rule, `formatMoneyIn`'s,
 * to the sentence as well as to the digits. What it must never do is compute a
 * figure: the amount that ends up in the ledger is the **server's**, and the
 * confirmation reads back what the server returned rather than what was typed. The
 * read-back and the ledger therefore cannot disagree — which is the whole point of
 * rendering the *countable* figure here rather than the typed one.
 *
 * 🚩 Pure: no React, no `t()`, no network. It returns the number **words** and the
 * two magnitudes; the currency's own nouns (*riyals*, *halalas*, *dinars*, *fils*)
 * are the `settlement` namespace's, because they are user-visible text and the
 * i18n rule admits no exception for a word that happens to be domain vocabulary.
 */

/** The value the words describe, split the way a branch counts it. */
export type AmountWords = {
  /** What the words are about — the typed figure at the branch's own precision. */
  value: number
  /** The same figure **grouped**: `50,000.00`. Half the guard; the words are the other. */
  grouped: string
  /** Whole units — 50,000 of `50,000.57`. */
  majorValue: number
  majorWords: string
  /** Fractional units as a **count**, not a fraction — 57 halalas, 250 fils. */
  minorValue: number
  minorWords: string
  /** The branch's precision, so a caller can label the box that was typed into. */
  decimals: number
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]
/** Up to the estate's plausible ceiling and one order beyond it. A settlement entry
 *  is a branch's till difference, not a balance sheet. */
const SCALES: readonly [number, string][] = [
  [1_000_000_000, 'billion'],
  [1_000_000, 'million'],
  [1_000, 'thousand'],
]

/**
 * One non-negative integer in English words.
 *
 * ⚠️ **`en-US` style, deliberately, and it matches the digits beside it.** No
 * *"and"* before the tens (`one hundred five`, not `one hundred and five`), because
 * the figures on this screen are drawn with `toLocaleString('en-US')` — pinned in
 * `@/core/money` for the same reason this is pinned here: a sentence and a number
 * that disagreed about their locale would be two readings of one amount.
 *
 * Hyphenated tens (`twenty-one`) because that is what makes `21` and `2100`
 * unmistakable when read aloud on the phone call this whole screen exists for.
 */
export function numberToWords(value: number): string {
  if (!Number.isFinite(value)) return ONES[0]
  const n = Math.floor(Math.abs(value))
  if (n < 20) return ONES[n]
  if (n < 100) {
    const rest = n % 10
    return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : '')
  }
  if (n < 1_000) {
    const rest = n % 100
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${numberToWords(rest)}` : ''}`
  }
  for (const [scale, name] of SCALES) {
    if (n >= scale) {
      const rest = n % scale
      return `${numberToWords(Math.floor(n / scale))} ${name}${rest ? ` ${numberToWords(rest)}` : ''}`
    }
  }
  // Beyond a billion the estate has bigger problems than a sentence; the digits
  // still render, and they are the figure of record.
  return String(n)
}

/**
 * One amount, ready to be read back — grouped digits and the two magnitudes in words.
 *
 * 🚩 **The split is done in integer minor units, not by slicing the decimal string.**
 * `50000.57 * 100` is `5000056.999…` in IEEE-754, so a naive `Math.floor` of the
 * remainder reads back *fifty-six halalas* on an amount the same screen prints as
 * `50,000.57` — the exact class of disagreement between the words and the figure
 * that this guard exists to make impossible.
 *
 * A negative or unreadable amount reads as **zero** rather than throwing: the form
 * refuses to commit one, and a review step that crashed on a stray `-` would be a
 * broken screen instead of a refused entry.
 */
export function amountInWords(
  value: number | null | undefined,
  currency: string | null | undefined,
): AmountWords {
  const decimals = currencyDecimals(currency)
  const factor = 10 ** decimals
  const safe = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
  const units = Math.round(safe * factor)
  const rounded = units / factor
  const majorValue = Math.floor(units / factor)
  const minorValue = units - majorValue * factor

  return {
    value: rounded,
    grouped: formatMoneyIn(rounded, currency),
    majorValue,
    majorWords: numberToWords(majorValue),
    minorValue,
    minorWords: numberToWords(minorValue),
    decimals,
  }
}
