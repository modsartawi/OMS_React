import { describe, expect, it } from 'vitest'

import type { LoyActivityRow } from '@/core/models/loy'
import { buildActivityColumns } from './activity-columns'

/**
 * The Expires column, pinned where the drive cannot see it.
 *
 * 🚩 This column both **sorts and filters** (226 §7: the whole 100-row window is
 * in the browser, so sorting reorders the result and not a page), which makes the
 * split between value and display load-bearing: AG Grid sorts the *value*, so a
 * `valueGetter` that returned `"02 Aug 2027"` would sort `"01 Jan 2028"` first
 * and filter on `"Aug"`. The tab drive reads rendered `cellText` and is blind to
 * that — both readings are identical on screen — which is exactly why the
 * assertion lives here.
 *
 * The Date column has always been right (`field` + `valueFormatter`); this suite
 * holds Expires to the same shape and its two blanking rules besides.
 */

/** `t` as the columns see it: identity, so an assertion reads the key rather than
 *  a copy string a wording change would break for no behavioural reason. */
const t = ((key: string) => key) as unknown as Parameters<typeof buildActivityColumns>[0]

const row = (over: Partial<LoyActivityRow> = {}): LoyActivityRow => ({
  activityId: '9001',
  activityDateTime: '2026-08-02T14:35:00',
  activityType: 'ACRL',
  description: 'Purchase',
  activityStatus: 'A',
  referenceNumber: 'R-88412',
  expiryDate: '2027-08-02T00:00:00',
  points: 12.5,
  ...over,
})

const expires = () => {
  const col = buildActivityColumns(t).find((c) => c.colId === 'expires')
  if (!col) throw new Error('no expires column')
  return col
}

/** The value AG Grid sorts and filters on. */
const sortValue = (one: LoyActivityRow): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (expires().valueGetter as any)({ data: one })

/** The text the agent reads. */
const shown = (one: LoyActivityRow): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  String((expires().valueFormatter as any)({ value: sortValue(one), data: one }))

describe('the Expires column', () => {
  it('🚩 sorts on the underlying date, not on the words — a display string would order Jan 2028 before Aug 2027', () => {
    const august2027 = sortValue(row({ expiryDate: '2027-08-02T00:00:00' }))
    const january2028 = sortValue(row({ expiryDate: '2028-01-01T00:00:00' }))

    expect(august2027).toBe('2027-08-02T00:00:00')
    expect(String(august2027) < String(january2028)).toBe(true)
  })

  it('shows the short date, so the value it sorts on is never what the agent reads', () => {
    expect(shown(row({ expiryDate: '2027-08-02T00:00:00' }))).toBe('02 Aug 2027')
  })

  it('blanks a debit — expiry is meaningless when the server took points away', () => {
    const debit = row({ points: -40, expiryDate: '2027-08-02T00:00:00' })
    expect(sortValue(debit)).toBeNull()
    expect(shown(debit)).toBe('')
  })

  it('blanks a zero-point row for the same reason', () => {
    expect(shown(row({ points: 0 }))).toBe('')
  })

  it('blanks the 0001-01-01 sentinel an unset date arrives as', () => {
    expect(shown(row({ expiryDate: '0001-01-01T00:00:00' }))).toBe('')
  })

  it('keeps a credit its date', () => {
    expect(shown(row({ points: 12.5 }))).toBe('02 Aug 2027')
  })
})
