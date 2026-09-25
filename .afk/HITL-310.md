# HITL-310 — decisions taken AFK

Contract read: BackOffice 1979 (`status: done`, `## Web contract` present), cross-checked against the committed
SIS.Api on `C:\Work\DMSCO\BackOffice` main: `SettlementWebEndpoints.cs` registers `Settlement/Cancel` and
`Settlement/CloseOut` through `Supervised(...)`, and `SettlementBulkEndpoints.cs` registers `Settlement/Bulk/Cancel`
through its own `Supervised(...)` (the two upload routes stay `Gated`). Routes, bodies, responses and refusal codes
are unchanged from 1185/1186/1977/1978, and the new refusal is a bare 403. **No disagreement between contract and
code.** The flag is 309's `canSuperviseSettlement` (unchanged), so no new field was added.

## Q: What does an accountant see where the correction button was?
**Decision taken:** The panel stays and names the act the entry would take plus the supervisor who can take it
(`correction.supervisorOnly.cancel` / `.writeOff`, carrying the amount or the remaining). There is no button and no
reason box. The pure decision is `correctionShownTo(offer, canSupervise)` in `correction.ts`. It returns
`{ kind: 'supervisor-only', offer }`, so the "one affordance" union survives.
**Why:** The ticket says "an accountant sees the entry without them", and story 20 says a wrong entry is fixed by a
supervisor cancelling and the accountant re-posting. The sentence is how an accountant learns that.
**Revisit if:** the owner wants the panel hidden entirely for accountants.

## Q: What does the batch-withdrawal address show an accountant?
**Decision taken:** The batch header, plus one sentence saying withdrawal is an accountant supervisor's act and to
send the page's address to one. It has no reason box and no button. The route is still reachable, because it is an
address someone may paste.
**Why:** Hiding the route would turn a pasted link into a dead end with no explanation.
**Revisit if:** the route should redirect an accountant to the door instead.

## Q: The bulk upload's confirmation linked to "Withdraw this whole batch". What does an accountant get?
**Decision taken:** No link. Instead a sentence: "only an accountant supervisor can withdraw the batch. Give them
batch {{batchId}}." A supervisor still gets the link.
**Why:** The link is an entry point to withdraw, so the ticket hides it. The batch id is what a supervisor needs, and
the withdrawal address is `/collection/settlement/upload?batch=<id>`.
**Revisit if:** supervisors need a way to FIND a batch's withdrawal without being handed the id. Nothing lists
batches today. That gap predates this ticket.

## Q: How is a bare 403 on Cancel / Close-out / Bulk Cancel handled?
**Decision taken:** The same way as 309's Approve/Reject. `supervisionFailure` (approval.ts, doc widened to five
doors) recognises it and names it in an en key (`correction.errors.forbidden` as a toast, `batch.errors.forbidden`
in the banner). It then invalidates `COLLECTION_ACCESS_KEY` so the probe re-reads and the button or act disappears.
The correction's reason box closes.
**Why:** One rule for all five supervisor doors. A 403 has no body, so the server says nothing to pass through.
**Revisit if:** the 403 should navigate away.

## Q: Copy that explains corrections — which lines name the supervisor?
**Decision taken:** Rewritten: `correction.noAmend` ("…both are an accountant supervisor's acts. A wrong entry is
cancelled by a supervisor and posted again."), the three `immutable` lines (post form, post confirmation, bulk
confirmation) and `batch.act.notRetroVoided` ("until a supervisor writes it off"). The supervisor's own `why`
sentences are unchanged.
**Why:** "The screen copy that explains corrections names the supervisor."
**Revisit if:** copy review prefers "supervisor" over "accountant supervisor" (the spec's user type name).

## Q: settlement-drive.mjs exercised cancel / write-off / withdrawal as a session with no supervision flag
**Decision taken:** Its `ALL` access body now carries `canSuperviseSettlement: true`, with a comment. The accountant's
view of the same acts is in the new `tools/settlement-supervision-drive.mjs` (39 checks).
**Why:** Since 1979, those acts are a supervisor's. The old drive's session is, in effect, one.
**Revisit if:** never. Without the flag, a real accountant would get a 403 on every act that drive presses.

## Review outcome (/code-review, before commit)
**Applied:** In `BatchWithdraw`'s outcome, a row a supervisor had already REJECTED fell into "A till got to these
first" and showed a remaining the branch does not hold. It now has its own group ("Already rejected by a
supervisor", no figure), decided by a new pure `withdrawalGroups` in `bulk.ts`, tested in `bulk.test.ts` and driven.
The server's refusal (`ENTRY_NOT_OPEN` for a REJECTED row) is the contract's own shape (1979 §1). This only changes
how the web groups it.

## Review outcome (/standards-review, before commit)
**Standards: no hard violations.** Applied: the correction panel's error handler is renamed `failed` →
`onCorrectionError`. Left as judgement calls: the check-a-403-then-invalidate shape now appears three times
(ApprovalDialog, EntryCorrection, BatchWithdraw), and so does the `useQuery(collectionAccessQuery())` +
`canSuperviseSettlement` pair (BranchAccount, BatchWithdraw, CommittedPanel). A shared hook/helper is reasonable,
but it would reach back into 309's committed ApprovalDialog/BranchAccount. That is a small follow-up refactor, not
this slice's. The `CONTEXT.md` gap for settlement terms (accountant supervisor, settlement supervision) predates
this diff and remains `/domain-modeling`'s job.
**Spec: applied.** The accountant's bulk confirmation now hands over the withdrawal ADDRESS (as selectable text,
not a link), because a bare batch id was a dead end: nothing lets a supervisor type one in. Copy that only a
supervisor now reads is in second person (`batch.act.notRetroVoided`, `batch.outcome.pendingRow`). The drive now
also exercises `ENTRY_NOT_OPEN` on Cancel (41 checks).

## Q: 1979 §3 says "offer Reject" for a pending row of a withdrawn batch. Inline, or a link?
**Decision taken:** A link to the entry's account (309's behaviour kept). The row now tells the supervisor to open
it there to reject, with a reason.
**Why:** Story 9 requires amount, store, accountant AND description before a supervisor decides. The bulk-cancel
row carries no `postedByName` and no `reason`, so an inline ApprovalDialog would either fetch the account anyway or
authorise with less than story 9 demands. The account already has Reject beside the whole entry.
**Revisit if:** supervisors want one-press rejection from the batch outcome. That needs the bulk-cancel row to grow
the entry's poster and description (a BackOffice contract change).

## Left as-is (pre-existing, not 310's)
- A cancel refused with a code the panel does not map (e.g. `ENTRY_NOT_OPEN`) shows the server's code verbatim in
  the race notice (`raced.reason`, 272's pass-through). The dismiss button then re-reads the entry's real status.
- The UI requires a reason on cancel, close-out and withdraw, while 1979 says `reason` is optional. That is 272/273's
  deliberate choice (the audit reads it), and a stricter client is safe.
- If the access cache were ever cold, `BatchWithdraw` and `CommittedPanel` could briefly show the supervisor-only
  notice. The ScreenGate always warms it first.
