/**
 * Ticket 990 (spec 983 D11, C2) — *Reorder all* and the history read's gate.
 *
 * `reorderAll` is asserted at its edge: a fake `add` verb in, the report out. The
 * verb stands in for the page's `runGuarded(addItem)`, so a `SESSION_BUSY` that
 * reaches here is one whose bounded schedule is already spent.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { ATTACHED_SESSION, BELOW_ATP_COMMIT_ATTEMPT, EMPTY_SESSION } from './__fixtures__/payloads'
import { historyRead, reorderAll, type ReorderLine } from './reorder'

/** A refusal exactly as `core/api.ts` maps one: 409 with the envelope, so
 *  `apiErrorCode()` reads the code and `message` is the server's sentence. */
const refusal = (code: string, message: string) =>
  new ApiError('business', message, 409, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], null)

const LINES: ReorderLine[] = [
  { itemNumber: '100001', description: 'PANADOL EXTRA 24', qty: 2, uom: 'PAC' },
  { itemNumber: '100002', description: 'VITAMIN C 1000', qty: 1, uom: 'EA' },
  { itemNumber: '100003', description: 'NIVEA CREAM 50ML', qty: 1, uom: 'EA' },
]

/** A verb that answers each item by its own rule, and records what was asked, in order. */
function verb(rules: Record<string, () => Promise<typeof ATTACHED_SESSION>>) {
  const asked: string[] = []
  return {
    asked,
    add: (line: ReorderLine) => {
      asked.push(`${line.itemNumber}x${line.qty}${line.uom}`)
      return (rules[line.itemNumber] ?? (() => Promise.resolve(ATTACHED_SESSION)))()
    },
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'fallback')

describe('reorderAll', () => {
  it('reorderAddsOneAtATimeAndReportsEachRefusal', async () => {
    const server = verb({ '100002': () => Promise.reject(refusal('ITEM_NOT_FOUND', 'Item 100002 is blocked.')) })

    const report = await reorderAll(LINES, { add: server.add, messageOf })

    // One at a time, in the order's own order, with its quantity and unit.
    expect(server.asked).toEqual(['100001x2PAC', '100002x1EA', '100003x1EA'])
    expect(report.added).toBe(2)
    expect(report.total).toBe(3)
    expect(report.refused).toEqual([
      { line: LINES[1], reason: 'refused', message: 'Item 100002 is blocked.' },
    ])
    expect(report.stopped).toBeNull()
    expect(report.notTried).toEqual([])
  })

  it('stops at the first BUSY and names what it never tried', async () => {
    const server = verb({ '100002': () => Promise.reject(refusal('SESSION_BUSY', 'busy')) })

    const report = await reorderAll(LINES, { add: server.add, messageOf })

    expect(server.asked).toEqual(['100001x2PAC', '100002x1EA'])
    expect(report.added).toBe(1)
    expect(report.stopped).toBe('busy')
    expect(report.refused).toEqual([])
    expect(report.notTried).toEqual([LINES[1], LINES[2]])
  })

  it('stops when the order is closed under it', async () => {
    const server = verb({ '100001': () => Promise.reject(refusal('SESSION_CLOSED', 'closed')) })

    const report = await reorderAll(LINES, { add: server.add, messageOf })

    expect(server.asked).toEqual(['100001x2PAC'])
    expect(report.added).toBe(0)
    expect(report.stopped).toBe('closed')
    expect(report.notTried).toEqual(LINES)
  })

  it('counts a below-availability ask as not added, and carries on', async () => {
    const asked = { ...BELOW_ATP_COMMIT_ATTEMPT, pendingConfirmation: { kind: 'belowAtp' } } as typeof ATTACHED_SESSION
    const server = verb({ '100001': () => Promise.resolve(asked) })

    const report = await reorderAll(LINES, { add: server.add, messageOf })

    expect(server.asked).toHaveLength(3)
    expect(report.added).toBe(2)
    expect(report.refused).toEqual([{ line: LINES[0], reason: 'belowAtp', message: null }])
  })

  it('hands each landed state to onLanded, so the basket redraws as it goes', async () => {
    const landed: number[] = []
    const server = verb({})

    await reorderAll(LINES, { add: server.add, messageOf, onLanded: (state) => landed.push(state.version) })

    expect(landed).toEqual([ATTACHED_SESSION.version, ATTACHED_SESSION.version, ATTACHED_SESSION.version])
  })
})

describe('historyRead', () => {
  it('noHistoryWithoutACustomer', () => {
    expect(EMPTY_SESSION.header.customer).toBeFalsy()
    expect(historyRead(EMPTY_SESSION)).toBeNull()
    expect(historyRead(undefined)).toBeNull()
  })

  it('reads once per attached customer, keyed by them', () => {
    const read = historyRead(ATTACHED_SESSION)
    const customerId = ATTACHED_SESSION.header.customer!.customerId
    expect(read).toEqual({ transactionId: ATTACHED_SESSION.transactionId, customerId })
  })

  it('does not read on an order that is no longer open', () => {
    expect(historyRead({ ...ATTACHED_SESSION, status: 'submitted' } as typeof ATTACHED_SESSION)).toBeNull()
  })
})
