/**
 * The Settlement Account feature's server calls (spec 267).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular is
 * never caught here.
 *
 * 268 landed the surface — the screen's reading of its grant. 269 added the first
 * door that reads the ledger (one branch's account), 270 the three the door needs
 * plus the repair. 271 added the first door that writes into the ledger
 * (`Settlement/Post`), and **272 adds the two that correct it: `Settlement/Cancel`
 * and `Settlement/CloseOut`.** The two bulk doors (spec 267 D7) arrive with 273;
 * the joining ticket 274 settles every route string against a live SIS.Api.
 *
 * ⚠️ **There is no `Settlement/Access` probe and there must not be one.** The
 * settlement account is a **fifth grant on the Collections probe** (spec 267 D1),
 * not an area of its own — same nav group, same `/collection/*` prefix, same one
 * `CollectionWeb/Access` call. The key, the options and the call live in
 * `@/core/collection/api`, where ticket 268 graduated them the moment this feature
 * became their second consumer: a feature may not import another feature's api
 * (`.claude/rules/feature-structure.md`).
 */
import { api } from '@/core/api'
import { newRequestId } from '@/core/engine-session/request-id'
import type { CollectionAccessResult } from '@/core/models/collection'
import type {
  SettlementAccount,
  SettlementBranch,
  SettlementBulkCancelResult,
  SettlementBulkCommitResult,
  SettlementBulkPreview,
  SettlementCancelResult,
  SettlementCloseOutResult,
  SettlementEntryKind,
  SettlementFleetRow,
  SettlementOrphanRow,
  SettlementPostResult,
  SettlementRepairResult,
  SettlementScope,
} from '@/core/models/settlement'
import { ACCOUNT_LIMIT, BRANCH_LIMIT, FLEET_LIMIT, WORKLIST_LIMIT } from './cap'

/**
 * The settlement account's predicate — this screen's own reading of the fifth flag.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. That strictness is doing
 * real work today rather than guarding a hypothetical: the server does not answer
 * `canOpenSettlement` yet (BackOffice spec 1173), so every live probe currently
 * arrives with the field **absent** — and absent must read as no.
 *
 * Exported because the nav leaf and the screen's own gate must read the SAME
 * predicate rather than two spellings of it, which is what stops the menu and the
 * screen disagreeing about whether the session is allowed in.
 */
export const canOpenSettlement = (r: CollectionAccessResult | null | undefined): boolean =>
  r?.canOpenSettlement === true

