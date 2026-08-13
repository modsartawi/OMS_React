import { distinctCurrencies, roundMoney } from '@/core/money'
import type {
  SettlementBulkError,
  SettlementBulkPreview,
  SettlementBulkRow,
  SettlementCancelResult,
  SettlementLedgerRow,
} from '@/core/models/settlement'

/**
 * **The bulk door's rules** — the preview's partition and the batch withdrawal's
 * plan, as pure functions (ticket 273, spec 267 D7).
 *
 * Two things are decided here, and both are the silent-regression kind the spec's
 * Testing Decisions section points at:
 *
 * 1. 🔑 **What blocks and what merely warns.** *Hard errors are all-or-nothing;
 *    duplicate warnings commit anyway.* Getting that backwards in either direction
 *    is expensive in a different way — a batch stricter than the single form makes a
 *    genuine second shortage unpostable by file, and a batch that committed over a
 *    hard error leaves finance reconciling a half-posted month against their own
 *    sheet.
 * 2. 🔑 **What a batch withdrawal can and cannot touch**, and how the rows a till
 *    already consumed are named rather than counted.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock. Every sentence a reader sees is
 * the `settlement` namespace's; every sentence the SERVER sent rides through as
 * data.
 */

/* ── the preview ──────────────────────────────────────────────────────────── */

/**
 * One reason nothing in this file may commit.
 *
 * ⚠️ **`source` distinguishes who refused**, and it is not cosmetic: a `server`
 * blocker carries the server's own words about a malformed row, while `unresolved`
 * is *this screen's own* refusal — see `reviewBulk`. A sentence that attributed the
 * second to the server would be putting words in its mouth.
 */
export type BulkBlocker = SettlementBulkError & {
  source: 'server' | 'unresolved'
  /** The store code that resolved to nothing — set only on an `unresolved`
   *  blocker. ⚠️ It is its own field rather than borrowed `message`, which is typed
   *  *the server's own words*: a code sitting in that slot reads as a server
   *  sentence to the next caller who renders it generically. */
  storeId?: string
}

/** One currency's share of the file. The read-back is per currency, never a sum
 *  across them — a riyal added to a dinar is a figure wrong in both. */
export type BulkTotal = {
  currencyKey: string
  total: number
  rowCount: number
}

/** The file, reviewed. */
export type BulkReview = {
  rows: SettlementBulkRow[]
  /** Every reason the file cannot commit, the file's own faults (`rowNumber: 0`)
   *  first and the rest in sheet order — the order finance will fix them in. */
  blockers: BulkBlocker[]
  /** Warnings by row number, so a row can wear its own without the grid scanning
   *  a flat array per row. Rows with none are absent rather than empty. */
  warningsByRow: Record<number, string[]>
  /** How many rows carry at least one warning — the count the commit step states. */
  warnedRows: number
  totals: BulkTotal[]
  /** 🔑 Hard errors block; warnings never do. An empty file cannot commit either —
   *  there is nothing to post, and a commit of nothing is a batch handle minted
   *  over no money. */
  canCommit: boolean
  /**
   * ⚠️ The server's own scalar `total` against the rows' own sum, when the file is
   * single-currency and the two disagree. `null` when they agree, when the file
   * holds more than one currency (a scalar cannot describe it), or when there is
   * nothing to compare.
   *
   * It does **not** block: the rows are what the accountant reviewed and the rows
   * are what commits. But a guard that quietly disagreed with the server's own sum
   * would be a guard nobody could trust, so the disagreement is stated.
   */
  disagreement: { server: number; rows: number } | null
}

/**
 * The preview, partitioned.
 *
 * 🔑 **One client-side blocker is added, and exactly one**: a row whose `storeName`
 * came back **empty**. The preview grid *is* the row-level guard, and its whole
 * claim is that every row shows its code resolved to a branch name — the thing that
 * catches the right amount on the wrong branch. A row with no name is either an
 * unresolvable code (a hard error in the ticket's own words) or a server that
 * resolved nothing, and in both cases committing it would post money onto a branch
 * nobody on this screen could read back.
 *
 * ⚠️ **Duplicate warnings are not blockers and there is no path from one to
 * `canCommit`.** The batch must never be stricter than the single form (which warns
 * and posts), or a real second shortage months apart becomes unpostable by file.
 */
