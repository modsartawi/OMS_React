/**
 * Ticket 553 — pause / resume a HungerStation store's stock sync, and push its stock now (contract
 * § Stock sync, `PUT …/Sync/{storeCode}/Active` and `POST …/Sync/{storeCode}/Now`). The pure half:
 * the doors' paths, the sync-now result line, how each refusal of sync now reads, and how the
 * answers patch the store row in place.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-stores.json'
import ar from '@/locales/ar/hungerstation-stores.json'
import type { HungerStationStoreRow, HungerStationSyncLogRow } from '@/core/models/hungerstation'
import { SYNC_NOW_REFUSALS, applyPush, replaceRow, syncActivePath, syncNowPath, syncNowRefusal, syncNowResult } from './sync'

const row = (storeCode: string, over: Partial<HungerStationStoreRow['sync']> = {}): HungerStationStoreRow => ({
  storeCode,
  storeName: 'Riyadh Olaya',
  chainKey: 'OlaCare',
  vendorId: 'abc12',
  onboardedAt: '2026-10-24T10:00:00',
  onboardedBy: 'HSADMIN',
  updatedAt: '2026-10-24T10:05:00',
  updatedBy: 'HSADMIN',
  sync: {
    active: true,
    lastFullRun: '2026-10-24T07:05:00',
    lastDeltaRun: '2026-10-24T10:30:00',
    lastRun: '2026-10-24T10:30:00',
    lastStatus: 'S',
    lastError: null,
    health: 'ok',
    ...over,
  },
})

const log = (over: Partial<HungerStationSyncLogRow> = {}): HungerStationSyncLogRow => ({
  logId: '01JHS',
  syncType: 'F',
  startTime: '2026-10-24T11:00:00',
  endTime: '2026-10-24T11:00:04',
  status: 'S',
  rows: 1812,
  error: null,
  ...over,
})

describe('the sync doors’ paths', () => {
  it('pause / resume is Sync/{store}/Active, sync now is Sync/{store}/Now', () => {
    expect(syncActivePath('0099')).toBe('HungerStationWeb/Sync/0099/Active')
    expect(syncNowPath('0099')).toBe('HungerStationWeb/Sync/0099/Now')
  })

  it('the store code is one encoded path segment', () => {
    expect(syncNowPath('a/b')).toBe('HungerStationWeb/Sync/a%2Fb/Now')
  })
})

describe('syncNowResult — the line a finished push reads', () => {
  it('a successful push: the rows sent, grouped, and Success', () => {
    expect(syncNowResult(log())).toEqual({ key: 'syncNow.result.S', rows: '1,812', status: 'S' })
  })

  it('a push recorded as an error reads Error', () => {
    expect(syncNowResult(log({ status: 'E', rows: 0 }))).toEqual({ key: 'syncNow.result.E', rows: '0', status: 'E' })
  })

  it.each([en, ar])('both result sentences name the rows through a slot', (locale) => {
    const r = (locale.syncNow as { result: Record<string, string> }).result
    for (const s of ['S', 'E']) expect(r[s]).toMatch(/<n>\{\{rows\}\}<\/n>/)
  })

  it('in English it says how many were sent and how it ended', () => {
    expect(en.syncNow.result.S).toBe('<n>{{rows}}</n> materials sent. Status: Success.')
    expect(en.syncNow.result.E).toBe('<n>{{rows}}</n> materials sent. Status: Error.')
  })
})

describe('syncNowRefusal — how each refusal of sync now reads', () => {
  it('DHS-00013 is the paused store', () => {
    expect(syncNowRefusal('DHS-00013')).toBe('paused')
  })

  it('DHS-00014 is HungerStation refusing or unreachable', () => {
    expect(syncNowRefusal('DHS-00014')).toBe('hungerStationFailed')
  })

  it('409 HungerStationSyncBusy is a push already running', () => {
    expect(syncNowRefusal('HungerStationSyncBusy')).toBe('busy')
  })

  it('DHS-00007 is a store removed meanwhile', () => {
    expect(syncNowRefusal('DHS-00007')).toBe('gone')
  })

  it('anything else is not one of its own (the dialog shows it with its code)', () => {
    expect(syncNowRefusal('DHS-00008')).toBeNull()
    expect(syncNowRefusal(null)).toBeNull()
  })

  it('busy says a push is already running, try again shortly — and that nothing was recorded', () => {
    expect(en.syncNow.refusal.busy).toMatch(/A push is already running; try again shortly\./)
    expect(en.syncNow.refusal.busyHint).toMatch(/Nothing was pushed or recorded/)
  })

  it('DHS-00014 says the push was recorded as failed and appears in the logs', () => {
    expect(en.syncNow.refusal.hungerStationFailed).toMatch(/HungerStation refused the push or could not be reached/)
    expect(en.syncNow.refusal.hungerStationFailedHint).toMatch(/recorded as failed/)
    expect(en.syncNow.refusal.hungerStationFailedHint).toMatch(/logs/)
  })

  it.each([en, ar])('every refusal has its sentence and its hint in both languages', (locale) => {
    const r = (locale.syncNow as { refusal: Record<string, string> }).refusal
    for (const kind of SYNC_NOW_REFUSALS) expect([kind, typeof r[kind], typeof r[`${kind}Hint`]]).toEqual([kind, 'string', 'string'])
  })
})

describe('the sync-now confirmation says what it does', () => {
  it('a FULL push to the LIVE HungerStation vendor', () => {
    expect(en.syncNow.note).toMatch(/full push/)
    expect(en.syncNow.note).toMatch(/live HungerStation vendor/)
  })

  it('the note names the store and its vendor id through slots', () => {
    for (const locale of [en, ar]) {
      expect(locale.syncNow.note).toMatch(/<store>\{\{store\}\}<\/store>/)
      expect(locale.syncNow.note).toMatch(/<vendor>\{\{vendorId\}\}<\/vendor>/)
    }
  })
})

describe('applyPush — the push’s log row refreshes the row’s sync block', () => {
  it('a full push is the last full run and the last run, with its status; the error clears', () => {
    const failing = row('0099', { lastStatus: 'E', lastError: 'HTTP 500', health: 'failing' })
    expect(applyPush(failing, log()).sync).toEqual({
      active: true,
      lastFullRun: '2026-10-24T11:00:00',
      lastDeltaRun: '2026-10-24T10:30:00',
      lastRun: '2026-10-24T11:00:00',
      lastStatus: 'S',
      lastError: null,
      health: 'ok',
    })
  })

  it('an error push reads failing, with its error', () => {
    expect(applyPush(row('1234'), log({ status: 'E', error: 'HTTP 502' })).sync).toMatchObject({
      lastStatus: 'E',
      lastError: 'HTTP 502',
      health: 'failing',
    })
  })

  it('leaves everything outside the sync block, and the input, untouched', () => {
    const before = row('1234')
    const after = applyPush(before, log())
    expect({ ...after, sync: before.sync }).toEqual(before)
    expect(before.sync.lastRun).toBe('2026-10-24T10:30:00')
  })
})

describe('replaceRow — pause / resume patch the row in place', () => {
  it('swaps the store’s row where it stands, the others untouched', () => {
    const rows = [row('1234'), row('0099'), row('2001')]
    const paused = row('0099', { active: false })
    const out = replaceRow(rows, paused)
    expect(out.map((r) => r.storeCode)).toEqual(['1234', '0099', '2001'])
    expect(out[1]).toBe(paused)
    expect(out[0]).toBe(rows[0])
  })

  it('a list without the store is left as it is', () => {
    const rows = [row('1234')]
    expect(replaceRow(rows, row('0099'))).toEqual(rows)
    expect(replaceRow(undefined, row('0099'))).toBeUndefined()
  })
})
