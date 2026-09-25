import { distinctCurrencies, roundMoney } from '@/core/money'
import type {
  SettlementBulkCancelRow,
  SettlementBulkCommitResult,
  SettlementBulkError,
  SettlementBulkPreview,
  SettlementBulkRow,
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
}

/**
 * The `code` an `unresolved` blocker carries.
 *
 * ⚠️ **It is this screen's own vocabulary, not the server's**, and it is spelled
 * unmistakably so nobody mistakes it for one of `SettlementBulkIssueCodes`. 274
 * settled that the wire locates a fault by **machine code** rather than by
 * spreadsheet column (`SettlementBulkIssueModel.code`), which gave the client
 * blocker a natural slot — the store code it could not resolve rides in `storeCode`
 * beside it, exactly as the server's own issues do.
 */
export const UNRESOLVED_BRANCH_CODE = 'CLIENT_UNRESOLVED_BRANCH'

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
  /**
   * ✅ Ticket 311: the SERVER's hard errors by row number, in its own words — so a
   * refused row wears its refusal in the grid, beside the cell it is about, and not
   * only in the list above it. *"Row 3 has no description"* read forty rows away from
   * row 3 is a sentence someone has to go and find the row for.
   *
   * Row 0 (the file's own fault) is absent: there is no row to hang it on, and the
   * blocker list already leads with it. The client's own `unresolved` blocker is
   * absent too — the grid already says so on that row, in its branch-name cell.
   */
  errorsByRow: Record<number, string[]>
  /** How many rows carry at least one warning — the count the commit step states. */
  warnedRows: number
  /**
   * ✅ Ticket 309 (BackOffice 1978 §3): how many rows **will land pending** — waiting
   * for an accountant supervisor, invisible to every till until one approves them.
   *
   * 🚩 **Counted, never a blocker and never a warning.** The server decides it per row
   * (`awaitsApproval`, the single post's own rule) and says in as many words that
   * waiting touches neither `canCommit`, `errors` nor `warnings` — so it touches
   * nothing here either. `=== true`: a row the server did not mark does not wait.
   */
  awaitingApproval: number
  /**
   * ✅ 274: the warnings that are about the **file** rather than a row — the
   * server's `rowNumber: 0` issues, in its own words.
   *
   * 🔑 **This is where the replay notice lives.** 273 modelled *"a file with these
   * 47 rows was posted 4 minutes ago by ضحى"* as a structured `replay` object; the
   * door sends that exact sentence as a file-level warning
   * (`SettlementBulkIssueCodes.RecentIdenticalBatch`). Pulled out here because a
   * grid that renders warnings per row would drop row 0 on the floor — there is no
   * row 0 to hang it on, and the notice is the one that says *somebody may have
   * already posted this month*.
   */
  fileNotices: string[]
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
      code: UNRESOLVED_BRANCH_CODE,
      storeCode: r.storeCode,
      // No server words to pass through — this refusal is the screen's own, and it
      // says so by leaving the server's slot empty.
      message: '',
      source: 'unresolved' as const,
    }))

  // The file's own faults first — a missing header is why every row below it looks
  // wrong, and a reader who fixed forty rows before reaching it fixed nothing.
  const blockers = [...fromServer, ...unresolved].sort((a, b) => a.rowNumber - b.rowNumber)

  const errorsByRow: Record<number, string[]> = {}
  for (const e of fromServer) {
    if (e.rowNumber > 0) (errorsByRow[e.rowNumber] ??= []).push(e.message)
  }

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
    errorsByRow,
    warningsByRow,
    // ⚠️ Row 0 is the file's, so it is not one of the *rows* that carry a warning —
    // counting it there would report "1 row to look twice at" on a file whose every
    // row is clean.
    warnedRows: Object.keys(warningsByRow).filter((r) => Number(r) !== 0).length,
    awaitingApproval: rows.filter((r) => r.awaitsApproval === true).length,
    fileNotices: warningsByRow[0] ?? [],
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

/**
 * The code a refused commit carries when **rows** are why (BackOffice 1980 §2): the
 * answer's `errors[]` are the same per-row issues the preview names.
 */
export const COMMIT_ROW_ERRORS = 'ROW_ERRORS'

