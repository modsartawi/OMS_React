import type { AmountWords } from './amount-words'

/**
 * **The amount, as a sentence** — the words plus the currency's own nouns (*fifty
 * thousand riyals and fifty-seven halalas*).
 *
 * 🔑 **This is the guard itself, so there is exactly one of it.** 271 reads back one
 * entry's amount before it commits; 273 reads back a whole file's total before it
 * commits — the ticket calls that *"271's guard lifted to the aggregate"*, and two
 * copies of it that could drift on a plural or a currency noun would be two
 * different guards on one screen. Extracted here the moment the second consumer
 * arrived, which is `feature-structure`'s own ladder (copy the markup, extract the
 * rule) and the call 272 made for `ReasonField`.
 *
 * The **number** words are `amount-words.ts`'s (pure, tested); the **nouns** are the
 * `settlement` namespace's, because they are user-visible text and the i18n rule
 * admits no exception for a word that happens to be domain vocabulary. Their plural
 * forms are i18next's `_one`/`_other`, so *one riyal* is not *1 riyals* on the one
 * screen where a sentence is the guard.
 */

/** Which currencies this app has words for. Anything else reads its ISO code as the
 *  noun (*"fifty thousand KWD"*) rather than borrowing a riyal's — the footprint is
 *  KSA + Bahrain (`CURRENCY_DECIMALS` says so in one line), and a third currency
 *  arrives here visibly instead of wearing the wrong noun. Logged for 274. */
export const WORDED_CURRENCIES = new Set(['SAR', 'BHD'])

export function inWordsSentence(
  t: (key: string, options?: Record<string, unknown>) => string,
  words: AmountWords,
  currencyKey: string,
): string {
  const code = (currencyKey || '').toUpperCase()
  const bank = WORDED_CURRENCIES.has(code) ? code : 'other'
  const major = t(`post.words.${bank}.major`, {
    count: words.majorValue,
    words: words.majorWords,
    currency: code,
  })
  if (words.minorValue === 0) return major

  const minor = t(`post.words.${bank}.minor`, {
    count: words.minorValue,
    words: words.minorWords,
    currency: code,
  })
  // A sub-unit amount with no whole units reads as itself — *fifty halalas*, not
  // *zero riyals and fifty halalas*.
  return words.majorValue === 0 ? minor : t('post.words.join', { major, minor })
}
