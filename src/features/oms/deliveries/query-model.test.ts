/**
 * The query bar's token model (ticket 399, spec 380 L8; ruling 368 §1): the 14
 * `DeliveryFilterCriteria` as tokens, the date pair as ONE relative Date token that resolves only
 * at search time, and the unapplied edits measured against the last search that ran.
 */
import { describe, expect, it } from 'vitest'
import { BLANK_CRITERIA, buildDeliveryQuery, DEFAULT_LIMIT } from './filter'
import {
  barTokens,
  BLANK_QUERY,
  discardedDraft,
  inSearch,
  pendingDiff,
  QUERY_FIELDS,
  QUERY_GROUPS,
  queryOfTokens,
  resolveDate,
  restoreField,
  toFilterCriteria,
  tokensOf,
  withField,
  type QueryCriteria,
} from './query-model'

/** Every one of the 13 entries set — the 14 criteria, with From/To as one Date. */
const FULL: QueryCriteria = {
  date: { preset: 'last3' },
  deliveryNo: '80001238',
  documentNo: '1000000435',
  orderNo: '900138',
  customerPhone: '0510008238',
  storeCode: '1017',
  documentType: 'CLCN',
  documentSource: 'Web',
  deliveryDocumentType: 'Forward',
  deliveryType: 'PickInStore',
  isExpress: false,
  documentReason: 'Customer asked',
  limit: 50,
}

/** 3 Oct 2026, mid-afternoon local time. */
const NOW = new Date(2026, 9, 3, 15, 42, 7)
const day = (d: Date | null | undefined) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null

describe('criteriaRoundTripThroughTokens', () => {
  it('the fields cover all 14 criteria exactly once, From/To as the one Date entry', () => {
    const keys = QUERY_FIELDS.flatMap((f) => f.criteria)
    expect([...keys].sort()).toEqual(Object.keys(BLANK_CRITERIA).sort())
    expect(new Set(keys).size).toBe(14)
    expect(QUERY_FIELDS).toHaveLength(13)
    expect(QUERY_FIELDS.find((f) => f.id === 'date')?.criteria).toEqual(['fromDate', 'toDate'])
  })

  it('groups them When · Find one · Narrow · Rows, in that order, with nothing left over', () => {
    expect(QUERY_GROUPS).toEqual(['when', 'find', 'narrow', 'rows'])
    const byGroup = Object.fromEntries(QUERY_GROUPS.map((g) => [g, QUERY_FIELDS.filter((f) => f.group === g).map((f) => f.id)]))
    expect(byGroup).toEqual({
      when: ['date'],
      find: ['deliveryNo', 'documentNo', 'orderNo', 'customerPhone'],
      narrow: ['storeCode', 'documentType', 'documentSource', 'deliveryDocumentType', 'deliveryType', 'isExpress', 'documentReason'],
      rows: ['limit'],
    })
  })

  it('each set criterion is one token, and the tokens rebuild the query unchanged', () => {
    const tokens = tokensOf(FULL)
    expect(tokens.map((t) => t.field)).toEqual(QUERY_FIELDS.map((f) => f.id))
    expect(queryOfTokens(tokens)).toEqual(FULL)
  })

  it('each criterion alone survives the round trip', () => {
    for (const { id } of QUERY_FIELDS) {
      const one = withField(BLANK_QUERY, id, FULL[id])
      const tokens = tokensOf(one)
      // The one criterion, plus the Limit token, which is always there.
      expect(tokens.map((t) => t.field)).toEqual(id === 'limit' ? ['limit'] : [id, 'limit'])
      expect(queryOfTokens(tokens)).toEqual(one)
    }
  })

  it('Date is ONE token that stays relative', () => {
    const tokens = tokensOf(withField(BLANK_QUERY, 'date', { preset: 'last7' }))
    expect(tokens).toEqual([
      { field: 'date', value: { preset: 'last7' } },
      { field: 'limit', value: DEFAULT_LIMIT },
    ])
  })

  it('a blank query is the Limit token alone, which is always in the search', () => {
    expect(tokensOf(BLANK_QUERY)).toEqual([{ field: 'limit', value: DEFAULT_LIMIT }])
    expect(inSearch(BLANK_QUERY, 'limit')).toBe(true)
    expect(inSearch(BLANK_QUERY, 'storeCode')).toBe(false)
    // A cleared Limit is still a Limit: it searches with the default.
    expect(tokensOf(withField(BLANK_QUERY, 'limit', null))).toEqual([{ field: 'limit', value: null }])
  })

  it('"No" for Dawaa Now is a criterion; blank text is not', () => {
    expect(inSearch(withField(BLANK_QUERY, 'isExpress', false), 'isExpress')).toBe(true)
    expect(inSearch(withField(BLANK_QUERY, 'storeCode', '   '), 'storeCode')).toBe(false)
    expect(tokensOf(withField(BLANK_QUERY, 'storeCode', '  ')).map((t) => t.field)).toEqual(['limit'])
  })

  it('the 13 non-date criteria reach the search contract unchanged', () => {
    const criteria = toFilterCriteria(FULL, NOW)
    const { date: _date, ...rest } = FULL
    expect(criteria).toMatchObject(rest)
    expect(buildDeliveryQuery(criteria)).toEqual({
      Limit: 50,
      FromDate: '2026-10-01',
      ToDate: '2026-10-03',
      DocumentType: 'CLCN',
      DocumentSource: 'Web',
      DeliveryDocumentType: 'Forward',
      DocumentNo: '1000000435',
      DeliveryNo: '80001238',
      StoreCode: '1017',
      CustomerPhone: '0510008238',
      OrderNo: '900138',
      DeliveryType: 'PickInStore',
      DocumentReason: 'Customer asked',
      IsExpress: false,
    })
  })

  it('a blank query searches exactly as the blank panel did', () => {
    expect(buildDeliveryQuery(toFilterCriteria(BLANK_QUERY, NOW))).toEqual(buildDeliveryQuery(BLANK_CRITERIA))
  })
})

