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
import { IDF_LISTED_KINDS } from './masters' // 647: every listed kind, general included
import { IDF_GENERAL_TABS } from './general' // 647
import { IDF_CHANGE_ACTIONS, IDF_CHANGE_ENTITIES } from './changes' // 650
import { IDF_EXCEPTION_HANDLINGS, IDF_EXCEPTION_KEY_KINDS } from './exceptions' // 624
import { IDF_SKIP_REASONS, IDF_TIERS } from './lookup' // 625
import { IDF_UPLOAD_RULES } from './upload' // 622
import { SWAP_REPORT_COUNTS } from './report' // 627
import { IDF_EVENT_OUTCOMES } from './events' // 627
import { IDF_DRAFT_MARKS } from './draft' // 645
import { IDF_GROUPS_IMPORT_RULES } from './groups-import' // 653

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
      ...IDF_LISTED_KINDS.map((k) => `masters.kind.${k}`),
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
      ...IDF_SKIP_REASONS.map((r) => `lookup.skipReason.${r}`),
      ...(['item', 'store', 'payer', 'documentType', 'subDocumentType', 'nphiesClaimType'] as const).map((f) => `lookup.fields.${f}`),
      ...['payerPlaceholder', 'itemTitle', 'idfGroup', 'insurer', 'exceptionTitle', 'skippedMaster'].map((k) => `lookup.${k}`),
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
      ...['back', 'loading', 'failed', 'notFound', 'live', 'title', 'hint', 'file', 'submit', 'uploadFailed', 'clean', 'notOk', 'lineCount'].map((k) => `upload.${k}`),
      ...['line', 'item', 'rule', 'message'].map((c) => `upload.columns.${c}`),
      ...IDF_UPLOAD_RULES.map((r) => `upload.rule.${r}`),
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
      ...['name', 'code', 'stores'].map((c) => `storeLists.columns.${c}`),
      ...['label', 'code', 'codePlaceholder', 'nameEn', 'nameAr', 'action', 'done'].map((k) => `storeLists.create.${k}`),
      ...['action', 'nameEn', 'nameAr', 'save', 'done'].map((k) => `storeLists.rename.${k}`),
      ...['codeRequired', 'codeAscii', 'codeTooLong', 'nameRequired'].map((k) => `storeLists.problem.${k}`),
      ...['badStores', 'clashesWith', 'sharedStores'].map((k) => `storeLists.${k}`),
      ...['title', 'empty', 'addLabel', 'addPlaceholder', 'add', 'remove', 'save', 'done'].map((k) => `storeLists.stores.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const s = locale.storeLists as Record<string, Record<string, string> | string>
    expect(String(s.refusalCode)).toContain('<v>{{code}}</v>')
    expect(String((s.stores as Record<string, string>).title)).toContain('<n>{{name}}</n>')
    expect(String(s.badStores)).toContain('<v>{{codes}}</v>')
    expect(String(s.sharedStores)).toContain('<v>{{stores}}</v>')
    // 3162 builds no delete door, so the screen offers none
    expect(s.delete).toBeUndefined()
  })
})

// 624 · the keys the IDF exceptions screen builds
describe('insurance-idf — the keys the IDF exceptions screen builds exist', () => {
  it.each([en, ar])('key kinds, handlings, columns, problems', (locale) => {
    const keys = [
      ...IDF_EXCEPTION_KEY_KINDS.map((k) => `exceptions.keyKind.${k}`),
      ...IDF_EXCEPTION_HANDLINGS.map((h) => `exceptions.handling.${h}`),
      ...['keyKind', 'key', 'handling', 'stores', 'reason', 'changed', 'actions'].map((c) => `exceptions.columns.${c}`),
      ...['keyRequired', 'keyWholeNumber', 'masterRequired', 'reasonRequired', 'reasonTooLong'].map((p) => `exceptions.problem.${p}`),
      ...IDF_EXCEPTION_KEY_KINDS.map((k) => `exceptions.keyPlaceholder.${k}`),
      ...['allStores', 'allStoresHint', 'stores.all', 'stores.pilot'].map((k) => `exceptions.${k}`),
      ...['title', 'add', 'addTitle', 'editTitle', 'deleteTitle', 'master', 'pickMaster', 'reason', 'saved', 'added', 'deleted'].map((k) => `exceptions.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

// 621 · the create / edit master form
describe('insurance-idf — the keys the master form builds exist (621)', () => {
  it.each([en, ar])('fields, resolution order, problems, refusal', (locale) => {
    const keys = [
      ...['newAction', 'edit', 'editLabel', 'columnActions', 'createTitle', 'editTitle', 'kind', 'kindFixed', 'payer', 'payerPlaceholder', 'payerHint', 'sharedStores'].map((k) => `masterForm.${k}`),
      ...['storeList', 'storeListOptional', 'pickStoreList', 'storeListsFailed', 'nameEn', 'nameAr', 'hard', 'reminder', 'thresholdsHint'].map((k) => `masterForm.${k}`),
      ...['orderTitle', 'orderHint', 'thisOne', 'save', 'cancel', 'created', 'saved', 'refused', 'refusedFallback', 'refusalCode', 'clashesWith', 'denied'].map((k) => `masterForm.${k}`),
      // the resolution order's words are the lookup's tier words (`lookup.tier.*`, checked under 625)
      ...['insurerRequired', 'storeListRequired', 'nameRequired', 'wholeNumber', 'reminderAboveHard'].map((k) => `masterForm.problem.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const f = locale.masterForm as Record<string, unknown>
    expect(String(f.refusalCode)).toContain('<v>{{code}}</v>')
    expect(String(f.clashesWith)).toContain('<n>{{name}}</n>')
    expect(String(f.clashesWith)).toContain('<v>{{id}}</v>')
    expect(String(f.sharedStores)).toContain('<v>{{stores}}</v>')
  })
  it.each([en, ar])('the insurer field says customer id, with a customer-id placeholder (628)', (locale) => {
    const f = locale.masterForm as unknown as Record<string, string>
    expect(f.payerPlaceholder).toContain('0001100336')
    expect(f.payerPlaceholder).not.toContain('BUPA')
    expect((locale.masters as { columns: Record<string, string> }).columns.payer).toBe(f.payer)
  })
})

// 623 · versions and restore
describe('insurance-idf — the keys the versions section builds exist (623)', () => {
  it.each([en, ar])('title, columns, live mark, restore panel', (locale) => {
    const keys = [
      ...['title', 'lede', 'loading', 'failed', 'empty', 'live', 'restore', 'restoreTitle', 'restoreHint'].map((k) => `versions.${k}`),
      ...['note', 'notePlaceholder', 'confirm', 'cancel', 'restored', 'restoredDetail', 'restoreFailed'].map((k) => `versions.${k}`),
      ...['number', 'byAt', 'entries', 'note', 'actions'].map((c) => `versions.columns.${c}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the restore title and hint isolate the version number as a tag', (locale) => {
    const v = locale.versions as Record<string, unknown>
    expect(String(v.restoreTitle)).toContain('<v>{{n}}</v>')
    expect(String(v.restoreHint)).toContain('<v>{{n}}</v>')
  })
})

// 627 · the swap report's fixed columns (3169) and every outcome's word
describe('insurance-idf — the keys the swap report columns build exist (627)', () => {
  it.each([en, ar])('a word for every count column, the money and time columns, the total and general rows', (locale) => {
    const keys = [
      ...IDF_EVENT_OUTCOMES.map((o) => `events.outcome.${o}`),
      ...SWAP_REPORT_COUNTS.map((c) => `report.columns.${c}`),
      ...['master', 'store', 'payer', 'priceDifference', 'averageTime'].map((c) => `report.columns.${c}`),
      'report.totalRow',
      'report.general',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the price difference says per base unit', (locale) => {
    const c = (locale.report as { columns: Record<string, string> }).columns
    expect(c.priceDifference).toMatch(locale === en ? /per base unit/ : /وحدة أساسية/)
  })
})

// 643 · the keys the items section builds
describe('insurance-idf — the keys the items section builds exist (643)', () => {
  it.each([en, ar])('title, filters, version picker, states and columns', (locale) => {
    const keys = [
      ...['title', 'lede', 'version', 'versionOption', 'versionOptionLive', 'notLive', 'showLive', 'noLive', 'search', 'searchPlaceholder'].map((k) => `items.${k}`),
      ...['group', 'groupPlaceholder', 'loading', 'failed', 'empty', 'noMatch', 'total'].map((k) => `items.${k}`),
      ...['item', 'description', 'group', 'priority', 'mark', 'actions'].map((c) => `items.columns.${c}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('counts and version numbers are isolated as tags', (locale) => {
    const items = locale.items as Record<string, unknown> | undefined
    expect(String(items?.total)).toContain('<v>{{total}}</v>')
    expect(String(items?.notLive)).toContain('<v>{{n}}</v>')
  })
})

// 645 · the draft panel
describe('insurance-idf — the keys the draft panel builds exist (645)', () => {
  it.each([en, ar])('panel, add, re-rank, remove, publish, discard and every mark', (locale) => {
    const keys = [
      ...['title', 'lede', 'loading', 'failed', 'none', 'start', 'startFailed', 'started', 'changed', 'changes', 'counts', 'comparing'].map((k) => `draft.${k}`),
      ...['addTitle', 'item', 'itemPlaceholder', 'group', 'groupPlaceholder', 'priority', 'add', 'editFailed', 'reRank', 'reRankTitle', 'newPriority', 'save'].map((k) => `draft.${k}`),
      ...['remove', 'removeTitle', 'removeHint', 'cancel', 'note', 'notePlaceholder', 'publish', 'publishHint', 'published', 'publishedDetail', 'publishFailed'].map((k) => `draft.${k}`),
      ...['discard', 'discardTitle', 'discardHint', 'discarded', 'discardFailed', 'shown'].map((k) => `draft.${k}`),
      ...[...IDF_DRAFT_MARKS, 'removed'].map((m) => `draft.mark.${m}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const counts = String((locale.draft as Record<string, unknown> | undefined)?.counts)
    for (const v of ['added', 'reRanked', 'moved', 'removed']) expect(counts).toContain(`<v>{{${v}}}</v>`)
  })
})

// 646 · whose draft, stale → rebase, add a group
describe('insurance-idf — the keys the draft owner, rebase and group add build exist (646)', () => {
  it.each([en, ar])('owner, someone else, stale, rebase, start refusal, group add', (locale) => {
    const keys = [
      ...['owner', 'you', 'base', 'baseVersion', 'baseNone', 'someoneElse', 'stale', 'rebase', 'rebased', 'rebaseFailed'].map((k) => `draft.${k}`),
      ...['discardOtherTitle', 'discardOtherHint', 'startRefused', 'startRefusedNoDate'].map((k) => `draft.${k}`),
      ...['groupTitle', 'groupHint', 'addGroup', 'groupRefused', 'rule', 'message'].map((k) => `draft.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const d = locale.draft as Record<string, unknown>
    expect(String(d.someoneElse)).toContain('<b>{{by}}</b>')
    expect(String(d.someoneElse)).toContain('<v>{{since}}</v>')
    for (const f of locale === en ? ['_one', '_other'] : ['_zero', '_one', '_two', '_few', '_many', '_other']) expect(String(d[`groupAdded${f}`])).toContain('<v>{{n}}</v>')
  })
})

// 644 · the keys the master export + template build
describe('insurance-idf — the keys the master export and template build exist (644)', () => {
  it.each([en, ar])('export, template and their refusal titles', (locale) => {
    for (const key of ['download.export', 'download.exportFailed', 'download.template', 'download.templateFailed']) {
      expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    }
  })
})

// 652 · the IDF groups leaf
describe('insurance-idf — the keys the IDF groups leaf builds exist (652)', () => {
  it.each([en, ar])('page, columns, form, problems, remove, export', (locale) => {
    const keys = [
      ...['title', 'lede', 'help', 'loading', 'failed', 'empty', 'searchLabel', 'searchPlaceholder', 'add', 'addTitle', 'edit', 'editTitle'].map((k) => `groups.${k}`),
      ...['number', 'numberFixed', 'description', 'dosageForm', 'save', 'cancel', 'added', 'saved', 'saveFailed'].map((k) => `groups.${k}`),
      ...['remove', 'removeTitle', 'removeHint', 'removed', 'removeFailed', 'export', 'exportFailed'].map((k) => `groups.${k}`),
      ...['number', 'description', 'dosageForm', 'itemCount', 'actions'].map((c) => `groups.columns.${c}`),
      ...['numberRequired', 'numberTooLong', 'descriptionRequired'].map((p) => `groups.problem.${p}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const g = locale.groups as Record<string, unknown>
    expect(String(g.total)).toContain('<v>{{total}}</v>')
    for (const [k, v] of Object.entries(g)) if (k.startsWith('refusedCount_')) expect([k, String(v)]).toEqual([k, expect.stringContaining('<v>{{n}}</v>')])
    expect(Object.keys(g).some((k) => k.startsWith('refusedCount_'))).toBe(true)
  })
  it.each([areaEn, areaAr])('the IDF groups menu label in the area namespace', (locale) => {
    expect(hasLocaleKey(locale, 'menu.idfGroups')).toBe(true)
  })
})

// 653 · the IDF groups import
describe('insurance-idf — the keys the IDF groups import builds exist (653)', () => {
  it.each([en, ar])('template, dialog, report columns, actions, rules, apply', (locale) => {
    const keys = [
      ...['template', 'templateFailed', 'open', 'title', 'hint', 'file', 'submit', 'uploadFailed', 'clean', 'notOk', 'close'].map((k) => `groupsImport.${k}`),
      ...['apply', 'applyHint', 'applied', 'appliedDetail', 'applyFailed'].map((k) => `groupsImport.${k}`),
      ...['line', 'group', 'action', 'rule', 'message'].map((c) => `groupsImport.columns.${c}`),
      ...['add', 'update'].map((a) => `groupsImport.action.${a}`),
      ...IDF_GROUPS_IMPORT_RULES.map((r) => `groupsImport.rule.${r}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    const g = locale.groupsImport as Record<string, unknown>
    expect(String(g.counts)).toMatch(/<v>\{\{add\}\}<\/v>.*<v>\{\{update\}\}<\/v>|<v>\{\{update\}\}<\/v>.*<v>\{\{add\}\}<\/v>/)
    expect(String(g.result)).toMatch(/<v>\{\{added\}\}<\/v>/)
    expect(String(g.result)).toMatch(/<v>\{\{updated\}\}<\/v>/)
    expect(Object.keys(g).some((k) => k.startsWith('rowsFailed_'))).toBe(true)
    for (const [k, v] of Object.entries(g)) if (k.startsWith('rowsFailed_')) expect([k, String(v)]).toEqual([k, expect.stringContaining('<v>{{n}}</v>')])
  })
})

// 647 · the keys the General page builds
describe('insurance-idf — the keys the General page builds exist (647)', () => {
  it.each([en, ar])('title, tier, help, tabs, items lede and empty', (locale) => {
    const keys = ['general.title', 'general.tier', 'general.help', 'general.tabs.label', ...IDF_GENERAL_TABS.map((k) => `general.tabs.${k}`), 'general.itemsLede', 'general.empty']
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the tier sentence isolates its number as a tag', (locale) => {
    expect(String((locale as { general: { tier: string } }).general.tier)).toContain('<v>{{n}}</v>')
  })
})

// 650 · the keys the Change log tab builds
describe('insurance-idf — the keys the Change log tab builds exist (650)', () => {
  it.each([en, ar])('filter, columns, entity and action words, states and export', (locale) => {
    const keys = [
      'general.tabs.changes',
      'changes.lede',
      ...['label', 'item', 'idf', 'user', 'from', 'to', 'invalid', 'reversed'].map((k) => `changes.filter.${k}`),
      ...['at', 'by', 'entity', 'key', 'action', 'before', 'after', 'reason', 'upload'].map((k) => `changes.columns.${k}`),
      ...IDF_CHANGE_ENTITIES.map((k) => `changes.entity.${k}`),
      ...IDF_CHANGE_ACTIONS.map((k) => `changes.action.${k}`),
      ...['none', 'total', 'empty', 'noMatch', 'loading', 'failed', 'export', 'exportFailed'].map((k) => `changes.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([en, ar])('the total isolates its figure as a tag', (locale) => {
    expect(String((locale as { changes: { total: string } }).changes.total)).toContain('<v>{{total}}</v>')
  })
})

// 648 · the keys the general item dialogs build
describe('insurance-idf — the keys the general item dialogs build exist (648)', () => {
  const PROBLEMS = ['itemRequired', 'groupRequired', 'priorityRequired', 'priorityWholeNumber', 'reasonRequired', 'reasonTooLong']
  it.each([en, ar])('actions, titles, fields, outcomes and every problem', (locale) => {
    const keys = [
      ...['setItem', 'edit', 'clear', 'setTitle', 'editTitle', 'clearTitle', 'lede', 'clearHint', 'item', 'group', 'priority', 'reason', 'cancel', 'save'],
      ...['saved', 'cleared', 'saveFailed', 'clearFailed'],
      ...PROBLEMS.map((p) => `problem.${p}`),
    ].map((k) => `generalEdit.${k}`)
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
