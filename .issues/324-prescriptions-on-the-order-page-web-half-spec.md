---
type: spec
status: ready
---

# 324 — Prescriptions on the order page: the web half (frontend half of BackOffice spec 2054, ticket 2071)

The stories, decisions and glossary are BackOffice's. Read
`C:\Work\DMSCO\BackOffice\.issues\2054-attachments-on-oms-sales-documents-spec.md` (merged into `pricing2` as
`dfda68dab`, 2026-09-27), its decision ticket
`C:\Work\DMSCO\BackOffice\.issues\2050-where-each-reader-screen-shows-an-orders-attachments.md` (section **G**), and
the ticket this spec carries out, `C:\Work\DMSCO\BackOffice\.issues\2071-the-oms-react-order-page-lists-adds-and-withdraws-prescriptions.md`.
This file lists only what the web builds.

## Problem Statement

A sales document can now carry files. A P2E pharmacist attaches the customer's prescription at the till. Dawaa OK
sends files inside its create. Hybris attaches Altibbi's prescription later. Each file sits in the attachment register
under the owner kind `SD_DOCUMENT`, keyed by the order's `DocumentNo`.

Head office cannot see any of them from the web. The order page (`/oms/document/{no}`) shows the Prescription card
and its "Rx document" link, but nothing says the order has files, and there is nowhere to read, add or withdraw one.
HQ WPF already shows "Attachments: N files · Open in OMS web" (BackOffice 2070), and that link lands on this page, where
there are no files to see.

## Solution

The order page gains a fifth tab, **Attachments**. It shows only to someone who holds the order's attachment category
(`P2E`, `ERX` or `ALTIBBI`).
- Its badge is the file count the document read already carries.
- Opening the tab for the first time lists the files. That list is an audited read, so it is never fetched just
  because the page loaded.
- The tab previews and downloads a file, adds a prescription (file + optional caption), and withdraws a wrong file
  with a reason. Withdrawn files stay listed apart, as a trail.

The Prescription card on the summary rail gains a **Files · N · Show** row that switches to the tab. The card now also
shows when the only thing it would hold is files.

Opened as a delivery (`/oms/delivery/{no}`), the tab lists the files of the delivery's **owner** (its order, or the
Altibbi document the order links). It says "Filed on order \<no\>", and Add files onto that owner.

The body of the tab is the ECR-slip drawer's body (spec 319), **lifted** into `core/attachments/` and parameterised,
so the slip drawer and the order tab are one component. The slip drawer keeps its behaviour exactly; its tests and
drives are the proof.

## User Stories

Carried from BackOffice 2054 (stories 43–47), made specific to the web:

1. As an HQ web user holding the order's category, I want an Attachments tab on the order page, so that I can review
   the order's prescriptions without leaving the page.
2. As an HQ web user, I want the tab's badge to show how many files the order has before I open it, so that I know
   whether there is anything to look at.
3. As an HQ web user, I want a missing count to show no badge rather than "0", so that "the server could not count"
   never reads as "no files".
4. As an HQ web user without the order's category, I want no Attachments tab and no Files row at all, so that the page
   never offers me something the server will refuse.
5. As the data protection officer, I want the file list fetched only when a user opens the tab, so that every
   recorded list read is one a person asked for.
6. As the data protection officer, I want a file's bytes fetched only when a user selects that file, never the first
   file by default, so that every recorded open is one a person asked for.
7. As an HQ web user, I want each file listed with its name, caption, when it was stored and where it came from (the
   till, the partner key, or "Web · \<user\>"), so that I can tell the files apart.
8. As an HQ web user, I want to preview a JPEG, PNG or PDF beside the list, so that I can read it without downloading.
9. As an HQ web user, I want to download the file I am previewing without it being fetched a second time, so that a
   download is not a second recorded read.
10. As an HQ web user, I want a file withdrawn meanwhile to say so and refresh the list, so that I do not keep looking
    at something that is no longer evidence.
11. As an HQ web user, I want a file the File Server has lost to say so plainly, with no retry, so that I know it is
    not my fault.
12. As an HQ web user, I want a list the server refused to record (`READ_NOT_AUDITED`) to show the server's message
    and no files, so that an unrecorded read never happens on my screen.
