import { describe, expect, it } from 'vitest'
import type { ScriptStoreRow, SentScript } from '@/core/models/sync-console'
import {
  SCRIPT_STATES,
  orderScriptStores,
  scriptCounts,
  scriptIsLegacy,
  scriptStateBadge,
  scriptTargetKey,
  storeScriptBadge,
} from './scripts-helpers'
import en from '@/locales/en/sync-console.json'

/** A `sync-console` key's English words, or `undefined` when the bundle lacks it. */
const label = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)

const script = (over: Partial<SentScript> = {}): SentScript => ({
  scriptId: '01JBX7Q2Z9M4K8R3T6V1W5Y0AB',
  title: 'Drop the stale IDF view',
  sentBy: 'msartawi',
  sentAt: '2026-10-29T10:00:00',
  targetMode: 'all',
  storeCount: 412,
  executed: 400,
  pending: 6,
  retrying: 3,
  exhausted: 2,
  withdrawn: 1,
  withdrawnAt: null,
  isLegacy: false,
  ...over,
})

const store = (code: string, state: string): ScriptStoreRow => ({
  code,
  description: `Store ${code}`,
  state,
  attempts: 0,
  lastAttempt: null,
  errorMessage: null,
})

describe('the state counts', () => {
  it('reads the five derived states in the ticket order, each with its own words', () => {
    const counts = scriptCounts(script())
    expect(counts.map((c) => [c.state, c.n])).toEqual([
      ['executed', 400],
      ['pending', 6],
      ['retrying', 3],
      ['exhausted', 2],
      ['withdrawn', 1],
    ])
    expect(counts.map((c) => label(c.labelKey))).toEqual(['Executed', 'Pending', 'Retrying', 'Exhausted', 'Withdrawn'])
  })

  it('calls a store that used up its attempts exhausted, never failed or dead (CONTEXT.md)', () => {
    expect(label(scriptStateBadge('exhausted').labelKey ?? '')).toBe('Exhausted')
    expect(scriptStateBadge('exhausted').sev).toBe('bad')
    expect(scriptStateBadge('retrying').sev).toBe('warn')
    expect(scriptStateBadge('executed').sev).toBe('ok')
  })

  it('shows a state this bundle does not know as its raw code, neutral', () => {
    expect(scriptStateBadge('quarantined')).toEqual({ labelKey: null, sev: 'mute' })
    expect(scriptStateBadge('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })

  it('has words for every state', () => {
    for (const s of SCRIPT_STATES) expect(label(`scriptStates.${s}`)).toEqual(expect.any(String))
  })
})

describe('the legacy title', () => {
  it('a script the door marks legacy is untitled (legacy), whatever title it carries', () => {
    expect(scriptIsLegacy(script({ isLegacy: true, title: 'untitled (legacy)', sentBy: null, sentAt: null }))).toBe(true)
    expect(label('scriptsPage.legacyTitle')).toBe('untitled (legacy)')
  })

  it('a store-tab row with no title is legacy (it has no isLegacy flag)', () => {
    expect(scriptIsLegacy({ title: null })).toBe(true)
    expect(scriptIsLegacy({ title: '  ' })).toBe(true)
    expect(scriptIsLegacy({ title: 'Drop the stale IDF view' })).toBe(false)
  })

  it('a sent script with a title is not legacy', () => {
    expect(scriptIsLegacy(script())).toBe(false)
  })
})

describe('the target', () => {
  it('words all and chosen, in any case the door sends', () => {
    expect(scriptTargetKey('all')).toBe('scriptsPage.targets.all')
    expect(scriptTargetKey('Chosen')).toBe('scriptsPage.targets.chosen')
    expect(label('scriptsPage.targets.all')).toBe('All worker stores')
    expect(label('scriptsPage.targets.chosen')).toBe('Chosen stores')
  })

  it('has no words for a legacy script or an unknown mode', () => {
    expect(scriptTargetKey(null)).toBeNull()
    expect(scriptTargetKey('Some')).toBeNull()
  })
})

describe("the detail's per-store order", () => {
  it('puts the exhausted stores first, then retrying, pending, withdrawn and executed', () => {
    const rows = [
      store('P001', 'executed'),
      store('P002', 'pending'),
      store('P003', 'exhausted'),
      store('P004', 'withdrawn'),
      store('P005', 'retrying'),
      store('P006', 'exhausted'),
    ]
    expect(orderScriptStores(rows).map((r) => r.code)).toEqual(['P003', 'P006', 'P005', 'P002', 'P004', 'P001'])
  })

  it('keeps the door order within a state, and puts a state it does not know last', () => {
    const rows = [store('P009', 'quarantined'), store('P002', 'pending'), store('P001', 'pending')]
    expect(orderScriptStores(rows).map((r) => r.code)).toEqual(['P002', 'P001', 'P009'])
  })

  it('does not reorder the array it was given', () => {
    const rows = [store('P001', 'executed'), store('P002', 'exhausted')]
    orderScriptStores(rows)
    expect(rows.map((r) => r.code)).toEqual(['P001', 'P002'])
  })
})

describe("the store page's Scripts tab state", () => {
  const row = { isExecuted: false, errorMessage: 'Invalid column' }
  it("reads the door's derived state when it sends one", () => {
    expect(storeScriptBadge({ ...row, state: 'exhausted' })).toEqual({ labelKey: 'scriptStates.exhausted', sev: 'bad' })
    expect(storeScriptBadge({ ...row, state: 'withdrawn' })).toEqual({ labelKey: 'scriptStates.withdrawn', sev: 'mute' })
  })

  it('falls back to executed / failed / not run on a door older than 3207 (no state)', () => {
    expect(storeScriptBadge({ ...row, state: null })).toEqual({ labelKey: 'scripts.failed', sev: 'bad' })
    expect(storeScriptBadge({ isExecuted: true, errorMessage: null, state: null })).toEqual({ labelKey: 'scripts.executed', sev: 'ok' })
  })
})
