---
status: open
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

- [ ] vitest on the pure modules:
  - `storeDayOwnerKey`: an ISO `businessDay` with and without a time part gives `yyyy-MM-dd`, and no locale or
    `Date` round-trip shifts it; a date near midnight is the proof;
  - the till label: device when set, "Web · \<uploadedBy\>" when empty;
  - the preview kind by content type, image / pdf / none;
  - the withdrawn list is ordered newest withdrawal first, and n is its length.
- [ ] A drive (stubbed, no live SIS.Api) covers:
  - clicking a count on each grid, and a `0`;
  - a null not being clickable;
  - a jpeg, a png and a pdf previewing;
  - the download saving under `fileName`;
  - a 404 and a 502 on `/Content`;
  - Withdrawn (n) collapsed and expanded, with no preview or download controls inside;
  - object URLs revoked on close (count `URL.revokeObjectURL` calls in the page);
  - loading, error and refusal on `ByOwner`.
- [ ] 320's drive and the sibling drives unchanged.
- [ ] `typecheck`, `lint`, `build` and `npm test` green.

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
