# HITL-309 — decisions taken AFK

Contracts read: BackOffice 1977 and 1978 (both `status: done`, both with `## Web contract`), cross-checked
against the committed SIS.Api / Sartawi.Retail.Data source on `C:\Work\DMSCO\BackOffice` (main, after merge
ae11fac70): `SettlementWebEndpoints` (`Supervised(...)` on Approve/Reject), `CollectionWebEndpoints.Access`
(`canSuperviseSettlement`), `SettlementAccountEntryModel` (the five approval fields), `SettlementEntryActApiResponse`
(`accepted/refusalReason/remainingAmount/status`), `SettlementBulkRowModel.AwaitsApproval`, and the ledger's
`LedgerStatuses` (accepts `PENDING_APPROVAL` and `REJECTED`). **No disagreement found between contract and code.**

## Q: How does "the open lane can filter to pending" look?
**Decision taken:** A fourth tab on Open settlements, *Awaiting approval*, fed by its own call
`Settlement/Ledger?status=PENDING_APPROVAL&sort=age&limit=500` with its own count, cap and failure (the cash
tab's shape).
**Why:** A pending surplus is not open, so it cannot sit inside *Owed* without the lane's counts (and the front
page's signpost) counting money no till can see; the lane's own answer is `status=OPEN` and never contains one.
**Revisit if:** the owner wanted a chip on *Owed* instead, or a separate supervisor screen/route.

## Q: Who sees the Awaiting approval queue?
**Decision taken:** Everyone holding the settlement screen grant sees the queue; only `canSuperviseSettlement === true`
draws the Approve / Reject column.
**Why:** Story 6 — the accountant wants to see their pending entries; story 8 — the supervisor's queue. Same list.
**Revisit if:** the queue should be supervisor-only.

## Q: Where do Approve and Reject live?
**Decision taken:** Both on a queue row (two row-action buttons) and on the selected pending entry's panel in the
branch account. Both open ONE `ApprovalDialog` that shows amount, branch, poster and description (story 9) before
the press; Reject needs a non-blank reason (box stops at 200, sent trimmed).
**Why:** The queue is where a supervisor works; the account is where every other entry act already lives.
**Revisit if:** a one-click approve (no confirm dialog) is wanted on the queue.

## Q: What does the Remaining column show for a pending or rejected entry?
**Decision taken:** An em dash, like a cancelled entry (`remainingIsAClaim` — one predicate read by both grids).
The amount is still in the Amount column.
**Why:** The wire carries a remaining on both, and neither is a claim on anybody (not live yet / never will be).
**Revisit if:** accountants want the pending remaining shown.

## Q: Should the headline mention pending entries at all?
**Decision taken:** Yes, as a separate sentence under the figures — a COUNT ("2 surpluses wait for a supervisor's
approval…") and never a sum; drawn only when > 0. No figure includes pending or rejected.
**Why:** Story 14 excludes them from totals; the count keeps the accountant from thinking a posted surplus vanished.
**Revisit if:** the owner wants no mention in the headline.

## Q: Landing order and dimming on the account/ledger grids
**Decision taken:** Open first, then pending, then the closed history; pending rows are NOT dimmed, rejected rows are.
Status labels: *Awaiting approval* (matches the tab) and *Rejected*.
**Why:** Pending is the one row someone still has to act on; rejected is an ending like cancelled.
**Revisit if:** copy review prefers other labels.

## Q: What does a refusal (`ENTRY_NOT_PENDING`) or a bare 403 show?
**Decision taken:** Refusal → a warning toast naming what the entry is now ("…is now Open. Nothing was changed.";
`status: ''` → "no longer exists"). An unknown refusal code is passed through as data. Bare 403 → en key "You no
longer hold settlement supervision…", and the `CollectionWeb/Access` probe is invalidated so the buttons disappear.
**Why:** The contract's refusal is 200 + current status; a 403 has no body so the server says nothing to pass through.
**Revisit if:** the 403 should also navigate away.

## Q: Scope creep — post confirmation and batch withdrawal
**Decision taken:** Added (small): `Settlement/Post`'s new `status` → the confirmation says the surplus waits for
approval (1977 §2); `Settlement/Bulk/Cancel` rows in `PENDING_APPROVAL` are grouped as "Still waiting for a
supervisor" and point to Reject on the account, never a write-off (1978 §5). No correction-action hiding (that is 310).
**Why:** Both are shapes in the contracts this ticket is blocked by; leaving them would tell an accountant a
pending surplus is live, or that a till got to it first.
**Revisit if:** these belong to 310 / 311.

## Q: Defensive filtering on the client
**Decision taken:** `open-lane.ts` counts only rows whose own `status` is `OPEN` (and the queue only
`PENDING_APPROVAL`), whatever the door returns.
**Why:** The ticket's rule is that every figure/projection module excludes pending and rejected; this holds it
even for a door that answered wider than asked. It drops nothing today.
**Revisit if:** never — it is a no-op against a correct server.

## Q: Test layout
**Decision taken:** One cross-module suite `approval.test.ts` over a new `approval-fixture.ts` (branch 0719), rather
than a seventh branch in `settlement-fixture.ts` (whose suite pins "six branches, no others"). The supervision
predicate is pinned in `access.test.ts`. Drive: new `tools/settlement-approval-drive.mjs` (42 checks); the
existing `settlement-drive.mjs` stub answers the new queue call empty and keeps "the open lane asks ONCE".
**Why:** The ticket's rule is one rule across modules; one suite proves it everywhere.
**Revisit if:** reviewers prefer per-module test files.

## Q: Should the post form's "already standing" warning count a pending surplus? (/code-review finding)
**Decision taken:** No change. `posting.ts`'s standing position stays OPEN-only; a second identical 500+ surplus
posted while the first waits gets no warning on the form.
**Why:** The warning states a FIGURE ("may already keep back X"), and this ticket's rule is that no figure includes
a pending entry. The supervisor's queue shows both rows side by side (same branch, same amount) before either is
approved, so the duplicate is caught at approval.
**Revisit if:** accountants double-post in practice — then add a separate *count* line ("and N more wait for
approval") beside the figure, never inside it.

## Review outcome (/code-review + /standards-review, before commit)
**Applied:** the bulk commit now also invalidates the pending queue; the queue drops its *oldest first* claim when
the door sends no ages (`PendingLane.aged`, `open.subtitlePendingUnordered`); `remainingIsAClaim` is a typed
KEEP-list (`OPEN | CONSUMED | CLOSED_OUT`) and `isDimmed` is one predicate both grids read; `approval.ts`'s purity
note is accurate (ApiError is imported only to recognise a 403); the chase and reject pills share
`ROW_ACTION_CLASS`; the approval panel has its own `approval.panel.forEntry` key; `invalidateSettlement`'s doc fixed.
**Left, as judgement calls:** "branch" in the new copy (CONTEXT.md prefers *store*; the feature already says branch
~70 times — a feature-wide sweep, not this ticket's); the per-tab ternaries in `OpenSettlements.tsx`; the
`storeName`/`currencyKey` pair; the unknown refusal code shown verbatim in the `approval.refused` toast (server data,
and only reachable if the door grows a code the contract does not define).
**Not logged above, now logged:** `correction.ts` returns *none* (`pending` / `rejected`) for the two new statuses —
by STATUS, not by role, so it does not pre-empt 310; without it a pending surplus fell through to the OPEN branch and
offered a Cancel the server refuses. `audit.ts` gains *Approved* / *Rejected* facts (read off the stamps, year-1 =
unstamped). `EntryJournal` gets its own empty sentence for a pending and a rejected entry.
**Spec partials left:** batch-withdraw's pending rows link to their account (where a supervisor has Reject) rather
than carrying an inline Reject — whether withdrawal should reject pending rows at all is 1979's / 310's to settle;
the ledger grid labels a rejected row *Rejected* without a reason column — the reason is on the entry's account
panel and audit pane, one click away (row click lands on the entry).
