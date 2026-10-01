import { roundMoney } from '@/core/money'
import type {
  SettlementChangeRequest,
  SettlementChangeRequestKind,
  SettlementConsumption,
} from '@/core/models/settlement'
import { describeDocument, type AccountEntryRow, type JournalDocument } from './account-projection'
import { isStamped } from './approval'
import { cardFor, type CardChange } from './change-request'

/**
 * **The audit pane's read model** — one entry and its consumptions projected into
 * **one column of time** (ticket 272, spec 267 D6).
 *
 * Posting, consumption, void, repair and correction are rendered as *the same kind
 * of fact*, because to a reader answering *"what happened to entry 143?"* they are:
 * each is a thing somebody or something did, at a time, that moved a figure.
 *
 * ⚠️ **Nothing here reads or writes the authz audit table, and nothing may.**
 * `UaAdminAudit.Timestamp` is UTC; every timestamp on this contract is **local wall
 * clock** (the wire types say so on `SettlementEntry`). Mixing them would put a
 * three-hour lie beside a branch manager's own row in the same list — the one
 * defect a pane like this can have that nobody would spot by reading it. This
 * module borrows the authz pane's **layout** and none of its storage, which is why
 * it is a projection of two arrays this screen already holds rather than a query.
 *
 * 🚩 **The entry IS the audit.** There is no new storage, no new door and no
 * fetch: every fact below is already stamped with who and when on the two arrays
 * `Settlement/Account` returned — and, since ticket 350, on the `requests[]` of the
 * change-request History read the panel already holds (spec 342 W11). The caller
 * hands them in; this module still fetches nothing.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock. Times are passed through
 * verbatim — no parsing, no conversion, no `Date` — because the only correct thing
 * to do with a local wall clock from another timezone's branch is show it.
 */

/**
 * 🔑 **"From where"** — and the three answers are deliberately different shapes.
 *
 * - A **consumption** answers with the **store code**. *Which branch spent this* is
 *   a real audit question, the consumption knows its own store, and on an entry
 *   posted centrally the answering branch is the fact worth having.
 * - A **posting** answers with the **poster's name**, denormalised at post time so
 *   a later rename cannot rewrite history.
 * - A **closure** answers with a **staff id and no name**: D8's entry carries
 *   `postedByName` and only `closedByStaffId`. 🚩 That asymmetry is transcribed
 *   rather than papered over — inventing a name here would be a field this screen
 *   assumes rather than reads. Logged in `.afk/HITL-272.md` for 274.
 *
 * ⚠️ There is **no address, no IP and no `PostedFrom`**, and none is owed. A
 * browser IP on an internal app names a desk, not a person, and the person is
 * already on the row.
 */
export type AuditWhere =
  | { kind: 'person'; name: string }
  | { kind: 'store'; storeId: string }
  | { kind: 'staff'; staffId: string }

/**
 * What kind of fact a row is.
 *
 * `approved` / `rejected` are an accountant supervisor's decision on a pending
 * surplus (ticket 309) — the supervisor named by staff id, as a closer is.
 *
 * `restored` covers both a **void** and a **repair**: 🚩 on D8's contract they are
 * the same row — a `REVERSE` consumption — and this screen has no field that tells
 * them apart. Rendering them as one honest fact (*money went back onto the entry*)
 * beats guessing which act produced it, and the document beside the row is what
 * distinguishes them to a reader: a void names the receipt it undoes, a repaired
 * orphan has no document to name. Logged for 274.
 */
export type AuditFactKind =
  | 'posted'
  | 'approved'
  | 'rejected'
  | 'consumed'
  | 'restored'
  | 'cancelled'
  | 'written-off'
  // 350: a change request's steps (spec 342 W11). Raised, then one decision — or, for a
  // supervisor's own, the one applied fact. A request is withdrawn, rejected or
  // superseded, never "cancelled" (W13): only the ENTRY is cancelled.
  | 'requested'
  | 'request-applied'
  | 'request-rejected'
  | 'request-withdrawn'
  | 'request-superseded'

/**
 * What a change-request fact says about its request (350) — `null` on every fact of
 * the entry's own.
 */
export type AuditRequest = {
  kind: SettlementChangeRequestKind
  /** Old → new, only the fields that differ (`cardFor`'s reading, so the card and the
   *  column cannot disagree about what was asked). Filled on the raise and on the
   *  application — the two facts where a figure is asked for or moves — and empty on a
   *  rejection, a withdrawal or a supersede, which move nothing. */
  changes: CardChange[]
  /** A supervisor's own request: raised and applied at once (`decidedAt == requestedAt`,
   *  BackOffice 2194), told as ONE applied fact. */
  own: boolean
}