describe('relativeDateResolvesAtSearchTime', () => {
  it('each preset resolves to a concrete From/To against the injected now', () => {
    const range = (preset: 'today' | 'yesterday' | 'last3' | 'last7') => {
      const r = resolveDate({ preset }, NOW)
      return [day(r?.from), day(r?.to)]
    }
    expect(range('today')).toEqual(['2026-10-03', '2026-10-03'])
    expect(range('yesterday')).toEqual(['2026-10-02', '2026-10-02'])
    expect(range('last3')).toEqual(['2026-10-01', '2026-10-03'])
    expect(range('last7')).toEqual(['2026-09-27', '2026-10-03'])
  })

  it('"Last 3 days" stays relative in the model, and means tomorrow\'s days tomorrow', () => {
    const query = withField(BLANK_QUERY, 'date', { preset: 'last3' })
    const today = toFilterCriteria(query, NOW)
    const tomorrow = toFilterCriteria(query, new Date(2026, 9, 4, 8, 0))
    expect(query.date).toEqual({ preset: 'last3' })
    expect([day(today.fromDate), day(today.toDate)]).toEqual(['2026-10-01', '2026-10-03'])
    expect([day(tomorrow.fromDate), day(tomorrow.toDate)]).toEqual(['2026-10-02', '2026-10-04'])
  })

  it('crosses a month end and resolves to local midnight', () => {
    const r = resolveDate({ preset: 'last7' }, new Date(2026, 2, 3, 0, 30))
    expect([day(r?.from), day(r?.to)]).toEqual(['2026-02-25', '2026-03-03'])
    expect([r?.from.getHours(), r?.from.getMinutes(), r?.to.getHours()]).toEqual([0, 0, 0])
  })

  it('a Custom range resolves to its own two days, and only when both are set', () => {
    const custom = resolveDate({ preset: 'custom', from: '2026-09-01', to: '2026-09-15' }, NOW)
    expect([day(custom?.from), day(custom?.to)]).toEqual(['2026-09-01', '2026-09-15'])
    expect(resolveDate({ preset: 'custom', from: '2026-09-01', to: null }, NOW)).toBeNull()
    expect(resolveDate({ preset: 'custom', from: 'not a date', to: '2026-09-15' }, NOW)).toBeNull()
    expect(resolveDate(null, NOW)).toBeNull()
  })

  it('a Custom range missing an end is no criterion: no token, no flag, nothing sent', () => {
    const half = withField(BLANK_QUERY, 'date', { preset: 'custom', from: '2026-09-01', to: null })
    expect(inSearch(half, 'date')).toBe(false)
    expect(tokensOf(half).map((t) => t.field)).toEqual(['limit'])
    expect(pendingDiff(half, null).count).toBe(0)
    // Against a search that ran with a Date, it reads as the Date removed.
    expect(pendingDiff(half, withField(BLANK_QUERY, 'date', { preset: 'today' })).removed).toEqual(['date'])
    // While its popover is open it still has a token to sit in.
    expect(barTokens(half, null, 'date').map((t) => [t.field, t.state])).toEqual([['date', 'added']])
    expect(buildDeliveryQuery(toFilterCriteria(half, NOW))).not.toHaveProperty('FromDate')
  })

  it('no Date sends no FromDate/ToDate', () => {
    const params = buildDeliveryQuery(toFilterCriteria(withField(BLANK_QUERY, 'storeCode', '1017'), NOW))
    expect(params).not.toHaveProperty('FromDate')
    expect(params).not.toHaveProperty('ToDate')
  })
})

