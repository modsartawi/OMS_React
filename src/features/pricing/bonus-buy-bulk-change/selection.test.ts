/**
 * Which rows the bulk change may take (BackOffice spec 4190 stories 14, 15, 32; oms 958): only
 * Planned OMS bonus buys; every other row is locked with its reason, and Select all says what it skipped.
 */
import { describe, expect, it } from 'vitest'
import { BULK_CAP, batchProblem, lockReason, selectAllPlanned } from './selection'

const row = (bbyNumber: string, bbyStatus: string | null, salesArea: [string, string] | null = null) => ({
  bbyNumber,
  bbyStatus,
  salesOrganization: salesArea?.[0] ?? null,
  distributionChannel: salesArea?.[1] ?? null,
})

describe('the lock reason per status', () => {
  it('a Planned OMS bonus buy is not locked', () => {
    expect(lockReason(row('OMS000000001', '1'))).toBeNull()
  })

  it('Tested, Activated (blank) and Deactivated are locked with their own reason', () => {
    expect(lockReason(row('OMS000000002', '3'))).toBe('tested')
    expect(lockReason(row('OMS000000003', ''))).toBe('activated')
    expect(lockReason(row('OMS000000004', '2'))).toBe('deactivated')
  })

  it('🚩 a missing or unknown status is locked, never taken as Planned or Activated', () => {
    expect(lockReason(row('OMS000000005', null))).toBe('unknown')
    expect(lockReason(row('OMS000000006', 'X'))).toBe('unknown')
  })

  it("the server's own `locked` flag (BO BbyBulkListRow.Locked) locks a row the status alone would leave open", () => {
    expect(lockReason({ ...row('OMS000000007', '1'), locked: true })).toBe('unknown')
    expect(lockReason({ ...row('OMS000000008', '1'), locked: false })).toBeNull()
  })

  it('🚩 a SAP bonus buy is locked even when it reads Planned: it is never edited here', () => {
    expect(lockReason(row('0000012345', '1'))).toBe('notOms')
  })
})

describe('select all = Planned only, with the skipped count', () => {
  it('takes the Planned rows in order and counts the rest as skipped', () => {
    expect(
      selectAllPlanned([
        row('OMS000000001', '1'),
        row('OMS000000002', '3'),
        row('OMS000000003', '1'),
        row('OMS000000004', ''),
        row('OMS000000005', '2'),
      ]),
    ).toEqual({ selected: ['OMS000000001', 'OMS000000003'], skipped: 3 })
  })

  it('nothing to take: none selected, every row skipped', () => {
    expect(selectAllPlanned([row('OMS000000002', '3')])).toEqual({ selected: [], skipped: 1 })
    expect(selectAllPlanned([])).toEqual({ selected: [], skipped: 0 })
  })
})

describe('the batch the screen will send', () => {
  const ksa = ['1000', '20'] as [string, string]
  const bahrain = ['1000', '21'] as [string, string]

  it('empty, over the cap, or mixing sales areas is a problem; one area within the cap is not', () => {
    expect(batchProblem([])).toBe('empty')
    expect(batchProblem([row('OMS000000001', '1', ksa), row('OMS000000002', '1')])).toBeNull()
    expect(batchProblem([row('OMS000000001', '1', ksa), row('OMS000000002', '1', bahrain)])).toBe('mixedSalesArea')
    const many = Array.from({ length: BULK_CAP + 1 }, (_, i) => row(`OMS${String(i).padStart(9, '0')}`, '1', ksa))
    expect(BULK_CAP).toBe(200)
    expect(batchProblem(many.slice(0, BULK_CAP))).toBeNull()
    expect(batchProblem(many)).toBe('overCap')
  })
})
