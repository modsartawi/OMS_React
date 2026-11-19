import { describe, expect, it } from 'vitest'
import type { StoreDbStore } from '@/core/models/store-database'
import store from './__fixtures__/store.json'
import notChecked from './__fixtures__/store-not-checked.json'
import { growth, historyRows, notCheckedBanner, readingLines } from './reading-helpers'

const read = store as StoreDbStore
const unread = notChecked as StoreDbStore

describe('notCheckedBanner', () => {
  it('a store not checked shows the banner with the last attempt\'s error and time', () => {
    expect(notCheckedBanner(unread)).toEqual({
      at: '2026-11-18T04:10:00',
      error:
        'A network-related or instance-specific error occurred while establishing a connection to SQL Server. (provider: TCP Provider, error: 0 - The wait operation timed out.)',
    })
  })

  it('a store read on its last attempt shows no banner', () => {
    expect(notCheckedBanner(read)).toBeNull()
  })

  it('a failed last attempt shows the banner even before the state catches up (flat lastTakenAt / lastSucceeded / lastError)', () => {
    expect(notCheckedBanner({ ...read, lastTakenAt: '2026-11-18T05:00:00', lastSucceeded: false, lastError: 'Login failed.' })).toEqual({
      at: '2026-11-18T05:00:00',
      error: 'Login failed.',
    })
  })

  it('a store never tried shows the banner with no error and no time', () => {
    expect(notCheckedBanner({ state: 'NotChecked', lastTakenAt: null, lastSucceeded: null, lastError: null })).toEqual({ at: null, error: null })
  })

  it('a succeeded attempt’s empty error is no error', () => {
    expect(notCheckedBanner({ state: 'NotChecked', lastTakenAt: '2026-11-18T05:00:00', lastSucceeded: true, lastError: '' })).toEqual({ at: '2026-11-18T05:00:00', error: null })
  })
})

describe('historyRows', () => {
  it('the fixture history draws one row per day kept, labelled by its day (the DateTime’s date), sizes in MB, the cap beside them', () => {
    const { files } = historyRows(read.history, read.reading?.capKb ?? 0)
    expect(read.history[0].day).toBe('2026-11-12T00:00:00')
    expect(files).toHaveLength(6)
    expect(files[0]).toEqual({
      x: '2026-11-12',
      label: '2026-11-12',
      values: { used: 2997, allocated: 3328, log: 512, cap: 4096 },
      slot: null,
    })
    expect(files[5].values).toEqual({ used: 3072, allocated: 3328, log: 512, cap: 4096 })
  })

  it('drive free draws on its own chart, in GB to one place', () => {
    const { drive } = historyRows(read.history, 4194304)
    expect(drive[0]).toEqual({ x: '2026-11-12', label: '2026-11-12', values: { driveFree: 18.3 }, slot: null })
    expect(drive.map((r) => r.values.driveFree)).toEqual([18.3, 18.2, 18.2, 18.1, 18, 18])
  })

  it('a day whose drive was not matched (-1) draws a gap, never a dip to 0', () => {
    const history = read.history.map((d, i) => (i === 2 ? { ...d, driveFreeKb: -1 } : d))
    expect(historyRows(history, 0).drive[2].values).toEqual({ driveFree: null })
  })

  it('a size the day did not carry stays null — never 0', () => {
    const history = read.history.map((d, i) => (i === 3 ? { ...d, usedKb: null, allocatedKb: null, logAllocatedKb: null } : d))
    expect(historyRows(history, 4194304).files[3].values).toEqual({ used: null, allocated: null, log: null, cap: 4096 })
  })

  it('a store with no cap draws no cap line', () => {
    const { files } = historyRows(read.history, 0)
    expect(Object.keys(files[0].values)).toEqual(['used', 'allocated', 'log'])
  })

  it('the days draw oldest first, whatever order the door sends', () => {
    const { files } = historyRows([...read.history].reverse(), 0)
    expect(files.map((r) => r.x)).toEqual(read.history.map((d) => d.day.slice(0, 10)))
  })

  it('no history is no rows', () => {
    expect(historyRows(undefined, 0)).toEqual({ files: [], drive: [] })
  })
})

