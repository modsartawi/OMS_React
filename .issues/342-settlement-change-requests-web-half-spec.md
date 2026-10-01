---
type: spec
status: ready
---

# 342 — Settlement entry change and delete requests: the web half (frontend half of BackOffice spec 2190)

The owner's rule, the stories and the glossary are BackOffice's. Read
`C:\Work\DMSCO\BackOffice-2149\.issues\2190-a-settlement-entry-is-changed-or-deleted-on-a-supervisors-approval-spec.md`,
ADR 0055 in that tree's `docs\adr` ("a settlement entry is corrected in place only by an approved
change request"), and the **Change request (settlement)** entry in that tree's `CONTEXT.md`.
Decision numbers D1…D21 below are that spec's. W1…W14 are this file's own.

> ⚠ **Where the BackOffice half lives today.** Tickets 2191–2197 are built and committed on
> BackOffice branch `spec2149` (worktree `C:\Work\DMSCO\BackOffice-2149`), which is **not yet merged**
> into `pricing2`. The wave was first minted as spec 2161, tickets 2162–2168, ADR 0050 and migrations
> 091–094. Those numbers collided with other work on `pricing2`, so it was renumbered before the merge
> (`a2c729f00`): spec **2190**, tickets **2191–2197**, ADR **0055**, migrations **095–098**. Code
> comments, run notes or chat from before then that cite the old numbers mean these.

