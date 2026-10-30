/**
 * Ticket 687 — experiments kept by name in browser storage. Save, list, open, rename and delete over a fake storage;
 * a storage that throws (private window, blocked site data, a full quota) reports "off" and never throws into the page.
 */
import { describe, expect, it } from 'vitest'
import type { PlaygroundExperiment } from '@/core/insurance-rules/experiment'
import { EXPERIMENTS_KEY, experimentStore, type StorageLike } from './experiment-store'

const AS_OF = '2026-10-30T14:05:00'
const exp = (name: string, over: Partial<PlaygroundExperiment> = {}): PlaygroundExperiment => ({
  name,
  kind: 'guard',
  asOf: AS_OF,
  data: { lines: [{ line: 1 }] },
  document: { schema: 1, kind: 'guard', revision: 0, fields: [], lists: [], rules: [] },
  ...over,
})

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}
const freshStore = () => {
  const s = fakeStorage()
  return experimentStore(() => s)
}
const throwing: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('SecurityError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('experimentStore — by name', () => {
  it('save, then list and open by name; a reopened store reads what was saved', () => {
    const s = fakeStorage()
    const store = experimentStore(() => s)
    expect(store.isOn()).toBe(true)
    expect(store.list()).toEqual([])
    expect(store.save(exp('Long supply'))).toEqual({ ok: true })
    expect(store.save(exp('A raw one', { raw: 'qty', data: undefined }))).toEqual({ ok: true })
    const again = experimentStore(() => s)
    expect(again.list()).toEqual(['A raw one', 'Long supply'])
    expect(again.open('Long supply')).toEqual(exp('Long supply'))
    expect(again.open('A raw one')).toEqual({ name: 'A raw one', kind: 'guard', asOf: AS_OF, raw: 'qty', document: exp('x').document })
    expect(again.open('nope')).toBeNull()
  })

  it('saving under a name that exists replaces that experiment (names match trimmed, case-insensitive)', () => {
    const store = freshStore()
    store.save(exp('Mine'))
    expect(store.save(exp(' mine ', { kind: 'coverage' }))).toEqual({ ok: true })
    expect(store.list()).toEqual(['mine'])
    expect(store.open('MINE')?.kind).toBe('coverage')
  })

  it('a blank name is refused', () => {
    const store = freshStore()
    expect(store.save(exp('  '))).toEqual({ ok: false, reason: 'noName' })
  })

  it('rename keeps the experiment under its new name; a taken or missing name is refused', () => {
    const store = freshStore()
    store.save(exp('One'))
    store.save(exp('Two'))
    expect(store.rename('One', 'Three')).toEqual({ ok: true })
    expect(store.list()).toEqual(['Three', 'Two'])
    expect(store.open('Three')?.name).toBe('Three')
    expect(store.rename('Three', 'two')).toEqual({ ok: false, reason: 'taken' })
    expect(store.rename('Gone', 'Four')).toEqual({ ok: false, reason: 'missing' })
    expect(store.rename('Three', ' ')).toEqual({ ok: false, reason: 'noName' })
    expect(store.rename('Three', 'three')).toEqual({ ok: true })
    expect(store.list()).toEqual(['three', 'Two'])
  })

  it('delete removes it by name', () => {
    const store = freshStore()
    store.save(exp('One'))
    expect(store.remove('one')).toEqual({ ok: true })
    expect(store.list()).toEqual([])
    expect(store.remove('one')).toEqual({ ok: false, reason: 'missing' })
  })

  it('an entry that does not decode is skipped; a store that is not JSON reads empty', () => {
    const s = fakeStorage()
    s.setItem(EXPERIMENTS_KEY, JSON.stringify({ version: 1, experiments: [{ format: 'x' }, { ...JSON.parse(JSON.stringify(exp('Kept'))), format: 'oms.insurance-playground.experiment', version: 1 }] }))
    expect(experimentStore(() => s).list()).toEqual(['Kept'])
    s.setItem(EXPERIMENTS_KEY, '{nope')
    expect(experimentStore(() => s).list()).toEqual([])
  })
})

describe('experimentStore — storage off', () => {
  it('a throwing storage reports off and every call answers without throwing', () => {
    const store = experimentStore(() => throwing)
    expect(store.isOn()).toBe(false)
    expect(store.list()).toEqual([])
    expect(store.open('x')).toBeNull()
    expect(store.save(exp('x'))).toEqual({ ok: false, reason: 'off' })
    expect(store.rename('x', 'y')).toEqual({ ok: false, reason: 'off' })
    expect(store.remove('x')).toEqual({ ok: false, reason: 'off' })
  })

  it('no storage at all, or one whose getter throws, is off too', () => {
    expect(experimentStore(() => null).isOn()).toBe(false)
    const getterThrows = experimentStore(() => {
      throw new Error('SecurityError')
    })
    expect(getterThrows.isOn()).toBe(false)
    expect(getterThrows.save(exp('x'))).toEqual({ ok: false, reason: 'off' })
  })

  it('a storage that reads but refuses writes (a full quota) is off for saving', () => {
    const s = fakeStorage()
    const full: StorageLike = {
      ...s,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const store = experimentStore(() => full)
    expect(store.isOn()).toBe(false)
    expect(store.save(exp('x'))).toEqual({ ok: false, reason: 'off' })
  })
})