export function reviewBulk(preview: SettlementBulkPreview | null | undefined): BulkReview {
  const rows = preview?.rows ?? []

  const fromServer: BulkBlocker[] = (preview?.errors ?? []).map((e) => ({
    ...e,
    source: 'server',
  }))

  // ⚠️ **Only where the server said nothing.** A row the server already named is
  // named once — its own words — because two sentences about one bad row read as two
  // bad rows to someone counting what they have to fix in the sheet. The client
  // blocker is a backstop against a silent server, not a second opinion.
  const named = new Set(fromServer.map((e) => e.rowNumber))
  const unresolved: BulkBlocker[] = rows
    .filter((r) => !(r.storeName ?? '').trim() && !named.has(r.rowNumber))
    .map((r) => ({
      rowNumber: r.rowNumber,
      column: 'storeId',
      // No server words to pass through — this refusal is the screen's own, and it
      // says so by leaving the server's slot empty.
      message: '',
      source: 'unresolved' as const,
      storeId: r.storeId,
    }))

  // The file's own faults first — a missing header is why every row below it looks
  // wrong, and a reader who fixed forty rows before reaching it fixed nothing.
  const blockers = [...fromServer, ...unresolved].sort((a, b) => a.rowNumber - b.rowNumber)

  const warningsByRow: Record<number, string[]> = {}
  for (const w of preview?.warnings ?? []) {
    ;(warningsByRow[w.rowNumber] ??= []).push(w.message)
  }

  const totals = bulkTotals(rows)
  // 🔑 **The guard must cover every row, or there is no guard.** The commit is
  // licensed by a total read back in words; a file whose rows did not all reach a
  // total would be committed behind a sentence that described only some of it.
  // `bulkTotals` buckets every row by construction, so this holds — and it is
  // asserted rather than assumed, because the failure mode is silent.
  const counted = totals.reduce((sum, total) => sum + total.rowCount, 0)

  return {
    rows,
    blockers,
    warningsByRow,
    warnedRows: Object.keys(warningsByRow).length,
    totals,
    canCommit: blockers.length === 0 && rows.length > 0 && counted === rows.length,
    disagreement: compareToServerTotal(totals, preview?.total),
  }
}

/**
 * The file's total **per currency**, folded from the previewed rows.
 *
 * 🔑 **The rows are the source, not D8's scalar.** The ticket's own Proof is that
 * the total in words *matches the sum of the previewed rows* — so a read-back of a
 * figure the screen could not derive would be unprovable by the bullet that asks
 * for it. And a file holding a Bahraini branch beside Saudi ones has no single
 * total at all: `figures.ts` already refuses that fold estate-wide, and this is the
 * same refusal one screen over.
 *
 * Summed at the scale money is **held** at (`roundMoney`), then rendered at each
 * branch's own precision by the caller (D10).
 */
export function bulkTotals(rows: readonly SettlementBulkRow[] | null | undefined): BulkTotal[] {
  const code = (row: SettlementBulkRow) => (row.currencyKey ?? '').trim().toUpperCase()
  // 🔑 **Every row lands in a bucket, including one with no currency code at all.**
  // `distinctCurrencies` skips a blank code by design (it answers *which currencies
  // are here*), and folding on it alone would silently drop those rows out of the
  // read-back — leaving the aggregate guard rendering **nothing** on a file the
  // commit button would still post. An unnamed currency is a bucket of its own,
  // labelled as unnamed, rather than a row that vanishes from the sentence.
  const codes = [...distinctCurrencies(rows ?? [], (r) => r.currencyKey)]
  if ((rows ?? []).some((r) => !code(r))) codes.push('')

  return codes.map((currencyKey) => {
    // Matched on the NORMALISED code, because `distinctCurrencies` normalises what
    // it returns — a raw comparison would drop every `sar` row out of its own total.
    const mine = (rows ?? []).filter((r) => code(r) === currencyKey)
    return {
      currencyKey,
      total: roundMoney(mine.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)),
      rowCount: mine.length,
    }
  })
}

function compareToServerTotal(
  totals: BulkTotal[],
  serverTotal: number | null | undefined,
): BulkReview['disagreement'] {
  if (typeof serverTotal !== 'number' || !Number.isFinite(serverTotal)) return null
  // More than one currency and the scalar describes nothing — there is no honest
  // comparison to make, so none is made.
  if (totals.length !== 1) return null
  const rows = totals[0].total
  return roundMoney(serverTotal) === rows ? null : { server: roundMoney(serverTotal), rows }
}

/* ── cancel as a unit ─────────────────────────────────────────────────────── */

/**
 * Why one entry of a batch is not going to be cancelled by this act.
 *
 * ⚠️ They are distinguished rather than collapsed into *"skipped"*, because each is
 * a different answer to the branch that phones about it: a till spent it, an
 * accountant already withdrew it, or an accountant already forgave its remainder.
 */
export type BatchSkipReason = 'consumed' | 'cancelled' | 'written-off' | 'partly-consumed'

export type BatchPlan = {
  /** The entries a cancel will actually be attempted on — `OPEN` and untouched,
   *  which is 272's own `cancel` affordance applied per row. */
  cancellable: SettlementLedgerRow[]
  /** …and the rest, each with the reason it is not in the first list. 🔑 These are
   *  **named, not counted**: *"reporting which rows a till already consumed"* is the
   *  ticket's own requirement, and a number is not a report. */
  skipped: { row: SettlementLedgerRow; because: BatchSkipReason }[]
}