**The seam is the contract.** Every server-backed item here calls a door built by a BackOffice ticket
of spec 2190, whose `## Web contract` section records the route, method, fields and a sample response:
2191 (the four doors, the act response, the Ledger mark), 2192 (spent floor, entry figures on the
History read), 2193 (delete), 2194 (Withdraw, one open request, supersede, a supervisor's own request)
and 2195 (theft day). Build and test against a stub of **exactly that shape**, and never invent a
field. The one read this spec needs that does not exist yet is the supervisor's queue (W9), which
needs a new BackOffice ticket before its web ticket can start.

## Problem Statement

An accountant who posts a wrong figure onto a branch's settlement account has no way to fix it from
the web. The only corrections there are the supervisor's: **Cancel** an untouched entry, or **Write
off** what is left of a partly spent one. Neither changes a figure. A shortage typed as 350 instead of
300, a surplus with the wrong description, or a theft named against the wrong business day can only be
cancelled and posted again under a new number, and only by a supervisor. Once the branch has spent
from the entry, even that is gone.

The server side now exists (BackOffice spec 2190). An accountant asks for a change or a delete with a
reason, an accountant supervisor approves or rejects it, and the entry is corrected in place with its
history kept. Nothing on the web reaches it yet.

## Solution

Every place the web shows a single settlement entry gains a **change request** pane:
- An accountant (settlement grant) can ask to change the entry's amount, its description, or a theft's
  business day, or ask to delete an entry nobody has spent from. The ask needs a reason.
- While a request waits, the entry keeps working at its current figures, and the pane shows the
  waiting request (old → new, who asked, when, why).
- The requester can withdraw it.
- An accountant supervisor (settlement supervision) approves or rejects it right there. A supervisor's
  own request applies at once.
- Every request, decided or waiting, joins the entry's audit column.

Ledger and open-settlement rows mark an entry with a request waiting on it. A new **Change requests**
tab in Open settlements gives the supervisor one queue of every waiting request in the estate.

The web never decides a rule. It shadows the server's rules to choose which buttons to draw. Every
refusal is the server's, and it is shown in words keyed off the server's code.

## User Stories

1. As an accountant, I want a "Request a change" action on an entry I am looking at, so that a wrong amount or description is fixed without cancelling and reposting it.
2. As an accountant, I want the change form to open with the entry's current amount and description filled in, so that I only edit what is wrong.
3. As an accountant, I want the form to show the lowest amount I may ask for (what the branch has already spent), so that I am not refused for asking below it.
4. As an accountant, I want the amount I type shown rounded the way the branch's currency rounds it, so that I see the figure that will land (whole riyals for SAR; three decimals for BHD/KWD/OMR).
5. As an accountant, I want to be told before I send it that my request changes nothing, so that I don't raise an empty request.
6. As an accountant, I want a reason box that is required and limited to 200 characters, so that the supervisor knows why I am asking.
7. As an accountant correcting a theft, I want to move it to another business day using the same day picker the post dialog uses, so that a theft named against the wrong day lands on the right one.
8. As an accountant, I want a "Request delete" action on an entry nobody has spent from, so that an entry posted in error is withdrawn with a record of why.
9. As an accountant looking at an entry the branch has spent from, I want to be told it cannot be deleted and offered to reduce it to the spent figure instead, so that I take the one correction the rules allow.
10. As an accountant, I want to see the request I raised waiting on the entry, with its old and new figures, so that I know what is pending.
11. As an accountant, I want to withdraw my own waiting request, so that a request I raised by mistake never reaches a supervisor.
12. As an accountant, I want no Withdraw button on someone else's request, so that I am not offered an act the server refuses.
13. As an accountant, I want to be told when an entry already has a request waiting, naming it, so that I don't try to raise a second one.
14. As an accountant, I want the entry to show a "change waiting" mark in the Ledger and in Open settlements, so that I can see at a glance which entries are under review.
15. As an accountant supervisor, I want Approve and Reject on a waiting request in the entry's pane, so that I decide it beside the entry's current figures.
16. As an accountant supervisor, I want the pane to show what the branch has spent from the entry right now, so that I judge the request against today's figures, not the ones at the time it was raised.
17. As an accountant supervisor, I want rejecting to require a reason, so that the accountant knows why.
18. As an accountant supervisor, I want a queue of every waiting change and delete request across the estate, so that nothing waits unseen.
19. As an accountant supervisor, I want each queue row to show the branch, entry number, kind, old → new figures, requester, time and reason, so that I can decide most requests from the queue itself.
20. As an accountant supervisor, I want an approval that the server refuses (the branch spent past the new amount, the day was collected, the entry moved) to stay in my queue with the reason shown, so that I can reject it with a reason or ask for a fresh request.
21. As an accountant supervisor, I want my own change or delete to apply at once, and the form to say so before I press it, so that I am never surprised that no approval step followed.
22. As an accountant supervisor, I want to be told when my own change is blocked by an accountant's waiting request, and be able to decide that request from the same place, so that I can clear it first.
23. As an accountant supervisor, I want to know that cancelling, writing off, approving or rejecting an entry ends any request waiting on it, so that I am not surprised to find it marked superseded.
24. As an accountant or supervisor, I want every request on an entry (applied, rejected, withdrawn, superseded, waiting) to appear in the entry's audit column with who, when and why, so that the entry's whole story is in one place.
25. As an accountant or supervisor, I want a changed entry's panel to say "Changed" with its earlier amount, so that I see what the branch's till now shows next to the same entry.
26. As an accountant or supervisor, I want the screen to redraw from the server's answer after every act, so that I never see figures the server did not return.
27. As anyone without the grant an act needs, I want the button absent, and a bare 403 handled as the existing supervisor screens handle it, so that I am never shown a broken act.
28. As an accountant correcting a theft whose day has been collected, I want to be told it can no longer be corrected or deleted, so that I understand nothing posted to SAP can be contradicted.
29. As a reader of the screen, I want the entry's own text called "Description" and the request's text called "Reason", so that the two are never confused.

## Implementation Decisions

- **W1 — No new grant, no new probe flag (D20).**
  - Raise, Withdraw and History sit behind the settlement grant the screen already reads as
    `canOpenSettlement`.
  - Approve and Reject sit behind settlement supervision, which the screen already reads as
    `canSuperviseSettlement` off the Collections probe.
  - The probe only decides which buttons are drawn. A bare 403 is handled through the existing
    `supervisionFailure` path.
  - **Never decide an outcome from the probe.** A supervisor's own request applying at once is
    known from the server's `requestStatus: "APPLIED"`, never from the flag.

- **W2 — Where the pane lives.** A new change-request pane joins the entry panel in the branch account
  view, beside the existing approval, correction, journal and audit panes. Opening an entry from the
  Ledger or the open-settlement lanes opens that same panel. Placement:
  - Above the correction pane (Cancel / Write off).
  - Below the approval pane, for a pending entry.

- **W3 — A pure offer module, the server's shadow** (same discipline as `correction.ts`). One pure
  function decides what the pane draws for an entry. It takes the entry's kind, status, amount,
  remaining, the History read's open request, and the session's grants and user id. It returns one
  tagged union, never a set of predicates a caller can combine. The offers:

  | Entry | Accountant | Supervisor |
  |---|---|---|
  | Finished (`CANCELLED`, `CLOSED_OUT`, `REJECTED`) | nothing; the sentence says why (D2) | same |
  | Open request waiting | the waiting-request card; Withdraw if the session raised it | the card with Approve / Reject; Withdraw only if they raised it |
  | `PENDING_APPROVAL` / `OPEN` / `CONSUMED`, no request waiting, nothing spent | Request a change · Request delete | Change now · Delete now |
  | Same, something spent | Request a change; delete replaced by "reduce to the spent figure" (W5) | Change now; same replacement |

  - **Spent** is the server's `spentAmount` from the History read, never `amount − remaining`
    computed here. Equality is compared at the scale money is held at, as `correction.ts` does.
  - **Theft:** the same rows apply. The web does not shadow the collected-day rule (it has no
    reliable read of it), so `THEFT_DAY_COLLECTED` arrives as a refusal.

- **W4 — The change form (D3, D5, D17).**
  - **Fields:** amount, description and, for a theft only, business day. Amount and description are
    pre-filled with the current values; the day uses 339's closed-day field. A required reason uses
    the existing `ReasonField`, limit 200.
  - **What is sent:** only the fields that differ, as `newAmount` / `newDescription` /
    `newBusinessDay`. An unchanged field goes as `null`.
  - **Amount:** rounded for display with the posting module's branch-currency rounding. The floor
    "lowest allowed: X" uses the History read's `spentAmount`. A figure below the floor or ≤ 0 is
    refused in the form; the server still decides.
  - **No change:** Submit is disabled while nothing differs after rounding (shadowing `NO_CHANGE`).
  - **Supervisor wording:** for a supervisor the button reads "Change now" and the form says
    "applies immediately — no approval step" (D8).

- **W5 — The delete form (D6).**
  - **Untouched entry:** a reason only.
  - **Something spent:** there is no delete. The pane says "The branch has spent X from this entry,
    so it cannot be deleted" and offers "Reduce it to X", which opens the change form with `X` filled
    in. The same happens when the server answers `DELETE_SPENT`, using that answer's `spentAmount`.
  - **What is sent:** `requestKind: "DELETE"` with no figures.

- **W6 — The waiting-request card (D9, D10, D18).**
  - **Content:** request kind; old → new amount, description and day (only those that differ); the
    requester's name and time; the reason.
  - **The entry stays live:** the card says the entry keeps working at its current figures until the
    request is decided.
  - **Withdraw** is drawn only when the session's `userId` equals `requestedByStaffId`. Both are the
    session's UserId claim on the server; the first ticket confirms this against a live session. The
    server's `NOT_REQUESTER` remains the guard.
  - **Reject** opens a reason box (required, ≤ 200).

- **W7 — Refusals are codes, not messages.** One pure map from every code in the 2191–2195 contracts
  to the sentence and the next step. The server's `message` is the fallback only for an unknown code.
  The 200 refusals:

  | Code | Sentence (gist) | Next step offered |
  |---|---|---|
  | `ENTRY_NOT_OPEN` | the entry no longer exists | close the pane |
  | `ENTRY_FINAL` | the entry was cancelled / closed out / rejected | redraw |
  | `BELOW_SPENT` | the branch has spent X; ask for at least X | refill the floor from `spentAmount` |
  | `DELETE_SPENT` | the branch has spent X; it cannot be deleted | "Reduce it to X" (W5) |
  | `CHANGE_ALREADY_OPEN` | a request is already waiting | open it (`changeRequestId`); re-read History when the id is `''` |
  | `NO_CHANGE` | nothing would change | stay in the form |
  | `CHANGE_STALE` | the entry moved since this was asked | supervisor: reject with a reason |
  | `CHANGE_NOT_OPEN` | already applied / rejected / withdrawn / superseded | redraw; `requestStatus` names which |
  | `NOT_REQUESTER` | only the requester can withdraw it | none |
  | `THEFT_DAY_COLLECTED` | the theft's day (or the new day) is collected | supervisor at approval: reject with a reason |
  | `WRONG_KIND`, `REMAINING_INSUFFICIENT` | 2191's tracer refusals, not answered since 2192 / 2195 | mapped defensively to a generic sentence |

  - **400 codes** map to field errors in the form: `SettlementAmountRequired`,
    `SettlementAmountRoundsToZero`, `SettlementReasonTooLong`, `SettlementChangeReasonRequired`,
    `SettlementReasonRequired`, `SettlementDeleteTakesNoFigures`, `SettlementBusinessDayTheftOnly`,
    `SettlementTheftBusinessDayRequired`, `SettlementTheftDayNotClosed`, and the body/id codes.

- **W8 — Redraw from the answer, then re-read (D15).**
  - **Immediately:** every act response carries the entry's figures now (`amount`, `remainingAmount`,
    `spentAmount`, `description`, `entryStatus`, `businessDay`), and the pane redraws from those.
  - **Then:** the History read and the view's own list (Account, Ledger or lane) are refetched.
  - **A refused approve** leaves the card in place with the refusal shown. The request is still `OPEN`.

