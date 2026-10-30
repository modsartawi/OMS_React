import { EXPERIMENT_VERSION, experimentFile, readExperiment, type PlaygroundExperiment } from '@/core/insurance-rules/experiment'
import type { StorageLike } from '@/core/util/storage-like'

// The playground's named experiments in browser storage (BackOffice spec 3243 story 50; oms ticket 687). Each entry is
// the 687 file shape (`experimentFile`), so what is kept is what is exported. Pure: the storage is a parameter, so
// vitest's node environment carries the suite; `browserStorage` is the one edge that reaches `localStorage`.
//
// 🚩 Every access is wrapped: a private window, blocked site data or a full quota make the store **off** (said by the
// save controls) and never throw into the page. Anything unreadable is an empty store; an entry that does not decode
// is skipped. Names match trimmed and case-insensitive; saving under a taken name replaces that experiment.

export const EXPERIMENTS_KEY = 'oms.insurance-playground.experiments.v1'
const PROBE_KEY = 'oms.insurance-playground.probe'

/** The toolbar's status words (`experiments.said.*`): what happened, or why it did not. */
export const SAID_KEYS = ['saved', 'opened', 'renamed', 'deleted', 'exported', 'imported', 'off', 'noName', 'notReady', 'taken', 'missing'] as const
export type SaidKey = (typeof SAID_KEYS)[number]

export type StoreResult = { ok: true } | { ok: false; reason: 'off' | 'noName' | 'taken' | 'missing' }

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** The page's storage: `localStorage`, or null when even reaching it throws. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function experimentStore(storage: () => StorageLike | null = browserStorage) {
  const get = (): StorageLike | null => {
    try {
      return storage()
    } catch {
      return null
    }
  }

  const read = (): PlaygroundExperiment[] => {
    try {
      const text = get()?.getItem(EXPERIMENTS_KEY)
      if (!text) return []
      const v = JSON.parse(text) as { experiments?: unknown }
      if (!Array.isArray(v?.experiments)) return []
      return v.experiments.flatMap((e) => {
        const r = readExperiment(e)
        return r.ok ? [r.experiment] : []
      })
    } catch {
      return []
    }
  }

  const write = (all: PlaygroundExperiment[]): StoreResult => {
    try {
      const s = get()
      if (!s) return { ok: false, reason: 'off' }
      s.setItem(EXPERIMENTS_KEY, JSON.stringify({ version: EXPERIMENT_VERSION, experiments: all.map(experimentFile) }))
      return { ok: true }
    } catch {
      return { ok: false, reason: 'off' }
    }
  }

  return {
    /** Storage can be written: a probe write and remove both succeed. */
    isOn(): boolean {
      try {
        const s = get()
        if (!s) return false
        s.setItem(PROBE_KEY, '1')
        s.removeItem(PROBE_KEY)
        return true
      } catch {
        return false
      }
    },
    /** The saved names, in name order. */
    list(): string[] {
      return read()
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b))
    },
    open(name: string): PlaygroundExperiment | null {
      return read().find((e) => same(e.name, name)) ?? null
    },
    save(e: PlaygroundExperiment): StoreResult {
      const name = e.name.trim()
      if (!name) return { ok: false, reason: 'noName' }
      if (!this.isOn()) return { ok: false, reason: 'off' }
      return write([...read().filter((x) => !same(x.name, name)), { ...e, name }])
    },
    rename(from: string, to: string): StoreResult {
      const name = to.trim()
      if (!name) return { ok: false, reason: 'noName' }
      if (!this.isOn()) return { ok: false, reason: 'off' }
      const all = read()
      if (!all.some((x) => same(x.name, from))) return { ok: false, reason: 'missing' }
      if (!same(from, name) && all.some((x) => same(x.name, name))) return { ok: false, reason: 'taken' }
      return write(all.map((x) => (same(x.name, from) ? { ...x, name } : x)))
    },
    remove(name: string): StoreResult {
      if (!this.isOn()) return { ok: false, reason: 'off' }
      const all = read()
      if (!all.some((x) => same(x.name, name))) return { ok: false, reason: 'missing' }
      return write(all.filter((x) => !same(x.name, name)))
    },
  }
}

export type ExperimentStore = ReturnType<typeof experimentStore>
