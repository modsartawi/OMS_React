import type { SettlementFleetRow } from '@/core/models/settlement'
import { isInScope, type ScopeResolution } from './scope'

/**
 * The door's search — **one box resolving four things** (ticket 270, spec 267 D2):
 * branch code, branch name in **either script**, city, or an entry number.
 *
 * 🔑 **Nobody browses 1394 branches.** An accountant arrives with a *branch* in
 * mind (a phone call quoting an entry number) or with *work* in mind, never with a
 * list in mind — so this module ranks, and the screen renders the top of the
 * ranking rather than a scrollable estate.
 *
 * 🔑 **The scope ranks; it never refuses.** An out-of-scope branch is still a hit,
 * ranked below the in-scope ones. A search that hid a branch because it was
 * somebody else's would have turned a convenience into a permission, which D2
 * forbids in as many words.
 *
 * 🚩 Pure: no React, no `t()`, no network. The words, and the navigation, are the
 * component's.
 */

/** How many hits the door draws. Enough that a city with a dozen branches is
 *  readable, few enough that the answer to a one-letter query is not the estate
 *  again — the count of everything that matched is reported beside them. */
export const SEARCH_HIT_LIMIT = 20

/**
 * An entry number, or `null` when the query is not one.
 *
 * ⚠️ **A leading zero is a store code, not an entry number**, and that single rule
 * is what keeps `0142` (a branch) apart from `142` (an entry) in a box that takes
 * both. Store codes are zero-padded four-digit strings; `SettlementEntry.
 * entryNumber` is an unpadded `int`. A query that is all digits with no leading
 * zero is looked up as an entry **as well as** ranked as a branch code — the two
 * answers are shown together and the reader picks, because a box that guessed
 * would be wrong on whichever of the two the accountant meant.
 */
export function parseEntryNumber(query: string | null | undefined): number | null {
  const q = (query ?? '').trim()
  if (!/^[1-9]\d{0,8}$/.test(q)) return null
  return Number(q)
}

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
  CityPrefix: 4,
  CityContains: 5,
} as const

export type MatchRank = (typeof MatchRank)[keyof typeof MatchRank]

export type BranchHit = {
  row: SettlementFleetRow
  rank: MatchRank
  /** 🔑 Drawn as a quiet marker, never as a filter — see the module docblock. */
  inScope: boolean
}

export type BranchSearchResult = {
  hits: BranchHit[]
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

function rankOf(row: SettlementFleetRow, needle: string): MatchRank | null {
  const code = fold(row.storeId)
  if (code === needle) return MatchRank.CodeExact
  if (code.startsWith(needle)) return MatchRank.CodePrefix

  const name = fold(row.storeName)
  if (name.startsWith(needle)) return MatchRank.NamePrefix
  if (name.includes(needle)) return MatchRank.NameContains

  const city = fold(row.city)
  if (city.startsWith(needle)) return MatchRank.CityPrefix
  if (city.includes(needle)) return MatchRank.CityContains

  return null
}

/**
 * The ranked branches for one query.
 *
 * An empty query returns **nothing at all** rather than the estate: the door's
 * whole argument is that a list of 1394 branches is not a way of finding anything,
 * and the worklist is what fills the screen until something is typed.
 *
 * Ordering: match quality first, then **in-scope before out-of-scope**, then the
 * store code — total, so a re-render cannot reshuffle the list under a cursor.
 */
export function searchBranches(
  rows: readonly SettlementFleetRow[] | null | undefined,
  query: string,
  resolution: ScopeResolution,
  limit: number = SEARCH_HIT_LIMIT,
): BranchSearchResult {
  const needle = fold(query)
  if (!needle) return { hits: [], total: 0 }

  const hits: BranchHit[] = []
  for (const row of rows ?? []) {
    const rank = rankOf(row, needle)
    if (rank === null) continue
    hits.push({ row, rank, inScope: isInScope(row, resolution) })
  }

  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.inScope) - Number(a.inScope) ||
      (a.row.storeId < b.row.storeId ? -1 : a.row.storeId > b.row.storeId ? 1 : 0),
  )

  return { hits: hits.slice(0, Math.max(0, limit)), total: hits.length }
}

/**
 * What pressing Enter means — **the one place the box's ambiguity is resolved**.
 *
 * 🔑 **An exact branch code wins over an entry number, and it has to.** Store codes
 * are four digits and entry numbers are unpadded ints, so `1001` is legitimately
 * both — a real branch code in this estate *and* a real entry number. Ranking them
 * the other way round would take an accountant who typed their own branch's code to
 * a different branch's account, which is the worst outcome this box can produce:
 * plausible, silent, and about money. (`parseEntryNumber`'s leading-zero rule
 * already separates `0142` from `142`; this separates `1001` from `1001`, which no
 * rule about the string itself could.)
 *
 * The order, and why:
 *
 * 1. **an exact code** → that branch. The accountant typed an address.
 * 2. **a bare number** → look it up as an entry. *"Entry 143, whichever branch it is
 *    on"* is the phone call this box exists for.
 * 3. **exactly one branch matched** → that branch, so Enter is never a dead key.
 * 4. otherwise → leave the ranked list on screen; the reader picks.
 */
export type SubmitIntent =
  | { kind: 'branch'; storeId: string }
  | { kind: 'entry'; entryNumber: number }
  | { kind: 'ranked' }

export function resolveSubmit(
  rows: readonly SettlementFleetRow[] | null | undefined,
  query: string,
  resolution: ScopeResolution,
): SubmitIntent {
  const result = searchBranches(rows, query, resolution, 2)
  const exact = result.hits.find((h) => h.rank === MatchRank.CodeExact)
  if (exact) return { kind: 'branch', storeId: exact.row.storeId }

  const entryNumber = parseEntryNumber(query)
  if (entryNumber !== null) return { kind: 'entry', entryNumber }

  if (result.total === 1) return { kind: 'branch', storeId: result.hits[0].row.storeId }
  return { kind: 'ranked' }
}
