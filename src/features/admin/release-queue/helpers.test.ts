import { describe, expect, it } from 'vitest'
import type { SlotAuditRow, SlotQueueEntry } from '@/core/models/release-queue'
import {
  convergenceShares,
  formatSeconds,
  fourHourFlag,
  historyParams,
  outcomeKind,
  queuePositionLabel,
  releaseQueueFromParams,
  releaseQueueToParams,
  lastPoolChange,
  poolChangeKind,
  poolReading,
  poolSizeDraft,
  showsControls,
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

describe('controlsHiddenWithoutManage (ticket 792)', () => {
  it('shows the controls only to a PosRelease.Queue.Manage holder', () => {
    expect(showsControls({ canView: true, canManage: true })).toBe(true)
  })

  it('hides them from a View-only holder, and on a missing or malformed probe answer', () => {
    expect(showsControls({ canView: true, canManage: false })).toBe(false)
    expect(showsControls(undefined)).toBe(false)
    expect(showsControls(null)).toBe(false)
    expect(showsControls({ canView: true, canManage: 'true' } as never)).toBe(false)
  })
})

describe('poolZeroReadsAsPaused (ticket 792)', () => {
  it('a pool of 0 reads as Paused, not as a size', () => {
    expect(poolReading(0)).toEqual({ paused: true })
  })

  it('any other size reads as that size', () => {
    expect(poolReading(1)).toEqual({ paused: false, size: 1 })
    expect(poolReading(40)).toEqual({ paused: false, size: 40 })
  })
})

describe('poolSizeDraft (ticket 792)', () => {
  it('reads a whole number from 0 (pause) to 500, white space trimmed', () => {
    expect(poolSizeDraft('0')).toBe(0)
    expect(poolSizeDraft(' 25 ')).toBe(25)
    expect(poolSizeDraft('500')).toBe(500)
  })

  it('anything else is not a size the door takes', () => {
    for (const bad of ['', ' ', '501', '-1', '2.5', '1e2', 'ten', '0x10']) expect([bad, poolSizeDraft(bad)]).toEqual([bad, null])
  })
})

describe('poolChangeKind (ticket 792)', () => {
  it('names what a new size does to the pool, so the confirm can say it', () => {
    expect(poolChangeKind(40, 0)).toBe('pause')
    expect(poolChangeKind(0, 10)).toBe('resume')
    expect(poolChangeKind(40, 60)).toBe('resize')
    expect(poolChangeKind(40, 40)).toBe('same')
    expect(poolChangeKind(0, 0)).toBe('same')
  })
})

describe('lastPoolChange (ticket 792)', () => {
  const row = (auditId: string, action: string, changedAt: string, extra: Partial<SlotAuditRow> = {}): SlotAuditRow => ({
    auditId,
    action,
    changedBy: 'm.sartawi',
    changedAt,
    oldPoolSize: 0,
    newPoolSize: 0,
    leaseId: '',
    storeCode: '',
    machineCode: '',
    ...extra,
  })

  it('is the newest resize in the audit (HQ answers newest first), skipping the frees above it', () => {
    const rows = [
      row('3', 'free-lease', '2026-11-06T10:00:00', { leaseId: 'L1', storeCode: 'R101', machineCode: 'R101-T1' }),
      row('2', 'pool-size', '2026-11-06T09:30:00', { changedBy: 'a.owner', oldPoolSize: 40, newPoolSize: 0 }),
      row('1', 'pool-size', '2026-11-05T08:00:00', { oldPoolSize: 20, newPoolSize: 40 }),
    ]
    expect(lastPoolChange(rows)).toEqual({ by: 'a.owner', at: '2026-11-06T09:30:00', from: 40, to: 0 })
  })

  it('is null when the audit holds no resize', () => {
    expect(lastPoolChange([])).toBeNull()
    expect(lastPoolChange([row('1', 'free-lease', '2026-11-06T10:00:00')])).toBeNull()
  })

  it('is null on a missing or malformed rows list, so a side read never breaks the pool strip', () => {
    expect(lastPoolChange(undefined)).toBeNull()
    expect(lastPoolChange({} as never)).toBeNull()
  })
})