/** One fact in the column. Every figure on it is one the server wrote. */
export type AuditFact = {
  /** Stable across re-renders and unique within one entry — the row's own wire id,
   *  prefixed so a consumption and the entry itself can never collide. */
  id: string
  /** **Local wall clock, verbatim.** See the module docblock. */
  at: string
  kind: AuditFactKind
  /** The figure this fact moved, or `null` where the fact moved nothing. */
  amount: number | null
  /** What the entry had left **after** this fact, where the server said so —
   *  `remainingAfter` on a consumption, and nothing anywhere else. 🚩 Never a
   *  subtraction this screen performs. */
  remainingAfter: number | null
  where: AuditWhere
  /** Server text, passed through unlocalised: the posting's reason, the closure's.
   *  `''` where the fact carries none. */
  note: string
  /** The document behind a consumption, as the journal already describes it —
   *  reused rather than re-derived, so the two panes cannot disagree about what an
   *  undocumented row means. `null` on a fact that is not a consumption. */
  document: JournalDocument | null
  /** The change request behind the fact (350), `null` on the entry's own facts. */
  request: AuditRequest | null
}

/**
 * The entry's own two facts: it was posted, and — if it is closed by a human — it
 * was corrected.
 *
 * ⚠️ `CONSUMED` produces **no closing fact**, deliberately: the last consumption
 * already *is* that fact, and a synthetic *"closed"* row beside it would be the
 * same event told twice with two different times.
 */
function entryFacts(entry: AccountEntryRow, posted: PostedFigures | null): AuditFact[] {
  const facts: AuditFact[] = [
    {
      id: `entry:${entry.settlementEntryId}:posted`,
      at: entry.postedAt,
      kind: 'posted',
      // 350: the figures it was POSTED at — once a change request has moved them, the
      // entry's own fields say what it is now, and a "Posted 320" above "350 → 320"
      // would contradict the column it heads.
      amount: posted?.amount ?? entry.amount,
      remainingAfter: null,
      where: { kind: 'person', name: entry.postedByName },
      note: posted?.description ?? entry.reason,
      document: null,
      request: null,
    },
  ]

  // 🔑 Ticket 309: the supervisor's decision, when there was one. ⚠️ Read off the
  // STAMP (`isStamped`), not off the status — an approved entry is `OPEN` like any
  // other, and a year-1 default would otherwise sort a fact nobody made before the
  // posting. A supervisor's own large surplus is approved by its poster at `postedAt`,
  // and says so: that is the record of it never having waited.
  if (entry.approvedByStaffId && isStamped(entry.approvedAt))
    facts.push({
      // `reviewed` sorts after `posted` — the tie-break for a decision stamped in the
      // same minute as the post it decided.
      id: `entry:${entry.settlementEntryId}:reviewed`,
      at: entry.approvedAt,
      kind: 'approved',
      amount: null,
      remainingAfter: null,
      where: { kind: 'staff', staffId: entry.approvedByStaffId },
      note: '',
      document: null,
      request: null,
    })
  if (entry.status === 'REJECTED' && isStamped(entry.rejectedAt))
    facts.push({
      id: `entry:${entry.settlementEntryId}:reviewed`,
      at: entry.rejectedAt,
      kind: 'rejected',
      amount: null,
      remainingAfter: null,
      where: { kind: 'staff', staffId: entry.rejectedByStaffId },
      // The reason the accountant reads before posting a corrected entry — server
      // text, passed through unlocalised.
      note: entry.rejectedReason,
      document: null,
      request: null,
    })

  const closed = entry.status === 'CANCELLED' || entry.status === 'CLOSED_OUT'
  // ⚠️ A closed entry with no `closedAt` gets no row rather than a row at the top
  // of time: an empty timestamp sorts before every real one, so a missing stamp
  // would silently claim the correction happened before the posting.
  if (closed && entry.closedAt)
    facts.push({
      id: `entry:${entry.settlementEntryId}:closed`,
      at: entry.closedAt,
      kind: entry.status === 'CANCELLED' ? 'cancelled' : 'written-off',
      // 🚩 **A cancel forgives nothing, so it states no figure**; a write-off's
      // figure is `writtenOff` — the journal's own last `remainingAfter`, which
      // `projectAccount` already read back off the server (269). It is not
      // recomputed here, and it is emphatically not `amount − remaining`: this
      // feature performs no subtractions, and the one place that rule could quietly
      // break is a second module deriving the same number a second way.
      amount: entry.status === 'CLOSED_OUT' ? entry.writtenOff : null,
      remainingAfter: null,
      where: { kind: 'staff', staffId: entry.closedByStaffId },
      note: entry.closedReason,
      document: null,
      request: null,
    })

  return facts
}

