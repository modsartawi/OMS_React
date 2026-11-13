/**
 * Oms 896 — the payer-month calls at the `@/core/api` boundary: what is sent, and what is not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayerMonthRow } from '@/core/models/insurance-payer-month'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { payerMonthApi, ReasonRequiredError, monthKey, PAYER_MONTH_KEY } = await import('./api')
const { payerMonthAccessApi } = await import('./access')

const ROW: PayerMonthRow = {
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
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue([])
  api.post.mockReset().mockResolvedValue({})
})

describe('the month read', () => {
  it('the page opens without activity', async () => {
    await payerMonthApi.month(2026, 10, false)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('InsurancePayerMonthWeb/Months/2026/10', undefined)
  })

  it('"Show payers with activity" sends activity=true', async () => {
    await payerMonthApi.month(2026, 10, true)
    expect(api.get).toHaveBeenCalledWith('InsurancePayerMonthWeb/Months/2026/10', { activity: 'true' })
  })

  it('the two reads are two cache entries under one prefix, so an act can re-read both', () => {
    expect(monthKey(2026, 10, false)).not.toEqual(monthKey(2026, 10, true))
    for (const key of [monthKey(2026, 10, false), monthKey(2026, 10, true)]) expect(key.slice(0, 1)).toEqual([...PAYER_MONTH_KEY])
  })
})

describe('the acts', () => {
  it('close without a reason is not sent', async () => {
    for (const reason of ['', '   '])
      await expect(payerMonthApi.act({ kind: 'close', row: ROW, year: 2026, month: 10 }, reason)).rejects.toBeInstanceOf(ReasonRequiredError)
    await expect(payerMonthApi.closeAll({ kind: 'closeAll', count: 3, year: 2026, month: 10 }, '')).rejects.toBeInstanceOf(ReasonRequiredError)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('close and reopen post the payer, the period and the reason — never an actor', async () => {
    await payerMonthApi.act({ kind: 'close', row: ROW, year: 2026, month: 10 }, 'statement sent')
    expect(api.post).toHaveBeenLastCalledWith('InsurancePayerMonthWeb/Close', { customerId: 'BUPA', year: 2026, month: 10, reason: 'statement sent' })
    await payerMonthApi.act({ kind: 'reopen', row: { ...ROW, isClosed: true }, year: 2026, month: 10 }, 'late correction')
    expect(api.post).toHaveBeenLastCalledWith('InsurancePayerMonthWeb/Reopen', { customerId: 'BUPA', year: 2026, month: 10, reason: 'late correction' })
  })

  it('close all sends ONE request for the month, naming no payer', async () => {
    await payerMonthApi.closeAll({ kind: 'closeAll', count: 14, year: 2026, month: 10 }, 'month-end')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('InsurancePayerMonthWeb/CloseAll', { year: 2026, month: 10, reason: 'month-end' })
  })
})

describe('the reads behind a row', () => {
  it('history and corrections are read by payer and period, the payer escaped', async () => {
    await payerMonthApi.audit('AL RAJHI/T', 2026, 10)
    expect(api.get).toHaveBeenLastCalledWith('InsurancePayerMonthWeb/Audit/AL%20RAJHI%2FT/2026/10')
    await payerMonthApi.corrections('BUPA', 2026, 10)
    expect(api.get).toHaveBeenLastCalledWith('InsurancePayerMonthWeb/Corrections/BUPA/2026/10')
  })
})

describe('the access probe', () => {
  it('reads InsurancePayerMonthWeb/Access', async () => {
    api.get.mockResolvedValueOnce({ canManage: true })
    await expect(payerMonthAccessApi.access()).resolves.toEqual({ canManage: true })
    expect(api.get).toHaveBeenLastCalledWith('InsurancePayerMonthWeb/Access')
  })
})