/**
 * **A commit refused over its rows, folded back onto the preview** (ticket 311) —
 * or `null` when the refusal is not that one.
 *
 * 🔑 The commit re-sends the previewed file, so a `ROW_ERRORS` refusal means the
 * server now refuses rows its preview passed (the preview and the commit
 * share one evaluation server-side, so for a blank description this is unreachable
 * with the same bytes — but a branch closed in between is not). What the accountant
 * needs is the preview again, **with those rows named on the grid**, not a banner
 * that says `ROW_ERRORS`. So the answer's errors REPLACE the preview's (they are the
 * newer reading of the same file) and `canCommit` goes false.
 *
 * ⚠️ A `ROW_ERRORS` with no errors is left to the caller's generic refusal: an
 * empty list folded onto the preview would re-open a commit the server just refused.
 */
export function withCommitRowErrors(
  preview: SettlementBulkPreview,
  result: Pick<SettlementBulkCommitResult, 'accepted' | 'refusalReason' | 'errors'> | null | undefined,
): SettlementBulkPreview | null {
  if (!result || result.accepted || result.refusalReason !== COMMIT_ROW_ERRORS) return null
  const errors = result.errors ?? []
  if (errors.length === 0) return null
  return { ...preview, errors, canCommit: false }
}

/* ── cancel as a unit ─────────────────────────────────────────────────────── */

/**
 * ⚠️ **Four exports stood here until ticket 274 and are gone**: `planBatchWithdraw`,
 * `summariseBatchWithdraw`, and the `BatchPlan` / `BatchAttempt` / `BatchOutcome`
 * shapes around them.
 *
 * 🔑 **They were a client-side re-implementation of a server door.** 273 withdrew a
 * batch by fetching the cross-estate ledger filtered to a `batchId`, deciding per row
 * which entries were still cancellable, calling `Settlement/Cancel` once per row, and
 * summarising the partial failure itself. `Settlement/Bulk/Cancel` (BackOffice ticket
 * 1186) does exactly that — the same loop over 1185's per-entry cancel — and answers
 * `{ batchId, total, cancelled, refused, rows[] }` with each row's own
 * `accepted` / `refusalReason` / `remainingAmount` / `status`.
 *
 * One request replaces N, and the partial-failure story is told by the party that
 * knows it. The rulings the deleted code encoded are all still enforced, one layer
 * down:
 *
 * - **a batch is a handle, never a second lifecycle** — a row a till already consumed
 *   is refused and *named*, never written off for sharing a batch with forty others;
 * - **a partly-withdrawn batch is not an error** and nothing rolls back;
 * - **untouched is tested at the scale money is held at**, inside the guarded UPDATE
 *   rather than by a client comparing two rounded decimals.
 *
 * 🚩 It also stood on `Settlement/Ledger`, which 274 found does not exist — so this
 * path had never worked against a real server and could not have.
 */

/**
 * **What a batch withdrawal came back with, grouped by what each row IS** — the
 * door's own `rows`, never re-decided (1979 §3, 1978 §5).
 *
 * - `withdrawn` — accepted.
 * - `waiting` — refused and `PENDING_APPROVAL`: no till has seen it and it stays
 *   pending; what ends it is a supervisor's Reject on its account.
 * - `rejected` — refused and `REJECTED`: a supervisor already refused it, so it never
 *   went live. 🚩 **Not a till's doing, and it carries no remaining a branch holds** —
 *   listing it under *"a till got to these first"* with its remaining would state a
 *   figure every other surface of this feature refuses to show (309).
 * - `refused` — every other refusal: the till got there first (`REMAINING_INSUFFICIENT`),
 *   or the entry had already ended. Its remaining is the server's true figure.
 */
export type WithdrawalGroups = {
  withdrawn: SettlementBulkCancelRow[]
  refused: SettlementBulkCancelRow[]
  waiting: SettlementBulkCancelRow[]
  rejected: SettlementBulkCancelRow[]
}

export function withdrawalGroups(rows: SettlementBulkCancelRow[] | null | undefined): WithdrawalGroups {
  const groups: WithdrawalGroups = { withdrawn: [], refused: [], waiting: [], rejected: [] }
  for (const row of rows ?? []) {
    if (row.accepted) groups.withdrawn.push(row)
    else if (row.status === 'PENDING_APPROVAL') groups.waiting.push(row)
    else if (row.status === 'REJECTED') groups.rejected.push(row)
    else groups.refused.push(row)
  }
  return groups
}
