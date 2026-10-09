/**
 * Ticket 454 — `historyOnDemand`: no history request until a row is expanded, and one request per
 * unit after that (keyed on material + serial + lot).
 */
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Gs1CheckAnswer } from '@/core/models/materials'
import { gs1CheckApi } from './api'
import { historyKey, historyQuery, historyRequest } from './history-on-demand'

afterEach(() => vi.restoreAllMocks())

/** A checked answer, from the contract's own example. */
const answer = (over: { serial?: string | null; lot?: string | null; material?: string | null } = {}): Gs1CheckAnswer => ({
  code: '01062812345678901727033110A12#21X9',
  duplicate: false,
  parse: {
    valid: true,
    gtin: '06281234567890',
    expiry: '2027-03-31',
    lot: over.lot === undefined ? 'A12' : over.lot,
    serial: over.serial === undefined ? 'X9' : over.serial,
    issues: [],
  },
  material:
    over.material === null ? null : { materialNumber: over.material ?? '101234', description: 'PANADOL 500MG 24 TAB', description2: null },
  materialReason: over.material === null ? 'GTIN_UNKNOWN' : null,
  batch: 'known',
  status: 'SOLD',
  soldRef: { storeCode: '1007', machine: '03', trxNumber: '200311' },
  heldBy: null,
  historyCount: 3,
})

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('historyRequest — what a unit is asked by', () => {
  it('material + serial + lot, as strings', () => {
    expect(historyRequest(answer())).toEqual({ material: '101234', serial: 'X9', lot: 'A12' })
  })
  it('lot is optional', () => {
    expect(historyRequest(answer({ lot: null }))).toEqual({ material: '101234', serial: 'X9', lot: null })
  })
  it('nothing to ask without a material, a serial, or an answer', () => {
    expect(historyRequest(answer({ material: null }))).toBeNull()
    expect(historyRequest(answer({ serial: null }))).toBeNull()
    expect(historyRequest(undefined)).toBeNull()
  })
  it('the key is material + serial + lot, and the history count the check gave', () => {
    expect(historyKey(historyRequest(answer()), 3)).toEqual(['materials', 'gs1History', '101234', 'X9', 'A12', 3])
    expect(historyKey(historyRequest(answer({ lot: 'B7' })))).not.toEqual(historyKey(historyRequest(answer())))
  })
})

describe('historyOnDemand — no request until expanded, one per unit after', () => {
  it('a collapsed row asks nothing', async () => {
    const history = vi.spyOn(gs1CheckApi, 'history').mockResolvedValue([])
    const client = new QueryClient()
    const row = new QueryObserver(client, historyQuery(historyRequest(answer()), false))
    const off = row.subscribe(() => {})
    await tick()
    expect(history).not.toHaveBeenCalled()
    off()
  })

  it('expanding asks once; the same unit again (re-opened, or a duplicate row) asks no more', async () => {
    const history = vi.spyOn(gs1CheckApi, 'history').mockResolvedValue([])
    const client = new QueryClient()
    const request = historyRequest(answer())
    const row = new QueryObserver(client, historyQuery(request, false))
    const off = row.subscribe(() => {})
    row.setOptions(historyQuery(request, true))
    await vi.waitFor(() => expect(row.getCurrentResult().isSuccess).toBe(true))
    expect(history).toHaveBeenCalledTimes(1)
    expect(history).toHaveBeenCalledWith({ material: '101234', serial: 'X9', lot: 'A12' })

    // Collapse and expand again; then a second row of the same unit.
    row.setOptions(historyQuery(request, false))
    row.setOptions(historyQuery(request, true))
    const twin = new QueryObserver(client, historyQuery(historyRequest(answer()), true))
    const offTwin = twin.subscribe(() => {})
    await tick()
    expect(history).toHaveBeenCalledTimes(1)
    off()
    offTwin()
  })

  it('a different unit is its own request', async () => {
    const history = vi.spyOn(gs1CheckApi, 'history').mockResolvedValue([])
    const client = new QueryClient()
    const a = new QueryObserver(client, historyQuery(historyRequest(answer()), true))
    const b = new QueryObserver(client, historyQuery(historyRequest(answer({ serial: 'X10' })), true))
    const off = [a.subscribe(() => {}), b.subscribe(() => {})]
    await vi.waitFor(() => expect(history).toHaveBeenCalledTimes(2))
    off.forEach((u) => u())
  })

  it('a re-scan whose history count has grown asks again; the same count does not', async () => {
    const history = vi.spyOn(gs1CheckApi, 'history').mockResolvedValue([])
    const client = new QueryClient()
    const request = historyRequest(answer())
    const first = new QueryObserver(client, historyQuery(request, true, 3))
    const off = [first.subscribe(() => {})]
    await vi.waitFor(() => expect(history).toHaveBeenCalledTimes(1))
    off.push(new QueryObserver(client, historyQuery(request, true, 3)).subscribe(() => {}))
    await tick()
    expect(history).toHaveBeenCalledTimes(1)
    off.push(new QueryObserver(client, historyQuery(request, true, 4)).subscribe(() => {}))
    await vi.waitFor(() => expect(history).toHaveBeenCalledTimes(2))
    off.forEach((u) => u())
  })

  it('a unit with nothing to ask never asks, even expanded', async () => {
    const history = vi.spyOn(gs1CheckApi, 'history').mockResolvedValue([])
    const client = new QueryClient()
    const row = new QueryObserver(client, historyQuery(historyRequest(answer({ material: null })), true))
    const off = row.subscribe(() => {})
    await tick()
    expect(history).not.toHaveBeenCalled()
    off()
  })
})
