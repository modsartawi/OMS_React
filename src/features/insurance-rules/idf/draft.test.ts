/**
 * Ticket 645 — a master's draft (BackOffice spec 3185, door 3189). The draft's rows against the version it was copied
 * from: each draft row marked added / re-ranked / moved / unchanged, and the base rows the draft no longer holds listed
 * as removed. A refused edit (a 400 carrying the upload's `{ rule, messageEn, messageAr }`) reads as the rule's word and
 * the message in the reader's language, the raw code when this build has no word for it.
 */
import { describe, expect, it } from 'vitest'
import { DRAFT_SHOWN, draftAddBody, draftDiff, draftEditRefusal, draftPage, itemsShown, pickShown, removedShown } from './draft'

const row = (itemNumber: string, idfNumber: string, priority: number) => ({ itemNumber, descriptionEn: `Item ${itemNumber}`, descriptionAr: '', idfNumber, priority })

describe('draft diff marks added, re-ranked, removed and unchanged rows against live', () => {
  const live = [row('100200', 'IDF-PARA-500', 1), row('100300', 'IDF-PARA-500', 2), row('200100', 'IDF-IBU', 1), row('200200', 'IDF-IBU', 2)]
  const draft = [
    row('100200', 'IDF-PARA-500', 1), // unchanged
    row('100300', 'IDF-PARA-500', 3), // re-ranked 2 → 3
    row('200200', 'IDF-AMOX', 2), // moved to another group
    row('100999', 'IDF-PARA-500', 4), // added
  ] // 200100 removed

  it('marks every draft row by its item number', () => {
    const d = draftDiff(draft, live)
    expect(d.mark('100200')).toBe('unchanged')
    expect(d.mark('100300')).toBe('reRanked')
    expect(d.mark('200200')).toBe('moved')
    expect(d.mark('100999')).toBe('added')
  })

  it('lists the live rows the draft no longer holds as removed, with their live values', () => {
    expect(draftDiff(draft, live).removed).toEqual([row('200100', 'IDF-IBU', 1)])
  })

  it('counts each kind', () => {
    expect(draftDiff(draft, live).counts).toEqual({ added: 1, reRanked: 1, moved: 1, removed: 1, unchanged: 1 })
  })

  it('a fresh draft is all unchanged; a draft over no live version is all added', () => {
    expect(draftDiff(live, live).counts).toEqual({ added: 0, reRanked: 0, moved: 0, removed: 0, unchanged: 4 })
    expect(draftDiff(live, []).counts).toEqual({ added: 4, reRanked: 0, moved: 0, removed: 0, unchanged: 0 })
  })

  it('an item the draft does not hold has no mark', () => {
    expect(draftDiff(draft, live).mark('555555')).toBeNull()
  })
})

describe('an edit refusal maps its rule to a message, raw code as fallback', () => {
  const data = { rule: 'itemNotInGroup', messageEn: 'Item 100302 is not in IDF group IDF-PARA-500.', messageAr: 'الصنف 100302 ليس في مجموعة IDF-PARA-500.' }

  it('a known rule reads its word key and the message in the reader language', () => {
    expect(draftEditRefusal(data, 'en')).toEqual({ rule: 'itemNotInGroup', wordKey: 'upload.rule.itemNotInGroup', message: 'Item 100302 is not in IDF group IDF-PARA-500.' })
    expect(draftEditRefusal(data, 'ar')?.message).toBe('الصنف 100302 ليس في مجموعة IDF-PARA-500.')
  })

  it('a rule this build has no word for keeps its raw code', () => {
    expect(draftEditRefusal({ ...data, rule: 'itemBlocked' }, 'en')).toEqual({ rule: 'itemBlocked', wordKey: null, message: data.messageEn })
  })

  it('Arabic falls back to English when blank', () => {
    expect(draftEditRefusal({ ...data, messageAr: '' }, 'ar')?.message).toBe(data.messageEn)
  })

  it('a refusal carrying no rule is not a rule refusal (the envelope message shows instead)', () => {
    expect(draftEditRefusal(null, 'en')).toBeNull()
    expect(draftEditRefusal({ by: 'nalharbi' }, 'en')).toBeNull()
    expect(draftEditRefusal('itemNotInGroup', 'en')).toBeNull()
  })
})

