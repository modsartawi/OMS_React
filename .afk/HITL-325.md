# HITL — ticket 325 (the slip rules, reads and upload store live in `core/attachments`)

Pre-flight: no ticket of this wave had landed (`git log` on spec324 shows only the spec and the runner). 325 has no
BackOffice dependency (its first act is not the 2061/2062/2063 check; that starts at 327).

## FINDING: one expected value changed — the ByOwner cache-key literal in the Add-slip freshness test
**Decision taken:** The ticket requires the query keys to "move under one `attachments` head" and says
`markSlipDayChanged` "now invalidates the new ByOwner key". The Add-slip freshness test (322's, now
`features/collection/inquiry/slip-freshness.test.ts`) pinned the old key as a literal, so its first expected entry is
now `['attachments', 'by-owner', 'STORE_DAY', OWNER]` instead of `['collection', 'slips', 'by-owner', OWNER]`. The
other two entries (both grid heads, `refetchType: 'none'`) and their order are unchanged. A script compared every
`expect` of the four old suites with the new ones (after the renames below): 222 old expects, and this is the only one
that differs.
**Why:** it is a client cache identity, not wire behaviour. No request, body or screen changes, and the four slip
drives pass unmodified. Keeping the old key would break the ticket's own "one `attachments` head" rule.
**Revisit if:** the owner reads "assertions unchanged" as covering cache-key literals too. The only way to keep this
literal is to leave ByOwner under `['collection','slips']`, which contradicts the ticket.

## Q: What are the moved functions called in core?
**Decision taken:** generic names, since the order page reads them too: `attachmentSource` (was `slipTill`),
`attachmentPreviewKind`, `attachmentOwnerList`, `attachmentContentFailure`, `attachmentFileRefusal`,
`pickAttachmentFiles`, `canSendUpload`, `attachmentUploadForm`, `ATTACHMENT_MAX_BYTES`, `ATTACHMENT_ACCEPT`,
`useAttachmentUploads`, `uploadInFlight`, `attachmentAccessQuery`, `attachmentsByOwnerQuery`,
`attachmentContentQuery`, `attachmentsApi`. Unchanged: `holdsCategory`, `wallClockText`, `withdrawnNewestFirst`,
`keepsIdOnClose`, `isRetryableUpload`, `FILE_SERVER_UNREACHABLE`, and every withdraw rule name. The moved tests call
the new names; their expected values are untouched. There are no slip-named re-exports left behind (that would be a
second path to one rule).
**Why:** a `slip*` name in `core/` would mislead the prescription callers (327-331).
**Revisit if:** the owner prefers the slip names kept as aliases in the feature.

## Q: `slipTill` is not in the ticket's list of moved rules. Move it?
**Decision taken:** yes, as `attachmentSource`. `SlipTillText.tsx` stays in the feature for now (326 moves the panel).
**Why:** it is the spec's source-line rule ("sourceDevice when set, else Web · uploadedBy (the slip rule, unchanged)"),
which the order tab uses verbatim. Leaving it in the feature would force 326 to move it anyway.
**Revisit if:** never — 326 needs it in core.

## Q: How does the lifted upload store refresh after a 200, when the grids are the slip's?
**Decision taken:** the store no longer takes a `QueryClient`. `add(target, files, onStored)` and
`retry(target, id, onStored)` run the caller's `onStored` after each 200 and never on a refusal. The slip's Add passes
`() => markSlipDayChanged(queryClient, ownerKey)`, which (as before) invalidates the day's ByOwner and marks both grid
heads stale with `refetchType: 'none'` — the same three invalidations in the same order.
**Why:** `core/` must not learn the Collections grid keys. The callback keeps the grid rule where it lives.
**Revisit if:** 326/330 decide the panel itself re-reads ByOwner and `onChanged` is grid-only. Then
`markSlipDayChanged` should drop its ByOwner line so the slip does not invalidate twice.

