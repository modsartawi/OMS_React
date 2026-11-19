import { describe, expect, it } from 'vitest'
import type { StoreDbBackups } from '@/core/models/store-database'
import backups from './__fixtures__/backups.json'
import { backupFileName, canDropCopy, restoreChoice, sideCopyName } from './restore-helpers'

/** Oms 919 (BackOffice 4038, spec 4016 D16): Browse, restore into a side copy, drop a side copy. */
describe('choosing a backup to restore', () => {
  const files = (backups as StoreDbBackups).files
  const byName = (n: string) => files.find((f) => backupFileName(f.file) === n)!

  it('a backup taken on the store’s own engine can be chosen', () => {
    expect(restoreChoice(byName('POS_full.bak'), '10.50.6000')).toEqual({ ok: true })
  })

  it('an older build of the same engine can be chosen (a service pack is not a newer engine)', () => {
    expect(restoreChoice(byName('POS_20261101.bak'), '10.50.6000')).toEqual({ ok: true })
  })

  it('a newer-engine backup cannot be chosen, and says why', () => {
    expect(restoreChoice(byName('POS_from_2019.bak'), '10.50.6000')).toEqual({ ok: false, why: 'newerEngine' })
  })

  it('judges newer by the version when the server sends no flag', () => {
    const r2 = { ...byName('POS_full.bak'), newerThanStore: undefined }
    expect(restoreChoice(r2, '10.0.5500')).toEqual({ ok: false, why: 'newerEngine' }) // 2008 R2 onto 2008
    expect(restoreChoice({ ...r2, engineVersion: '15.0.2000' }, '15.0.4000')).toEqual({ ok: true })
  })

  it('trusts the server’s flag over the client’s compare', () => {
    expect(restoreChoice({ ...byName('POS_full.bak'), newerThanStore: true }, '10.50.6000')).toEqual({ ok: false, why: 'newerEngine' })
  })

  it('a file the engine could not read cannot be chosen', () => {
    expect(restoreChoice(byName('half_copied.bak'), '10.50.6000')).toEqual({ ok: false, why: 'unreadable' })
  })

  it('a file of unknown engine, with no store version to judge by, cannot be chosen', () => {
    expect(restoreChoice({ ...byName('POS_full.bak'), newerThanStore: undefined, engineVersion: null }, '10.50.6000')).toEqual({
      ok: false,
      why: 'unknownEngine',
    })
    expect(restoreChoice({ ...byName('POS_full.bak'), newerThanStore: undefined }, null)).toEqual({ ok: false, why: 'unknownEngine' })
  })

  it('only a full backup can be chosen (backupType 1; the door refuses NOT_A_FULL_BACKUP)', () => {
    expect(restoreChoice({ ...byName('POS_full.bak'), backupType: 5 }, '10.50.6000')).toEqual({ ok: false, why: 'notFull' })
    expect(restoreChoice({ ...byName('POS_full.bak'), backupType: 2 }, '10.50.6000')).toEqual({ ok: false, why: 'notFull' })
  })

  it('names a file by the last part of its path (the door sends only the full path)', () => {
    expect(files.map((f) => backupFileName(f.file))).toEqual(['POS_full.bak', 'POS_20261101.bak', 'POS_from_2019.bak', 'half_copied.bak'])
    expect(backupFileName('/mnt/backups/x.bak')).toBe('x.bak')
    expect(backupFileName('plain.bak')).toBe('plain.bak')
  })
})

describe('the side copy a restore creates', () => {
  it('is POS_Restore_ and the day', () => {
    expect(sideCopyName('2026-11-19', [])).toBe('POS_Restore_20261119')
  })

  it('takes a suffix when the name is taken, _2 first', () => {
    expect(sideCopyName('2026-11-10', ['POS_Restore_20261110'])).toBe('POS_Restore_20261110_2')
    expect(sideCopyName('2026-11-10', ['POS_Restore_20261110', 'POS_Restore_20261110_2'])).toBe('POS_Restore_20261110_3')
  })

  it('reads a taken name as SQL does, case-insensitively', () => {
    expect(sideCopyName('2026-11-10', ['pos_restore_20261110'])).toBe('POS_Restore_20261110_2')
  })

  it('another day’s copy does not take the name', () => {
    expect(sideCopyName('2026-11-19', ['POS_Restore_20261110'])).toBe('POS_Restore_20261119')
  })
})

describe('dropping a side copy', () => {
  it('offers Drop only for a POS_Restore_ name', () => {
    expect(canDropCopy('POS_Restore_20261110')).toBe(true)
    expect(canDropCopy('POS_Restore_20261110_2')).toBe(true)
    expect(canDropCopy('POS')).toBe(false)
    expect(canDropCopy('POS_Restore')).toBe(false)
    expect(canDropCopy('master')).toBe(false)
  })
})
