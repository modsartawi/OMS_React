---
status: done
spec: 319
blocked-by: 320
---

# 321 — Clicking a count opens a drawer that lists, previews and downloads the day's slips

## What to build

Make each row's slip count on Ready and Cash Collections clickable, **`0` included**. A null count stays a plain
dash and is not clickable. A click opens a side drawer for that store day. The drawer is read-only in this
ticket.

- **The key.** Add one pure `storeDayOwnerKey(storeId, businessDay)` → `<storeId>/<yyyy-MM-dd>`. It takes the
  date part of `businessDay` by string handling, never through a locale or `new Date(...)`. 322 and 323 reuse
  it.
- **The read.** `GET AttachmentWeb/ByOwner?ownerKind=STORE_DAY&ownerKey=<key>`, through 320's envelope-keeping
  read, because `withdrawn` sits beside `data`.
- **The list (`data`, STORED slips, newest first as sent).** One row per slip showing:
  - **file name**;
  - **uploaded at**: `storedAt` as the server sent it (local wall clock, no zone), never re-parsed through
    `new Date(...)`;
  - **till**: `sourceDevice` when it is not empty, else **"Web · \<uploadedBy\>"**.
- **Preview.** Selecting a slip fetches `GET AttachmentWeb/{attachmentId}/Content` through `api.blob`.
  - Show `image/jpeg` and `image/png` as `<img src={objectURL}>`.
  - Show `application/pdf` as `<iframe src={objectURL}>`.
  - Any other type shows no preview, but its download still works.
  - Revoke every object URL when the selection changes and when the drawer closes.
  - A **404** means the slip is no longer readable (it was withdrawn meanwhile): say so and re-read `ByOwner`.
  - A **502** means the File Server has lost the file: say so. It is not the user's fault and there is no
    retry.
- **Download** beside the preview. It saves the same blob under `fileName` and does not fetch a second time.
- **Withdrawn (n).** A collapsed section under the list, where n = `withdrawn.length`, newest withdrawal first.
  Each row shows:
  - the file name;
  - the till, or "Web · \<uploadedBy\>";
  - who withdrew it and when (`withdrawnBy`, `withdrawnAt` as sent);
  - the reason as `reasonLabel` beside `reasonLabelArabic`;
  - the note.

  It has **no preview and no download**, since nothing on a withdrawn item can fetch its bytes (C6). Any holder
  of the category sees it, with or without the withdraw grant. The section is hidden when n = 0.
- **Empty.** A `0` count opens a drawer that says the day has no slip. That is where 322's Add slip will go.
- The drawer names its day (store, business date). It is dismissable, and it takes loading, error and refusal
  states like the grids.

## Contract

Build against BackOffice
[2034](C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md)'s
`## Web contract` (the drawer, preview and download sections). Where 2034 and
[2035](C:\Work\DMSCO\BackOffice\.issues\2035-finance-withdraws-a-wrong-slip-and-it-stops-being-readable.md)'s
drawer section differ, **2035 wins**: it adds `uploadedBy` on each item, the `withdrawn` sibling, and the
"Web · \<uploadedBy\>" till. Cross-check against `AttachmentWebEndpoints.cs` and the ByOwner projection on
BackOffice `pricing2`. Add no field the contract does not name.

## Proof

- [x] vitest on the pure modules:
  - `storeDayOwnerKey`: an ISO `businessDay` with and without a time part gives `yyyy-MM-dd`, and no locale or
    `Date` round-trip shifts it; a date near midnight is the proof;
  - the till label: device when set, "Web · \<uploadedBy\>" when empty;
  - the preview kind by content type, image / pdf / none;
  - the withdrawn list is ordered newest withdrawal first, and n is its length.
- [x] A drive (stubbed, no live SIS.Api) covers:
  - clicking a count on each grid, and a `0`;
  - a null not being clickable;
  - a jpeg, a png and a pdf previewing;
  - the download saving under `fileName`;
  - a 404 and a 502 on `/Content`;
  - Withdrawn (n) collapsed and expanded, with no preview or download controls inside;
  - object URLs revoked on close (count `URL.revokeObjectURL` calls in the page);
  - loading, error and refusal on `ByOwner`.
- [x] 320's drive and the sibling drives unchanged. (320's one forward-looking check narrowed; see Comments.)
- [x] `typecheck`, `lint`, `build` and `npm test` green.