describe('readingLines', () => {
  const lines = readingLines(read.reading, read.files)
  const line = (key: string) => lines.find((l) => l.key === key)

  it('names the reading in the order the panel reads it', () => {
    expect(lines.map((l) => l.key)).toEqual([
      'engine',
      'cap',
      'used',
      'allocated',
      'freeInFile',
      'log',
      'recoveryModel',
      'driveFree',
      'cpus',
      'memory',
      'uptime',
      'longestTransaction',
      'blockedSessions',
      'lastBackup',
    ])
  })

  it('spells the engine with its version, edition and bitness', () => {
    expect(line('engine')).toEqual({
      key: 'engine',
      kind: 'engine',
      engine: 'SQL Server 2008 R2',
      version: '10.50.6000.34 SP3',
      edition: 'Express Edition',
      bitness: 'x64',
    })
  })

  it('reads used against the cap, and the free space inside the file as allocated less used', () => {
    expect(line('cap')).toEqual({ key: 'cap', kind: 'size', size: { unit: 'gb', n: '4.0' } })
    expect(line('used')).toEqual({ key: 'used', kind: 'used', size: { unit: 'gb', n: '3.0' }, share: '75' })
    expect(line('freeInFile')).toEqual({ key: 'freeInFile', kind: 'size', size: { unit: 'mb', n: '256' } })
  })

  it('reads the log as its used part of its size', () => {
    expect(line('log')).toEqual({ key: 'log', kind: 'log', used: { unit: 'mb', n: '60' }, size: { unit: 'mb', n: '512' } })
  })

  it('reads the uptime from the SQL start to the reading, in whole days and hours', () => {
    expect(line('uptime')).toEqual({ key: 'uptime', kind: 'uptime', days: 15, hours: 21 })
  })

  it('reads the last backup as its time, and the drive with the data file’s letter (files[])', () => {
    expect(line('lastBackup')).toEqual({ key: 'lastBackup', kind: 'backup', at: '2026-11-17T02:15:00' })
    expect(line('driveFree')).toEqual({ key: 'driveFree', kind: 'drive', drive: 'D:', size: { unit: 'gb', n: '18.0' } })
    expect(readingLines(read.reading).find((l) => l.key === 'driveFree')).toEqual({ key: 'driveFree', kind: 'drive', drive: null, size: { unit: 'gb', n: '18.0' } })
  })

  it('a drive the server could not match (-1) reads as missing, never "-1 KB"', () => {
    const l = readingLines({ ...read.reading!, driveFreeKb: -1 }, read.files)
    expect(l.find((x) => x.key === 'driveFree')).toEqual({ key: 'driveFree', kind: 'drive', drive: 'D:', size: null })
  })

  it('reads the machine’s CPU count and physical memory (story 15)', () => {
    expect(line('cpus')).toEqual({ key: 'cpus', kind: 'count', n: 4 })
    expect(line('memory')).toEqual({ key: 'memory', kind: 'size', size: { unit: 'gb', n: '8.0' } })
  })

  it('reads the longest open transaction’s age and the sessions blocked at reading time (story 16)', () => {
    expect(line('longestTransaction')).toEqual({ key: 'longestTransaction', kind: 'age', hours: 0, minutes: 12, seconds: 34 })
    expect(line('blockedSessions')).toEqual({ key: 'blockedSessions', kind: 'count', n: 2 })
    const long = readingLines({ ...read.reading!, longestOpenTransactionSeconds: 3 * 3600 + 5 * 60 + 9 })
    expect(long.find((x) => x.key === 'longestTransaction')).toEqual({ key: 'longestTransaction', kind: 'age', hours: 3, minutes: 5, seconds: 9 })
  })

  it('no open transaction reads as none, and no blocked session as 0', () => {
    const l = readingLines({ ...read.reading!, longestOpenTransactionSeconds: 0, blockedSessions: 0 })
    expect(l.find((x) => x.key === 'longestTransaction')).toEqual({ key: 'longestTransaction', kind: 'noTransaction' })
    expect(l.find((x) => x.key === 'blockedSessions')).toEqual({ key: 'blockedSessions', kind: 'count', n: 0 })
  })

  it('a door that does not send the machine or session figures reads them as missing', () => {
    const { cpuCount: _c, physicalMemoryKb: _m, longestOpenTransactionSeconds: _l, blockedSessions: _b, ...older } = read.reading!
    const l = readingLines(older as typeof read.reading)
    for (const key of ['cpus', 'longestTransaction', 'blockedSessions']) expect(l.find((x) => x.key === key)).toEqual({ key, kind: 'missing' })
    expect(l.find((x) => x.key === 'memory')).toEqual({ key: 'memory', kind: 'size', size: null })
  })

  it('a store with no cap reads "no cap", and no share of it', () => {
    const l = readingLines({ ...read.reading!, capKb: 0 })
    expect(l.find((x) => x.key === 'cap')).toEqual({ key: 'cap', kind: 'noCap' })
    expect(l.find((x) => x.key === 'used')).toEqual({ key: 'used', kind: 'used', size: { unit: 'gb', n: '3.0' }, share: null })
  })

  it('a figure the reading did not carry reads as missing, never 0', () => {
    const l = readingLines({ ...read.reading!, allocatedKb: null, sqlStartedAt: null, lastFullBackupAt: null })
    expect(l.find((x) => x.key === 'freeInFile')).toEqual({ key: 'freeInFile', kind: 'size', size: null })
    expect(l.find((x) => x.key === 'uptime')).toEqual({ key: 'uptime', kind: 'missing' })
    expect(l.find((x) => x.key === 'lastBackup')).toEqual({ key: 'lastBackup', kind: 'missing' })
  })

  it('a store never read has no lines', () => {
    expect(readingLines(null)).toEqual([])
  })
})

describe('growth', () => {
  it('reads days to cap with the rate behind it and the reading it is measured from (growthFrom)', () => {
    expect(growth(read)).toEqual({ days: 41, perDay: { unit: 'mb', n: '12' }, since: '2026-11-04T03:10:00', shrinking: false })
  })

  it('no forecast keeps the rate, and says when the database is not growing', () => {
    expect(growth({ ...read, daysToCap: null, growthKbPerDay: -2048 })).toEqual({
      days: null,
      perDay: { unit: 'mb', n: '2' },
      since: '2026-11-04T03:10:00',
      shrinking: true,
    })
  })

  it('neither a forecast nor a rate is nothing to show', () => {
    expect(growth({ ...read, daysToCap: null, growthKbPerDay: null })).toBeNull()
  })
})
