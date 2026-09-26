# HITL — ticket 321 (a day's slips open in a drawer with preview and download)

Pre-flight: BackOffice 2034 and 2035 are both `status: done` on `pricing2` and both carry `## Web contract`.
Contract vs code (`AttachmentDto.cs`, `WithdrawnAttachmentDto.cs`, `AttachmentOwnerListResponse.cs`,
`AttachmentWebEndpoints.cs`, `AttachmentContentResult.cs`, `AttachmentOwnerKinds.cs` on pricing2): **no drift**.
The stubs use exactly those shapes.

## Q: The drawer primitive (the ticket's open question)
**Decision taken:** `SlipDrawer.tsx` inside `features/collection/inquiry`, with its own native `<dialog>` frame. The frame copies `core/ui/Modal`'s contract (`showModal`, Escape, backdrop click, React state as the single source of `open`), pinned to the inline end at full height (`ms-auto`). It imports nothing from `callcenter` and puts nothing in `layout/` or a `src/components/` folder.
**Why:** Modal draws a centred box and takes no placement or className. ConfirmSheet is another feature's. `layout/` is the composition root, not a shared component shelf, and the wave forbids both routes.
**Revisit if:** a second feature needs a side drawer. It then graduates to `core/ui/` as a `placement` on Modal or a sibling of it.

## Q: The drawer's scrim trips the colour-literal gate
**Decision taken:** Added one `ALLOWED` entry in `tools/check-palette.mjs` for `SlipDrawer.tsx` / `bg-black/50`, with its reason, the same way `ViewManager.tsx` and `AppShell.tsx` scrims are listed.
**Why:** a scrim is black in both themes by intent. That is the gate's own documented precedent.
**Revisit if:** a scrim token lands in `global.css`.

## Q: 320's drive asserted "the count is not a link or a button yet"
**Decision taken:** Narrowed that one check in `tools/slip-count-drive.mjs` to "an unknown (null) count is not a link or a button". It still passes 64/64. The four OLD drives (ready, collection, collections-filters, four-filters) are unmodified and green.
**Why:** that assertion was 320's placeholder for exactly what 321 builds. What stays true from 320 is that a null is never clickable.
**Revisit if:** the reviewer reads "320's drive unchanged" as byte-for-byte. The alternative would be a non-button clickable span, which is worse for accessibility.

## Q: How are `storedAt` / `withdrawnAt` drawn?
**Decision taken:** `wallClockText`, a pure regex cut: `yyyy-MM-ddTHH:mm[:ss]` becomes `yyyy-MM-dd HH:mm[:ss]`, and any fraction of a second is dropped (`.1234567` from a .NET `DateTime.Now`). Anything else is shown exactly as sent. Never `Date`.
**Why:** the wave allows a string cut of the T. Seven fraction digits are noise to an accountant.
**Revisit if:** the owner wants the fraction, or wants the raw `T` kept.

## Q: What do 404 and 502 on `/Content` say, and what do they branch on?
**Decision taken:** They branch on the CODE (`slipContentFailure`). `NOT_FOUND` shows the drawer's own sentence ("… is no longer readable: it was withdrawn …"), clears the selection and re-reads ByOwner. `FILE_SERVER_MISSING` shows the drawer's own title (the File Server lost it, not your fault, a retry will not help) with the server's bilingual message under it, as sent, and no retry button. Every other refusal (`FILE_SERVER_KEY_REFUSED` 502, `FILE_SERVER_UNAVAILABLE` / `NOT_SET_UP` 503, network) shows the server's message as sent.
**Why:** a 502 is also `FILE_SERVER_KEY_REFUSED` (IT's key fault), which is not "the file is lost". Branching on status would say the wrong thing.
**Revisit if:** the owner wants the transient 503 `FILE_SERVER_UNAVAILABLE` to offer a retry. 321 offers none.

## Q: ByOwner's refusal state keys on `statusCode === 403`
**Decision taken:** A bare 403 on ByOwner draws "Your account is not allowed to read this day's slips". Everything else is `apiErrorMessage` (so `NOT_SET_UP` shows its bilingual message as sent).
**Why:** the ticket asks for "refusal states like the grids", and ReadyPage keys its refusal on exactly this. A bare 403 carries no code to branch on.
**Revisit if:** SIS.Api starts enveloping its grant-filter 403 with a code.

## Q: A re-opened day shows its last list while it re-reads
**Decision taken:** ByOwner is cached per owner key (default `staleTime` 0, default `gcTime`). Re-opening a day draws the cached list at once and refetches underneath. A failed refetch shows the error in place of the list.
**Why:** it is TanStack's default and one key the 322/323 re-reads invalidate (`slipsByOwnerKey`). Slip bytes, by contrast, use `gcTime: 0` and never outlive their preview.
**Revisit if:** the owner wants a shimmer on every opening.

## Q: The till label when a web upload has no `uploadedBy`
**Decision taken:** `Web · <uploadedBy>` (the U+00B7 copied from ticket 321, `uploadedBy` a named param) when there is one, and plain "Web" when `uploadedBy` is empty.
**Why:** "Web · " with nothing after it reads as a bug. The server always stamps the Ua user on a web upload, so this is defensive only.
**Revisit if:** never, unless the contract changes.