## Boundaries

- No Add, no Withdraw and no reason picker (322, 323).
- No new route. The drawer is a component in `features/collection/inquiry/`, opened by both pages.
- No hand-rolled `fetch`. Use `api.blob` for the bytes and the core envelope read for `ByOwner`.
- The contract says `credentials: 'include'`. The shared `send` is same-origin by design, which is correct
  here. Do not change it.

## Done when

A collection accountant clicks a store day's count on either grid and sees that day's slips. They can preview
each one, image or PDF, and download it. Below the list they see what was withdrawn and why, and they never
leave the collection screen.

## Blocked by

- [320](320-ready-and-collections-show-each-store-days-slip-count.md): the column, the probe and the envelope
  read.
- BackOffice 2034 and 2035: **done** (merged `da71a9621`).

## Open questions

- The drawer primitive. The repo has no shared drawer or sheet component (there is no `src/components/`), and the
  call-center console's `ConfirmSheet` belongs to another feature and cannot be imported. Build the drawer the
  way the existing dialogs in `collection/inquiry` are built (for example, `AssignmentUploadDialog`), or move a
  shared primitive to `layout/` if `feature-structure` allows it. Record the choice.

## Comments

**Done 2026-09-26 (AFK).**

**Contract.** Built against BackOffice 2034's and 2035's `## Web contract` (2035 wins on the till, `uploadedBy` and
`withdrawn`). Both are `status: done` on `pricing2`. I cross-checked the contract against the code on `pricing2`:
- `AttachmentDto.cs` (`sourceDevice`, `uploadedBy`);
- `WithdrawnAttachmentDto.cs` and `AttachmentOwnerListResponse.cs` (`withdrawn` beside `data`);
- `AttachmentWebEndpoints.cs`;
- `AttachmentContentResult.cs` (404 `NOT_FOUND`; 502 `FILE_SERVER_MISSING` and `FILE_SERVER_KEY_REFUSED`; 503
  `FILE_SERVER_UNAVAILABLE`);
- `AttachmentOwnerKinds.StoreDayKey` (store trimmed, invariant day).

There is no field drift. The stubs are exactly those shapes, and no field was invented.

