import { roundMoney } from '@/core/money'
import type {
  SettlementEntry,
  SettlementEntryKind,
  SettlementFleetRow,
} from '@/core/models/settlement'
import { MatchRank, searchBranches } from './search'

/**
 * **The posting form's rules** — the two guards ticket 271 requires, as pure
 * functions (spec 267 D4).
 *
 * The form itself is one component; everything it *decides* is decided here, because
 * both decisions are the silent-regression kind the spec's Testing Decisions section
 * points at: whether a typed branch has resolved to **exactly one** match, and what
 * the branch is already carrying of the kind about to be posted.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock.
 */

/** How many near-misses an ambiguous query shows. Enough to pick from by eye,
 *  few enough that the answer to `a` is not the estate — the count says the rest. */
export const AMBIGUOUS_PREVIEW = 6

/**
 * What any reason on this screen may carry — spec 267 D4's 200, for the posted
 * entry's reason and the repair's alike.
 *
 * 🚩 It lives here rather than beside each `<textarea>` because *"an accountant
 * never learns two limits for two boxes on one screen"* was an invariant asserted in
 * two comments and enforced in neither: two constants that must agree are two
 * constants that will eventually disagree, silently, in a box that truncates.
 */
export const REASON_MAX = 200

/**
 * 🔑 **THE POSTING BOX IS NEVER SCOPED — and after ticket 274 that is the CALLER's
 * job to guarantee, not this module's.**
 *
 * 270 enforced it here, with a hardcoded `ScopeResolution` of *all* handed to
 * `searchBranches`, because the scope was a client-side ranking over one estate-wide
 * answer. 274 moved the scope onto the wire (`Settlement/Fleet?scope=…`), which
 * silently moved this rule too: **the rows this function is given are now whatever
 * the door returned**, and under `scope=mine` that is a subset of the estate.
 *
 * ⚠️ So the guarantee is now structural and lives one layer up: `PostEntryDialog`
 * resolves branches against an **estate-wide** fleet query of its own
 * (`settlementApi.fleet('all')`), never the door's scoped one. If it ever passes the
 * scoped rows in, this function will happily answer *"no such branch"* for a real
 * branch — and the failure is invisible, because *"no such branch"* is a legitimate
 * answer it already gives.
 *
 * The reason has not changed: an accountant covering a colleague, or posting a
 * month's audit onto the 1255 branches assigned to nobody, must not find the branch
 * they typed missing or ranked below one they did not mean. **The worst outcome this
 * screen can produce is the right amount on the wrong branch.**
 */

/**
 * What a typed branch resolved to.
 *
 * ⚠️ **Only `one` may be posted against** — spec 267 D4 and user story 15: *"the
 * branch typed and resolved to exactly one match before I can post, so that a
 * thousand-option dropdown never picks the wrong branch for me"*. `many` is not a
 * near-miss to be broken by ranking; it is the form refusing to guess.
 */
export type BranchResolution =
  | { kind: 'empty' }
  | { kind: 'one'; row: SettlementFleetRow }
  | { kind: 'many'; matches: SettlementFleetRow[]; total: number }
  | { kind: 'none' }

/**
 * The typed branch, resolved — **code or name in either script**, the same keys the
 * door's own box takes, through the same ranking module so a branch findable at the
 * door is postable here. (274 removed city from both, together: §B5.)
 *
 * 🔑 **An exact code collapses an otherwise ambiguous query, and it has to.** `0142`
 * is a prefix of nothing in a four-digit estate, but a *name* fragment routinely
 * matches a dozen branches — and an accountant who typed a full branch code has
 * given an address, not a search. Ranking is `search.ts`'s; the exactness rule is
 * this module's, because *"resolved to exactly one match"* is a posting constraint
 * and not a way of ordering a list.
 */
export function resolveBranch(
  rows: readonly SettlementFleetRow[] | null | undefined,
  query: string,
): BranchResolution {
  if (!query.trim()) return { kind: 'empty' }

  const result = searchBranches(rows, query, AMBIGUOUS_PREVIEW)
  if (result.total === 0) return { kind: 'none' }

  // Read off the hit's own rank rather than re-folding the string here, so there is
  // one definition of *"this is that branch's code"* — `search.ts`'s.
  const exact = result.hits.find((h) => h.rank === MatchRank.CodeExact)
  if (exact) return { kind: 'one', row: exact.row }

  if (result.total === 1) return { kind: 'one', row: result.hits[0].row }
  return { kind: 'many', matches: result.hits.map((h) => h.row), total: result.total }
}

/**
 * The typed amount as a number, or `null` when it is not one.
 *
 * ⚠️ **Zero is not an amount and neither is a negative.** `amount` is a positive
 * magnitude on this contract — `entryKind` carries the direction (see the wire
 * types) — so a `-500` typed into a shortage is not *"a surplus, surely"*, it is a
 * figure the form must refuse rather than reinterpret.
 *
 * The grouping separator is accepted because an accountant transcribing `50,000`
 * off a spreadsheet types what they read. Nothing else is: a stray letter is a
 * refusal, not a number with a letter in it.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  const text = (raw ?? '').trim().replace(/,/g, '')
  if (!/^\d*\.?\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * What the branch is **already carrying of the same kind** — 🔑 the second of the
 * ticket's two required guards.
 *
 * A monthly audit reposting the same shortage onto a branch that already carries one
 * is **permitted by design** (the server has no duplicate predicate and must not
 * grow one — a genuine second shortage months later is a real entry). So this screen
 * is the only place the duplicate can be caught at all, which is why it *names each
 * existing entry and its remaining* rather than showing a total: *"this branch
 * already owes 500.00"* is a fact an accountant can reconcile against their sheet;
 * *"1 open entry"* is not.
 *
 * 🚩 **It warns and never refuses** (D4, the ticket's own words). Nothing here
 * returns a flag a caller could disable a button with.
 *
 * Only the **same kind** counts: a shortage and a surplus never cancel each other
 * out (the account headline says so out loud), and a branch legitimately holds one
 * of each — the fixture's 0142 does.
 */
export type StandingPosition = {
  /** The open entries of that kind, **oldest first** — the order a reconciliation
   *  reads in, and the one the audit pane (272) will use. */
  entries: SettlementEntry[]
  /** Their remaining, summed at the scale money is held at. Displayed beside the
   *  named entries, never instead of them. */
  total: number
}

export function standingPosition(
  entries: readonly SettlementEntry[] | null | undefined,
  kind: SettlementEntryKind,
): StandingPosition {
  const open = (entries ?? [])
    .filter((e) => e.status === 'OPEN' && e.entryKind === kind)
    .sort(
      (a, b) =>
        (a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0) ||
        a.entryNumber - b.entryNumber,
    )

  return {
    entries: open,
    total: roundMoney(open.reduce((sum, e) => sum + e.remainingAmount, 0)),
  }
}
