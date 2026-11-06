import { describe, expect, it } from 'vitest'
import type { SlotQueueEntry } from '@/core/models/release-queue'
import {
  convergenceShares,
  formatSeconds,
  fourHourFlag,
  historyParams,
  outcomeKind,
  queuePositionLabel,
  releaseQueueFromParams,
  releaseQueueToParams,
  storesInGrantOrder,
} from './helpers'

describe('the page address', () => {
  it('opens on the live slots with no filter when the address says nothing', () => {
    expect(releaseQueueFromParams(new URLSearchParams())).toEqual({
      tab: 'slots',
      history: { outcome: '', store: '', version: '', page: 1 },
    })
  })

  it('reads the tab and the history filters back; an unknown tab or outcome is dropped', () => {
    const q = releaseQueueFromParams(new URLSearchParams('tab=history&outcome=failed&store=R101&version=3.4.1&page=2'))
    expect(q).toEqual({ tab: 'history', history: { outcome: 'failed', store: 'R101', version: '3.4.1', page: 2 } })
    expect(releaseQueueFromParams(new URLSearchParams('tab=nope&outcome=active&page=-3'))).toEqual({
      tab: 'slots',
      history: { outcome: '', store: '', version: '', page: 1 },
    })
  })

  it('writes only what differs from the default', () => {
    expect(releaseQueueToParams({ tab: 'slots', history: { outcome: '', store: '', version: '', page: 1 } }).toString()).toBe('')
    expect(
      releaseQueueToParams({ tab: 'history', history: { outcome: 'expired', store: 'R1', version: '', page: 3 } }).toString(),
    ).toBe('tab=history&outcome=expired&store=R1&page=3')
  })
})

// The 3401 queue row's wait fields, as `GET PosReleaseQueue/Queue` answers them.
const row = (waitSeconds: number, waitedOverFourHours = false) => ({ waitSeconds, waitedOverFourHours })

describe('fourHourFlag', () => {
  it('flags a wait of exactly four hours, and one over it', () => {
    expect(fourHourFlag(row(14_400))).toBe(true)
    expect(fourHourFlag(row(20_000))).toBe(true)
  })

  it('does not flag a wait under four hours', () => {
    expect(fourHourFlag(row(14_399))).toBe(false)
    expect(fourHourFlag(row(0))).toBe(false)
  })

  it("flags a row HQ already flagged, whatever its seconds say (the server's clock decides)", () => {
    expect(fourHourFlag(row(10, true))).toBe(true)
  })
})

describe('queuePositionLabel', () => {
  it('renders the position over the queue length, as one value', () => {
    expect(queuePositionLabel(3, 12)).toBe('3 / 12')
    expect(queuePositionLabel(1, 1)).toBe('1 / 1')
  })

  it('groups the digits of a long queue', () => {
    expect(queuePositionLabel(1250, 2400)).toBe('1,250 / 2,400')
  })
})

describe('convergenceShares', () => {
  const version = (downloaded: number, downloading: number, waiting: number) => ({
    package: 'pos',
    toVersion: '3.4.1',
    downloaded,
    downloading,
    waiting,
  })

  it('counts every till the version has reached or is reaching', () => {
    expect(convergenceShares(version(30, 8, 2)).total).toBe(40)
  })

  it('gives each state its share of the version, and the shares add up to 100', () => {
    expect(convergenceShares(version(30, 8, 2))).toMatchObject({ downloaded: 75, downloading: 20, waiting: 5 })
  })

  it('rounds so the three shares still add up to 100 (largest remainder)', () => {
    const s = convergenceShares(version(1, 1, 1))
    expect(s.downloaded + s.downloading + s.waiting).toBe(100)
    expect([s.downloaded, s.downloading, s.waiting].sort()).toEqual([33, 33, 34])

    // 28.57 / 14.29 / 57.14
    expect(convergenceShares(version(2, 1, 4))).toMatchObject({ downloaded: 29, downloading: 14, waiting: 57 })
  })

  it('a version nobody has asked for is all zeros, not a division by zero', () => {
    expect(convergenceShares(version(0, 0, 0))).toEqual({ total: 0, downloaded: 0, downloading: 0, waiting: 0 })
  })

  it('a fully downloaded version is 100 / 0 / 0', () => {
    expect(convergenceShares(version(12, 0, 0))).toEqual({ total: 12, downloaded: 100, downloading: 0, waiting: 0 })
  })
})

describe('formatSeconds', () => {
  it('draws a wait or a duration as h:mm:ss', () => {
    expect(formatSeconds(0)).toBe('0:00:00')
    expect(formatSeconds(65)).toBe('0:01:05')
    expect(formatSeconds(14_712)).toBe('4:05:12')
  })

  it('keeps counting hours past a day', () => {
    expect(formatSeconds(30 * 3600)).toBe('30:00:00')
  })

  it('a negative or missing value is blank', () => {
    expect(formatSeconds(-1)).toBe('')
    expect(formatSeconds(Number.NaN)).toBe('')
  })
})

describe('outcomeKind', () => {
  it('names the four finished states, and anything else as unknown', () => {
    expect(outcomeKind('released-done')).toBe('done')
    expect(outcomeKind('released-failed')).toBe('failed')
    expect(outcomeKind('expired')).toBe('expired')
    expect(outcomeKind('freed-by-hand')).toBe('freed')
    expect(outcomeKind('active')).toBe('unknown')
  })
})

describe('historyParams', () => {
  it('sends the filters trimmed and the page as skip / take', () => {
    expect(historyParams({ outcome: 'failed', store: ' R101 ', version: '3.4.1', page: 3 }, 50)).toEqual({
      outcome: 'failed',
      store: 'R101',
      version: '3.4.1',
      skip: 100,
      take: 50,
    })
  })

  it('a blank filter is sent blank (core/api drops it)', () => {
    expect(historyParams({ outcome: '', store: '  ', version: '', page: 1 }, 50)).toEqual({
      outcome: '',
      store: '',
      version: '',
      skip: 0,
      take: 50,
    })
  })
})

describe('storesInGrantOrder', () => {
  const entry = (position: number, storeCode: string, machineCode: string): SlotQueueEntry => ({
    position,
    storeCode,
    machineCode,
    package: 'pos',
    toVersion: '3.4.1',
    urgent: false,
    firstAskedAt: '2026-11-06T08:00:00',
    lastAskedAt: '2026-11-06T09:00:00',
    waitSeconds: 3600,
    waitedOverFourHours: false,
  })

  it('lists each store once, where its first till stands, with its tills in position order', () => {
    const stores = storesInGrantOrder([entry(1, 'R200', 'T1'), entry(2, 'R101', 'T1'), entry(3, 'R200', 'T2'), entry(4, 'R101', 'T3')])
    expect(stores.map((s) => s.storeCode)).toEqual(['R200', 'R101'])
    expect(stores[0].tills.map((t) => t.machineCode)).toEqual(['T1', 'T2'])
    expect(stores[1].tills.map((t) => t.position)).toEqual([2, 4])
  })

  it('follows the positions, not the order the rows came in', () => {
    const stores = storesInGrantOrder([entry(2, 'R101', 'T1'), entry(1, 'R200', 'T1')])
    expect(stores.map((s) => s.storeCode)).toEqual(['R200', 'R101'])
  })
})
