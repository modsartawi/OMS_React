/**
 * Review 3126 P3/P4 — the editor's audience, window, history narrowing and per-list refill days (stories 8, 11, 16).
 * Pure edits of `guard-edit` and the sentences they read as.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rules.json'
import { plainSentence, type Sentence } from '@/core/rules/sentence'
import type { GuardList, GuardRule, HistoryCondition, SupplyCondition } from './model'
import { addDaysFor, newGuardRule, removeDaysFor, setDaysFor, setWindow, toggleAudienceExclude, toggleChannel, toggleNarrow, setAudienceStores } from './guard-edit'
import { conditionSentence, guardSentence } from './sentence'

const instance = i18next.createInstance()
instance.init({ lng: 'en', resources: { en: { 'insurance-rules': en } }, ns: ['insurance-rules'], defaultNS: 'insurance-rules', initAsync: false, interpolation: { escapeValue: false } })
const t = instance.getFixedT('en', 'insurance-rules') as unknown as (key: string, o: Record<string, unknown>) => string
const text = (s: Sentence) => plainSentence(s, t)

const LISTS: GuardList[] = [{ id: 'ctrl', name: { en: 'Controlled drugs', ar: 'الأدوية المراقبة' }, filters: [], include: [], exclude: [] }]
const history: HistoryCondition = { check: 'history', match: 'sameItem', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false }
const supply: SupplyCondition = { check: 'supply', match: 'sameKind', eligibleDaysBeforeDue: 10 }

describe('history narrowing (story 8)', () => {
  it('toggleNarrow_addsAndRemovesAScope_estateWideByDefault', () => {
    const a = toggleNarrow(history, 'payer')
    expect(a.narrowTo).toEqual(['payer'])
    const b = toggleNarrow(a, 'store')
    expect(b.narrowTo).toEqual(['payer', 'store'])
    expect(toggleNarrow(toggleNarrow(b, 'payer'), 'store').narrowTo).toBeUndefined()
  })
  it('a narrowed history reads with a clause naming the scopes', () => {
    const rule = newGuardRule('G-X')
    const n = conditionSentence({ ...history, narrowTo: ['payer', 'store'] }, { rule, lists: LISTS })
    expect(n.clauses.map(text)).toEqual(['counting only dispenses with the same payer and store'])
    expect(conditionSentence(history, { rule, lists: LISTS }).clauses).toEqual([])
  })
})

describe('refill days per list (story 11, controlled drugs)', () => {
  it('addDaysFor / setDaysFor / removeDaysFor edit eligibleDaysBeforeDueFor', () => {
    const a = addDaysFor(supply, 'ctrl')
    expect(a.eligibleDaysBeforeDueFor).toEqual([{ list: 'ctrl', value: 7 }])
    const b = setDaysFor(a, 0, { value: 5 })
    expect(b.eligibleDaysBeforeDueFor).toEqual([{ list: 'ctrl', value: 5 }])
    expect(removeDaysFor(b, 0).eligibleDaysBeforeDueFor).toBeUndefined()
  })
  it('reads as "7 days for Controlled drugs"', () => {
    const n = conditionSentence(addDaysFor(supply, 'ctrl'), { rule: newGuardRule('G-X'), lists: LISTS })
    expect(n.clauses.map(text)).toEqual(['7 days for Controlled drugs'])
  })
})

describe('audience and window (story 16)', () => {
  const base = newGuardRule('G-X')
  it('channels toggle; stores are set; patient / policy lists are excluded', () => {
    let r: GuardRule = toggleChannel(base, 'bupa')
    expect(r.audience?.channels).toEqual(['nphies', 'waseel', 'oms'])
    r = toggleChannel(r, 'bupa')
    expect(r.audience?.channels).toEqual(['nphies', 'waseel', 'oms', 'bupa'])
    r = setAudienceStores(r, ['P001', 'P019'])
    expect(r.audience?.stores).toEqual(['P001', 'P019'])
    r = toggleAudienceExclude(r, 'patient', 'PL-VIP')
    r = toggleAudienceExclude(r, 'policy', 'PO-7')
    expect(r.audience).toEqual({ channels: ['nphies', 'waseel', 'oms', 'bupa'], stores: ['P001', 'P019'], excludePatientLists: ['PL-VIP'], excludePolicyLists: ['PO-7'] })
    expect(toggleAudienceExclude(r, 'patient', 'PL-VIP').audience?.excludePatientLists).toBeUndefined()
  })
  it('setWindow sets from / until; an empty box is open', () => {
    const r = setWindow(setWindow(base, { from: '2026-11-01' }), { until: '' })
    expect(r.window).toEqual({ from: '2026-11-01', until: null })
  })
  it('WHEN reads the excluded lists', () => {
    const r = toggleAudienceExclude(toggleAudienceExclude(base, 'patient', 'PL-VIP'), 'policy', 'PO-7')
    expect(guardSentence(r, LISTS).when.map(text)).toEqual([
      'Checked before a request is sent on NPHIES, Waseel, OMS, and Bupa, at every store',
      'except patients on PL-VIP',
      'except policies on PO-7',
      'With no time limit',
    ])
  })
})
