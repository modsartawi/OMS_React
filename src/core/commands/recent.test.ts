/**
 * The palette's Recent store (ticket 394, spec 380 K9): the last five numbers opened,
 * newest first, per user, and nothing but the kind and the number.
 *
 * 🚩 The negatives are the point. A store a human can edit, or an older build wrote,
 * must read as an empty list and never throw — and one user's list is never another's.
 */
import { describe, expect, it } from 'vitest'
import {
  parseRecent,
  pushRecent,
  readRecent,
  recentStorageKey,
  recordRecentIn,
  RECENT_LIMIT,
  type RecentRecord,
  type RecentStorage,
} from './recent'

/** A `Storage` stand-in: the two calls the store makes, over a Map. */
function memoryStorage(seed: Record<string, string> = {}): RecentStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

const delivery = (no: string): RecentRecord => ({ kind: 'delivery', no })
const docRecord = (no: string): RecentRecord => ({ kind: 'document', no })

describe('recentKeepsFiveNewestNumbersOnly', () => {
  it('pushing seven numbers keeps the newest five, newest first', () => {
    let list: RecentRecord[] = []
    for (const no of ['1', '2', '3', '4', '5', '6', '7']) list = pushRecent(list, delivery(`800000000${no}`))
    expect(RECENT_LIMIT).toBe(5)
    expect(list.map((r) => r.no)).toEqual(['8000000007', '8000000006', '8000000005', '8000000004', '8000000003'])
  })

  it('re-opening a number moves it to the front, with no duplicate', () => {
    const list = [delivery('3'), delivery('2'), delivery('1')]
    expect(pushRecent(list, delivery('1'))).toEqual([delivery('1'), delivery('3'), delivery('2')])
  })

  it('a delivery and a document with the same number are two records', () => {
    expect(pushRecent([delivery('42')], docRecord('42'))).toEqual([docRecord('42'), delivery('42')])
  })

  it('🚩 the stored value holds only the kind and the number', () => {
    const storage = memoryStorage()
    // A caller handing more than a record — a customer, a mobile — stores none of it.
    const leaky = { kind: 'delivery', no: '8000000174', customerName: 'عميل', mobile: '0500000000', otp: '1234' }
    recordRecentIn(storage, 'a.alharbi', leaky as RecentRecord)
    recordRecentIn(storage, 'a.alharbi', docRecord('1000000393'))
    const stored = storage.map.get(recentStorageKey('a.alharbi'))!
    expect(JSON.parse(stored)).toEqual([
      { kind: 'document', no: '1000000393' },
      { kind: 'delivery', no: '8000000174' },
    ])
    expect(stored).not.toMatch(/0500000000|عميل|1234|customer|mobile|otp/)
  })

  it('a malformed record is not pushed', () => {
    const list = [delivery('1')]
    expect(pushRecent(list, delivery(''))).toEqual(list)
    expect(pushRecent(list, delivery('../admin'))).toEqual(list)
    expect(pushRecent(list, { kind: 'order', no: '1' } as unknown as RecentRecord)).toEqual(list)
  })

  it('no user, nothing recorded', () => {
    const storage = memoryStorage()
    recordRecentIn(storage, null, delivery('1'))
    expect(storage.map.size).toBe(0)
  })
})

describe('recentParseIsDefensiveAndPerUser', () => {
  it.each([
    ['nothing', null],
    ['an empty string', ''],
    ['malformed JSON', '[{"kind":"delivery",'],
    ['an object', '{"kind":"delivery","no":"1"}'],
    ['a string', '"8000000174"'],
    ['a number', '8000000174'],
    ['null', 'null'],
    ['an older shape (bare numbers)', '["8000000174","8000000175"]'],
  ])('%s reads as an empty list and never throws', (_, raw) => {
    expect(parseRecent(raw)).toEqual([])
  })

  it('keeps the well-formed records and drops the rest, deduped and capped', () => {
    const raw = JSON.stringify([
      { kind: 'delivery', no: '1' },
      { kind: 'delivery', no: 1 },
      { kind: 'nope', no: '2' },
      null,
      'x',
      { kind: 'delivery', no: '1' },
      { kind: 'document', no: '2', customerName: 'x' },
      ...['3', '4', '5', '6'].map((no) => ({ kind: 'delivery', no })),
    ])
    expect(parseRecent(raw)).toEqual([delivery('1'), docRecord('2'), delivery('3'), delivery('4'), delivery('5')])
  })

  it('🚩 another user’s key reads as an empty list', () => {
    const storage = memoryStorage({
      [recentStorageKey('a.alharbi')]: JSON.stringify([delivery('8000000174')]),
    })
    expect(readRecent(storage, 'a.alharbi')).toEqual([delivery('8000000174')])
    expect(readRecent(storage, 'm.saleh')).toEqual([])
    expect(readRecent(storage, null)).toEqual([])
  })

  it('one user’s record never lands in another’s list', () => {
    const storage = memoryStorage()
    recordRecentIn(storage, 'a.alharbi', delivery('1'))
    recordRecentIn(storage, 'm.saleh', delivery('2'))
    expect(readRecent(storage, 'a.alharbi')).toEqual([delivery('1')])
    expect(readRecent(storage, 'm.saleh')).toEqual([delivery('2')])
  })

  it('a storage that throws reads as empty and records nothing, never throwing', () => {
    const throwing: RecentStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(readRecent(throwing, 'a.alharbi')).toEqual([])
    expect(() => recordRecentIn(throwing, 'a.alharbi', delivery('1'))).not.toThrow()
  })
})