/**
 * What a batch withdrawal can attempt, before it attempts anything.
 *
 * 🔑 **It is 272's per-entry decision applied across a `BatchId`, and nothing
 * more** — the ticket says so in as many words: *a loop over 272's mechanism, not a
 * new one*. An entry a till has partly consumed is **not** written off here: the
 * write-off is a separate act with a separate reason, and forgiving a remainder
 * because it happened to share a batch with forty other rows is not what *"finance
 * sent the wrong file"* asks for.
 *
 * ⚠️ Untouched is tested at the scale money is **held** at, the same call 272 made:
 * a BHD entry consumed by one fils is a partly-consumed entry, and rounding that
 * away at the branch's display precision would attempt a cancel the server refuses.
 */
export function planBatchWithdraw(
  rows: readonly SettlementLedgerRow[] | null | undefined,
): BatchPlan {
  const cancellable: SettlementLedgerRow[] = []
  const skipped: BatchPlan['skipped'] = []

  for (const row of rows ?? []) {
    switch (row.status) {
      case 'CONSUMED':
        skipped.push({ row, because: 'consumed' })
        continue
      case 'CANCELLED':
        skipped.push({ row, because: 'cancelled' })
        continue
      case 'CLOSED_OUT':
        skipped.push({ row, because: 'written-off' })
        continue
      case 'OPEN':
        break
    }
    if (roundMoney(row.remainingAmount) === roundMoney(row.amount)) cancellable.push(row)
    else skipped.push({ row, because: 'partly-consumed' })
  }

  return { cancellable, skipped }
}

/** One attempted cancel, and what came back. */
export type BatchAttempt = {
  row: SettlementLedgerRow
  result: Pick<SettlementCancelResult, 'accepted' | 'refusalReason' | 'remainingAmount'> | null
  /**
   * ⚠️ **A refusal that arrived as an error rather than as a 200** — a guardrail
   * denial the envelope carried with `success:false`, whose message is the server's
   * own words. It is reported **with the refusals**, not with the unknowns: the
   * server decided, and `api-envelope` forbids flattening a decision into a generic
   * "something went wrong". The caller does the classification, because what an
   * `ApiError` *is* belongs to `@/core/api` and this module is pure.
   */
  refusedBecause?: string
  /** Set when the call itself failed — a transport fault, not a refusal. The
   *  entry's state is then genuinely **unknown**. */
  failed?: boolean
}

export type BatchOutcome = {
  withdrawn: SettlementLedgerRow[]
  /** 🔑 **The rows a till got to first**, each with the server's own words and the
   *  remaining it came back with. Named, in the batch's own order. */
  refused: { row: SettlementLedgerRow; reason: string; remaining: number }[]
  /** Calls that did not complete at all. Distinguished from a refusal because the
   *  entry's state is *unknown*, not decided — and telling an accountant an entry
   *  survived when the request merely timed out would be a lie about money. */
  failed: SettlementLedgerRow[]
}

/**
 * What the loop actually did.
 *
 * 🚩 **A partly-withdrawn batch is not an error**, and nothing here rolls back. A
 * cancel that lost its race is 272's designed outcome — a 200 carrying the true
 * remaining — and re-posting the rows that succeeded for the sake of a tidy result
 * would put money back onto branches to make a report look neat.
 */
export function summariseBatchWithdraw(attempts: readonly BatchAttempt[]): BatchOutcome {
  const outcome: BatchOutcome = { withdrawn: [], refused: [], failed: [] }

  for (const attempt of attempts) {
    // ⚠️ **A refusal that arrived as an error is still a refusal.** The server
    // decided and said why; reporting it as *"the request did not complete, so this
    // entry's state is unknown"* would flatten a decision into a shrug, which is
    // the exact thing `api-envelope` forbids. Its remaining is the entry's last
    // known one — the refusal carried no newer figure.
    if (attempt.refusedBecause) {
      outcome.refused.push({
        row: attempt.row,
        reason: attempt.refusedBecause,
        remaining: roundMoney(attempt.row.remainingAmount),
      })
      continue
    }
    if (attempt.failed || !attempt.result) {
      outcome.failed.push(attempt.row)
      continue
    }
    if (attempt.result.accepted) {
      outcome.withdrawn.push(attempt.row)
      continue
    }
    const returned = attempt.result.remainingAmount
    outcome.refused.push({
      row: attempt.row,
      reason: attempt.result.refusalReason ?? '',
      // The server's own figure at the moment of the refusal — the only trustworthy
      // number once a race has been lost (272's rule). A refusal that carried none
      // reports the entry's last known remaining rather than inventing one.
      remaining: roundMoney(
        typeof returned === 'number' && Number.isFinite(returned)
          ? returned
          : attempt.row.remainingAmount,
      ),
    })
  }

  return outcome
}