function consumptionFact(c: SettlementConsumption): AuditFact {
  return {
    id: `consumption:${c.settlementConsumptionId}`,
    at: c.consumedAt,
    // 🔑 269's rule 2, read off the same condition and never re-tested loosely: a
    // `REVERSE` restores money to the entry, and a pane that drew it as another
    // spend would invert the branch's position in its own history.
    kind: c.consumptionKind === 'REVERSE' ? 'restored' : 'consumed',
    amount: c.amount,
    remainingAfter: c.remainingAfter,
    where: { kind: 'store', storeId: c.storeId },
    note: '',
    document: describeDocument(c),
    request: null,
  }
}

/**
 * The whole column, **oldest first**.
 *
 * ⚠️ Forward in time, matching the journal exactly (269 chose that direction for
 * this reason in as many words): the two panes sit on one screen over one entry,
 * and two panes disagreeing about the direction of time is a defect rather than a
 * preference.
 *
 * 🚩 **Totally ordered**, tie-broken by the fact's own id. A posting and a
 * consumption can share a minute-precision stamp, and an unstable comparator would
 * let a re-render reshuffle a branch's history under the reader — on the one pane
 * whose entire claim is *this is the order it happened in*.
 *
 * 🚩 **It takes the projected ROW, not an entry and a journal separately** — so the
 * two panes on this screen cannot be handed different journals, and the write-off's
 * figure is the one `projectAccount` already read back rather than a second
 * derivation of it.
 *
 * 🔑 **350: `requests` is the History read's `requests[]`**, merged by the same clock
 * and the same comparator — a request is one more thing somebody did to the entry.
 * Absent (History 404s, or has not landed) the column is exactly what it was before.
 * The `request:` id prefix sorts after `entry:`, so a supersede stamped with the very
 * act that closed the entry reads after that act.
 */
