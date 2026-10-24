import { describe, expect, it } from 'vitest'
import { PASS_KINDS, type PassKind, type RecentPassesSummary } from '@/core/models/sync-console'
import {
  DEFAULT_RECENT_PASSES_FILTER,
  okShare,
  passKindBadge,
  passMix,
  reachShare,
  recentPassesQuery,
  shareSeverity,
  toggleKind,
} from './recent-passes-helpers'

const kinds = (set: Partial<Record<PassKind, number>>) =>
  Object.fromEntries(PASS_KINDS.map((k) => [k, set[k] ?? 0])) as Record<PassKind, number>

const summary = (set: Partial<Record<PassKind, number>>, reached = 0, unreached = 0): RecentPassesSummary => {
  const all = kinds(set)
  return {
    passes: Object.values(all).reduce((a, b) => a + b, 0),
    stores: 0,
    kinds: all,
    reachedStores: reached,
    unreachedStores: unreached,
  }
}

describe('recentPassesQuery', () => {
  it('sends the window, the filters and the page', () => {
    expect(recentPassesQuery({ minutes: 15, loop: 'push', kind: 'connect', code: ' P702 ', page: 0 })).toEqual({
      minutes: 15,
      loop: 'push',
      kind: 'connect',
      code: 'P702',
      page: 1,
      pageSize: 50,
    })
  })

  it('opens on the last hour, every loop and kind', () => {
    expect(recentPassesQuery(DEFAULT_RECENT_PASSES_FILTER)).toEqual({
      minutes: 60,
      loop: null,
      kind: null,
      code: '',
      page: 1,
      pageSize: 50,
    })
  })
})

describe('toggleKind', () => {
  it('chooses a kind, clears it on a second click, and goes back to page 1', () => {
    const on = toggleKind({ ...DEFAULT_RECENT_PASSES_FILTER, page: 4 }, 'connect')
    expect(on).toMatchObject({ kind: 'connect', page: 1 })
    expect(toggleKind(on, 'connect').kind).toBeNull()
    expect(toggleKind(on, 'deadline').kind).toBe('deadline')
  })
})

describe('passKindBadge', () => {
  it('colours the network red and a slow store amber', () => {
    expect(passKindBadge('ok')).toEqual({ labelKey: 'passKinds.ok', sev: 'ok' })
    expect(passKindBadge('connect').sev).toBe('bad')
    expect(passKindBadge('deadline').sev).toBe('warn')
  })

  it('shows an unknown kind as its raw code, neutral', () => {
    expect(passKindBadge('sleepy')).toEqual({ labelKey: null, sev: 'mute' })
    expect(passKindBadge('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('passMix', () => {
  it('lists the kinds that happened, in the contract order, with their share', () => {
    expect(passMix(summary({ connect: 1, ok: 6, chunk: 3 }))).toEqual([
      { kind: 'ok', count: 6, percent: 60 },
      { kind: 'connect', count: 1, percent: 10 },
      { kind: 'chunk', count: 3, percent: 30 },
    ])
  })

  it('draws nothing for an empty window', () => {
    expect(passMix(summary({}))).toEqual([])
  })
})

describe('okShare and reachShare', () => {
  it('judges finished passes only', () => {
    expect(okShare(summary({ ok: 9, running: 10, timeout: 1 }))).toBe(90)
    expect(okShare(summary({ running: 3 }))).toBeNull()
  })

  it('judges the stores whose last connect fell in the window', () => {
    expect(reachShare(summary({}, 3, 1))).toBe(75)
    expect(reachShare(summary({}, 0, 0))).toBeNull()
  })

  it('reads 90 % up as green, 70 % up as amber, the rest red', () => {
    expect([shareSeverity(90), shareSeverity(89), shareSeverity(70), shareSeverity(69), shareSeverity(null)]).toEqual([
      'ok',
      'warn',
      'warn',
      'bad',
      'mute',
    ])
  })
})
