# HITL — ticket 327 (opening the Attachments tab lists the order's files, once)

Pre-flight: 325 (6a09afe) and 326 (edd91a0) landed on spec324 and their HITL notes were read. BackOffice 2061, 2062 and
2063 are `status: done` on pricing2. BackOffice 2077 is `status: open` (expected, not a blocker): built against its
`## Web contract` stub — `attachmentCategory`, absent when null. No rename since it was filed.

## Contract cross-check (pricing2) — drift found
**Decision taken:** built to the CODE. One drift, recorded in 327's comments:
- `AttachmentDto.cs` also carries `storeCode` (2067, the till viewer's filing store), which no web contract names.
  Not typed and not shown (nothing in spec 324 asks for it); the drive's stub sends it so the list is proven not to trip
  over it. `caption` (2056) is on the DTO for every owner kind (`''` when none), which matches the spec's
  "the shared item plus caption".
- Everything else agrees: `SdDocumentHeaderModel.AttachmentOwnerNo` / `AttachmentCount` (`int?`), both omitted when
  null; `AttachmentOwnerListResponse.Withdrawn` + `WithdrawReasons` (`{ code, label, labelArabic, noteRequired }`);
  `WithdrawnAttachmentDto` has no caption; `AttachmentRefusal.ReadNotAudited()` = 503 `READ_NOT_AUDITED`; `/Content`'s
  404 `NOT_FOUND` and 502 `FILE_SERVER_MISSING` (`AttachmentContentResult.cs`); `ListByOwnerAsync` audits an
  `SD_DOCUMENT` list and refuses 503 when it cannot. `SdDocumentAttachmentReads` has no category yet (2077 unbuilt).
**Why:** the runner: "If ticket and code disagree, follow the CODE."
**Revisit if:** 328/329 or a later spec wants the filing store shown.

## Q: How does the panel wait for the first selection while staying mounted?
**Decision taken:** the shared panel gains an optional `enabled` prop (default `true`, so the slip drawer is unchanged).
The page latches `openedOwner` on the tab's first selection and passes `opened` down; the page observes the same
ByOwner key with the same options (for the badge), so the two observers share one request — the drive counts exactly
one. The latch is reset whenever the route's number changes (the `/code-review` finding below).
**Why:** HITL-326's seam note offered this or "mount only after first selection"; the runner says "latch an 'opened'
flag on first selection and gate enabled on it".
**Revisit if:** never for slips — the four slip drives pass unedited.

## Q: Is a caption shown for every owner, or only for the order?
**Decision taken:** a `captioned` prop (default `false`). The order tab passes it; the slip drawer does not, so a slip
filed by a till with a caption still renders exactly as today. The rule is one pure function, `attachmentCaption`
(empty / blank / absent → nothing shown).
**Why:** "no behaviour change" for the slip drawer; the spec lists "whether Add takes a caption" as a panel parameter,
and 330 can reuse this one flag for Add.
**Revisit if:** the owner wants slip captions shown too (drop the flag).

## Q: Does a command's reload (Reschedule, Change Store, …) re-read the files?
**Decision taken:** no. Only the Refresh button re-reads ByOwner, and only once the tab is opened. Commands keep
calling `reload()`, which never touches the files.
**Why:** every ByOwner is an audit row; the spec names exactly four re-reads (Add, Withdraw, a `/Content` 404, Refresh).
**Revisit if:** the owner wants a command's success to refresh the list too.

## Q: The probe — asked on every document page?
**Decision taken:** only when the document names both `attachmentOwnerNo` and `attachmentCategory`; otherwise the
shared `AttachmentWeb/Access` entry is not asked at all. Same key and options as the slip grids (one entry).
**Why:** fail-closed without a request; an older SIS.Api (no 2077) never sees the probe from this page.
**Revisit if:** never.

## Q: Wording (all new; waits on the owner's read, map 1199)
**Decision taken:** in `document.json`: tab `Attachments`; badge title `{{count}} file(s)`; empty "No file is attached
to this order."; list loading / refused / failed; source column "Source" (not the slip's "Till" — an order's source is a
till, a partner key or the web); preview region / prompt / loading / alt / failed. The panel's type also needs the Add
and Withdraw words, so plain drafts are there now ("Add prescription", "Withdraw file", …) — not rendered in 327
(Add and Withdraw are off); 330 and 331 own their final wording.
**Why:** i18n-zero-literal; `AttachmentsPanelWords` is a complete words object.
**Revisit if:** the owner rewords any of them.

## Q: Test hooks in the order drive say `slip-*`
**Decision taken:** the drive reads the panel's frozen hooks (`slip-list`, `data-slip`, `slip-gone`, …) scoped to
`#tabpanel-attachments`.
**Why:** HITL-326 froze them for the four slip drives; a hook-prefix parameter would be speculative for one reader.
**Revisit if:** the owner wants owner-neutral hooks (a prefix prop, the slip passing `slip`).

## FINDING: `document-actions-drive` is red before this wave (not 327's)
**Decision taken:** left unedited. 3 checks fail identically at the base commit edd91a0 (proved by running the drive
against a throwaway worktree of edd91a0): "each cluster holds exactly two commands — 2,1,2", "the commands read in the
order the taxonomy fixed", "all eight commands render". Commit 7358a84 (2026-09-25, "The command bar no longer offers
Withdraw Request") removed a command and updated `commands.test.ts` but not this drive. The other six document drives
pass.
**Why:** a drive fix for an unrelated shipped change is outside 327's scope walls.
**Revisit if:** someone owns 7358a84's follow-up — the drive's cluster/eight-command expectations need updating to 7.

## Review outcome
- `/code-review`: one finding, fixed — the opened latch survived an in-route move between two documents (A → B → Back
  to A read A's list on load, no click). Reset while rendering on a new route number; the drive now moves the router in
  place and asserts zero reads (mutation-checked: without the reset, 1 read).
- `/standards-review`: no hard violations; spec axis found nothing missing or wrong. Applied: the tab state moved into
  `useOrderAttachments` (the page stays about the document; one place holds the observer's options), and one core
  `rereadAttachments`. Not applied: the ticket-mandated types only 331 reads; `attachmentCaption(unknown)` (a slip item
  has no caption field); the badge-title ternary; file names; `CONTEXT.md` glossary (a `/domain-modeling` pass).
  The spec axis flagged the Add/Withdraw word drafts as early copy (see the wording question above).
