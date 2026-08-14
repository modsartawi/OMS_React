/**
 * 🔑 **What this module needs of a row, and nothing more.** Two shapes are ranked
 * through it now — the door's `SettlementFleetRow` and the posting form's
 * `SettlementBranch` (274 / BackOffice 1199) — and they are not the same payload:
 * one aggregates branches with settlement activity, the other is the open estate off
 * the `Store` master. Two copies of this function is how a branch findable at the
 * door becomes unpostable at the form, silently, because *"no such branch"* is an
 * answer both give legitimately.
 *
 * Generic rather than a union, so `hits[].row` keeps the caller's own row type and
 * the component rendering a hit still sees every field it has.
 */
export type BranchLike = {
  storeId: string
  storeName: string
  /** Only the branch master carries one — see `MatchRank.CityContains`. */
  city?: string
  /** Only the branch master carries one — see `searchBranches`'s ordering. */
  isMine?: boolean
}

/**
 * The door's search — one box over **branch code and branch name in either
 * script** (ticket 270, spec 267 D2).
 *
 * ⚠️ **D2 asked for four keys and 274 could only deliver two.** The other two are
 * recorded in `.afk/FINDINGS-274.md` rather than faked:
 *
 * - **city** (§B5) — not on the live fleet row. BackOffice spec 1173 D13's row
 *   never carried one; 270 added it to D8 and it was never built.
 * - **entry number** (§B1) — needs a cross-estate lookup, and `Settlement/Ledger`
 *   does not exist. `Settlement/Account` cannot serve it: it requires the
 *   `storeId`, which is exactly what a caller quoting *"entry 143"* does not have.
 *
 * 🚩 The second is the one that hurts, because 1173 mints `EntryNumber` and calls it
 * *the handle finance and the branch settle by on the phone*. A box that silently
 * returned nothing for one would be worse than a box that never offered it, so the
 * screen's own placeholder names what it searches.
 *
 * 🔑 **Nobody browses 1394 branches.** An accountant arrives with a *branch* in
 * mind (a phone call quoting an entry number) or with *work* in mind, never with a
 * list in mind — so this module ranks, and the screen renders the top of the
 * ranking rather than a scrollable estate.
 *
 * 🔑 **The scope never refuses a hit — and now it cannot.** 270 ranked in-scope
 * branches above out-of-scope ones, reading `assignment` off each row. That field is
 * not on the live wire (§B4), so the ranking is gone; what remains is the property
 * it protected, which the server now enforces by construction — the search runs over
 * whatever the fleet door returned, and a branch outside the scope is still findable
 * the moment the control is widened. The scope was never a permission and still is
 * not one.
 *
 * 🚩 Pure: no React, no `t()`, no network. The words, and the navigation, are the
 * component's.
 */

/** How many hits the door draws. Enough that a city with a dozen branches is
 *  readable, few enough that the answer to a one-letter query is not the estate
 *  again — the count of everything that matched is reported beside them. */
export const SEARCH_HIT_LIMIT = 20

/**
 * Why a branch matched, worst rank last. Exported for the tests and for the
 * component, which never renders it — it is an ordering, not a label.
 *
 * A frozen object rather than a TypeScript `enum`: the repo compiles with
 * `isolatedModules`, under which a `const enum` cannot be inlined across files and
 * a plain `enum` emits runtime code into a module whose whole claim is that it is
 * pure data.
 */
export const MatchRank = {
  CodeExact: 0,
  CodePrefix: 1,
  NamePrefix: 2,
  NameContains: 3,
  /**
   * 🔑 **D2's third key, restored by 274** — and ranked last, because a city matches
   * a hundred branches where a name matches a handful. A row with no `city` (the
   * fleet row has never carried one) can never reach this rank, so the door's search
   * behaves exactly as before and only the posting form gains the key.
   */
  CityContains: 4,
} as const

export type MatchRank = (typeof MatchRank)[keyof typeof MatchRank]

export type BranchHit<T extends BranchLike = BranchLike> = {
  row: T
  rank: MatchRank
}

export type BranchSearchResult<T extends BranchLike = BranchLike> = {
  hits: BranchHit<T>[]
  /** Everything that matched, before the display cap — so *"20 of 63"* is sayable. */
  total: number
}

