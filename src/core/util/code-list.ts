/**
 * A list of codes as an operator types or pastes it (ticket 420, BackOffice spec 2396 stories
 * 35–37): the bonus buy's six Engine Rules lists and the coupon template's origin filter.
 *
 * This reads a list exactly as the server stores it, so the box can show what will be saved.
 * The server is `BbyMaintainValidator.List` (BackOffice `Sartawi.Retail.Data`), with BackOffice
 * 2400's separators, and the coupon admin's origin-filter writer does the same. It splits on
 * `, ; |` space and `\r \n \t`, trims each piece, drops the empty ones and joins them with `,`.
 * It does NOT de-duplicate: a code pasted twice is stored twice. The server upper-cases only
 * loyalty groups and tiers, so the caller asks for that.
 *
 * Shared by two features (bonus-buy-maintenance and coupons), so it lives in core.
 */

/** The server's `ListSeparators`, plus BackOffice 2400's `\r \n \t` (a pasted Excel column or row). */
const SEPARATORS = /[,;| \r\n\t]/

export interface CodeListOptions {
  /** Upper-case the result (the server does this for loyalty groups and tiers only). */
  upper?: boolean
}

/** The list as the server stores it: a trimmed comma list, `''` when it holds no code. */
export function normaliseCodeList(value: string | null | undefined, { upper = false }: CodeListOptions = {}): string {
  const list = (value ?? '')
    .split(SEPARATORS)
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
    .join(',')
  return upper ? list.toUpperCase() : list
}

/** How many codes a normalised list holds, counting a repeated code each time. */
export const codeListCount = (normalised: string): number => (normalised === '' ? 0 : normalised.split(',').length)

export interface CodeListMeter {
  normalised: string
  count: number
  /** The normalised list's length: the value the server checks against the column width. */
  length: number
  max: number
  over: boolean
}

/** What a list box shows beside it: how many codes, and the stored length against the cap. */
export function codeListMeter(value: string | null | undefined, max: number, options?: CodeListOptions): CodeListMeter {
  const normalised = normaliseCodeList(value, options)
  return { normalised, count: codeListCount(normalised), length: normalised.length, max, over: normalised.length > max }
}
