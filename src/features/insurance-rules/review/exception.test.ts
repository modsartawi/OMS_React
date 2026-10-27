/**
 * Ticket 614 — an HQ guard exception is valid until a LOCAL day at most 90 days from today (BackOffice 3135,
 * `Exception_ValidUntilMax90Days_LocalDate`): today counts as day 0, so today + 90 is the last day allowed.
 * Expected days are worked by hand on the calendar, not by the code's own `addDays`.
 */
import { describe, expect, it } from 'vitest'
import { exceptionMaxUntil, exceptionValidUntilProblem } from './exception'

describe('exceptionValidUntil', () => {
  it('exceptionValidUntil_capsAt90LocalDays', () => {
    // 27 Oct 2026: 4 days to 31 Oct, +30 November, +31 December, +25 January = 90.
    expect(exceptionMaxUntil('2026-10-27')).toBe('2027-01-25')
    expect(exceptionValidUntilProblem('2027-01-25', '2026-10-27')).toBeNull()
    expect(exceptionValidUntilProblem('2027-01-26', '2026-10-27')).toBe('tooLong')
    // A leap February counts its 29th: 15 Jan 2028 + 16 + 29 + 31 + 14 = 14 Apr 2028.
    expect(exceptionMaxUntil('2028-01-15')).toBe('2028-04-14')
    expect(exceptionValidUntilProblem('2028-04-15', '2028-01-15')).toBe('tooLong')
    // Today is allowed (valid through today); yesterday is not.
    expect(exceptionValidUntilProblem('2026-10-27', '2026-10-27')).toBeNull()
    expect(exceptionValidUntilProblem('2026-10-26', '2026-10-27')).toBe('past')
    // Empty or not a real day.
    expect(exceptionValidUntilProblem('', '2026-10-27')).toBe('missing')
    expect(exceptionValidUntilProblem('2026-02-30', '2026-01-01')).toBe('invalid')
  })
})
