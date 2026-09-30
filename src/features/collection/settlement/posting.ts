import { roundMoney } from '@/core/money'
import type {
  SettlementConsumableKind,
  SettlementEntry,
  SettlementEntryKind,
} from '@/core/models/settlement'
import { type BranchLike, MatchRank, searchBranches } from './search'

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
 * **The accountant's description, as the server will read it** (ticket 311,
 * BackOffice 1980) — trimmed, then measured.
 *
 * 🔑 **Required since spec 1976**: the description prints in the red box of the
 * branch's papers, and a blank box on a signed paper reads as a missing field. So a
 * description that is empty or only spaces is `blank`, and the 200 is measured
 * AFTER the trim — `SettlementAccountantService.PostAsync`'s own order, and the bulk
 * door's reading of a row. The trimmed text is what goes up, so the sentence an
 * accountant reviewed is the one the server stores.
 *
 * ⚠️ `too-long` is a backstop, not a path the box offers: `ReasonField` stops typing
 * at `REASON_MAX`, and a box that holds at most 200 cannot trim to more. It is
 * decided here anyway so the rule is whole in one place, and tested as such.
 */
export type DescriptionCheck = {
  /** What would be posted — the text, trimmed. */
  text: string
  problem: 'blank' | 'too-long' | null
}

export function checkDescription(raw: string | null | undefined): DescriptionCheck {
  const text = (raw ?? '').trim()
  if (!text) return { text, problem: 'blank' }
  if (text.length > REASON_MAX) return { text, problem: 'too-long' }
  return { text, problem: null }
}

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
 * 🚩 **…and `scope=all` was never the estate either, which is the finding this
 * module ended up producing.** The fleet's four UNION branches all drive off
 * `PosSettlementEntry` / `PosSettlementConsumption`; `Store` reaches in only as a
 * correlated name lookup. So *all* means **every branch with settlement activity** —
 * and on a migrated-but-unused database that is the empty set, so no branch could be
 * typed and the first entry could never be posted.
 *
 * ✅ **Settled by a door rather than a workaround:** `Settlement/Branches`
 * (BackOffice 1199) answers the open `Store` master, and the form resolves against
 * that. So this function's rows are now the ESTATE by construction — not a scope
 * that happens to be wide. What it must still never be handed is the fleet.
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
export type BranchResolution<T extends BranchLike = BranchLike> =
  | { kind: 'empty' }
  | { kind: 'one'; row: T }
  | { kind: 'many'; matches: T[]; total: number }
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
export function resolveBranch<T extends BranchLike>(
  rows: readonly T[] | null | undefined,
  query: string,
): BranchResolution<T> {
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
 *
 * ⚠️ **A consumable kind, never a theft** (ticket 339). A theft has no remaining to
 * run down — the wire's figure on one *means nothing* (BackOffice 2150) — so there is
 * no standing position of thefts to total, and the type refuses the question.
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
  kind: SettlementConsumableKind,
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

/* ── theft (ticket 339, BackOffice 2150, ADR 0049) ────────────────────────────── */

/** The three kinds, in the order the toggle draws them — the two a till consumes, then
 *  the one nothing does. */
export const POST_KINDS: readonly SettlementEntryKind[] = ['SHORTAGE', 'SURPLUS', 'THEFT']

/**
 * **The business day a theft names** — required for a theft, and not asked of the
 * other two kinds (the server ignores it on them, so it is not sent).
 *
 * 🔑 **A bare date, `yyyy-MM-dd`**, which is the contract's own instruction. Checked for
 * shape and for being a real day, because `2026-02-31` passes any pattern.
 *
 * ⚠️ **Whether the day is CLOSED is the server's to say, and nothing here guesses.** It
 * must be a closed business day of that branch; an open day, a future one and a day
 * the branch had no shift on are one refusal (`SettlementTheftDayNotClosed`), and this
 * module owns no clock to anticipate any of them.
 */
export type BusinessDayCheck = {
  /** What would be posted — `undefined` when the kind takes no day, or none is usable. */
  day: string | undefined
  problem: 'blank' | 'unreadable' | null
}

export function checkBusinessDay(
  kind: SettlementEntryKind,
  raw: string | null | undefined,
): BusinessDayCheck {
  if (kind !== 'THEFT') return { day: undefined, problem: null }

  const value = (raw ?? '').trim()
  if (!value) return { day: undefined, problem: 'blank' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { day: undefined, problem: 'unreadable' }
  // `T00:00:00Z` so the round-trip cannot be shifted a day by the reader's timezone —
  // `ledger.ts`'s `readDate` rule, for the same reason.
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return { day: undefined, problem: 'unreadable' }
  return { day: value, problem: null }
}

/** `POST Settlement/Post`'s body. */
export type PostRequest = {
  storeId: string
  entryKind: SettlementEntryKind
  amount: number
  reason: string
  /** A theft's day, `yyyy-MM-dd`. Absent on the other kinds. */
  businessDay?: string
}

/**
 * The body a post sends.
 *
 * 🚩 **The day goes up for a theft and for nothing else.** The form keeps whatever was
 * typed in the day box while the accountant toggles between kinds; this is the one
 * place that decides it is not part of a shortage or a surplus.
 */
export function postRequest(
  /** The form's state: the day box may hold anything, or nothing. */
  input: Omit<PostRequest, 'businessDay'> & { businessDay?: string | null },
): PostRequest {
  const { storeId, entryKind, amount, reason } = input
  const { day } = checkBusinessDay(entryKind, input.businessDay)
  return day === undefined
    ? { storeId, entryKind, amount, reason }
    : { storeId, entryKind, amount, reason, businessDay: day }
}

/** A theft posted with no day — a 400 on `Settlement/Post`. Matched, not displayed. */
export const THEFT_DAY_REQUIRED = 'SettlementTheftBusinessDayRequired'
/** The day is still open, or the branch has no shift on it (an unknown day, another
 *  branch's, a future one) — one code for all of them. */
export const THEFT_DAY_NOT_CLOSED = 'SettlementTheftDayNotClosed'

/** The description's two refusals (ticket 311, BackOffice 1980) — a blank one, and one
 *  over `REASON_MAX` after the trim. */
export const REASON_REQUIRED = 'SettlementReasonRequired'
export const REASON_TOO_LONG = 'SettlementReasonTooLong'

/**
 * Which field a refused post is about — so the server's sentence stands on the box
 * that can fix it rather than in a toast that has gone by the time it is read.
 *
 * `null` is everything else: the amount's and the store's refusals are not reachable
 * through this form's own guards, and they stay a toast.
 */
export function postRefusalField(code: string | null | undefined): 'businessDay' | 'reason' | null {
  switch (code) {
    case THEFT_DAY_REQUIRED:
    case THEFT_DAY_NOT_CLOSED:
      return 'businessDay'
    case REASON_REQUIRED:
    case REASON_TOO_LONG:
      return 'reason'
    default:
      return null
  }
}
