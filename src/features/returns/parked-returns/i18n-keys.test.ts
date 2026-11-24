/**
 * BackOffice ticket 4224 (spec 4212 story 13) — the `parked-returns` namespace ships English and Arabic together and mirrors
 * exactly: an English plural (`_one` / `_other`) is all SIX Arabic forms. It is registered, and every key the screen BUILDS
 * (a state, a ledger status, a badge, a needs-HQ reason, a park reason, a view) has words in both.
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import en from '@/locales/en/parked-returns.json'
import ar from '@/locales/ar/parked-returns.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import { LEDGER_STATUSES, VIEWS } from './filter'
import { SETTLE_REFUSAL_CODES } from './settle'
import { grainBadges, ledgerLabel, needsHqReasonLabel, NEEDS_HQ_REASONS, PARK_REASONS, parkReasonLabel, rowBadges, stateLabel, STATES } from './labels'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const pluralBase = (key: string, forms: string[]) => forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null
function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const base = pluralBase(key, forms)
    if (base === null) plain.add(key)
    else plurals.set(base, (plurals.get(base) ?? new Set()).add(key.slice(base.length)))
  }
  return { plain, plurals }
}

describe('parked-returns — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys and plural families', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
  })

  it('English plurals have _one and _other; Arabic ones all six', () => {
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })

  it('no Arabic value is blank or copied from English', () => {
    for (const key of leaves(ar)) {
      const value = localeAt(ar, key) as string
      expect([key, value.trim() === '']).toEqual([key, false])
      expect([key, value === localeAt(en, key)]).toEqual([key, false])
    }
  })
})

describe('parked-returns — registered', () => {
  it('in both languages', () => {
    expect(i18n.options.ns).toContain('parked-returns')
    expect(i18n.getResourceBundle('en', 'parked-returns')).toEqual(en)
    expect(i18n.getResourceBundle('ar', 'parked-returns')).toEqual(ar)
  })
})

describe('parked-returns — the keys the screen builds exist', () => {
  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s: the gate, the menu, every view, state, ledger status, badge and reason', (_lang, locale) => {
    const keys = [
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
      'menu.group',
      'menu.parked',
      ...VIEWS.map((v) => `filters.views.${v}`),
      ...STATES.map((s) => stateLabel(s).key),
      stateLabel('?').key,
      ...LEDGER_STATUSES.map((s) => ledgerLabel(s).key),
      ledgerLabel('?').key,
      ...rowBadges({ state: 'NEEDS_HQ', storeDetailsReceived: false }).map((b) => b.key),
      ...grainBadges({ status: 'FAILED', awaitingHq: true, escalated: true, cashRuled: true }).map((b) => b.key),
      ...NEEDS_HQ_REASONS.map(needsHqReasonLabel),
      needsHqReasonLabel('?'),
      ...PARK_REASONS.map(parkReasonLabel),
      parkReasonLabel(''),
      // 4225: every settle refusal, the bare 403, each action and the dialogs.
      ...SETTLE_REFUSAL_CODES.map((c) => `refusal.${c}`),
      'refusal.noSettleRight',
      'refusal.title',
      'refusal.failed',
      ...['REFUNDED', 'VOID_AFTER_CHECK', 'PAY_IN_CASH'].map((o) => `settle.action.${o}`),
      ...['REFUNDED', 'VOID_AFTER_CHECK'].flatMap((o) => [`settle.confirm.${o}.title`, `settle.confirm.${o}.body`]),
      ...['REFUNDED', 'VOID_AFTER_CHECK', 'PAY_IN_CASH'].map((o) => `settle.done.${o}`),
      ...['title', 'hint', 'reason', 'evidence', 'reasonMissing', 'evidenceMissing', 'tooLong', 'commit', 'committing', 'cancel'].map((k) => `cash.${k}`),
      ...['action', 'title', 'hint', 'status', 'statusPick', 'statusRefunded', 'statusFailed', 'partner', 'tenderType', 'originalReference', 'amount', 'store', 'cashier', 'commit', 'committing', 'cancel', 'done'].map(
        (k) => `rowless.${k}`,
      ),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s: the plurals the screen counts with', (_lang, locale) => {
    for (const key of ['list.count', 'list.needsHqCount', 'age.days']) expect([key, hasLocaleKey(locale, `${key}_other`)]).toEqual([key, true])
  })

  it('the three labels the ticket names, in English', () => {
    expect(localeAt(en, 'badge.storeDetailsNotReceived')).toBe('Store details not received')
    expect(localeAt(en, 'state.waitingForStore')).toBe('Waiting for the store')
    expect(localeAt(en, 'badge.awaitingHq')).toBe('Awaiting HQ')
  })
})
