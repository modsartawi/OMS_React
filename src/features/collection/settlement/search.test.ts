/**
 * The search (ticket 270, spec 267 D2) — **two keys in one box after ticket 274**,
 * where D2 asked for four.
 *
 * The assertion that still matters is the one the ticket's Proof names: a branch is
 * findable **by name in BOTH scripts**. It runs against the estate fixture rather
 * than a three-row mock, because a ranking that looks right over three rows is not a
 * ranking.
 *
 * ⚠️ **The two keys 274 could not deliver**, both recorded in
 * `.afk/FINDINGS-274.md` rather than faked:
 *
 * - **city** (§B5) — not on the live fleet row.
 * - **entry number** (§B1) — needs a cross-estate lookup, and `Settlement/Ledger`
 *   does not exist. `Settlement/Account` cannot serve it: it needs the `storeId` the
 *   caller is asking for.
 *
 * 🔑 **The scope's rule survives its own test.** 270 asserted *the scope ranks a
 * hit and never refuses one* over each row's `assignment`; that field is not on the
 * wire (§B4), so the ranking is gone — but the property it protected is now the
 * server's, which ORs the estate-wide carve-out into every scoped predicate. What is
 * left to assert here is that this module never filters at all.
 */
import { describe, expect, it } from 'vitest'
import { SETTLEMENT_FLEET } from './fleet-fixture'
import { MatchRank, resolveSubmit, searchBranches, SEARCH_HIT_LIMIT } from './search'

const find = (q: string) => searchBranches(SETTLEMENT_FLEET, q)
const ids = (q: string) => find(q).hits.map((h) => h.row.storeId)

describe('finding a branch two ways', () => {
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

  it('ranks a code match above a name match', () => {
    const ranked = find('Pharmacy').hits.map((h) => h.rank)
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked)
  })

  it('answers an empty query with NOTHING — the estate is not a search result', () => {
    expect(find('')).toEqual({ hits: [], total: 0 })
    expect(find('   ')).toEqual({ hits: [], total: 0 })
  })

  it('caps what it draws and still reports how many matched', () => {
    const result = find('Pharmacy')
    expect(result.total).toBeGreaterThan(SEARCH_HIT_LIMIT)
    expect(result.hits).toHaveLength(SEARCH_HIT_LIMIT)
  })
})

describe('🔑 the search never refuses a branch', () => {
  it('has no way to filter — the scope is not a parameter it takes', () => {
    // 270 enforced *"the scope ranks, it never refuses"* by ranking. 274 removed the
    // field it ranked on, so the rule is now structural: this function's required
    // parameters are the rows and the query, and neither is a scope. (`length` stops
    // at the first defaulted parameter, so the optional `limit` is not counted —
    // which is exactly the signature being asserted.) What the caller can search is
    // decided by which fleet answer it fetched, which is the server's own scoping,
    // carve-out included.
    expect(searchBranches).toHaveLength(2)
  })

  it('searches every row it is handed, assigned or not', () => {
    // 1255 of the estate's 1394 branches are on nobody's *mine*. Handed the estate,
    // the box reaches all of them.
    expect(find('Pharmacy').total).toBeGreaterThan(SEARCH_HIT_LIMIT)
    expect(ids('0331')).toContain('0331')
  })
})

/**
 * ⚠️ **A describe block on entry numbers stood here until 274.**
 * `parseEntryNumber` separated `0142` (a branch) from `142` (an entry) so one box
 * could take both. It is gone with the door that could resolve one (§B1) — but the
 * RULE is worth keeping in the record, because it comes straight back the day that
 * door lands: a leading zero is a store code, and an unpadded bare number is an
 * entry.
 */
