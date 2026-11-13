/**
 * Oms 896 — the payer-month screen's pure rules: the reason, which act a row offers, the close action's
 * correction count, when Close all is offered and what it says, the history's lines, and the refusals.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { PayerMonthAuditEntry, PayerMonthRow } from '@/core/models/insurance-payer-month'
import {
  REASON_MAX,
  REFUSAL_CODES,
  actBody,
  closeAction,
  closeAllOffer,
  defaultPeriod,
  historyLines,
  mergeRow,
  periodFromParams,
  periodText,
  periodToParams,
  reasonMeter,
  refusalKey,
  rowAct,
  rowState,
} from './payer-month-rules'
import { canManagePayerMonths } from './access'

const ROW = (over: Partial<PayerMonthRow> = {}): PayerMonthRow => ({
  customerId: 'BUPA',
  year: 2026,
  month: 10,
  isClosed: false,
  hasRow: false,
  lastAction: '',
  lastActionBy: '',
  lastActionAt: '0001-01-01T00:00:00',
  lastActionReason: '',
  correctionCount: 0,
  ...over,
})

const coded = (code: string | null, status = 400) =>
  new ApiError('business', 'server sentence', status, code === null ? [] : [{ errorCode: code, errorMessage: '' } as never])

describe('the access probe', () => {
  it('only an explicit canManage: true opens the leaf and the page', () => {
    expect(canManagePayerMonths({ canManage: true })).toBe(true)
    for (const r of [{ canManage: false }, { canManage: 'true' }, {}, null, undefined])
      expect(canManagePayerMonths(r as never)).toBe(false)
  })
})

describe('the reason', () => {
  it('a blank reason builds no body, so close is not sent', () => {
    for (const reason of ['', '   ', '\n\t'])
      expect(actBody({ kind: 'close', row: ROW(), year: 2026, month: 10 }, reason)).toBeNull()
  })

  it('a reason past the column (512) builds no body either', () => {
    expect(actBody({ kind: 'close', row: ROW(), year: 2026, month: 10 }, 'x'.repeat(REASON_MAX + 1))).toBeNull()
    expect(actBody({ kind: 'close', row: ROW(), year: 2026, month: 10 }, 'x'.repeat(REASON_MAX))).not.toBeNull()
  })

  it('close and reopen carry the payer; close-all never does; no body names an actor', () => {
    const close = actBody({ kind: 'close', row: ROW(), year: 2026, month: 10 }, '  payer statement sent  ')
    expect(close).toEqual({ customerId: 'BUPA', year: 2026, month: 10, reason: 'payer statement sent' })
    const reopen = actBody({ kind: 'reopen', row: ROW({ isClosed: true }), year: 2026, month: 10 }, 'late correction')
    expect(reopen).toEqual({ customerId: 'BUPA', year: 2026, month: 10, reason: 'late correction' })
    const all = actBody({ kind: 'closeAll', count: 3, year: 2026, month: 10 }, 'month-end')
    expect(all).toEqual({ year: 2026, month: 10, reason: 'month-end' })
    for (const body of [close, reopen, all]) expect(Object.keys(body!)).not.toContain('actor')
  })

  it('the meter counts the reason trimmed, as the ledger does, and is over past 512', () => {
    expect(reasonMeter('abc')).toEqual({ length: 3, max: 512, over: false, blank: false })
    expect(reasonMeter('x'.repeat(500) + ' '.repeat(20))).toMatchObject({ length: 500, over: false })
    expect(reasonMeter('   ')).toMatchObject({ blank: true })
    expect(reasonMeter('x'.repeat(513))).toMatchObject({ length: 513, over: true })
  })
})

describe('a row', () => {
  it('Reopen shows on a closed row only; an open row offers Close', () => {
    expect(rowAct(ROW({ isClosed: true, hasRow: true, lastAction: 'Close' }))).toBe('reopen')
    expect(rowAct(ROW())).toBe('close')
    expect(rowAct(ROW({ isClosed: false, hasRow: true, lastAction: 'Reopen' }))).toBe('close')
  })

  it('its state tells never-acted from reopened', () => {
    expect(rowState(ROW())).toBe('open')
    expect(rowState(ROW({ hasRow: true, lastAction: 'Reopen' }))).toBe('reopened')
    expect(rowState(ROW({ isClosed: true, hasRow: true, lastAction: 'Close' }))).toBe('closed')
  })

  it('the corrections count rides the close action', () => {
    expect(closeAction(ROW({ correctionCount: 3 }))).toEqual({ act: 'close', corrections: 3 })
    expect(closeAction(ROW())).toEqual({ act: 'close', corrections: 0 })
    // A closed row's action is Reopen; its count still travels with it.
    expect(closeAction(ROW({ isClosed: true, correctionCount: 2 }))).toEqual({ act: 'reopen', corrections: 2 })
  })

  it('an act answer replaces its row in a list, matched case-insensitively, and joins a list that lacked it', () => {
    const rows = [ROW({ customerId: 'AXA' }), ROW()]
    const closed = ROW({ customerId: 'bupa', isClosed: true, hasRow: true })
    expect(mergeRow(rows, closed)).toEqual([ROW({ customerId: 'AXA' }), closed])
    const added = mergeRow([ROW({ customerId: 'AXA' })], ROW({ customerId: 'TAWUNIYA' }))
    expect(added.map((r) => r.customerId)).toEqual(['AXA', 'TAWUNIYA'])
  })
})

describe('Close all', () => {
  it('is offered only once the activity list has been read', () => {
    expect(closeAllOffer({ activity: false, rows: [ROW()] })).toBeNull()
    expect(closeAllOffer({ activity: true, rows: undefined })).toBeNull()
  })

  it('states its count from that list, and how many of them are already closed', () => {
    const rows = [ROW(), ROW({ customerId: 'AXA', isClosed: true }), ROW({ customerId: 'MEDGULF', correctionCount: 2 })]
    expect(closeAllOffer({ activity: true, rows })).toEqual({ count: 3, alreadyClosed: 1, corrections: 2 })
  })

  it('an empty activity month offers nothing to close', () => {
    expect(closeAllOffer({ activity: true, rows: [] })).toBeNull()
  })
})

describe('the history', () => {
  it('shows both acts, oldest first, in the page’s words', () => {
    const audit: PayerMonthAuditEntry[] = [
      { actor: 'msartawi', action: 'Close', customerId: 'BUPA', year: 2026, month: 10, reason: 'month-end', beforeValue: 'Open', afterValue: 'Closed', createdAt: '2026-11-01T09:00:00' },
      { actor: 'nalharbi', action: 'Reopen', customerId: 'BUPA', year: 2026, month: 10, reason: 'late correction', beforeValue: 'Closed', afterValue: 'Open', createdAt: '2026-11-03T14:30:00' },
    ]
    expect(historyLines(audit)).toEqual([
      { key: 'history.action.close', actor: 'msartawi', at: '2026-11-01 09:00', reason: 'month-end' },
      { key: 'history.action.reopen', actor: 'nalharbi', at: '2026-11-03 14:30', reason: 'late correction' },
    ])
  })

  it('an action it does not know shows as itself', () => {
    expect(historyLines([{ actor: 'a', action: 'Purge', reason: '', createdAt: '' } as PayerMonthAuditEntry])[0]).toMatchObject({
      key: 'history.action.other',
    })
  })
})

describe('the period', () => {
  it('opens on the month before today', () => {
    expect(defaultPeriod(new Date(2026, 10, 13))).toEqual({ year: 2026, month: 10 })
    expect(defaultPeriod(new Date(2026, 0, 5))).toEqual({ year: 2025, month: 12 })
  })

  it('reads as one yyyy-MM value', () => {
    expect(periodText({ year: 2026, month: 3 })).toBe('2026-03')
  })

  it('round-trips through the URL, and a bad value falls back to the default', () => {
    const now = new Date(2026, 10, 13)
    expect(periodFromParams(new URLSearchParams('year=2025&month=3'), now)).toEqual({ year: 2025, month: 3 })
    expect(periodToParams({ year: 2025, month: 3 }).toString()).toBe('year=2025&month=3')
    for (const qs of ['', 'year=x&month=3', 'year=2025&month=13', 'year=2025&month=0', 'year=1999&month=1'])
      expect(periodFromParams(new URLSearchParams(qs), now)).toEqual({ year: 2026, month: 10 })
  })
})

describe('the refusals', () => {
  it('each ledger code has its own sentence', () => {
    expect(REFUSAL_CODES).toEqual(['INS-16261', 'INS-16262', 'INS-16263', 'INS-16264'])
    expect(refusalKey(coded('INS-16264'))).toBe('refusal.INS-16264')
  })

  it('a bare 403 is the grant, and an unknown code is the server’s own sentence', () => {
    expect(refusalKey(new ApiError('business', '', 403))).toBe('refusal.denied')
    expect(refusalKey(coded('INS-99999'))).toBeNull()
    expect(refusalKey(new Error('boom'))).toBeNull()
  })
})