describe('pendingDiffFlagsEditsAndRemovals', () => {
  const RAN: QueryCriteria = { ...BLANK_QUERY, date: { preset: 'today' }, storeCode: '1017', documentType: 'CLCN' }

  it('nothing is pending when the draft is the search that ran', () => {
    expect(pendingDiff(RAN, RAN)).toEqual({ edited: [], removed: [], added: [], count: 0 })
    expect(barTokens(RAN, RAN, null).map((t) => [t.field, t.state])).toEqual([
      ['date', 'applied'],
      ['storeCode', 'applied'],
      ['documentType', 'applied'],
    ])
  })

  it('editing, removing and adding each flag their token, and the note counts them', () => {
    let draft = withField(RAN, 'storeCode', '1002') // edited
    draft = withField(draft, 'date', null) // removed
    draft = withField(draft, 'orderNo', '900138') // added
    const diff = pendingDiff(draft, RAN)
    expect(diff).toEqual({ edited: ['storeCode'], removed: ['date'], added: ['orderNo'], count: 3 })
    expect(barTokens(draft, RAN, null).map((t) => [t.field, t.state])).toEqual([
      ['date', 'ghost'],
      ['orderNo', 'added'],
      ['storeCode', 'edited'],
      ['documentType', 'applied'],
    ])
  })

  it('a ghost shows the value that ran, so it can be restored', () => {
    const draft = withField(RAN, 'storeCode', null)
    const ghost = barTokens(draft, RAN, null).find((t) => t.field === 'storeCode')
    expect(ghost).toEqual({ field: 'storeCode', value: '1017', state: 'ghost' })
    const restored = restoreField(draft, RAN, 'storeCode')
    expect(restored.storeCode).toBe('1017')
    expect(pendingDiff(restored, RAN).count).toBe(0)
  })

  it('the Limit is edited, never removed: a cleared Limit that still means 200 is no change', () => {
    expect(pendingDiff(withField(RAN, 'limit', 30), RAN)).toMatchObject({ edited: ['limit'], count: 1 })
    expect(pendingDiff(withField(RAN, 'limit', null), RAN).count).toBe(0)
    expect(barTokens(withField(RAN, 'limit', 30), RAN, null).some((t) => t.field === 'limit')).toBe(false)
  })

  it('a typed space or the same text padded is not an edit', () => {
    expect(pendingDiff(withField(RAN, 'storeCode', ' 1017 '), RAN).count).toBe(0)
    expect(pendingDiff(withField(RAN, 'orderNo', ' '), RAN).count).toBe(0)
  })

  it('switching the relative preset is an edit; the same preset is not', () => {
    expect(pendingDiff(withField(RAN, 'date', { preset: 'last3' }), RAN).edited).toEqual(['date'])
    expect(pendingDiff(withField(RAN, 'date', { preset: 'today' }), RAN).count).toBe(0)
  })

  it('before any search, the draft is measured against the blank query', () => {
    expect(pendingDiff(BLANK_QUERY, null).count).toBe(0)
    expect(pendingDiff(withField(BLANK_QUERY, 'storeCode', '1017'), null)).toMatchObject({ added: ['storeCode'], count: 1 })
  })

  it('a token being added shows while its popover is open, even with no value yet', () => {
    expect(barTokens(RAN, RAN, 'deliveryNo').map((t) => [t.field, t.state])).toContainEqual(['deliveryNo', 'added'])
    expect(barTokens(RAN, RAN, null).some((t) => t.field === 'deliveryNo')).toBe(false)
  })

  it('Discard restores the last-run criteria', () => {
    const draft = withField(withField(RAN, 'storeCode', '1002'), 'date', null)
    expect(pendingDiff(draft, RAN).count).toBe(2)
    const back = discardedDraft(RAN)
    expect(back).toEqual(RAN)
    expect(pendingDiff(back, RAN).count).toBe(0)
    // Before any search there is nothing to go back to but the blank query.
    expect(discardedDraft(null)).toEqual(BLANK_QUERY)
  })
})
