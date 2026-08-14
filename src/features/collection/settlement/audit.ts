import type { SettlementConsumption } from '@/core/models/settlement'
import { describeDocument, type AccountEntryRow, type JournalDocument } from './account-projection'

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
 * `Settlement/Account` returned.
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
 * `restored` covers both a **void** and a **repair**: 🚩 on D8's contract they are
 * the same row — a `REVERSE` consumption — and this screen has no field that tells
 * them apart. Rendering them as one honest fact (*money went back onto the entry*)
 * beats guessing which act produced it, and the document beside the row is what
 * distinguishes them to a reader: a void names the receipt it undoes, a repaired
 * orphan has no document to name. Logged for 274.
 */
export type AuditFactKind = 'posted' | 'consumed' | 'restored' | 'cancelled' | 'written-off'

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
}

/**
 * The entry's own two facts: it was posted, and — if it is closed by a human — it
 * was corrected.
 *
 * ⚠️ `CONSUMED` produces **no closing fact**, deliberately: the last consumption
 * already *is* that fact, and a synthetic *"closed"* row beside it would be the
 * same event told twice with two different times.
 */
function entryFacts(entry: AccountEntryRow): AuditFact[] {
  const facts: AuditFact[] = [
    {
      id: `entry:${entry.settlementEntryId}:posted`,
      at: entry.postedAt,
      kind: 'posted',
      amount: entry.amount,
      remainingAfter: null,
      where: { kind: 'person', name: entry.postedByName },
      note: entry.reason,
      document: null,
    },
  ]

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
 */
export function auditColumn(row: AccountEntryRow | null | undefined): AuditFact[] {
  if (!row) return []

  return [...entryFacts(row), ...(row.journal ?? []).map((r) => consumptionFact(r.consumption))].sort(
    (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}