- **W9 — The supervisor's queue: a new BackOffice read, then a new tab.**
  - **What is missing:** spec 2190 has no estate-wide read of waiting requests. The Ledger only
    marks an entry (`openChangeRequestId`), and History is per entry.
  - **Proposed read for a BackOffice ticket to record:** `GET Settlement/ChangeRequest/Open?limit=`,
    behind settlement supervision. Each row carries the History row's request fields plus `storeId`,
    store code and name, `entryNumber`, `entryKind`, `entryStatus`, `amount`, `remainingAmount` and
    `spentAmount`, oldest first. The BackOffice ticket's `## Web contract` fixes the final shape.
  - **The tab:** "Change requests", drawn only for `canSuperviseSettlement`, beside "Awaiting
    approval" in Open settlements. Rows are approved or rejected inline, with the W7 refusals kept on
    the row.
  - **Blocking:** the web ticket for the tab is blocked by that BackOffice ticket.

- **W10 — The "change waiting" mark (D20).** The Ledger grid and the open-settlement lanes (both
  `Settlement/Ledger`) show a mark on a row whose `openChangeRequestId` is not `''`. The branch account
  view (`Settlement/Account`) carries no such field; its panel learns of a waiting request from the
  History read when the entry is opened. No Account field is added for this.

- **W11 — History in the audit column (D14).**
  - **The audit pane:** gains one fact per request, read from History and merged by time with the
    entry's existing facts: raised, applied, rejected (with reason), withdrawn, superseded. Each names
    the actor, under the name recorded then. Times are shown as received, in local wall clock.
  - **Changed tag:** when an `APPLIED` change exists, the panel header shows "Changed" with its date
    and the earlier amount. The rule is the till's (2197): the date is the latest applied change's;
    the earlier amount is the `oldAmount` of the latest applied change that moved the amount.