13. As an HQ web user holding the category, I want **+ Add prescription** with a file and an optional caption, so that
    a prescription emailed to head office is filed on the order.
14. As an HQ web user, I want to type the caption in Arabic and see it back exactly, so that the note is useful to the
    pharmacist.
15. As an HQ web user, I want a file of the wrong type or over 10 MiB refused before it is sent, so that I do not wait
    for a refusal the browser could give.
16. As an HQ web user, I want the server's refusal shown as it sends it (English, then Arabic), and a retry offered
    only when a retry can help, so that I am never invited to repeat a request that will fail again.
17. As an HQ web user, I want a retry of a failed add never to file the file twice, so that a flaky connection
    leaves no duplicate.
18. As an HQ web user, I want the eleventh file refused with the server's "too many" answer, so that the cap of 10 is
    the server's rule and not a guess in the browser.
19. As an HQ web user holding the withdraw grant, I want **Withdraw…** on the file I am previewing, with the order
    reasons (wrong order or customer, unreadable, duplicate, not a prescription, other with a note), so that the order
    shows only true evidence.
20. As an HQ web user, I want the reason labels to be exactly the server's, English beside Arabic, so that the words
    the owner approves in BackOffice are the words on screen.
21. As an HQ web user, I want Other to need a note before I can confirm, so that the trail always says why.
22. As an HQ web user, I want withdrawn files listed apart, collapsed, with who withdrew them, when, the reason and the
    note, and no preview or download, so that a correction is visible but its file is no longer readable.
23. As an HQ web user whose grant the server refuses (a bare 403), I want Withdraw to disappear for the rest of my visit,
    so that I am not offered it again.
24. As an HQ web user, I want a **Files · N · Show** row in the Prescription card that switches to the tab, so that
    the files are found where the prescription link is.
25. As an HQ web user on an order with files but no approval number, patient, clinician, eRx or link, I want the
    Prescription card to show anyway with its Files row, so that the files are not hidden behind an empty card.
26. As an HQ web user on a delivery's page, I want its order's files and the sentence "Filed on order \<no\>", linking
    to that order, so that I do not look for them twice.
27. As an HQ web user on a delivery's page, I want Add to file onto the order the files belong to, so that the files
    stay in one place.
28. As an HQ WPF user who clicked "Open in OMS web", I want to land on the order page with the tab and its badge in
    view, so that the link-out leads to the files.
29. As a finance user of the ECR-slip drawer, I want it to behave exactly as it did before the lift, so that the
    shared body costs me nothing.
30. As a developer, I want one attachments panel in `core/` used by both screens, so that a fix to the preview, the
    upload or the withdraw lands in both.

## Implementation Decisions

### The seam is the contract

Every call here goes to a door that a BackOffice ticket of spec 2054 built. Each ticket records its envelope under
`## Web contract`:

- `C:\Work\DMSCO\BackOffice\.issues\2063-the-document-read-names-the-files-owner-and-counts-them.md`:
  `attachmentOwnerNo` and `attachmentCount` on the document read.
- `C:\Work\DMSCO\BackOffice\.issues\2062-head-office-withdraws-a-wrong-prescription.md`: `withdrawReasons` on
  `ByOwner`, the `SD_DOCUMENT` reasons, and the withdraw grants.
- `C:\Work\DMSCO\BackOffice\.issues\2061-a-file-is-attached-to-an-order-after-it-is-created.md`: the late attach
  through `AttachmentWeb/Upload`, with its cap and refusal codes. It has no `## Web contract` heading; its
  **What to build** is the contract.

Build and test against a stub of exactly that shape, and never invent a field. Before building, cross-check each
contract against the committed BackOffice code and record any drift in the ticket's comments:
- `Sartawi.Retail.Data\Modules\Sd\Services\Models\SdDocument\SdDocumentHeaderModel.cs`
- `SdDocumentAttachmentReads.cs`
- `Services\SIS.Api\Endpoints\Attachments\AttachmentWebEndpoints.cs`
- `AttachmentDto.cs`
- `WithdrawnAttachmentDto.cs`
- `AttachmentRefusal.cs`

### ⚠ Prerequisite: the document read must name the owner's category (a BackOffice change, not yet ticketed)

