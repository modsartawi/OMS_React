# HITL — ticket 331 (Withdraw… offers the server's reasons, and a bare 403 takes it away)

Pre-flight: BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. 2077 is `status: open` (expected, not a
blocker; the drive stubs `attachmentCategory` per its Web contract, unchanged). 325, 326, 327 and 330 landed on spec324,
and their HITL notes were read.

## Contract cross-check (pricing2): no drift
**Decision taken:** built to the code, which agrees with 2062's `## Web contract`:
- `AttachmentOwnerListResponse.WithdrawReasons` is `IReadOnlyList<AttachmentWithdrawReason>`, and
  `AttachmentWithdrawReason` is `{ Code, Label, LabelArabic, NoteRequired }` (camel-cased on the wire).
- `AttachmentWebEndpoints.Withdraw` is `POST AttachmentWeb/{attachmentId}/Withdraw` with body `{ reasonCode, note }`,
  behind `AttachmentWithdrawGrantEndpointFilter` (the bodiless 403).
- `AttachmentWithdrawResult` answers 400 `reasonCode` / `note`, 404 `NOT_FOUND` and 503 `NOT_SET_UP`.
- `AttachmentAccess(Categories, WithdrawCategories)` is the probe.
**Why:** the runner says "If ticket and code disagree, follow the CODE." They agree.
**Revisit if:** 2062's drafted Arabic labels change. They are the server's, so there is nothing to change here.

## Q: A partly malformed `withdrawReasons`: drop the bad entries, or drop the whole list?
**Decision taken:** all or nothing. `withdrawReasonsFrom` answers none (so Withdraw is hidden) in any of these cases:
- the value is not an array;
- a code is sent twice;
- any reason lacks a non-empty string `code` or `label`;
- a reason's `noteRequired` is not a boolean;
- a reason's `labelArabic` is present but not a string. An absent or null `labelArabic` keeps the reason, with no
  Arabic shown.
**Why:** the fail-closed rule of this wave. A half-read list could drop the one reason the user needs, or let Other
confirm without its note (and 2062 then refuses it 400).
**Revisit if:** the owner prefers to show the reasons that read cleanly.

## Q: Where does "no reasons" live in the owner list, given the frozen `api.test.ts` assertion?
**Decision taken:** `AttachmentOwnerList` gains an OPTIONAL `withdrawReasons`. The projection sets it only when the
server sent a usable, non-empty list. The moved slip assertion, `expect(list).toEqual({ stored, withdrawn })`, passes
unchanged. The order hook reads `list.data?.withdrawReasons ?? []`. The slip drawer still ignores it and passes its own
five reasons.
**Why:** "assertions unchanged" for the lifted slip suites. Absent and empty mean the same thing to every reader.
**Revisit if:** the slip drawer ever moves onto the server's reasons (out of spec 324).

## Q: The button reads "Withdraw", not "Withdraw…"
**Decision taken:** kept the shared panel's word, `attachments:withdraw.button` = "Withdraw", byte for byte. The ticket
writes "Withdraw…", but that value is the one 326 moved from `collection` and the slip drives freeze. The dialog's
title ("Withdraw a file"), final sentence, confirm ("Withdraw file"), note-required line, failure line, 404 line and
bare-403 line are the order's `document:attachments.withdraw.*` words that 327 drafted. They render for the first time
in 331 and are used unchanged.
**Why:** the lift's "values unchanged" rule. A second button key for one character would split the shared panel's
wording.
**Revisit if:** the owner wants an ellipsis on the order tab. That would need a caller-supplied button word
(`AttachmentsPanelWords`), and the slip would keep "Withdraw".

## Q: Does the bare 403 survive the page's Refresh and tab switches?
**Decision taken:** yes, with no new state. The panel's `withdrawRefused` lives as long as the tab. The tab stays
mounted, keyed by the owner, until the page is left or another owner is shown. Refresh keeps the document on screen, so
the tab is not remounted. The drive checks all three: another file, a tab switch, and Refresh.
**Why:** "for the rest of the page visit". The panel already held it (323/326).
**Revisit if:** the page ever unmounts its tab panels on Refresh.

## Q: Wording
No new keys. Everything the Withdraw flow shows was already in `attachments` (the chrome) or `document` (327's drafts).
The reason labels and the Withdrawn row's `reasonLabel`/`reasonLabelArabic` are the server's, shown as sent. All of it
still waits on the owner's read (map 1199).

## FINDING (not 331's): `document-actions-drive` still fails 3 checks
These are the same three as HITL-327 and HITL-330 (commit 7358a84 removed a command without updating the drive). The
other six document drives, the four slip drives and the order drive are green.

## Q (from the spec-axis review, inherited): the dialog's own words sit in `document`, not `attachments`
**Decision taken:** left as 326/327 built it. The title, the final sentence, the confirm button and the
failure/404/403 lines are caller words (`AttachmentsPanelWords`), so the order tab's are in `document` and the slip's
in `collection`. The chrome (Reason, Note, Cancel, Withdrawing…, the limit line) is in `attachments`.
**Why:** the lift's shape, which 331 does not reopen. Moving the words would change the slip's (frozen) values or split
the panel's words type.
**Revisit if:** the owner reads 331's "the dialog chrome come from `attachments`" as including the title and confirm.

## Review outcome
- `/code-review` found nothing.
- `/standards-review`, standards axis: no hard violations. Applied: the double target computation and the unguarded
  cast in `canWithdrawOn` (now `admittedTarget` + `probeList`, which `attachmentsTabGate` shares). Kept, as judgement
  calls:
  - the `canWithdrawOn` name (the ticket's);
  - null or undefined reasons (the Proof's "absent");
  - four props from the page;
  - 2062's reasons as stub data in the tests and the drive.
- `/standards-review`, spec axis: nothing missing, no scope creep. The inherited namespace point is above.