export const settlementApi = {
  /**
   * `GET Settlement/Account?storeId=…` → one branch's whole position: every entry,
   * open and closed, and the flat array of consumptions behind them (spec 267 D8).
   *
   * 🚩 **One call, two arrays, no second round trip per entry.** The journal
   * drilldown is a re-render and never a request — the same shape `CollectionWeb/
   * Deposits` uses for its lines and slips (256), and for the same reason: an
   * accountant on a phone call opening four entries in a row must not be paying four
   * latencies to answer *"was my 500 used?"*.
   *
   * ⚠️ `Limit` is the cap the banner is measured against (`cap.ts`), asked for
   * rather than assumed — the door applies a 500-row `TOP` (D3) and a client that
   * did not name it would be inferring a number the server chose.
   *
   * ⚠️ The route string and the param casing are **274's to confirm** against a live
   * SIS.Api; D8 says as much in as many words. Until then 269's screens are driven
   * against `settlement-fixture.ts` served over this same door
   * (`tools/settlement-drive.mjs`), which is what makes 274 a joining event rather
   * than a rewiring.
   *
   * 401 is not caught here and must not be — `@/core/api` owns it
   * (`.claude/rules/api-envelope.md`).
   */
  account(storeId: string): Promise<SettlementAccount> {
    return api.get<SettlementAccount>('Settlement/Account', { storeId, limit: ACCOUNT_LIMIT })
  },

  /**
   * `GET Settlement/Fleet?scope=…` → one aggregated row per store (spec 267 D8).
   *
   * 🔑 **274, live: the scope is the SERVER's, and the carve-out comes with it.**
   * 270 sent `scope=all` always and ranked the answer on a client-side `assignment`
   * field, on the reasoning that a scoped fetch would lose the 1255 unassigned
   * branches from the two estate-wide lanes. The live door does not have that
   * failure mode: `AlwaysVisible` (`f.OrphanCount > 0 OR f.UncollectedCount > 0`)
   * is OR'd **into every scoped predicate**, so a branch carrying wrong money or
   * waiting cash rows whatever the scope says — one query, carve-out included. And
   * *mine* is resolved from the SESSION against the assignment tables, which is a
   * union over an org chart no client can see.
   *
   * ⚠️ **What that costs is the ranking, and it is recorded rather than faked.**
   * The row carries no `assignment`, so the screen can no longer say *which* rows
   * are mine and which are carved in — see `.afk/FINDINGS-274.md` §2. An accountant
   * with no staff row opens unfiltered (the server's own rule), never empty.
   *
   * The estate is 1394 rows of nine scalars — a single answer a browser sorts,
   * filters and ranks without noticing. 🚩 **Nothing caches or denormalises it**
   * (the ticket's own boundary): it is a query per page life, and the per-store
   * balance table this design refused twice stays refused. 274 measured the door at
   * estate scale before letting that stand — the number is in the ticket.
   */
  fleet(scope: SettlementScope): Promise<SettlementFleetRow[]> {
    // ⚠️ `limit` is NOT optional in practice — the door's own default is 500 and the
    // estate is 1394. See `FLEET_LIMIT`.
    return api.get<SettlementFleetRow[]>('Settlement/Fleet', { scope, limit: FLEET_LIMIT })
  },

  /**
   * `GET Settlement/Branches` → every **open** branch off the `Store` master
   * (BackOffice 1199) — the posting form's address book.
   *
   * 🔑 **This exists because the fleet is not the estate, and 274 found out the
   * expensive way.** The picker resolved what an accountant typed against
   * `fleet('all')`, on the reasonable-looking assumption that *all* meant the
   * estate. It does not: every branch of the fleet door's UNION drives off
   * `PosSettlementEntry` / `PosSettlementConsumption`, so *all* means **every branch
   * with settlement activity** — and on a migrated-but-unused database that is the
   * empty set. The branch box found nothing, for every query, and the only door that
   * mints a settlement row could not be reached without one already existing.
   * Nothing could go first.
   *
   * ⚠️ **Not `CollectionWeb/Assignment/Branches`, which returns the same payload.**
   * That route rides the assignment **write** grant, and BackOffice spec 1162 D13
   * minted it as a fifth grant precisely so it would never be OR-ed with a read.
   * Needing it to name a branch would mean an accountant must hold the authority to
   * reassign the estate before they may post — the widening that ruling refused. So
   * this is a settlement-gated door over the same master.
   *
   * 🚩 **No search parameter, deliberately.** ~1394 narrow rows is one answer the
   * browser ranks itself (`search.ts`), the way the fleet already is. A server-side
   * match would be a round trip per keystroke *and* a second ranking to keep in step
   * with the one the screen owns.
   */
  branches(): Promise<SettlementBranch[]> {
    return api.get<SettlementBranch[]>('Settlement/Branches', { limit: BRANCH_LIMIT })
  },

  /**
   * `GET Settlement/Orphans` → the **wrong money** lane, enumerated (BackOffice
   * ticket 1185).
   *
   * 🔑 **274 found the door 270 asked for, under a different name and half the
   * size.** 270 posted a `Settlement/Worklist` answering BOTH enumerated lanes plus
   * an ageing threshold; what exists is this one, answering orphan consumptions
   * only. The *cash waiting* lane and the ageing threshold have **no door at all**
   * — recorded in `.afk/FINDINGS-274.md` §3/§4 rather than fabricated here.
   *
   * 🔑 **It takes no scope, and the absence is still the design.** D8's `FleetRow`
   * can say a branch *has* an orphan; it cannot say which consumption or for how
   * much — and `Settlement/Repair` is keyed by a `settlementConsumptionId`. A door
   * with no scope to pass cannot be narrowed by accident, which is the carve-out
   * (D2) enforced by shape rather than by a comment.
   *
   * ⚠️ The rows are `SettlementConsumption`s: no `entryNumber`, no `storeName`, no
   * `currencyKey`, no `ageDays`. The lane orders on `consumedAt` — the server's own
   * clock, which is what `ageDays` was for.
   */
  orphans(): Promise<SettlementOrphanRow[]> {
    return api.get<SettlementOrphanRow[]>('Settlement/Orphans', { limit: WORKLIST_LIMIT })
  },

  /* ⚠️ **`ledger()` stood here until 274 and is gone**: there is no
   * `Settlement/Ledger`. BackOffice spec 1173 D13 specifies six doors and a
   * cross-estate lookup is not among them — 270 posted it as a D8 extension and it
   * was never built, because it was never asked for (`.afk/FINDINGS-274.md` §B1).
   *
   * 🔑 The one thing on this screen that genuinely needed it — withdrawing a batch —
   * does not any more: `bulkCancel` below is the server's own door for it, and it
   * replaces the ledger-fetch-then-loop 273 built. Resolving a bare entry number to
   * its branch has no substitute and is the §B1 ask. */

  /**
   * `POST Settlement/Post` → one entry onto one branch's ledger (spec 267 D8),
   * **the screen's first real write into the account** and the moment a slip
   * becomes money a branch manager is asked to hand over.
   *
   * 🔑 **Four fields, and no fifth.** There is no approval flag, no threshold and
   * no second permission on this body — whoever can open the screen can post (the
   * ticket's own boundary, and spec 267's *Out of Scope*: approval limits are
   * deliberately unsettled, so any number invented here would be invented). The
   * typo guard is the review step the form draws before it calls this, not
   * anything on the wire.
   *
   * ⚠️ **The amount goes up as typed and comes back as stored.** The server rounds
   * to what the branch can physically count (D4) and answers with the **rounded**
   * figure — which the confirmation reads back rather than echoing the form. The
   * client rounds nothing: a second rounding rule on this side is exactly how the
   * words an accountant approved and the ledger's own figure start to disagree.
   *
   * ⚠️ Route string and casing are 274's to confirm, as with every door here.
   */
  post(input: {
    storeId: string
    entryKind: SettlementEntryKind
    amount: number
    reason: string
  }): Promise<SettlementPostResult> {
    return api.post<SettlementPostResult>('Settlement/Post', input)
  },

  /**
   * `POST Settlement/Cancel` → withdraws an entry **as though it never happened**
   * (ticket 272, spec 267 D5). Only lawful while nothing has been taken against it.
   *
   * 🔑 **A refusal is a 200, and it is the case this door is designed around.** The
   * server's `remaining == amount` predicate sits *inside* its UPDATE, so a till
   * that consumed a millisecond earlier wins — and what comes back is
   * `accepted: false` with the **true remaining**, on which the screen offers the
   * write-off instead. Nothing here throws on that: rendering a lost race as a
   * failure teaches an accountant to distrust a screen that is working correctly.
   *
   * ⚠️ The screen decides *which* button from `correction.ts`, but this call is the
   * only authority — the client's reading can be right at render time and stale by
   * the time the button is pressed. That is why the refusal carries a figure rather
   * than only a sentence.
   */
  cancel(settlementEntryId: string, reason: string): Promise<SettlementCancelResult> {
    return api.post<SettlementCancelResult>('Settlement/Cancel', { settlementEntryId, reason })
  },

  /**
   * `POST Settlement/CloseOut` → forgives the **remainder** of a partly consumed
   * entry (ticket 272, spec 267 D5).
   *
   * 🚩 **It touches no consumption, and that is the load-bearing property.** A
   * receipt already in a collector's hands is never retro-voided, so the journal
   * under the act is unchanged by it — which the screen shows rather than asserts by
   * leaving the journal on screen beneath the button.
   *
   * ⚠️ D8 gives the answer two fields and no `refusalReason` (unlike cancel and
   * repair). The asymmetry is transcribed rather than tidied, and a refused
   * close-out reads through the namespace's own sentence — logged in
   * `.afk/HITL-272.md` for 274.
   */
  closeOut(settlementEntryId: string, reason: string): Promise<SettlementCloseOutResult> {
    return api.post<SettlementCloseOutResult>('Settlement/CloseOut', { settlementEntryId, reason })
  },

  /**
   * `POST Settlement/Repair` → puts an orphan consumption's money back on its
   * entry. **270's only write** (posting is this ticket's, correction 272's).
   *
   * 🔑 **A no-op is a 200, not a failure.** The server's guard is inside its
   * UPDATE and is predicated on the consumption still having no document, so a
   * late Z arriving mid-click means there was never anything to repair. That comes
   * back as `noOp: true` and the screen says so plainly. Likewise a refusal is
   * `accepted: false` with a reason — nothing here throws on a business outcome,
   * and `@/core/api` owns the ones that are genuinely errors.
   */
  repair(settlementConsumptionId: string, reason: string): Promise<SettlementRepairResult> {
    return api.post<SettlementRepairResult>('Settlement/Repair', {
      settlementConsumptionId,
      reason,
    })
  },

  /**
   * `POST Settlement/Bulk/Preview` (multipart) → the month's audit, parsed and
   * resolved (ticket 273, spec 267 D7/D8). **The first half of the second posting
   * door**, beside 271's single form, which is untouched.
   *
   * 🔑 **The client uploads bytes and parses nothing.** XLSX and CSV alike go up as
   * they came off disk; there is no spreadsheet library on this side and the ticket
   * forbids adding one. What comes back is the server's reading of the file —
   * every row with its store code **resolved to a branch name**, the errors that
   * block it, the warnings that do not, a `batchId` and a content hash.
   *
   * ⚠️ It goes through `api.upload`, which is `@/core/api`'s multipart door added
   * by this ticket — not a `fetch` beside it (`.claude/rules/api-envelope.md`), and
   * for the concrete reason that a refused upload has to arrive as the same
   * `ApiError` every other refusal on this screen does.
   *
   * 🔑 **274, live: the CLIENT mints the batch id, and it must be a ULID.** 273 had
   * the server minting it at preview and handing it back. The real door takes
   * `batchId` as a required form field and refuses anything that is not 26
   * characters of Crockford base-32 (`SettlementBulkBatchIdInvalid`, a 400) — for a
   * concrete reason the server spells out: the batch's **entry ids are derived from
   * it** by replacing its first five characters, so two batch ids sharing their last
   * 21 would mint the same entry ids and the second file would silently replay the
   * first, posting nothing while telling the accountant their month is filed.
   *
   * `newRequestId` is that ULID — `@/core/engine-session/request-id`, the same
   * minter the engine verbs use, reused rather than re-spelled. It is minted **per
   * preview**: one file reviewed is one batch, and re-previewing after fixing the
   * sheet is a new one.
   */
  bulkPreview(file: File, entryKind: SettlementEntryKind): Promise<SettlementBulkPreview> {
    const form = new FormData()
    form.append('file', file, file.name)
    // 🔑 The kind is the FILE's, chosen with 271's toggle before the upload — there
    // is no kind column, because a mixed file makes the total in words a **net**
    // figure a typo can hide inside (D7).
    form.append('entryKind', entryKind)
    form.append('batchId', newRequestId())
    return api.upload<SettlementBulkPreview>('Settlement/Bulk/Preview', form)
  },

  /**
   * `POST Settlement/Bulk/Commit` (multipart) → the same file, posted.
   *
   * 🔑 **The FILE is re-sent, not the rows.** There is no staging table and no
   * client-held row state (D7): what commits is the bytes the accountant reviewed,
   * never a JSON array the browser assembled and could have diverged from. The
   * server re-hashes what arrives and compares it with what it previewed, so a
   * **sheet edited between review and commit is refused** — which is a refusal this
   * client could not make, because it never read the file.
   *
   * 🔑 **274 settled it the other way, and 273 had it backwards.** The refusal is a
   * **200 carrying `accepted: false`** and a `refusalReason` — the same shape cancel
   * and repair use, and for the same reason: the server DECIDED, and a decision is
   * not a crash. `.afk/HITL-273.md`'s reasoning (*"a request describing a file the
   * server no longer holds is a refusal to act"*) was sound and simply not what the
   * door does. The only non-200 here is a malformed upload — no file, over 10 MB, an
   * extension outside the allow-list, or bytes that yield no rows — which is a 400
   * through the envelope, because a file that cannot be read is not a decision about
   * money.
   *
   * ⚠️ **`contentHash` is the client's to echo**, from the preview it is committing.
   * 273 sent only the file and left the server to remember what it had previewed;
   * the door takes the hash as a form field and compares it against the file it just
   * re-parsed. Omitting it refuses every commit.
   */
  bulkCommit(
    file: File,
    batchId: string,
    entryKind: SettlementEntryKind,
    contentHash: string,
  ): Promise<SettlementBulkCommitResult> {
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('batchId', batchId)
    form.append('entryKind', entryKind)
    form.append('contentHash', contentHash)
    return api.upload<SettlementBulkCommitResult>('Settlement/Bulk/Commit', form)
  },

  /**
   * `POST Settlement/Bulk/Cancel` → withdraws **every entry of a batch, as a unit**
   * (BackOffice ticket 1186).
   *
   * 🔑 **274 found this door, and it replaces a loop.** 273 withdrew a batch from
   * the browser: fetch the cross-estate ledger filtered to a `batchId`, decide per
   * row which were still cancellable, then call `Settlement/Cancel` once per row and
   * summarise what came back. That was N round trips, a partial-failure story the
   * client had to tell itself, and — as 274 also found — it stood on
   * `Settlement/Ledger`, a door that does not exist.
   *
   * ⚠️ **It is a loop over the per-entry cancel, not a second lifecycle** (D7): a
   * row a till already consumed is **refused and named** in `rows`, never written
   * off as a side effect of sharing a batch with forty others. The write-off stays a
   * separate act with its own reason — which is exactly the ruling `bulk.ts`'s
   * `planBatchWithdraw` made, now made by the server that owns the money.
   *
   * A partly-withdrawn batch is not an error and nothing rolls back.
   */
  bulkCancel(batchId: string, reason: string): Promise<SettlementBulkCancelResult> {
    return api.post<SettlementBulkCancelResult>('Settlement/Bulk/Cancel', { batchId, reason })
  },
}