/**
 * ⚠️ **`toLowerCase()` and nothing cleverer.** Arabic is caseless, so a name in
 * Arabic is unaffected and matches literally; the English half of a
 * `"صيدلية الروضة / Al-Rawdah Pharmacy"` name matches case-insensitively. No
 * transliteration and no diacritic folding is attempted: both would be a language
 * rule invented on a screen, and a wrong fold is a branch that cannot be found by
 * its own name.
 */
const fold = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase()

function rankOf(row: BranchLike, needle: string): MatchRank | null {
  const code = fold(row.storeId)
  if (code === needle) return MatchRank.CodeExact
  if (code.startsWith(needle)) return MatchRank.CodePrefix

  const name = fold(row.storeName)
  if (name.startsWith(needle)) return MatchRank.NamePrefix
  if (name.includes(needle)) return MatchRank.NameContains

  // ⚠️ `includes` and not `startsWith`: a city is typed to narrow a search, never to
  // address one branch.
  if (fold(row.city).includes(needle)) return MatchRank.CityContains

  return null
}

/**
 * The ranked branches for one query.
 *
 * An empty query returns **nothing at all** rather than the estate: the door's
 * whole argument is that a list of 1394 branches is not a way of finding anything,
 * and the worklist is what fills the screen until something is typed.
 *
 * Ordering: match quality first, then the store code — total, so a re-render cannot
 * reshuffle the list under a cursor.
 */
export function searchBranches<T extends BranchLike>(
  rows: readonly T[] | null | undefined,
  query: string,
  limit: number = SEARCH_HIT_LIMIT,
): BranchSearchResult<T> {
  const needle = fold(query)
  if (!needle) return { hits: [], total: 0 }

  const hits: BranchHit<T>[] = []
  for (const row of rows ?? []) {
    const rank = rankOf(row, needle)
    if (rank === null) continue
    hits.push({ row, rank })
  }

  // 🔑 **Match quality first, then WHOSE branch it is, then the code.** The pairing
  // master ranks this list and never filters it (274): an accountant's own branches
  // surface first, and everybody else's stay one keystroke away rather than one
  // permission away. ⚠️ `isMine` is the SERVER's reading of *mine* — own branches ∪
  // one-level reports' — so this ordering and the front page's scope agree about
  // whose money it is. Rows without the field (the fleet's) rank flat, as before.
  //
  // The code breaks every remaining tie, so the order is total and a re-render
  // cannot reshuffle the list under a cursor.
  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.row.isMine ?? false) - Number(a.row.isMine ?? false) ||
      (a.row.storeId < b.row.storeId ? -1 : a.row.storeId > b.row.storeId ? 1 : 0),
  )

  return { hits: hits.slice(0, Math.max(0, limit)), total: hits.length }
}

/**
 * What pressing Enter means.
 *
 * ⚠️ **274 removed a third meaning: an entry number.** 270's box resolved *"entry
 * 143, whichever branch it is on"* through the cross-estate ledger, and that door
 * does not exist (§B1). The rule that made the ambiguity safe is worth keeping in
 * the record, because it comes straight back the day the door lands: store codes are
 * zero-padded four-digit strings and `entryNumber` is an unpadded `int`, so `0142`
 * is unambiguously a branch — but **`1001` is legitimately both**, a real branch code
 * in this estate *and* a real entry number. An exact code therefore had to win, or an
 * accountant typing their own branch's code would land on a different branch's
 * account: plausible, silent, and about money.
 *
 * What is left:
 *
 * 1. **an exact code** → that branch. The accountant typed an address.
 * 2. **exactly one branch matched** → that branch, so Enter is never a dead key.
 * 3. otherwise → leave the ranked list on screen; the reader picks.
 */
export type SubmitIntent = { kind: 'branch'; storeId: string } | { kind: 'ranked' }

export function resolveSubmit(
  rows: readonly BranchLike[] | null | undefined,
  query: string,
): SubmitIntent {
  const result = searchBranches(rows, query, 2)
  const exact = result.hits.find((h) => h.rank === MatchRank.CodeExact)
  if (exact) return { kind: 'branch', storeId: exact.row.storeId }

  if (result.total === 1) return { kind: 'branch', storeId: result.hits[0].row.storeId }
  return { kind: 'ranked' }
}