## Q: How is the store keyed by owner kind + key?
**Decision taken:** one flat record, slot = `` `${ownerKind} ${ownerKey}` `` (`uploadSlot`), read through
`uploadsOf(state, owner)`. Owner kinds are space-free machine codes, so the first space always splits the two.
**Why:** it keeps the store's patch logic as it was, and a vitest proves one key under two kinds is two slots.
**Revisit if:** an owner kind ever contains a space.

## Q: How do the withdraw rules take the slip's reasons before 326 makes them data?
**Decision taken:** `needsWithdrawNote(reasons, code)` and `canConfirmWithdraw(reasons, code, note)` take a list of
`{ code, noteRequired }` (`WithdrawReasonRule`). The slip's `WITHDRAW_REASONS` gains `noteRequired` (Other only) and is
passed in by the dialog and by the slip tests. `withdrawBody` takes a plain `reasonCode: string`.
**Why:** the ticket moves "the note needed" to core and keeps the five-code list in the feature, so the rule has to take
the list. 326's `{ code, label, labelArabic?, noteRequired }` is a superset of this shape.
**Revisit if:** 326 prefers the rule to take the picked reason object instead of the code.

## Q: What does "freshness as a parameter" look like in 325?
**Decision taken:** `attachmentsByOwnerQuery(owner, freshness)`, where `AttachmentFreshness` is only `staleTime`,
`gcTime`, `refetchOnWindowFocus` and `refetchOnReconnect`. `retry: false` and the key cannot be overridden. The slip
passes `READ_ON_EVERY_OPENING = {}` (the app's defaults, exactly the options it had). The order tab's preset is left to
327, which is the ticket that uses it.
**Why:** named presets would put an unused constant in 325; the parameter is what 325 introduces.
**Revisit if:** 327 wants the order preset exported beside the slip's (a one-line add).

## Q: Where do the slip-only test cases go?
**Decision taken:**
- `slips.test.ts` keeps the count, filter, probe, column, owner key and `slipDayOf` cases, and gains the slip's
  six-part form case (was in `slip-upload.test.ts`), now built through `attachmentUploadForm(…, slipTarget(ownerKey))`.
- `slip-withdraw.test.ts` keeps the grant, the reason list and the confirm/note rule over the slip's five reasons.
- The Add-slip freshness cases moved to a new `slip-freshness.test.ts`, since they pin `markSlipDayChanged`.
- Everything generic moved to `src/core/attachments/{rules,upload,upload-store,withdraw}.test.ts`
  (`upload.test.ts` and `upload-store.test.ts` by `git mv`).
**Why:** a core test may not import a feature (the boundary gate scans tests too), and the ticket says slip-only cases
stay in the feature.
**Revisit if:** the owner prefers the freshness cases inside `slips.test.ts`.

## Q: The standards review's judgement calls — which were applied?
**Decision taken:** applied:
- ByOwner's key is spelled one way, `attachmentsByOwnerKey(owner)`; the slip invalidates it through `slipTarget`.
- `AttachmentOwner` moved to `core/models/attachment.ts`.
- The core store test no longer uses slip names.

A spec-review gap was closed too: core `rules.test.ts` now pins `holdsCategory`, the bare-string trap included.

Not applied:
- `withdraw.ts`'s `'NOT_FOUND'` beside `rules.ts`'s `CONTENT_NOT_FOUND`: these are two routes' codes (Withdraw's and
  /Content's), which happen to match. Both literals are exactly what they were before the lift.
- `AttachmentFreshness`'s `gcTime`/`refetchOnReconnect`, which nothing uses yet: the ticket asks for freshness as a
  parameter, and these are exactly the options 327's order tab sets.
- Core doc comments that name the slip caller: they follow `core/collection/api.ts`'s precedent (comments only, no
  imports).
- `CONTEXT.md` has no entry for "attachment register / owner / owner kind", and "attachment" also names a deposit's
  slip URLs.
**Why:** each skipped item is either a pre-existing spelling, a ticket-mandated seam, or glossary work that belongs to
`/domain-modeling`, not a no-behaviour-change prefactor.
**Revisit if:** the owner runs `/domain-modeling` for spec 324. It should add "attachment register", "owner kind" and
"owner key", and tell them apart from a deposit's attachments.