export function auditColumn(
  row: AccountEntryRow | null | undefined,
  requests?: readonly SettlementChangeRequest[] | null,
): AuditFact[] {
  if (!row) return []
  const mine = requestsOf(requests, row.settlementEntryId)

  return [
    ...entryFacts(row, postedFigures(mine)),
    ...(row.journal ?? []).map((r) => consumptionFact(r.consumption)),
    ...mine.flatMap(requestFacts),
  ].sort(
    (a, b) =>
      (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) ||
      rank(a) - rank(b) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/**
 * The tie-break within one stamp, before the ids. An APPLIED request is the cause of
 * what the entry then shows (an approved delete IS the cancel), so it reads before the
 * entry's own fact of the same second. Everything else keeps the id order: `request:`
 * after `entry:`, so a supersede reads after the direct act that ended it.
 *
 * ⚠️ Stamps are to the second: a raise and a till's consumption in the same second are
 * told in this fixed order, not in an order this screen cannot know.
 */
const rank = (f: AuditFact): number => (f.kind === 'request-applied' ? 0 : 1)

/** ⚠️ The read is keyed per entry; a row about another entry is never drawn or counted here. */
const requestsOf = (
  requests: readonly SettlementChangeRequest[] | null | undefined,
  settlementEntryId: string,
): SettlementChangeRequest[] => (requests ?? []).filter((r) => r.settlementEntryId === settlementEntryId)

/** Applied CHANGE requests, newest first — by `decidedAt`, then the ULID; never History's listing order. */
const appliedChanges = (requests: readonly SettlementChangeRequest[]): SettlementChangeRequest[] =>
  requests
    .filter((r) => r.status === 'APPLIED' && r.requestKind === 'CHANGE' && isStamped(r.decidedAt))
    .sort(
      (a, b) =>
        (a.decidedAt < b.decidedAt ? 1 : a.decidedAt > b.decidedAt ? -1 : 0) ||
        (a.changeRequestId < b.changeRequestId ? 1 : a.changeRequestId > b.changeRequestId ? -1 : 0),
    )

type PostedFigures = { amount: number; description: string }

/**
 * What the entry was **posted at**, once a change request has moved it — the `old…`
 * figures of the EARLIEST applied change, which are the server's record of the entry
 * when that request was raised. Nothing but an applied change moves an amount or a
 * Description, so before the first one the entry stood as posted. `null` when nothing
 * was applied: the entry's own fields are then its posted figures.
 */
function postedFigures(requests: readonly SettlementChangeRequest[]): PostedFigures | null {
  const first = appliedChanges(requests).at(-1)
  return first ? { amount: first.oldAmount, description: first.oldDescription } : null
}

/** The decision a request's status names — `null` while it waits. */
const DECIDED: Record<SettlementChangeRequest['status'], AuditFactKind | null> = {
  OPEN: null,
  APPLIED: 'request-applied',
  REJECTED: 'request-rejected',
  WITHDRAWN: 'request-withdrawn',
  SUPERSEDED: 'request-superseded',
}

/**
 * One request's facts (350): its raise, and its decision once there is one.
 *
 * - **Who:** the name recorded THEN (`requestedByName` on the raise, `decidedByName` on
 *   the decision — BackOffice 2194's per-status table), never re-resolved. A blank name
 *   falls back to the staff id, as the entry's own closer is named.
 * - **Why:** the raise carries the request's Reason; a rejection carries the rejection's.
 *   An application, a withdrawal or a supersede adds none — the raise above it says why.
 * - 🔑 **A supervisor's own request** (`APPLIED` with `decidedAt == requestedAt`) is ONE
 *   applied fact, with the request's Reason: it never waited, and a raise beside an
 *   approval stamped the same second would claim it had.
 * - ⚠️ An unstamped time gets no fact, as the entry's own closure does not.
 */
function requestFacts(r: SettlementChangeRequest): AuditFact[] {
  const asked = cardFor(r).changes
  const decided = DECIDED[r.status] ?? null
  // Both halves of 2194's record of it: the same person, the same stamp.
  const own =
    r.status === 'APPLIED' &&
    isStamped(r.decidedAt) &&
    r.decidedAt === r.requestedAt &&
    r.decidedByStaffId === r.requestedByStaffId
  const fact = (
    step: 'asked' | 'decided',
    at: string,
    kind: AuditFactKind,
    who: { name: string; staffId: string },
    note: string,
    changes: CardChange[],
  ): AuditFact => ({
    // `asked` sorts before `decided` — the tie-break for a decision in the raise's second.
    id: `request:${r.changeRequestId}:${step}`,
    at,
    kind,
    amount: null,
    remainingAfter: null,
    where: who.name ? { kind: 'person', name: who.name } : { kind: 'staff', staffId: who.staffId },
    note,
    document: null,
    request: { kind: r.requestKind, changes, own },
  })
  const requester = { name: r.requestedByName, staffId: r.requestedByStaffId }
  const decider = { name: r.decidedByName, staffId: r.decidedByStaffId }

  if (own) return [fact('decided', r.decidedAt, 'request-applied', decider, r.requestReason, asked)]

  const facts: AuditFact[] = []
  if (isStamped(r.requestedAt)) facts.push(fact('asked', r.requestedAt, 'requested', requester, r.requestReason, asked))
  if (decided && isStamped(r.decidedAt))
    facts.push(
      fact(
        'decided',
        r.decidedAt,
        decided,
        decider,
        decided === 'request-rejected' ? r.decisionReason : '',
        decided === 'request-applied' ? asked : [],
      ),
    )
  return facts
}

/* ── the "Changed" tag (350) ─────────────────────────────────────────────────── */

/**
 * The entry panel's **"Changed"** tag: when, and what the amount was before.
 * `earlierAmount` is `null` when no applied change moved the amount (a Description or a
 * theft's day) — the till's *"amount not changed"*.
 */
export type ChangedTag = { at: string; earlierAmount: number | null }

/**
 * **The till's rule, read off History** (BackOffice 2197, spec 342 W11) — so the web
 * and the branch's till say the same thing about the same entry.
 *
 * - Only an **`APPLIED` change** tags. An applied DELETE is not *"Changed"* — the entry
 *   is cancelled, and the column says so. A request still waiting, or rejected,
 *   withdrawn or superseded, tags nothing.
 * - **The date** is the latest applied change's `decidedAt`.
 * - **The earlier amount** is the `oldAmount` of the latest applied change that MOVED
 *   the amount — so 350 → 300 followed by a Description-only change still says 350, at
 *   the later date. The two can come from different changes (2197's `/code-review`).
 * - *Latest* is decided here, by `decidedAt` and then the ULID — never by History's
 *   listing order. *Moved* is read at the scale money is held at (`roundMoney`).
 * - ⚠️ A change applied while the entry was still pending is tagged, as the till's half
 *   literally reads (owner's ruling pending in BackOffice) — web and till agree.
 *
 * 🚩 Pure. `null` when there is no tag.
 */
export function changedTag(
  requests: readonly SettlementChangeRequest[] | null | undefined,
  settlementEntryId: string,
): ChangedTag | null {
  // The same entry filter as the column under it — header and column read one History.
  const applied = appliedChanges(requestsOf(requests, settlementEntryId))
  if (applied.length === 0) return null
  const moved = applied.find((r) => roundMoney(r.oldAmount) !== roundMoney(r.newAmount))
  return { at: applied[0].decidedAt, earlierAmount: moved ? moved.oldAmount : null }
}