- **W12 — A direct act supersedes (D9).** Cancel, Write off, Approve and Reject of a pending entry, and
  Bulk Cancel are unchanged on the web. Their confirm dialogs gain one sentence when a request is
  waiting: "the waiting change request will be closed as superseded". After the act the card shows the
  request as superseded.

- **W13 — Words (D21).**
  - "Change request" is the noun; "Request a change", "Request delete", "Change now" and "Delete now"
    are the acts.
  - The entry's text is "Description" everywhere. The request's and the rejection's text is "Reason".
  - A request is withdrawn, rejected or superseded, never "cancelled". A delete *cancels the entry*.
  - English locale, `settlement` namespace. Arabic appears only where existing labels already carry it
    inline.

- **W14 — Wire models.** Declared in `core/models/settlement.ts`:
  - **New:** the History read, the act response (with 2195's `businessDay`), and the Raise / Withdraw
    / Approve / Reject bodies.
  - **Ledger row:** gains `openChangeRequestId`.
  - **Typing:** every field as the contracts name it; money as `number`, dates as the local strings
    the server sends.

- **Boundaries.**
  - Web-only, against BackOffice tickets 2191–2195, plus one new BackOffice read for W9.
  - No feature flag: the doors exist once SIS.Api ships the wave, and until then they 404.
  - The panes must answer a 404 with "not available yet", never a crash, so the web may ship first.
  - No till work (2197 is the till's) and no Notification Center work (2196's notice goes to the
    branch, not the web).

## Testing Decisions

- **Seam:** oms-react's own suite, at the level its settlement feature already tests. Pure modules for
  rules (like `correction.test.ts`, `approval.test.ts`, `posting.test.ts`), and component tests for
  what a pane draws from a stubbed answer.
- **Fixtures:** built from the `## Web contract` samples of 2191–2195, field for field (like
  `approval-fixture.ts` and `settlement-fixture.ts`).
- **The offer module (W3):**
  - every status × kind × spent × waiting × grant cell of the table;
  - equality at holding scale, including a BHD entry spent by `0.001`;
  - Withdraw drawn only for the requester.
- **The form (W4/W5):**
  - only differing fields are sent;
  - rounding for SAR and BHD;
  - the spent floor;
  - Submit disabled when nothing differs;
  - the theft-only day field;
  - delete sends no figures;
  - "Reduce it to X" pre-fills the change form.
- **The refusal map (W7):** every code in the contracts maps to a sentence and a next step; an unknown
  code falls back to `message`.
- **Redraw (W8):** after an approve, the pane shows the act response's figures before the refetch
  lands. A refused approve keeps the card `OPEN` with the refusal.
- **Audit and tag (W11):**
  - request facts are merged by time;
  - the "Changed" tag's date and earlier amount follow the till's rule. Cases: 500 → 450 → 420 shows
    450; an amount change followed by a description-only change keeps the amount change's earlier
    figure and the later date.
- **Mark and queue (W10/W9):** the Ledger mark from `openChangeRequestId`. The queue tab is drawn only
  for supervision, and is tested against the BackOffice ticket's recorded sample once it exists.

## Out of Scope

- Everything BackOffice spec 2190 lists as out of scope, including:
  - batch requests over many entries (D11);
  - an automatic opposite entry below the spent floor (D5);
  - reprinting papers (D19).
- An Arabic locale for the web.
- Any change to how entries are posted, approved, cancelled or written off, beyond the supersede
  sentence in W12.
- Exporting the change-request history to Excel. The queue tab exports through the shared grid
  writer only if the ticket finds it free.

## Open Questions

- **The owner's rulings on the BackOffice wave, which change this spec's copy, not its shape** (see
  `.afk/REVIEW-2165.md` and `HITL-2168.md` in the BackOffice-2149 worktree; the run wrote them under the wave's old numbers 2165 and 2168):
  - **A supervisor's own change while an accountant's request waits.**
    - Today it is refused `CHANGE_ALREADY_OPEN`, and W6/W7 tell the supervisor to decide the
      waiting request first.
    - If the owner rules that it supersedes instead, the refusal goes away and the form gains the W12
      sentence.
  - **A change approved while the entry was still pending** is tagged "Changed" at the till. W11
    follows the same rule, so the web and the till agree whatever the ruling.
- **W9's read is a proposal.** Its BackOffice ticket owns the final shape and the grant. If the owner
  prefers a Ledger criterion (`Settlement/Ledger?changeRequest=OPEN`) over a new door, the queue row
  loses the request's figures and each row opens the panel instead.
