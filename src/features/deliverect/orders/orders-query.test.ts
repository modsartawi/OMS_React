/**
 * Ticket 478 — the orders monitor's search lives in the URL, and its date window (date-only, both
 * ends always sent, at most 31 days counted inclusively) is refused before any call.
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectOrdersQuery } from '@/core/models/deliverect'
import {
  ORDERS_MAX_WINDOW_DAYS,
  ORDERS_PAGE_SIZE,
  localToday,
  ordersFromParams,
  ordersToParams,
  platformChoices,
  toggled,
  windowDays,
  windowProblem,
} from './orders-query'

const TODAY = '2026-10-12'

const query = (over: Partial<DeliverectOrdersQuery> = {}): DeliverectOrdersQuery => ({
  from: '2026-10-01',
  to: '2026-10-12',
  platform: [],
  store: null,
  outcome: [],
  q: null,
  skip: 0,
  take: ORDERS_PAGE_SIZE,
  ...over,
})

describe('localToday', () => {
  it('is the LOCAL calendar date, from its parts — never toISOString', () => {
    // 00:30 local on the 13th: in any zone east of UTC, toISOString() would still say the 12th.
    expect(localToday(new Date(2026, 9, 13, 0, 30))).toBe('2026-10-13')
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('ordersFromParams ⇄ ordersToParams', () => {
  it('an empty URL is today..today, nothing else', () => {
    expect(ordersFromParams(new URLSearchParams(), TODAY)).toEqual(query({ from: TODAY, to: TODAY }))
  })

  it('from and to are ALWAYS written, even at their default', () => {
    expect(ordersToParams(query({ from: TODAY, to: TODAY })).toString()).toBe('from=2026-10-12&to=2026-10-12')
  })

  it('round-trips every filter: repeated platform and outcome keys, store, text, skip', () => {
    const full = query({
      platform: ['JAHEZ', 'KEETA'],
      store: '1234',
      outcome: ['refused', 'statusFailed'],
      q: 'J-1001',
      skip: 200,
    })
    const params = ordersToParams(full)
    expect(params.toString()).toBe(
      'from=2026-10-01&to=2026-10-12&platform=JAHEZ&platform=KEETA&store=1234&outcome=refused&outcome=statusFailed&q=J-1001&skip=200',
    )
    expect(ordersFromParams(params, TODAY)).toEqual(full)
  })

  it('a pasted URL reads back the same, with blanks, repeats and unknown outcomes dropped', () => {
    const read = ordersFromParams(
      new URLSearchParams('from=2026-10-01&to=2026-10-05&platform=JAHEZ&platform=JAHEZ&platform=&outcome=refused&outcome=lost&store=%20&q=%20x%20'),
      TODAY,
    )
    expect(read).toEqual(query({ to: '2026-10-05', platform: ['JAHEZ'], outcome: ['refused'], q: 'x' }))
  })

  it('a cleared date stays empty (refused as invalid) — only a MISSING key is today', () => {
    const read = ordersFromParams(new URLSearchParams('from=&to=2026-10-12'), TODAY)
    expect(read.from).toBe('')
    expect(windowProblem(read.from, read.to)).toBe('invalid')
    expect(ordersFromParams(new URLSearchParams('to=2026-10-12'), TODAY).from).toBe(TODAY)
  })

  it('a bad skip reads as the first page; take is the page constant, never in the URL', () => {
    for (const skip of ['-5', 'abc', '1.5', '0']) expect(ordersFromParams(new URLSearchParams(`skip=${skip}`), TODAY).skip).toBe(0)
    expect(ordersToParams(query()).has('take')).toBe(false)
    expect(ordersToParams(query()).has('skip')).toBe(false)
  })

  it('🚩 an over-long window in the URL is kept as written (refused on screen), never clipped', () => {
    const read = ordersFromParams(new URLSearchParams('from=2026-01-01&to=2026-10-12'), TODAY)
    expect([read.from, read.to]).toEqual(['2026-01-01', '2026-10-12'])
    expect(windowProblem(read.from, read.to)).toBe('tooLong')
  })
})

describe('the window — at most 31 days, counted inclusively', () => {
  it('the ceiling is 31', () => {
    expect(ORDERS_MAX_WINDOW_DAYS).toBe(31)
  })

  it('one day is from = to', () => {
    expect(windowDays(TODAY, TODAY)).toBe(1)
    expect(windowProblem(TODAY, TODAY)).toBeNull()
  })

  it('31 days pass; 32 are refused client-side', () => {
    expect(windowDays('2026-10-01', '2026-10-31')).toBe(31)
    expect(windowProblem('2026-10-01', '2026-10-31')).toBeNull()
    expect(windowDays('2026-10-01', '2026-11-01')).toBe(32)
    expect(windowProblem('2026-10-01', '2026-11-01')).toBe('tooLong')
  })

  it('across a month end and a leap day', () => {
    expect(windowProblem('2028-02-01', '2028-03-02')).toBeNull() // 31 days, Feb 29 included
    expect(windowProblem('2028-02-01', '2028-03-03')).toBe('tooLong')
  })

  it('to before from is reversed', () => {
    expect(windowProblem('2026-10-12', '2026-10-11')).toBe('reversed')
  })

  it.each([
    ['', TODAY],
    ['2026-13-01', TODAY],
    ['2026-02-30', '2026-03-01'],
    ['12/10/2026', TODAY],
  ])('a value that is not a real date (%j) is invalid', (from, to) => {
    expect(windowProblem(from, to)).toBe('invalid')
  })
})

describe('the repeatable filters', () => {
  it('toggled switches one key on or off, keeping the rest', () => {
    expect(toggled(['JAHEZ'], 'KEETA')).toEqual(['JAHEZ', 'KEETA'])
    expect(toggled(['JAHEZ', 'KEETA'], 'JAHEZ')).toEqual(['KEETA'])
  })

  it('platformChoices: the Platforms read when it answered, else the rows’ keys; the selected always kept', () => {
    expect(platformChoices([{ platformKey: 'KEETA' }, { platformKey: 'JAHEZ' }], ['HS'], [])).toEqual(['JAHEZ', 'KEETA'])
    expect(platformChoices(undefined, ['KEETA', 'JAHEZ', 'KEETA'], ['HSD'])).toEqual(['HSD', 'JAHEZ', 'KEETA'])
    expect(platformChoices(undefined, [], [])).toEqual([])
  })
})
