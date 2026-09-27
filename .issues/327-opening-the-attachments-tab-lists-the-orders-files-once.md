---
status: done
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

- [x] `attachmentsTabGate`: it admits only with an owner, a category and the category held. It refuses for:
      - no owner;
      - no category;
      - a pending, refused or malformed probe;
      - a bare-string `categories` (`'P2E'` must not admit `P2E`);

      · pure (vitest)
- [x] `attachmentsBadgeCount`: the model count before load; the list length after (it wins over a stale model
      count); absent → none; `0` → `0`. · pure (vitest)
- [x] New `tools/order-attachments-drive.mjs` (stubbed envelopes, network counted):
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
      ⚠ Held open for ONE drive that was red before this wave: `-actions` fails 3 checks identically at the base
      commit edd91a0 (see Comments). The other five are green, unmodified, and `document-rtl-drive` covers the tab.

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

## Comments

**Built 2026-09-27 (AFK).** Decisions and wording are in `.afk/HITL-327.md`.

**Pre-flight.** BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. BackOffice 2077 is `status: open`
(expected), so this is built against its `## Web contract` stub: `attachmentCategory`, a string, absent when null.
It has not been renamed.

**Contract cross-check against the committed code (pricing2).** One drift, and the web follows the code:
- `AttachmentDto.cs` also carries **`storeCode`** (2067, the till viewer's filing store), and no web contract names
  it. It is not typed and not shown here. The drive's stub sends it, so the list is proven not to trip on it.
- The rest agrees:
  - `caption` is on the DTO, `''` when none was given;
  - `AttachmentOwnerNo` and `AttachmentCount` (`int?`) are omitted when null;
  - `AttachmentOwnerListResponse` carries `Withdrawn` and `WithdrawReasons` (`{ code, label, labelArabic, noteRequired }`);
  - `WithdrawnAttachmentDto` has no caption;
  - `AttachmentRefusal.ReadNotAudited()` answers 503 `READ_NOT_AUDITED`;
  - `/Content` answers 404 `NOT_FOUND` and 502 `FILE_SERVER_MISSING` (`AttachmentContentResult.cs`);
  - `ListByOwnerAsync` audits an `SD_DOCUMENT` list and refuses when it cannot;
  - `SdDocumentAttachmentReads` has no category yet, since 2077 is unbuilt.

**Open question: answered.** There is no "count changed" note. Once the list has loaded, its length simply wins
(`attachmentsBadgeCount`), as the spec says. Nothing polls.

**What was built.**
- **Model.** `SdDocumentHeaderModel` gains optional `attachmentOwnerNo`, `attachmentCount` and `attachmentCategory`.
  `core/models/attachment.ts` gains `SdDocumentAttachment` (the item plus `caption`) and
  `AttachmentWithdrawReasonModel`. `withdrawReasons?` is typed beside `withdrawn`; 331 reads it.
- **Pure rules** (`features/oms/document/attachments-tab.ts`):
  - `orderAttachmentTarget`: `SD_DOCUMENT` under `attachmentOwnerNo`, in `attachmentCategory`, as `PRESCRIPTION`;
    `null` without either field;
  - `attachmentsTabGate`: owner, category and `holdsCategory`;
  - `attachmentsBadgeCount`: the one number the badge uses, and 328's Files row after it;
  - `core/attachments/rules.ts` gains `attachmentCaption`.
- **Core.**
  - `READ_ONCE_PER_VISIT`: `staleTime ∞`, `gcTime 0`, no refetch on focus or reconnect.
  - `rereadAttachments`: invalidates the exact key.
  - The panel gains two optional props, both defaulting to the slip's behaviour:
    - `enabled` (default `true`): the first-selection latch;
    - `captioned` (default `false`): the list shows a caption when it is not empty.
- **The page.** `useOrderAttachments(document, routeId)` holds all of the tab's state:
  - the probe, asked only when both fields are present;
  - the gate;
  - the latch: by owner, and reset on a new route number;
  - the page's own ByOwner observer for the badge, with the panel's exact options, so the two share one request;
  - the Refresh re-read, only once the tab has been opened.

  The tab is fifth and last, drawn only while the gate admits. Its panel (`AttachmentsTab.tsx`) stays mounted and
  hidden. Commands still reload through `reload()` alone and never re-read the files.
- **Words.** New `document` keys:
  - `tabs.attachments` and `tabs.fileCount_*`;
  - `attachments.*`: the empty sentence, loading, the refusals, "Source", the preview words;
  - drafts of the Add and Withdraw words, which `AttachmentsPanelWords` requires. They do not render in 327.

**Proof.**
- `npm test`: **153 files / 2611 tests** green (326 left it at 152 / 2590).
  - `attachments-tab.test.ts` has 19 cases: the gate (bare string, malformed, pending, refused, not held, no owner,
    no category); the badge (model → list, `0`, absent, non-integer); the target; the tab's keys backed in
    `document.json`.
  - `rules.test.ts` gains the caption cases.
- `typecheck` is clean, `build` is green, and `lint` is clean on all three gates (boundaries: 672 files).
- **`order-attachments-drive` 98/98** (vite on :5199, stubbed envelopes, network counted).
  - It covers every Proof bullet.
  - Plus: the probe is not asked without both fields; a delivery asks ByOwner for `attachmentOwnerNo`, never the
    route's number; ByOwner `READ_NOT_AUDITED` shows the server's message, not the empty sentence; coming back after
    leaving reads nothing until selected; an in-route move A → B → Back to A reads nothing until selected.
  - Mutation-checked:
    - the panel reading on mount → 5 fails;
    - Refresh and the page observer ungated → 8 fails;
    - no latch reset → 2 fails.
- **`document-rtl-drive` 49/49**, with a new section 7 in both directions:
  - the tab sits after Jobs;
  - the preview sits after the list;
  - the list headers are `text-start`;
  - the Arabic caption is exact and isolated as RTL.

  Mutation-checked: `text-left` fails the rtl half only, and dropping `dir="auto"` fails the ltr half.
- **Unmodified and green:** `document-detail` 39/39, `-cards` 45/45, `-rail` 25/25, `-band` 34/34, `-items` 23/23.
- ⚠ **`document-actions-drive` is red, and was before this wave.**
  - Three checks fail: "2,1,2 clusters", "the commands in taxonomy order", "all eight commands".
  - They fail identically when the drive runs against a throwaway worktree of the base commit edd91a0.
  - Cause: commit 7358a84 (2026-09-25, "The command bar no longer offers Withdraw Request") updated
    `commands.test.ts` but not this drive.
  - Outside 327's scope walls, and logged in HITL.
- **The four slip drives pass unedited** (`git diff edd91a0 -- tools/slip-*` is empty): `slip-count` 64/64,
  `slip-drawer` 63/63, `slip-add` 52/52, `slip-withdraw` 68/68.

**Review.**
- `/code-review`: one finding, fixed. The latch survived an in-route move between two documents: A → B → Back to A
  read A's list on load, without a click. It now resets on a new route number, and the drive proves it.
- `/standards-review`: no hard violations, and nothing missing or wrong on the spec axis.
  - Applied: the tab state moved out of the page into `useOrderAttachments` (Divergent Change), and the re-read has
    one core spelling, `rereadAttachments` (Duplicated Code).
  - Not applied:
    - the ticket-mandated model types that only 331 reads;
    - `attachmentCaption(unknown)`: the panel's list type has no caption on a slip;
    - the ternary for the badge title;
    - the file names;
    - glossary terms in `CONTEXT.md` (a `/domain-modeling` pass, as HITL-325 noted).
  - The spec axis also flagged the Add/Withdraw word drafts as early copy. They are forced by the words type, do not
    render, and are logged for 330/331.

**Outstanding (not this ticket's to fake):**
- the owner's read of every new string;
- 2077 actually served;
- the wave's live hand walk (2071);
- `document-actions-drive`'s pre-existing red.