describe('the items table shows the draft a page at a time, filtered as the door filters', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(String(100100 + i), i < 20 ? 'IDF-PARA-500' : 'IDF-IBU', (i % 10) + 1))
  rows[3] = { ...rows[3], descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول' }

  it('pages the rows 25 at a time with the whole count', () => {
    const p1 = draftPage(rows, { q: '', idf: '', page: 1 })
    expect([p1.total, p1.pageSize, p1.rows.length, p1.rows[0].itemNumber]).toEqual([30, 25, 25, '100100'])
    expect(draftPage(rows, { q: '', idf: '', page: 2 }).rows.map((r) => r.itemNumber)).toEqual(['100125', '100126', '100127', '100128', '100129'])
  })

  it('a search matches the item number or either description, case-blind; a group matches exactly', () => {
    expect(draftPage(rows, { q: 'PANADOL', idf: '', page: 1 }).rows.map((r) => r.itemNumber)).toEqual(['100103'])
    expect(draftPage(rows, { q: 'بنادول', idf: '', page: 1 }).total).toBe(1)
    expect(draftPage(rows, { q: '10012', idf: '', page: 1 }).total).toBe(10)
    expect(draftPage(rows, { q: '10012', idf: 'IDF-IBU', page: 1 }).rows.map((r) => r.itemNumber)).toEqual(['100120', '100121', '100122', '100123', '100124', '100125', '100126', '100127', '100128', '100129'])
    expect(draftPage(rows, { q: '', idf: 'IDF-IBU', page: 1 }).total).toBe(10)
  })

  it('removed rows matching the filter show on the last page only', () => {
    const removed = [row('900001', 'IDF-PARA-500', 1), row('900002', 'IDF-IBU', 2)]
    expect(removedShown(removed, { q: '', idf: '', page: 1 }, 30)).toEqual([])
    expect(removedShown(removed, { q: '', idf: '', page: 2 }, 30).map((r) => r.itemNumber)).toEqual(['900001', '900002'])
    expect(removedShown(removed, { q: '', idf: 'IDF-IBU', page: 1 }, 10).map((r) => r.itemNumber)).toEqual(['900002'])
    expect(removedShown(removed, { q: '', idf: '', page: 1 }, 0).length).toBe(2)
  })
})

describe('an open draft is what the items show unless the address names a version', () => {
  it('no version named: the draft when one is open, else the live version, else nothing', () => {
    expect(itemsShown({ version: '' }, 'V-11', true)).toEqual({ kind: 'draft' })
    expect(itemsShown({ version: '' }, 'V-11', false)).toEqual({ kind: 'version', versionId: 'V-11' })
    expect(itemsShown({ version: '' }, null, true)).toEqual({ kind: 'draft' })
    expect(itemsShown({ version: '' }, null, false)).toBeNull()
  })

  it('a named version shows, draft or not', () => {
    expect(itemsShown({ version: 'V-11' }, 'V-11', true)).toEqual({ kind: 'version', versionId: 'V-11' })
    expect(itemsShown({ version: 'V-7' }, 'V-11', false)).toEqual({ kind: 'version', versionId: 'V-7' })
  })

  it('picking keeps the filters and goes to page 1; the default (draft, else live) leaves the address', () => {
    const q = { version: 'V-7', q: 'pan', idf: 'IDF-PARA-500', page: 3 }
    expect(pickShown(q, DRAFT_SHOWN, 'V-11', true)).toEqual({ ...q, version: '', page: 1 })
    expect(pickShown(q, 'V-11', 'V-11', true)).toEqual({ ...q, version: 'V-11', page: 1 })
    expect(pickShown(q, 'V-11', 'V-11', false)).toEqual({ ...q, version: '', page: 1 })
  })
})

describe('the add form sends a trimmed item, group and numeric priority, leaving the rules to the server', () => {
  it('a filled form is a body', () => {
    expect(draftAddBody({ itemNumber: ' 100999 ', idfNumber: ' IDF-PARA-500', priority: ' 4 ' })).toEqual({ itemNumber: '100999', idfNumber: 'IDF-PARA-500', priority: 4 })
  })
  it('a priority the server will judge (2.5, 0) is still sent', () => {
    expect(draftAddBody({ itemNumber: '1', idfNumber: 'G', priority: '2.5' })?.priority).toBe(2.5)
    expect(draftAddBody({ itemNumber: '1', idfNumber: 'G', priority: '0' })?.priority).toBe(0)
  })
  it('a blank field or a priority that is not a number is no body', () => {
    expect(draftAddBody({ itemNumber: '', idfNumber: 'G', priority: '1' })).toBeNull()
    expect(draftAddBody({ itemNumber: '1', idfNumber: ' ', priority: '1' })).toBeNull()
    expect(draftAddBody({ itemNumber: '1', idfNumber: 'G', priority: '' })).toBeNull()
    expect(draftAddBody({ itemNumber: '1', idfNumber: 'G', priority: 'two' })).toBeNull()
  })
})
