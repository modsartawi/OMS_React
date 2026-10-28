/**
 * Ticket 633 — what a bulk load did (door BackOffice 3175): a count per outcome that together make up
 * every line sent, and every line not added, with its reason. An outcome this screen does not know yet
 * is still listed (and counted), never dropped.
 */
import { describe, expect, it } from 'vitest'
import { bulkOutcome } from './bulk-outcome'

const RESULT = {
  added: 3,
  alreadyInGroup: 1,
  duplicateInBatch: 2,
  notAMobile: 1,
  placeholder: 1,
  rejected: [
    { line: 'abc', outcome: 'NotAMobile' },
    { line: '0501234567', outcome: 'DuplicateInBatch' },
    { line: '0500000000', outcome: 'Placeholder' },
    { line: '966551234567', outcome: 'AlreadyInGroup' },
    { line: '+966501234567', outcome: 'DuplicateInBatch' },
  ],
}

describe('bulk outcome summary counts every outcome and lists rejected lines by reason', () => {
  it('counts each outcome under its key, in a fixed order, summing to the lines sent', () => {
    const o = bulkOutcome(RESULT, 8)
    expect(o.counts).toEqual([
      { key: 'added', count: 3 },
      { key: 'alreadyInGroup', count: 1 },
      { key: 'duplicateInBatch', count: 2 },
      { key: 'notAMobile', count: 1 },
      { key: 'placeholder', count: 1 },
    ])
    expect(o.total).toBe(8)
    expect(o.sent).toBe(8)
    expect(o.accountedFor).toBe(true)
  })

  it('lists the rejected lines grouped by reason, in the counts order, each as typed', () => {
    expect(bulkOutcome(RESULT, 8).rejected).toEqual([
      { line: '966551234567', outcome: 'AlreadyInGroup', reason: 'alreadyInGroup' },
      { line: '0501234567', outcome: 'DuplicateInBatch', reason: 'duplicateInBatch' },
      { line: '+966501234567', outcome: 'DuplicateInBatch', reason: 'duplicateInBatch' },
      { line: 'abc', outcome: 'NotAMobile', reason: 'notAMobile' },
      { line: '0500000000', outcome: 'Placeholder', reason: 'placeholder' },
    ])
  })

  it('reads an outcome in any case or spelling of the key (notAMobile, NOT_A_MOBILE)', () => {
    const o = bulkOutcome({ ...RESULT, rejected: [{ line: 'x', outcome: 'notAMobile' }, { line: 'y', outcome: 'NOT_A_MOBILE' }] }, 8)
    expect(o.rejected.map((r) => r.reason)).toEqual(['notAMobile', 'notAMobile'])
  })

  it('still lists — and counts — a line whose outcome this screen does not know, after the known ones', () => {
    const o = bulkOutcome(
      { added: 1, alreadyInGroup: 0, duplicateInBatch: 0, notAMobile: 1, placeholder: 0, rejected: [{ line: '0512', outcome: 'Blocked' }, { line: 'q', outcome: 'NotAMobile' }] },
      3,
    )
    expect(o.rejected).toEqual([
      { line: 'q', outcome: 'NotAMobile', reason: 'notAMobile' },
      { line: '0512', outcome: 'Blocked', reason: null },
    ])
    expect(o.counts.at(-1)).toEqual({ key: 'other', count: 1 })
    expect(o.total).toBe(3)
    expect(o.accountedFor).toBe(true)
  })

  it('says when the counts do not make up the lines sent', () => {
    const o = bulkOutcome(RESULT, 9)
    expect(o.total).toBe(8)
    expect(o.accountedFor).toBe(false)
  })

  it('reads a missing count as 0 and a missing rejected list as none', () => {
    const o = bulkOutcome({ added: 2 } as never, 2)
    expect(o.counts.map((c) => c.count)).toEqual([2, 0, 0, 0, 0])
    expect(o.rejected).toEqual([])
    expect(o.accountedFor).toBe(true)
  })
})
