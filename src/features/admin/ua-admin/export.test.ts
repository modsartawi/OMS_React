// The export walk (ticket 151, spec 147 "Tier 1 — pure"). Driven with a fake
// page fetcher: no network, no DOM, no React.
//
// Two of the three properties here are invisible until they fail badly. A walk
// that stops early writes a file that looks exactly like a complete one in
// Excel, and this file's whole use is spotting who is *missing*; a walk that
// duplicates someone reports a person twice in a cutover count. So the
// assertions are made at the walk's edge — what comes back — rather than as
// "no file was written", which is the caller's business.
import { describe, expect, it, vi } from 'vitest'
import type { UaEmployeeGridRow, UaEmployeeSearchResult } from '@/core/models/ua-user'
import {
  ExportCancelledError,
  ExportRunawayError,
  collectAllRows,
  estimateWalkSeconds,
  needsConfirm,
} from './export'
import { PAGE_SIZE } from './page-size'

const person = (employeeId: string): UaEmployeeGridRow => ({
  employeeId,
  displayName: `Person ${employeeId}`,
  phone: '0500000000',
  phoneClass: 'usable',
  email: '',
  deliveryChannel: 'sms',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-01T09:00:00',
})

const pageOf = (rows: UaEmployeeGridRow[], totalMatches: number, isCapped: boolean): UaEmployeeSearchResult => ({
  rows,
  totalMatches,
  rowCap: PAGE_SIZE,
  isCapped,
})

/** A server holding `total` identities, sliced exactly as SIS.Api slices. */
function estate(total: number): (page: number) => Promise<UaEmployeeSearchResult> {
  const all = Array.from({ length: total }, (_, i) => person(String(100000 + i)))
  return async (page) => {
    const start = (page - 1) * PAGE_SIZE
    return pageOf(all.slice(start, start + PAGE_SIZE), total, total > start + PAGE_SIZE)
  }
}

describe('PAGE_SIZE', () => {
  it('is still 50 — the walk and the grid page in the same steps', () => {
    // Pinned here because the arithmetic that used to assert it graduated to
    // `@/core/ui/pager` and is deliberately size-agnostic now (ticket 232).
    // Ua Users must stay observably unchanged: 50 a page, as it has been since
    // ticket 143.
    expect(PAGE_SIZE).toBe(50)
  })
})

describe('theWalkStopsAndDedupes', () => {
  it('walks from page 1 in the pager’s own steps until isCapped goes false', async () => {
    const asked: number[] = []
    const fetchPage = estate(120)
    const rows = await collectAllRows((page) => {
      asked.push(page)
      return fetchPage(page)
    })

    // 120 rows = 3 pages; the walk stops on the page that says nothing follows,
    // it does not keep going until a page comes back short.
    expect(asked).toEqual([1, 2, 3])
    expect(rows).toHaveLength(120)
    expect(rows[0].employeeId).toBe('100000')
    expect(rows.at(-1)?.employeeId).toBe('100119')
  })

  it('stops on the first page when nothing follows it', async () => {
    const fetchPage = vi.fn(async () => pageOf([person('1')], 1, false))
    expect(await collectAllRows(fetchPage)).toHaveLength(1)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('fires the runaway guard against a server that never stops', async () => {
    // A contract change that leaves `isCapped` permanently true must not spin
    // forever — and must not quietly hand back 200 pages either.
    let calls = 0
    const walk = collectAllRows(async () => {
      calls += 1
      return pageOf([person(String(calls))], 99999, true)
    })
    // Its own type, because "the walk never ended" is different news from "the
    // server refused" and the screen says so differently.
    await expect(walk).rejects.toBeInstanceOf(ExportRunawayError)
    expect(calls).toBe(200)
  })

  it('lands an employeeId appearing on two pages exactly once', async () => {
    // What a concurrent SAP insert does to a 45-second walk: everyone slides one
    // place down, so the last row of page 1 reappears as the first of page 2.
    const rows = await collectAllRows(async (page) =>
      page === 1
        ? pageOf([person('A'), person('B')], 3, true)
        : pageOf([person('B'), person('C')], 3, false),
    )
    expect(rows.map((r) => r.employeeId)).toEqual(['A', 'B', 'C'])
  })

  it('reports progress after every page, against the envelope’s own total', async () => {
    const seen: { collected: number; totalMatches: number }[] = []
    await collectAllRows(estate(120), { onProgress: (p) => seen.push(p) })
    expect(seen).toEqual([
      { collected: 50, totalMatches: 120 },
      { collected: 100, totalMatches: 120 },
      { collected: 120, totalMatches: 120 },
    ])
  })
})

describe('cancelOrErrorYieldsNoRows', () => {
  it('refuses to return what it had when the walk is cancelled mid-flight', async () => {
    let cancelled = false
    const fetchPage = estate(6000)
    const walk = collectAllRows(
      async (page) => {
        // Cancel arrives while page 3 is in flight — the rows for pages 1 and 2
        // are already in hand, which is exactly the partial file this refuses.
        if (page === 3) cancelled = true
        return fetchPage(page)
      },
      { isCancelled: () => cancelled },
    )
    await expect(walk).rejects.toBeInstanceOf(ExportCancelledError)
  })

  it('refuses before asking for anything when cancelled up front', async () => {
    const fetchPage = vi.fn(async () => pageOf([person('1')], 1, false))
    await expect(collectAllRows(fetchPage, { isCancelled: () => true })).rejects.toBeInstanceOf(
      ExportCancelledError,
    )
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('propagates a failing page rather than returning the pages before it', async () => {
    const boom = new Error('server said no')
    await expect(
      collectAllRows(async (page) => {
        if (page === 2) throw boom
        return pageOf([person('A')], 500, true)
      }),
    ).rejects.toBe(boom)
  })
})

describe('theConfirmIsAWaitTimeDevice', () => {
  it('quotes about 45 seconds for the whole estate and rounds to fives', () => {
    expect(estimateWalkSeconds(6000)).toBe(45)
    expect(estimateWalkSeconds(6000) % 5).toBe(0)
  })

  it('never quotes less than five seconds, even for one page', () => {
    expect(estimateWalkSeconds(0)).toBe(5)
    expect(estimateWalkSeconds(1)).toBe(5)
  })

  // The narrowed cards land under the threshold on purpose, so in practice only
  // *All people* raises the dialog (ticket 144). The card sizes here are the
  // real ones the screen reports.
  it('asks on All people and stays silent on every narrowed card', () => {
    expect(needsConfirm(6000)).toBe(true) // All people
    expect(needsConfirm(400)).toBe(false) // Phone gap — just under, deliberately
    expect(needsConfirm(152)).toBe(false) // Awaiting activation
  })

  it('asks the moment the count passes the threshold, not at it', () => {
    expect(needsConfirm(500)).toBe(false)
    expect(needsConfirm(501)).toBe(true)
  })

  // An unsettled count is not a small export: the screen must not be able to
  // read "0 matches" as "no need to ask".
  it('does not ask for a count of zero — the screen keeps that button dead', () => {
    expect(needsConfirm(0)).toBe(false)
  })
})
