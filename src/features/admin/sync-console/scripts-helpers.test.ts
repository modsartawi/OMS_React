import { describe, expect, it } from 'vitest'
import type { ScriptStoreRow, SentScript } from '@/core/models/sync-console'
import {
  SCRIPT_MAX_CHARS,
  SCRIPT_STATES,
  orderScriptStores,
  refusedStoreCodes,
  retryPreviewSentence,
  scriptControls,
  scriptRefusalKey,
  scriptSqlLength,
  sendPreviewSentence,
  sendTargetBody,
  storeRetryOffered,
  withdrawPreviewSentence,
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

// ── Ticket 664: Send, Withdraw and Retry ──────────────────────────────────────

describe("a send's target", () => {
  it('all eligible stores sends no codes at all (the door freezes the eligible set)', () => {
    expect(sendTargetBody('all', ['P001', 'P002'])).toEqual({ target: 'all' })
  })

  it('chosen stores sends the codes picked, in order, a repeated one once', () => {
    expect(sendTargetBody('chosen', ['P003', 'P001', 'P003'])).toEqual({ target: 'chosen', codes: ['P003', 'P001'] })
  })

  it('chosen with nothing picked still sends the empty list, so the door answers NO_STORES', () => {
    expect(sendTargetBody('chosen', [])).toEqual({ target: 'chosen', codes: [] })
  })
})

describe("the send preview's sentence", () => {
  it('counts the exact stores the script would reach', () => {
    const s = sendPreviewSentence({ scriptId: null, stores: ['P001', 'P002', 'P003'], auditId: null })
    expect(s).toEqual({ key: 'scriptSend.preview.stores', count: 3, n: '3' })
    expect(label('scriptSend.preview.stores_other')).toBe('This store script would be sent to {{n}} stores:')
    expect(label('scriptSend.preview.stores_one')).toBe('This store script would be sent to {{n}} store:')
  })

  it('formats a large count with its separators', () => {
    expect(sendPreviewSentence({ scriptId: null, stores: Array.from({ length: 1200 }, (_, i) => `P${i}`), auditId: null }).n).toBe('1,200')
  })

  it('the dialog warns that the script may run more than once and must be safe to re-run', () => {
    expect(label('scriptSend.rerunWarning')).toBe(
      'A store may run this script more than once (a store that fails it tries again, and a hand retry runs it anew). It must be safe to re-run.',
    )
  })
})

describe("the withdraw and retry previews' sentences", () => {
  it('withdraw says how many stores have not run it', () => {
    expect(withdrawPreviewSentence({ storesWithdrawn: 12, auditId: null })).toEqual({ key: 'scriptWithdraw.preview', count: 12, n: '12' })
    expect(label('scriptWithdraw.preview_other')).toBe('{{n}} stores have not run this script and would be withdrawn.')
  })

  it('retry says how many exhausted stores get five fresh attempts', () => {
    expect(retryPreviewSentence({ storesRetried: 1, auditId: null })).toEqual({ key: 'scriptRetry.preview', count: 1, n: '1' })
    expect(label('scriptRetry.preview_one')).toBe('{{n}} exhausted store would get five fresh attempts.')
  })

  it('the withdraw dialog says executed stores stay executed and a withdrawn script is never sent again', () => {
    expect(label('scriptWithdraw.note')).toBe(
      'Stores that already ran this script stay executed. A withdrawn script cannot be sent again: to run it again, send a new one.',
    )
  })
})

describe('when Withdraw and Retry are offered', () => {
  const can = { canRunScripts: true }

  it('a live script with stores not yet run offers Withdraw; one with exhausted stores offers Retry all', () => {
    expect(scriptControls(script(), can)).toEqual({ withdraw: true, retryAll: true })
  })

  it('without canRunScripts nothing is offered, and an absent flag (a door older than 3205) is a no', () => {
    expect(scriptControls(script(), { canRunScripts: false })).toEqual({ withdraw: false, retryAll: false })
    expect(scriptControls(script(), {})).toEqual({ withdraw: false, retryAll: false })
    expect(scriptControls(script(), null)).toEqual({ withdraw: false, retryAll: false })
  })

  it('a legacy script offers neither', () => {
    expect(scriptControls(script({ isLegacy: true }), can)).toEqual({ withdraw: false, retryAll: false })
  })

  it('a withdrawn script offers neither', () => {
    expect(scriptControls(script({ withdrawnAt: '2026-10-29T11:00:00' }), can)).toEqual({ withdraw: false, retryAll: false })
  })

  it('no exhausted store: no Retry all', () => {
    expect(scriptControls(script({ exhausted: 0 }), can)).toEqual({ withdraw: true, retryAll: false })
  })

  it('every store executed: nothing left to withdraw', () => {
    expect(scriptControls(script({ executed: 412, pending: 0, retrying: 0, exhausted: 0, withdrawn: 0 }), can)).toEqual({
      withdraw: false,
      retryAll: false,
    })
  })

  it('a store row offers Retry only when it is exhausted, on a live script, to a sender', () => {
    const live = script()
    expect(storeRetryOffered(store('P003', 'exhausted'), live, can)).toBe(true)
    for (const state of ['executed', 'pending', 'retrying', 'withdrawn', 'quarantined']) {
      expect(storeRetryOffered(store('P003', state), live, can)).toBe(false)
    }
    expect(storeRetryOffered(store('P003', 'exhausted'), live, { canRunScripts: false })).toBe(false)
    expect(storeRetryOffered(store('P003', 'exhausted'), script({ isLegacy: true }), can)).toBe(false)
    expect(storeRetryOffered(store('P003', 'exhausted'), script({ withdrawnAt: '2026-10-29T11:00:00' }), can)).toBe(false)
  })
})

describe("the SQL's length", () => {
  it('is counted against the door cap of 8,000 characters', () => {
    expect(SCRIPT_MAX_CHARS).toBe(8000)
    expect(scriptSqlLength('x'.repeat(8000))).toEqual({ n: 8000, over: false, text: '8,000 / 8,000' })
    expect(scriptSqlLength('x'.repeat(8001))).toEqual({ n: 8001, over: true, text: '8,001 / 8,000' })
  })
})

describe("the script doors' refusals", () => {
  it('words every refusal the send, withdraw and retry doors give', () => {
    for (const code of ['TITLE_REQUIRED', 'SCRIPT_EMPTY', 'SCRIPT_HAS_GO', 'SCRIPT_TOO_LONG', 'UNKNOWN_STORE', 'NOT_ELIGIBLE', 'NO_STORES', 'UNKNOWN_SCRIPT', 'LEGACY_SCRIPT', 'WITHDRAWN', 'NOT_EXHAUSTED']) {
      const key = scriptRefusalKey(code)
      expect(key).toBe(`scriptCodes.${code}`)
      expect(typeof label(key as string)).toBe('string')
    }
    expect(label('scriptCodes.SCRIPT_HAS_GO')).toBe('The script has a GO line. Send one batch, with no GO.')
  })

  it('leaves a code it does not know unworded (the raw code shows)', () => {
    expect(scriptRefusalKey('MELTED')).toBeNull()
  })

  it("reads the codes a store refusal names off the refusal's data, and nothing else", () => {
    expect(refusedStoreCodes({ codes: ['P999', 'BackOffice'] })).toEqual(['P999', 'BackOffice'])
    expect(refusedStoreCodes({ codes: ['P999', 7, null] })).toEqual(['P999'])
    expect(refusedStoreCodes(null)).toEqual([])
    expect(refusedStoreCodes({ stores: ['P1'] })).toEqual([])
    expect(refusedStoreCodes('P999')).toEqual([])
  })
})
