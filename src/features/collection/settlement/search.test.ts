/**
 * The search — **four keys in one box** (ticket 270, spec 267 D2): branch code,
 * branch name in either script, city, and an entry number.
 *
 * The assertions that matter are the two the ticket's Proof names: a branch is
 * findable **by name in BOTH scripts**, and the scope **ranks** a hit rather than
 * refusing it. Both are run against the estate fixture rather than a three-row
 * mock, because a ranking that looks right over three rows is not a ranking.
 */
import { describe, expect, it } from 'vitest'
import { SETTLEMENT_FLEET, SETTLEMENT_LEDGER } from './fleet-fixture'
import { resolveScope } from './scope'
import {
  MatchRank,
  parseEntryNumber,
  resolveSubmit,
  searchBranches,
  SEARCH_HIT_LIMIT,
} from './search'

const MINE = resolveScope('mine', SETTLEMENT_FLEET)
const ALL = resolveScope('all', SETTLEMENT_FLEET)
const find = (q: string, resolution = MINE) => searchBranches(SETTLEMENT_FLEET, q, resolution)
const ids = (q: string, resolution = MINE) => find(q, resolution).hits.map((h) => h.row.storeId)

describe('finding a branch four ways', () => {
  it('finds it by CODE, exactly and by prefix', () => {
    expect(ids('0331')[0]).toBe('0331')
    expect(find('0331').hits[0].rank).toBe(MatchRank.CodeExact)
    expect(ids('033').length).toBeGreaterThan(0)
    expect(ids('033').every((id) => id.startsWith('033'))).toBe(true)
  })

  it('🔑 finds it by NAME IN EITHER SCRIPT — the same branch, twice', () => {
    // The six hostile branches carry both scripts in one name, exactly as the wire
    // does: "صيدلية النخيل / Al-Nakheel Pharmacy".
    expect(ids('النخيل')).toContain('0331')
    expect(ids('Al-Nakheel')).toContain('0331')
    // …and case is not a barrier on the Latin half. Arabic is caseless, so the
    // same fold serves both without a transliteration rule invented on a screen.
    expect(ids('al-nakheel')).toContain('0331')
    expect(ids('صيدلية').length).toBeGreaterThan(0)
  })

  it('finds it by CITY', () => {
    const hits = find('Muharraq', ALL).hits
    expect(hits.map((h) => h.row.storeId)).toContain('0688')
    expect(hits.some((h) => h.rank >= MatchRank.CityPrefix)).toBe(true)
  })

  it('ranks a code match above a name match above a city match', () => {
    const ranked = find('Riyadh', ALL).hits.map((h) => h.rank)
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked)
  })

  it('answers an empty query with NOTHING — the estate is not a search result', () => {
    expect(find('')).toEqual({ hits: [], total: 0 })
    expect(find('   ')).toEqual({ hits: [], total: 0 })
  })

  it('caps what it draws and still reports how many matched', () => {
    const result = find('Pharmacy', ALL)
    expect(result.total).toBeGreaterThan(SEARCH_HIT_LIMIT)
    expect(result.hits).toHaveLength(SEARCH_HIT_LIMIT)
  })
})

describe('🔑 the scope RANKS a hit and never refuses one', () => {
  it('finds a branch outside the scope, and marks it as outside', () => {
    // 0331 belongs to nobody; the session is scoped to its own branches.
    const hit = find('0331').hits[0]
    expect(hit.row.storeId).toBe('0331')
    expect(hit.inScope).toBe(false)
  })

  it('puts in-scope branches first WITHIN a rank, never by hiding the rest', () => {
    const hits = find('Pharmacy', MINE).hits
    const firstOutOfScope = hits.findIndex((h) => !h.inScope)
    const lastInScope = hits.map((h) => h.inScope).lastIndexOf(true)
    if (firstOutOfScope !== -1 && lastInScope !== -1)
      expect(lastInScope).toBeLessThan(firstOutOfScope)
    // …and the same query under *all* finds AT LEAST as much: widening adds hits,
    // it never removes them.
    expect(find('Pharmacy', ALL).total).toBeGreaterThanOrEqual(find('Pharmacy', MINE).total)
  })

  it('🚩 returns the SAME branches under every scope — only the order moves', () => {
    const under = (r: typeof MINE) =>
      searchBranches(SETTLEMENT_FLEET, 'Al', r, 5000).hits.map((h) => h.row.storeId).sort()
    expect(under(MINE)).toEqual(under(ALL))
    expect(under(resolveScope('unassigned', SETTLEMENT_FLEET))).toEqual(under(ALL))
  })
})

describe('an entry number is not a store code', () => {
  it('reads an unpadded number as an entry number', () => {
    expect(parseEntryNumber('143')).toBe(143)
    expect(parseEntryNumber(' 7 ')).toBe(7)
  })

  it('🔑 refuses a LEADING ZERO — that is a branch code, and the fixture has one', () => {
    expect(parseEntryNumber('0142')).toBeNull()
    // …and it is a real branch, which is the whole reason the rule exists.
    expect(ids('0142', ALL)[0]).toBe('0142')
  })

  it('refuses anything that is not a bare number', () => {
    for (const q of ['', '  ', '14a', 'Al-Nakheel', '1.5', '-4', '1234567890'])
      expect(parseEntryNumber(q)).toBeNull()
  })

  it('🚩 a numeric query is BOTH — the branch ranking still runs beside the lookup', () => {
    // "143" is entry 143 at branch 0142, and it is also a code prefix nobody in
    // this estate holds. The ranked list still renders; which one Enter takes is
    // `resolveSubmit`'s to decide, below.
    expect(parseEntryNumber('143')).toBe(143)
    expect(() => find('143', ALL)).not.toThrow()
  })
})

describe('🔑 what Enter means — an exact code beats an entry number', () => {
  const submit = (q: string) => resolveSubmit(SETTLEMENT_FLEET, q, ALL)

  it('takes an EXACT branch code to that branch, even when it is also an entry number', () => {
    // 🚩 The defect this rule exists for: store codes are four digits and entry
    // numbers are unpadded ints, so a code like 1001 is legitimately BOTH. Ranking
    // the entry first would take an accountant who typed their own branch's code to
    // a DIFFERENT branch's account — plausible, silent, and about money.
    const collision = SETTLEMENT_FLEET.find(
      (r) => parseEntryNumber(r.storeId) !== null && SETTLEMENT_LEDGER.some((e) => String(e.entryNumber) === r.storeId),
    )
    expect(collision).toBeDefined()
    expect(submit(collision!.storeId)).toEqual({ kind: 'branch', storeId: collision!.storeId })
  })

  it('looks up a bare number as an entry when no branch carries that code', () => {
    expect(submit('143')).toEqual({ kind: 'entry', entryNumber: 143 })
  })

  it('opens the one branch a query names, so Enter is never a dead key', () => {
    expect(submit('Al-Nakheel')).toEqual({ kind: 'branch', storeId: '0331' })
    // …and a zero-padded code is a branch, never entry 142.
    expect(submit('0142')).toEqual({ kind: 'branch', storeId: '0142' })
  })

  it('leaves an ambiguous query on the ranked list rather than guessing', () => {
    expect(submit('Pharmacy')).toEqual({ kind: 'ranked' })
    expect(submit('')).toEqual({ kind: 'ranked' })
  })
})
