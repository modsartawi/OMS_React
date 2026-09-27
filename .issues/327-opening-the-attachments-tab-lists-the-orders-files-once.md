---
status: open
spec: 324
blocked-by: 326 (+ BackOffice 2077)
---

# 327 — Opening the Attachments tab lists the order's files, once

## What to build

**Slice 0 / tracer bullet.** It proves the new contract (2063 + 2077) and the audited lazy read end to end, before
any write is built.

**Model.** `core/models/sd-document.ts`'s header model gains these, each typed as possibly absent (the wire omits
them; "absent, not null, not 0"):
- `attachmentOwnerNo?: string`
- `attachmentCount?: number`
- `attachmentCategory?: string`

`core/models` gains the `SD_DOCUMENT` stored item (the shared item plus `caption`) and the `withdrawReasons` sibling
type. The reasons are only typed here. They are read in 331.

**The gate** is one pure function, and it fails closed. It admits only when all three hold:
- `attachmentOwnerNo` is present;
- `attachmentCategory` is present;
- the shared `AttachmentWeb/Access` probe's `categories` holds that category, by `holdsCategory` (strict array
  membership, never truthiness or a string's `includes`).

A pending, refused (503 `NOT_SET_UP`, 403, network) or malformed probe hides the tab.

**The number** is one pure function, used for the badge now and by the Files row in 328:
- before the list loads, the model's `attachmentCount`, with `0` shown;
- after the list loads, the length of the STORED list;
- absent count and no list → no badge.

**The tab.** `TAB_IDS` gains `attachments`, fifth and last. It is drawn only while the gate admits, and it carries the
badge.
- The panel **stays mounted** like the other four.
- The **first selection** of the tab starts `GET AttachmentWeb/ByOwner?ownerKind=SD_DOCUMENT&ownerKey=<attachmentOwnerNo>`.
  The page load and the panel's mount never do.
- Freshness is the order's: `staleTime: Infinity`, no refetch on focus or reconnect, and `gcTime: 0`, so leaving the
  page drops the list.
- The page's own **Refresh** re-reads ByOwner only if the tab has already been opened. A Refresh before that reads
  nothing new.

**The panel** is 326's, with `SD_DOCUMENT` parameters and no Add or Withdraw yet (330 and 331). It lists:
- file name;
- caption when not empty;
- stored at, as `wallClockText`;
- source: `sourceDevice`, else "Web · \<uploadedBy\>". `KEY:<UserId>` is shown as sent.

It also carries:
- preview and download as the slip's, with **no file auto-selected**, and download reusing the fetched blob;
- `/Content` answers by code: 404 → "withdrawn meanwhile" + re-read; 502 `FILE_SERVER_MISSING` → "lost, not your
  fault", no retry; 503 `READ_NOT_AUDITED` → the server's message, nothing shown;
- ByOwner `READ_NOT_AUDITED` → the server's message and no list. It is not an empty list;
- Withdrawn (n), collapsed, with no preview or caption, and hidden when n = 0.

**Words.** The tab name and the empty sentence go in the `document` namespace.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `attachmentsTabGate`: it admits only with an owner, a category and the category held. It refuses for:
      - no owner;
      - no category;
      - a pending, refused or malformed probe;
      - a bare-string `categories` (`'P2E'` must not admit `P2E`);

      · pure (vitest)
- [ ] `attachmentsBadgeCount`: the model count before load; the list length after (it wins over a stale model
      count); absent → none; `0` → `0`. · pure (vitest)
- [ ] New `tools/order-attachments-drive.mjs` (stubbed envelopes, network counted):
      - **zero ByOwner requests on page load**, exactly one on the tab's first selection, and none on re-selection;
      - Refresh before opening → none; Refresh after opening → one;
      - no `/Content` until a file is clicked;
      - the tab hidden for no owner, no category, a refused probe, a category not held;
      - the badge from the model, then from the list; an absent count → no badge;
      - jpeg/png/pdf previews; a download without a second fetch; the 404/502/`READ_NOT_AUDITED` answers;
      - Withdrawn (n) collapsed and expanded;
      - object URLs revoked on leave.

      · flow (Playwright)
- [ ] `document-detail`, `-cards`, `-rail`, `-band`, `-items` and `-actions` drives stay green.
      `document-rtl-drive` also covers the new tab in the Arabic layout. · flow

## Boundaries

- **Endpoints:** `AttachmentWeb/Access` (existing, shared entry), `AttachmentWeb/ByOwner` (`getEnvelope`, since
  `withdrawn` sits beside `data`), `AttachmentWeb/{id}/Content` (`api.blob`).
- **Codes:** `READ_NOT_AUDITED`, `NOT_FOUND`, `FILE_SERVER_MISSING`, `NOT_SET_UP`.
- **i18n:** new keys in `document`. The panel's words come from `attachments` (326).
- Nav is unchanged. Deliberately **no deep-link tab parameter** (HQ WPF 2070's link-out opens on Items).
- **Contract cross-check first.** Before building, read the committed BackOffice code the spec lists
  (`SdDocumentHeaderModel.cs`, `SdDocumentAttachmentReads.cs`, `AttachmentWebEndpoints.cs`, `AttachmentDto.cs`,
  `WithdrawnAttachmentDto.cs`, `AttachmentRefusal.cs`) and record any drift under `## Comments`.
- Build against a stub of **exactly** the 2063 + 2077 shape. Never invent a field.

## Done when

On a stubbed order whose category the session holds, the Attachments tab shows its badge, and selecting it lists,
previews and downloads the files with exactly one ByOwner read. `order-attachments-drive` and the document drives are
green.

## Blocked by

- [326](326-the-slip-drawer-renders-the-shared-attachments-panel.md)
- BackOffice [2077](C:\Work\DMSCO\BackOffice\.issues\2077-the-document-read-names-the-category-of-its-files-owner.md)
  (`attachmentCategory` on the document read). The client can be built against its `## Web contract` stub. Until
  it ships live, the tab stays hidden (it fails closed), which is safe on an older SIS.Api.

## Open questions

- Should a ByOwner answer that disagrees with the model count (a till attached meanwhile) say so, or silently take the
  list's length? The spec says the list's length wins and nothing polls. Confirm there is no "count changed" note.
