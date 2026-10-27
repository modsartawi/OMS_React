/**
 * Ticket 619 — the `insurance-idf` namespace ships English and Arabic together, the Arabic mirroring the English
 * keys exactly (an English plural `_one` / `_other` being all six Arabic forms); every key the masters list builds
 * exists in both, with the area's IDF menu labels.
 *
 * 620–627: add your keys under your leaf's top-level object (`storeLists`, `masterForm`, `upload`, `versions`,
 * `exceptions`, `lookup`, `events`, `report`) and your "keys the code builds" as your own `it` below.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-idf.json'
import ar from '@/locales/ar/insurance-idf.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { IDF_MASTER_KINDS } from './masters'
import { IDF_EXCEPTION_HANDLINGS, IDF_EXCEPTION_KEY_KINDS } from './exceptions' // 624
import { IDF_TIERS } from './lookup' // 625

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const base = (key: string, forms: string[]) => forms.reduce((k, f) => (k.endsWith(f) ? k.slice(0, -f.length) : k), key)

describe('insurance-idf keys mirror EN and AR', () => {
  it('the same non-plural keys', () => {
    const plain = (keys: string[], forms: string[]) => keys.filter((k) => base(k, forms) === k).sort()
    expect(plain(leaves(ar), AR_PLURAL)).toEqual(plain(leaves(en), EN_PLURAL))
  })
  it('the same plural families, English two forms and Arabic six', () => {
    const families = (keys: string[], forms: string[]) => {
      const out = new Map<string, string[]>()
      for (const k of keys) if (base(k, forms) !== k) out.set(base(k, forms), [...(out.get(base(k, forms)) ?? []), k.slice(base(k, forms).length)])
      return out
    }
    const enF = families(leaves(en), EN_PLURAL)
    const arF = families(leaves(ar), AR_PLURAL)
    expect([...arF.keys()].sort()).toEqual([...enF.keys()].sort())
    for (const [k, f] of enF) expect([k, f.sort()]).toEqual([k, [...EN_PLURAL].sort()])
    for (const [k, f] of arF) expect([k, f.sort()]).toEqual([k, [...AR_PLURAL].sort()])
  })
  it('one top-level object per IDF leaf', () => {
    for (const leaf of ['masters', 'storeLists', 'masterForm', 'upload', 'versions', 'exceptions', 'lookup', 'events', 'report'])
      for (const locale of [en, ar]) expect([leaf, typeof (locale as Record<string, unknown>)[leaf]]).toEqual([leaf, 'object'])
  })
})

describe('insurance-idf — the keys the masters list builds exist', () => {
  it.each([en, ar])('kinds, columns, thresholds, no live version, no access', (locale) => {
    const keys = [
      ...IDF_MASTER_KINDS.map((k) => `masters.kind.${k}`),
      ...['name', 'kind', 'payer', 'storeList', 'thresholds', 'version', 'published', 'note'].map((c) => `masters.columns.${c}`),
      'masters.title',
      'masters.thresholds',
      'masters.noLive',
      'access.deniedTitle',
      'access.deniedHint',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the thresholds sentence isolates both values as tags', (locale) => {
    const s = String((locale.masters as Record<string, unknown>).thresholds)
    expect(s).toContain('<v>{{hard}}</v>')
    expect(s).toContain('<v>{{reminder}}</v>')
  })
  it.each([areaEn, areaAr])('the IDF menu labels in the area namespace', (locale) => {
    for (const key of ['menu.idfMasters', 'menu.idfStoreLists', 'menu.idfExceptions', 'menu.idfLookup', 'menu.idfEvents'])
      expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

// 625 · the keys the lookup builds
describe('insurance-idf — the keys the lookup builds exist (625)', () => {
  it.each([en, ar])('every tier word, field, column and sentence', (locale) => {
    const keys = [
      ...IDF_TIERS.map((k) => `lookup.tier.${k}`),
      ...(['item', 'store', 'payer', 'documentType'] as const).map((f) => `lookup.fields.${f}`),
      ...['item', 'description', 'priority', 'sourceTier'].map((c) => `lookup.columns.${c}`),
      ...['title', 'lede', 'submit', 'hint', 'loading', 'failed', 'decidedBy', 'generalMaster', 'version', 'priority', 'cash'].map((k) => `lookup.${k}`),
      ...['skippedTitle', 'skippedNone', 'groupTitle', 'lookedUp'].map((k) => `lookup.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('version and priority isolate their value as a tag', (locale) => {
    const l = locale.lookup as Record<string, unknown>
    expect(String(l.version)).toContain('<v>{{version}}</v>')
    expect(String(l.priority)).toContain('<v>{{priority}}</v>')
  })
})

// 622 · upload and publish
describe('insurance-idf — the keys the master page and its upload build exist', () => {
  it.each([en, ar])('header, upload, report columns, rules, publish', (locale) => {
    const keys = [
      ...['back', 'loading', 'failed', 'notFound', 'live', 'title', 'hint', 'file', 'submit', 'uploadFailed', 'clean', 'notOk'].map((k) => `upload.${k}`),
      ...['line', 'item', 'rule', 'message'].map((c) => `upload.columns.${c}`),
      ...['unknownItem', 'notInItemCustomer', 'unknownGroup', 'badPriority', 'duplicateItem'].map((r) => `upload.rule.${r}`),
      ...['note', 'notePlaceholder', 'publish', 'publishHint', 'published', 'publishedDetail', 'publishFailed'].map((k) => `upload.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the failed-rows sentence isolates its count as a tag', (locale) => {
    const up = locale.upload as Record<string, unknown>
    for (const [k, v] of Object.entries(up)) if (k.startsWith('rowsFailed_')) expect([k, String(v)]).toEqual([k, expect.stringContaining('<v>{{n}}</v>')])
  })
})

// 620 · store lists
describe('insurance-idf — the keys the store lists build exist (620)', () => {
  it.each([en, ar])('page, columns, pilot mark, refusal, create / rename / delete, the stores editor', (locale) => {
    const keys = [
      ...['title', 'lede', 'loading', 'failed', 'empty', 'refused', 'refusedFallback', 'refusalCode', 'pilot', 'open', 'close', 'cancel'].map((k) => `storeLists.${k}`),
      ...['name', 'id', 'stores'].map((c) => `storeLists.columns.${c}`),
      ...['label', 'placeholder', 'action', 'done'].map((k) => `storeLists.create.${k}`),
      ...['action', 'label', 'save', 'done'].map((k) => `storeLists.rename.${k}`),
      ...['action', 'title', 'confirm', 'done'].map((k) => `storeLists.delete.${k}`),
      ...['title', 'empty', 'addLabel', 'addPlaceholder', 'add', 'remove', 'save', 'done'].map((k) => `storeLists.stores.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const s = locale.storeLists as Record<string, Record<string, string> | string>
    expect(String(s.refusalCode)).toContain('<v>{{code}}</v>')
    expect(String((s.stores as Record<string, string>).title)).toContain('<n>{{name}}</n>')
  })
})

// 624 · the keys the IDF exceptions screen builds
describe('insurance-idf — the keys the IDF exceptions screen builds exist', () => {
  it.each([en, ar])('key kinds, handlings, columns, problems', (locale) => {
    const keys = [
      ...IDF_EXCEPTION_KEY_KINDS.map((k) => `exceptions.keyKind.${k}`),
      ...IDF_EXCEPTION_HANDLINGS.map((h) => `exceptions.handling.${h}`),
      ...['keyKind', 'key', 'handling', 'reason', 'changed', 'actions'].map((c) => `exceptions.columns.${c}`),
      ...['keyRequired', 'masterRequired', 'reasonRequired'].map((p) => `exceptions.problem.${p}`),
      ...['title', 'add', 'addTitle', 'editTitle', 'deleteTitle', 'master', 'pickMaster', 'reason', 'saved', 'added', 'deleted'].map((k) => `exceptions.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

// 621 · the create / edit master form
describe('insurance-idf — the keys the master form builds exist (621)', () => {
  it.each([en, ar])('fields, resolution order, problems, refusal', (locale) => {
    const keys = [
      ...['newAction', 'edit', 'editLabel', 'columnActions', 'createTitle', 'editTitle', 'kind', 'kindFixed', 'payer', 'payerPlaceholder'].map((k) => `masterForm.${k}`),
      ...['storeList', 'storeListOptional', 'pickStoreList', 'storeListsFailed', 'nameEn', 'nameAr', 'hard', 'reminder', 'thresholdsHint'].map((k) => `masterForm.${k}`),
      ...['orderTitle', 'orderHint', 'thisOne', 'save', 'cancel', 'created', 'saved', 'refused', 'refusedFallback', 'refusalCode', 'clashesWith', 'denied'].map((k) => `masterForm.${k}`),
      ...['insurerStoreList', 'insurer', 'store', 'general'].map((k) => `masterForm.order.${k}`),
      ...['payerRequired', 'storeListRequired', 'nameRequired', 'wholeNumber', 'reminderAboveHard'].map((k) => `masterForm.problem.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const f = locale.masterForm as Record<string, unknown>
    expect(String(f.refusalCode)).toContain('<v>{{code}}</v>')
    expect(String(f.clashesWith)).toContain('<n>{{name}}</n>')
    expect(String(f.clashesWith)).toContain('<v>{{id}}</v>')
  })
})

// 623 · versions and restore
describe('insurance-idf — the keys the versions section builds exist (623)', () => {
  it.each([en, ar])('title, columns, live mark, restore panel', (locale) => {
    const keys = [
      ...['title', 'lede', 'loading', 'failed', 'empty', 'live', 'restore', 'restoreTitle', 'restoreHint'].map((k) => `versions.${k}`),
      ...['note', 'notePlaceholder', 'confirm', 'cancel', 'restored', 'restoredDetail', 'restoreFailed'].map((k) => `versions.${k}`),
      ...['number', 'byAt', 'note', 'actions'].map((c) => `versions.columns.${c}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the restore title and hint isolate the version number as a tag', (locale) => {
    const v = locale.versions as Record<string, unknown>
    expect(String(v.restoreTitle)).toContain('<v>{{n}}</v>')
    expect(String(v.restoreHint)).toContain('<v>{{n}}</v>')
  })
})