**Drift from this ticket's text, recorded.** "A **502** means the File Server has lost the file" is branched on the
CODE, not the status. Only `FILE_SERVER_MISSING` says "lost". The other 502, `FILE_SERVER_KEY_REFUSED` (a rotated key,
IT's to fix), shows the server's own bilingual message as sent. Branching on 502 would tell the accountant a file is
gone when it is a key fault.

**The drawer primitive (the open question).** `SlipDrawer.tsx` is a component in `features/collection/inquiry`,
built the way `AssignmentUploadDialog` is. It imports only `@/core/*` and its own files. Its frame is a native
`<dialog>` (`showModal`, Escape, backdrop click, focus given back to the count), which is `core/ui/Modal`'s contract
pinned to the inline end at full height. Modal draws a centred box and takes no placement. It does not use
`callcenter`'s `ConfirmSheet`, puts nothing in `layout/`, and adds no `src/components/`. The drawer's
`backdrop:bg-black/50` scrim got one documented `ALLOWED` entry in `tools/check-palette.mjs`, on the
`ViewManager`/`AppShell` precedent.

**The core read.** It uses 320's `api.getEnvelope<StoredSlip[], SlipOwnerSiblings>` for ByOwner, and `api.blob` for
`/Content`. `core/api.ts` is untouched.

**What was built.**
- **`slips.ts`** (pure):
  - `storeDayOwnerKey(storeId, businessDay)` builds `<storeId>/<yyyy-MM-dd>` by regex on the string: never `Date`,
    locale or `Intl`. It returns null with no day or no store.
  - `slipDayOf(row)` returns null unless the count is known AND the key builds, so a null is never clickable and a
    null `businessDay` never opens anything.
  - `slipTill` picks the device, or the web uploader.
  - `slipPreviewKind` returns image / pdf / none.
  - `wallClockText` is a string cut of the T, dropping the fraction.
  - `withdrawnNewestFirst` is a stable string sort, and `slipOwnerList` reads the envelope.
  - `slipContentFailure` maps the codes to gone / lost / other.
- **`api.ts`**:
  - `slipsByOwner(ownerKey)` and `slipContent(id)`.
  - `slipsByOwnerKey(ownerKey)` = `['collection','slips','by-owner',ownerKey]`, the ONE key 322/323 re-read, with
    `slipsByOwnerQuery` (`retry: false`).
  - `slipContentQuery` (`gcTime: 0`, `retry: false`), so bytes never outlive their preview.
- **`SlipCountColumn`**: a known count (0 included) with an owner is a `<button data-slip-open>` that opens the
  drawer. The builders take `onOpenSlips`.
- **`useSlipView`** holds `drawerDay` / `openSlips` / `closeSlips` (null whenever the probe hides slips). Both Pages
  render `<SlipDrawer>` over the grid.
- **`SlipDrawer.tsx`**:
  - the title names the store and business date;
  - loading, error (message as sent), and refusal (bare 403, the grids' wording) on ByOwner;
  - "No slip is filed for this day" on an empty list;
  - the list (file name, uploaded at, till);
  - the preview (`<img>` / `<iframe>` / none), keyed by slip, each with its own object URL revoked on unmount, so a
    selection change or a close revokes it;
  - Download saves the fetched blob under `fileName` through `core/util/download-file`'s `saveBlob`;
  - 404 says so, drops the selection and re-reads ByOwner; 502 `FILE_SERVER_MISSING` gets its own title, the server's
    words and no retry;
  - Withdrawn (n) is a collapsed `<details>`, newest first, showing file, till, who and when, the server's
    `reasonLabel` beside `reasonLabelArabic`, and the note. It has no controls.
- **i18n**: `slips.open` and `slips.drawer.*` go in the one `slips` group. The till is `"Web · {{uploadedBy}}"`
  (U+00B7 copied from this ticket), with plain "Web" only if `uploadedBy` is empty.

**Proof.**
- **vitest:** 144 files / 2518 tests, all green (+63 over 320's baseline); `slips.test.ts` has 47 cases. These cover:
  - the owner key with and without a time part;
  - four days near midnight (`23:59:59`, `23:30Z`, `00:00:30`, `+03:00`);
  - a stubbed throwing `Date`;
  - the till;
  - the preview kind;
  - the withdrawn order and n, ByOwner's envelope and the content-failure codes.
- **`tools/slip-drawer-drive.mjs`: 63/63** (stubbed, no live SIS.Api). It covers:
  - the count on both grids, and a 0, each opening its own day's key; a null not clickable;
  - jpeg (decodes), png and pdf previews, and a text file with download only;
  - the download under `fileName`, byte-equal, with no second fetch;
  - 404 (said, re-read, gone from the list) and 502 (said, server words, no retry, one fetch);
  - Withdrawn (2) collapsed, then expanded, newest first, with no controls and no content fetch;
  - on close, 6 object URLs made and 6 revoked; Escape closes;
  - ByOwner loading, 500, bare 403 and 503 `NOT_SET_UP`;
  - a refused probe giving no slip button;
  - no raw keys and no page errors.
- **Sibling drives:** `slip-count-drive` 64/64; `ready-drive` 44/44, `collection-drive` 220/220,
  `collections-filters-drive` 44/44 and `four-filters-drive` 80/80, all **unmodified**.
  - ⚠ One check in 320's `slip-count-drive` was narrowed: "the count is not a link or a button *yet*" now reads "an
    unknown (null) count is not a link or a button". That assertion was 320's placeholder for exactly what this
    ticket builds (HITL).
- **`typecheck`, `lint` (3 gates) and `build`:** green.

**Review.**
- **Built-in /code-review:** no findings.
- **/standards-review, Standards:** no hard violations. Taken: the reason line is now one interpolated key, the
  duplicated transient "gone" paragraph was removed, and the column's double `onOpen` check was simplified. Left as
  judgement calls:
  - the `statusCode === 403` refusal check (a bare 403 carries no code; now in four places, a core helper is a later
    tidy-up);
  - `slipTill`'s name;
  - `useSlipView` owning the drawer state;
  - the new CONTEXT terms (store day, owner key, withdrawn slip) for `/domain-modeling`.
- **/standards-review, Spec:** no wrong behaviour. Its two gaps (the 320 drive edit, and the 502-by-code drift) are
  recorded above and in `.afk/HITL-321.md`.

**Outstanding (not AFK-able).**
- The live walk against a real SIS.Api with the File Server key set. None is up, and every drive is stubbed.
- The owner's read of every new string (`slips.open`, `slips.drawer.*`).