The tab's gate needs the category of the order's files ("`AttachmentWeb/Access` holds the document's category"), and
so does Add (`Category` must equal the accept-list line's, or the server refuses `DOCUMENT_TAKES_NO_ATTACHMENTS`).
**No field the web receives carries it:**
- `attachmentOwnerDocument` (2068) holds the owner's pair, but the server fills it **only for an owner whose line comes
  through the till door**, which is P2E alone. A Dawaa OK (`ERX`) or Altibbi (`ALTIBBI`) owner answers without it.
- The page's own `documentType`/`documentSource` are the **page's** document, not the owner's. On a delivery, or when
  the owner is an ATBI document, they name the wrong pair.
- A mirror of the accept list in the web would drift from the one server constant that 2054 made the switch.

**Decision:** BackOffice adds one field to the document read, **`attachmentCategory`** (string). It is the category of
the owner's accept-list line, stamped by `SdDocumentAttachmentReads` beside `attachmentOwnerNo` for **every** door. It
is **absent** when the owner's pair has no line, or when the read could not answer. This web half reads it and nothing
else for the category. The kind needs no field: every line takes `PRESCRIPTION` only.

The field is additive and omitted when null, like its neighbours. It has to be filed as a BackOffice ticket (next free
number there) and **built before this spec's read slice**. Until it ships, the tab stays hidden, because an absent
category fails closed. So an older SIS.Api is safe.

### What the page reads, and what it means

- `attachmentOwnerNo` absent → **no tab and no Files row**. There is no owner to list.
- `attachmentCategory` absent → no tab and no Files row (fails closed; see the prerequisite).
- The gate is `AttachmentWeb/Access`. The tab shows only when `categories` holds `attachmentCategory`, by strict array
  membership (the slip drawer's `holdsCategory`: never truthiness, and never a bare string's `includes`). A pending,
  refused (503 `NOT_SET_UP` until BackOffice 1962, a 403, a network failure) or malformed probe hides it.
- `attachmentCount` present → the badge before the list loads, `0` included. Absent → no badge (2063: "absent, not
  null, not 0"). Once the list has loaded, the badge and the Files row show the length of the STORED list. One pure
  function decides the number for both.
- **Withdraw…** needs `withdrawCategories` to hold the category too, by the same membership test. **Nobody is bound on
  day one** (2062), so it stays hidden until an admin binds someone.

### The tab

- `TAB_IDS` gains `attachments`, fifth and last. It is drawn only while the gate admits.
- The panel **stays mounted** like the other four, as the page's own rule requires. The first **selection** of the tab
  triggers the `ByOwner` read, never the page load or the panel's mount. After that the panel keeps its list.
- The read is `GET AttachmentWeb/ByOwner?ownerKind=SD_DOCUMENT&ownerKey=<attachmentOwnerNo>` through
  `api.getEnvelope`, because `withdrawn` and `withdrawReasons` sit beside `data`.
- **Cache discipline** (every fetch writes an audit row):
  - `staleTime: Infinity`, no refetch on focus or reconnect, and `gcTime: 0`, so leaving the page drops the list.
  - Re-read only after a successful Add or Withdraw, after a `/Content` 404, and on the page's own Refresh **when the
    tab has already been opened**. A Refresh before the tab is opened reads nothing new.
  - The slip drawer keeps its own freshness (a new read on every opening). So freshness is a **parameter** of the
    shared read, not a constant of it.
- **The list** (STORED, newest first as sent) shows per file:
  - file name;
  - caption, when not empty;
  - stored at, as the server's digits (`wallClockText`, never a `Date`);
  - where it came from: `sourceDevice` when set, else "Web · \<uploadedBy\>" (the slip rule, unchanged). A partner row
    reads `KEY:<UserId>` as its device. It is shown as sent.
- **Preview and download**: the slip drawer's, unchanged.
  - Select a file → `GET AttachmentWeb/{id}/Content` through `api.blob`, with `gcTime 0`.
  - `image/jpeg`/`image/png` as `<img>`, `application/pdf` in an `<iframe>`, anything else download only.
  - Object URLs are revoked on change and on leave.
  - **No file is ever selected automatically.**
  - Download saves the same blob under `fileName`.
  - `/Content` answers by **code**:
    - `NOT_FOUND` (404) → "withdrawn meanwhile", then re-read;
    - `FILE_SERVER_MISSING` (502) → "lost, not your fault", no retry;
    - `READ_NOT_AUDITED` (503) → the server's message, nothing shown;
    - anything else → the message as sent.
- `ByOwner` refused with `READ_NOT_AUDITED` (503) → the server's message and no list. It is not an empty list.
- **Withdrawn (n)**: collapsed, newest withdrawal first. It shows name, source, `withdrawnBy`, `withdrawnAt`,
  `reasonLabel` beside `reasonLabelArabic`, and the note. It has no preview or download, and no caption (the DTO
  carries none). It is hidden when n = 0.

### Add prescription

- **+ Add prescription** is in the tab whenever the gate admits (read grant = upload grant on the web, as for slips).
  It is there on an ended order too: the web attaches at any time (2061).
- **One file per Add, with an optional caption.** This differs from the slip Add, which sends each picked file at once
  and has no caption.
  - The caption is trimmed and cut to 200 characters without splitting a surrogate pair (the withdraw note's rule, so
    one pure function serves both).
  - Arabic is sent as typed.
- **The browser's check** is the slip one, before anything is sent: jpg/jpeg/png/pdf by extension **or** type, and at
  most 10,485,760 bytes.
- **The form** is `POST AttachmentWeb/Upload` with these parts:
  - `ClientRequestId`;
  - `OwnerKind=SD_DOCUMENT`;
  - `OwnerKey=<attachmentOwnerNo>`;
  - `Category=<attachmentCategory>`;
  - `Kind=PRESCRIPTION`;
  - `Caption`, **only when not empty**;
  - the file.

  It has **no `SourceDevice`**. The slip form is the same builder with no caption, so its six parts are byte-identical
  to today.
- **Retry.** A retry keeps the file's `ClientRequestId`. The id outlives the component: it lives in the zustand upload
  store, lifted and keyed by owner kind + key. Retryable = network, a codeless 5xx, or `FILE_SERVER_UNREACHABLE`,
  **by code, never by status**, exactly the slip rule.
- **Refusals shown as sent, with no retry:**
  - `TOO_LARGE`, `UNSUPPORTED_TYPE`;
  - `CATEGORY_NOT_HELD`;
  - `DOCUMENT_TAKES_NO_ATTACHMENTS`, `ATTACHMENT_KIND_NOT_ACCEPTED`;
  - `ATTACHMENT_TOO_MANY` (the cap of 10 is the server's: there is no client cap and no pre-disabled Add);
  - the unknown-document refusal (cross-check its code in 2061's tests);
  - `NOT_SET_UP`;
  - a field-name 400.
- After a 200: re-read `ByOwner`. The badge follows the new list.

### Withdraw

- It sits beside Download on the previewed file, as for slips.
- **The reasons are the response's `withdrawReasons`**, in the order sent, each `{ code, label, labelArabic,
  noteRequired }`. Show `label` beside `labelArabic`. **Do not copy 2062's table into the web.** If the response has
  no `withdrawReasons` (an older SIS.Api), Withdraw is hidden. There are no client fallback reasons.
- Confirm is live when a reason is picked and, where `noteRequired`, a note with something in it. The body is
  `{ reasonCode, note }`, with the note trimmed and cut to 200.
- The answers are the slip rules (`withdrawAnswer`):
  - 200 drops the preview and re-reads;
  - 400 keeps the input and shows the message;
  - 404 says so and re-reads;
  - a **bare 403** takes Withdraw away for the rest of the page visit;
  - 503 `NOT_SET_UP` shows the message with no resend;
  - anything else shows the message, and pressing again is safe.
- The order's `ATWD` history line is the server's. The web sends nothing for it. The Log tab shows it on its next
  load.

### The lift into `core/attachments/`

2050 G3: "features never import features", so the shared body moves up into core. It is **lifted, not copied**.
- **Moves to `core/attachments/`, parameterised:**
  - The pure rules: `holdsCategory`, the preview kind, `wallClockText`, the withdrawn ordering, the owner-list
    projection, the content-failure codes, the upload check, form and retryability, and the withdraw rules and answers.
  - The reads: the access probe, `ByOwner`, `/Content`, Upload and Withdraw, with their query keys moved under one
    `attachments` head. The probe keeps **one** shared cache entry, which both screens read.
  - The upload store.
  - The panel components: list, Withdrawn list, preview, Add and withdraw dialog.
- The panel takes these parameters:
  - owner kind, owner key, category, kind;
  - the read's freshness;
  - the reason list (see below);
  - the caller's words (the empty sentence and the Add label);
  - whether Add takes a caption;
  - an `onChanged` callback.
- **Stays in `collection/inquiry`:**
  - `DrawerFrame` and the grid-staleness hook (`markSlipDayChanged` is called through `onChanged`);
  - `storeDayOwnerKey`, the slip count, column and "No slip" filter;
  - `CASH_CLOSE`/`ECR_SLIP`;
  - the slip reason list.
- **Reasons are a parameter.** The slip drawer keeps its client list: five codes with the EN·AR bundle labels ticket
  323 drafted, still waiting on the owner's read. It does so because "no behaviour change" is the lift's promise. The
  order tab passes the server's list. Moving slips onto the server's `withdrawReasons` is possible now (2062 serves
  them for `STORE_DAY` too), but it is out of this spec.
- **i18n.** A new `attachments` namespace, registered centrally, holds the panel's own words. The slip drawer's generic
  keys move into it **with their values unchanged**. The words a caller passes stay in the caller's namespace. The
  order tab's new strings (tab name, Add prescription, caption label, "Filed on order", the Files row) go in `document`.
  English and Arabic both wait on the owner's read (map 1199).

### The Prescription card and the Files row

- `fields.ts` gains a Files row, `Files · N · Show`. It shows only when the tab would (owner and category present, the
  gate admits) and N > 0. Clicking Show selects the tab, which triggers the first read.
- N is the same number as the badge. `fields.ts` stays pure: it gets N and a "files row allowed" flag handed in, and
  never reads the probe itself.
- The card's existing rule ("show when any row has a value") now also counts the Files row. The "Rx document" link row
  is unchanged.
- The row carries an **action**, not an `href`. The card row type gains an optional action that the rail renders as
  a button. That is a small, local extension.

### A delivery's page

- The tab lists `attachmentOwnerNo`'s files. When that differs from the route's number, the tab heads its list with
  **"Filed on order \<no\>"**, linking to `/oms/document/<no>`. An ATBI owner reads the same, since it is an order
  document.
- Add files onto the owner, as the contract requires.

### HQ WPF's link-out

2070 opens `<base>/oms/document/{attachmentOwnerNo}` with **no tab parameter**. The page opens on Items, with the
Attachments tab and its badge visible. **No deep-link parameter is added here.** It would change HQ WPF's URL builder
too. Selecting the tab is the read a person asked for.

### Model

`core/models/sd-document.ts`'s header model gains optional `attachmentOwnerNo`, `attachmentCount` and
`attachmentCategory`, typed as possibly absent. `core/models` gains the `SD_DOCUMENT` item shape, which is the slip
item plus `caption`, and the `withdrawReasons` sibling. The slip types become aliases of the shared ones, with nothing
renamed on the wire.

### Deploy

oms-react goes **last**, after OMS DB script 004, the grant seed on OMS-HQ, SIS.Api (with the prerequisite field), the
till and HQ WPF (2054 "Deploy order"). Until the File Server production key exists (BackOffice 1962), the probe
answers 503 `NOT_SET_UP` and the tab stays hidden. That is correct, not a bug.

## Testing Decisions

- **Test behaviour through the pure modules' outputs and the drives' visible page, never implementation details.**
  RTL is still not installed (spec 083), so components are proven by driving the app.
- **Tier 1, vitest on the pure modules (node):**
  - the badge/Files number: model count before load, list length after, absent → none, `0` shown;
  - the gate: owner absent, category absent, probe pending/refused/malformed, a bare-string `categories`, and
    `withdrawCategories` without the category;
  - the caption and note clamp (200, surrogate pair kept whole, trimmed);
  - the upload form: `SD_DOCUMENT` parts with and without a caption, and **the slip form byte-identical to today's six
    parts**;
  - retryability by code (`NOT_SET_UP` 503 is not retryable, `FILE_SERVER_UNREACHABLE` is, a bare 403 is not);
  - reasons from the response: order kept, `noteRequired` honoured, an absent list hides Withdraw;
  - the Files row: shown only with the flag and N > 0; the card shows on files alone; the link row is unchanged;
  - "Filed on order": shown only when the owner differs from the route's number.
- **The lift's proof is the existing slip suites.** They move with their modules, re-pointed at the new paths with
  **assertions unchanged**. `slip-count-drive`, `slip-drawer-drive`, `slip-add-drive` and `slip-withdraw-drive` must
  pass **unmodified**. A drive that needs an edit is a behaviour change and a finding.
- **Tier 3, a new stubbed drive** (`order-attachments-drive`, no live SIS.Api), with the network counted:
  - **no `ByOwner` request on page load**, exactly one on the tab's first selection, and none on re-selection;
  - no `/Content` until a file is clicked;
  - the tab hidden for: no owner, no category, a refused probe, a category not held;
  - the badge from the model, then from the list; absent count → no badge;
  - jpeg/png/pdf previews, download without a second fetch, 404/502/`READ_NOT_AUDITED` answers;
  - Add with an Arabic caption (the form part asserted), a local refusal, `ATTACHMENT_TOO_MANY`, a retry keeping its
    `ClientRequestId`;
  - Withdraw with server reasons, Other needing a note, a bare 403 removing it, no Withdraw without the grant or
    without `withdrawReasons`;
  - Withdrawn (n) collapsed and expanded;
  - the Files row switching tabs;
  - a delivery showing "Filed on order" and adding onto the owner;
  - object URLs revoked on leave.
- The document page's drives (`document-detail`, `-cards`, `-rail`, `-rtl`, `-band`, `-items`, `-actions`) stay
  green, and `document-rtl-drive` also covers the new tab in Arabic layout.
- `typecheck`, `lint` (import boundaries: nothing under `core/attachments` imports a feature) and `build` must all be
  green, as must `npm test`.
- **Owner's hand walk** (2071's Proof), against a live SIS.Api with a user holding P2E read only, then read + withdraw:
  - the tab;
  - Add with an Arabic caption;
  - Withdraw as `WRONG_ORDER`;
  - the trail;
  - a delivery's page.

## Proposed slices (for `/to-tickets`)

| Slice | What | Blocked by |
|---|---|---|
| Prefactor | Lift the slip drawer's body into `core/attachments/`, parameterised; the slip drawer renders it; no behaviour change | — |
| Read | The tab, gate, badge, first-open read, list, preview/download, Withdrawn (n), the Files row, the delivery's "Filed on order" | Prefactor + the BackOffice `attachmentCategory` ticket |
| Add | + Add prescription with caption, retry and refusals | Read |
| Withdraw | Withdraw… with the server's reasons and grant | Read |

## Out of Scope

- Every server, SIS.Api, till, HQ WPF and DB change, **except** the prerequisite `attachmentCategory` field, which
  BackOffice builds.
- Moving the slip drawer onto the server's `withdrawReasons`.
- A deep link that opens the Attachments tab, and any change to HQ WPF's link-out.
- Files on the P2E/My Orders lists, or on the deliveries grid (the web does not call `MyOrdersList`).
- A customer-level search of prescriptions (`AttachmentWeb/Search`).
- Restoring a withdrawn file, editing a caption, deleting or retaining files (2054: correction is withdrawal).
- A client-side cap on files, camera capture, HEIC, and any change to `PrescriptionUrl` or the "Rx document" row.

## Further Notes

- **Day one is dark by design.**
  - Nobody holds `P2E`/`ALTIBBI` read, or any withdraw grant, until an admin binds them.
  - ADMIN has no P2E/ALTIBBI read either (BackOffice `.afk/HITL-2062.md`: 1968 left the category undeclared).
  - The probe answers `NOT_SET_UP` until 1962.

  The hand walk needs the seed, a bound user and a configured File Server on staging.
- **Wording waits on the owner.** Everything here is new or moved: the tab name, Add prescription, the caption label,
  the Files row and "Filed on order". The reason labels are the server's. The Arabic in 2062's table is drafted.
- **The badge can be briefly stale.** A till may attach while the page is open. The model count is from the page load
  and the list from the tab's open. The page's Refresh fixes both, and nothing polls.