describe('🔑 what Enter means', () => {
  const submit = (q: string) => resolveSubmit(SETTLEMENT_FLEET, q)

  it('takes an EXACT branch code to that branch, beating every other match', () => {
    // 🚩 The defect this rule exists for: store codes are four digits and entry
    // numbers are unpadded ints, so a code like 1001 is legitimately BOTH. Ranking
    // the entry first would take an accountant who typed their own branch's code to
    // a DIFFERENT branch's account — plausible, silent, and about money.
    const numericCode = SETTLEMENT_FLEET.find((r) => /^[1-9]/.test(r.storeId))
    expect(numericCode).toBeDefined()
    expect(submit(numericCode!.storeId)).toEqual({ kind: 'branch', storeId: numericCode!.storeId })
  })

  it('leaves a bare number that names no branch on the ranked list', () => {
    // ⚠️ 274: this used to jump to entry 143's branch. There is no door that
    // knows which branch entry 143 is on (§B1), so the honest answer is the ranked
    // list — and the box's own placeholder says it searches branches.
    expect(submit('999999')).toEqual({ kind: 'ranked' })
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

/**
 * 🔑 **The branch master's two extra keys** — ticket 274 / BackOffice 1199.
 *
 * The picker searches `Settlement/Branches` (the open `Store` master) rather than
 * the fleet, because the fleet is *branches with settlement activity* and is empty
 * on a database where nothing has been posted. That row carries two things the fleet
 * never has: a `city`, and the server's own reading of **whose branch this is**.
 */
describe('🔑 the branch master ranks by city and by whose branch it is', () => {
  const BRANCHES = [
    { storeId: '0900', storeName: 'Zahra Pharmacy', city: 'Jeddah', isMine: false },
    { storeId: '0901', storeName: 'Yasmin Pharmacy', city: 'Riyadh', isMine: true },
    { storeId: '0902', storeName: 'Wadi Pharmacy', city: 'Jeddah', isMine: true },
  ]

  it('finds a branch by its CITY — D2’s third key, which the fleet row never carried', () => {
    const result = searchBranches(BRANCHES, 'riyadh')
    expect(result.hits.map((h) => h.row.storeId)).toEqual(['0901'])
    expect(result.hits[0].rank).toBe(MatchRank.CityContains)
  })

  it('ranks a city match LAST — a city narrows a search, a name addresses one', () => {
    // 'wadi' is a name on 0902; if a city ever outranked a name, typing a branch's
    // own name would surface every branch in some city above it.
    const named = searchBranches(BRANCHES, 'wadi')
    expect(named.hits[0].row.storeId).toBe('0902')
    expect(named.hits[0].rank).toBe(MatchRank.NamePrefix)
  })

  it('🚩 puts the accountant’s OWN branches first — and still returns everybody else’s', () => {
    // The whole ruling in one assertion: the pairing master RANKS this list and does
    // not GATE it. 1255 of 1394 branches are paired to nobody, so a filter here would
    // make their shortages unpostable by anyone — while the bulk lane, which resolves
    // names straight off the same master, would keep reaching them.
    const result = searchBranches(BRANCHES, 'pharmacy')
    expect(result.hits.map((h) => h.row.storeId)).toEqual(['0901', '0902', '0900'])
    expect(result.total).toBe(3)
  })

  it('breaks a tie by store code, so a re-render cannot reshuffle the list', () => {
    const mine = searchBranches(BRANCHES, 'pharmacy').hits.filter((h) => h.row.isMine)
    expect(mine.map((h) => h.row.storeId)).toEqual(['0901', '0902'])
  })

  it('⚠️ leaves a row WITHOUT the two fields ranking exactly as before', () => {
    // The door still searches the fleet, whose rows carry neither — so the same
    // function must not reorder that screen or invent a rank it cannot reach.
    const fleetHits = searchBranches(SETTLEMENT_FLEET, 'Pharmacy')
    expect(fleetHits.hits.every((h) => h.rank !== MatchRank.CityContains)).toBe(true)
    expect(fleetHits.hits.map((h) => h.row.storeId)).toEqual(
      [...fleetHits.hits.map((h) => h.row.storeId)].sort(),
    )
  })
})
