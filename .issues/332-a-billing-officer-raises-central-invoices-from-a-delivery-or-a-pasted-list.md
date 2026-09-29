---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2094-hq-invoices-a-delivered-delivery-no-till-invoiced-spec.md
blocked-by: BackOffice 2099
---

# 332 — A billing officer raises central invoices from a delivery or a pasted list, and sees each row's verdict

## What to build

This is the web half of BackOffice spec 2094 (ADR 0048, **Central invoice**). A central invoice is HQ
invoicing a delivered retail delivery that no till invoiced, with no pick and no serials. What the
invoice contains, and every eligibility rule, lives on the server. This screen only asks and shows
the answer.

- **Access:** `GET Sd/CentralInvoice/Access` → `{ canOpen }`. When `canOpen` is false, neither the
  action nor the screen appears, and a 403 from either call removes them.
- **Delivery page action:** a *Central invoice…* action on a delivery's page. It opens a dialog with
  a **required** reason and calls `POST Sd/CentralInvoice` with `{ deliveryNos: [thisOne], reason }`.
  The dialog then shows the verdict: accepted/queued, *wait* (changed in the last 24h) or refused,
  with the server's message verbatim.
- **Bulk screen:** in the OMS area, a textarea to paste delivery numbers (one per line; commas and
  whitespace tolerated; duplicates collapsed client-side, and the server dedupes too), an optional
  CSV/XLSX upload of a delivery-number column, and a required reason. The client caps a request at
  200 rows to match the server. The result is a grid of one row per delivery: verdict, code and
  message. The refused and *wait* rows can be copied back out for a later retry.
- **Submission:** the send button is disabled while a request is in flight, so a double click cannot
  send twice. The server is still the guard.

## Spine reach

UI (page action, dialog, bulk screen) / HTTP client (access + POST)

## Proof

- [ ] Owner smoke test on dev SIS.Api (cookie mode):
  - a granted user raises one central invoice from a delivery page and sees *queued*;
  - a pasted list of five, holding one accepted, one *wait*, one refused and one non-delivery, shows
    four correct rows;
  - an ungranted user sees neither the action nor the screen.
- [x] The pure paste parser (split, trim, dedupe, cap) is covered if the repo has a runner. If not,
  it's verified by the smoke test and noted here. *(vitest: `delivery-list.test.ts`, `xlsx.test.ts`,
  `core/central-invoice/verdicts.test.ts`, `layout/menu-model.test.ts`.)*

## Boundaries

Client only: the server contract belongs to BackOffice 2099. No feature flag; access is the grant.

## Done when

The smoke test passes and the build is clean.

## Blocked by

BackOffice [2099](C:\Work\DMSCO\BackOffice\.issues\2099-only-a-granted-hq-user-can-raise-central-invoices-over-http-with-a-reason.md)

## Notes (2026-09-29)

- **Built, client half.** The server contract is BackOffice 2099 (done); this ticket's wire was checked against the shipped
  `CentralInvoiceWebEndpoints.cs` / `CentralInvoiceGrantEndpointFilter.cs`, and there is no drift. The body is
  `{ deliveryNos, reason }` with no actor field, the answer is `data.results[] = { deliveryNo, verdict, code, message }`
  with verdicts `accepted | wait | refused` (exact match, and an unknown spelling is shown as sent, never as *Queued*),
  and without the grant the server sends a bare 403 with no body.
- **Shape.** Two features consume the probe, the POST, the dialog and the verdict pill, so they live in
  `core/central-invoice/`: `api.ts` (one `CENTRAL_INVOICE_ACCESS_KEY` + `canOpenCentralInvoice`, fail-closed,
  `isGrantRefused` / `revokeCentralInvoiceAccess`), `raise.tsx` (`useRaiseCentralInvoice`, `ReasonField`,
  `RaiseButton`), `CentralInvoiceDialog`, `VerdictBadge` and `verdicts.ts`. The bulk screen is
  `features/oms/central-invoice/` at `/oms/central-invoice`, with a nav leaf in the OMS group behind its **own** grant.
  The delivery page's action is a fourth, **Billing**, cluster on the command bar. It is shown only with the grant
  on a category-`D` document (so a delivery-return opened on `/oms/delivery/...` gets none).
- **i18n.** A new `central-invoice` namespace. It is the feature's name, and `core/central-invoice` speaks in it too
  (the `attachments` precedent). The `document` namespace gains `command.clusters.billing` and
  `actions.central-invoice`.
- **Double send.** A ref guard in the shared hook. `isPending` reaches the render a tick after `mutate`, and the
  drive caught **two** POSTs from a double click before the guard was added.
- **403.** A 403 from the POST overwrites the shared probe entry, so the action, the nav leaf and the bulk screen
  (which becomes the denied card) all drop together. A 403 from Access is already a denial in `ScreenGate`.
- **Paste and upload.**
  - Splitting is on whitespace, `,` and `;`. Duplicates are collapsed ordinally, as the server's `Distinct()` does.
  - The 200 cap is counted on distinct numbers and **reported, not applied**: an over-long list is held back with a
    sentence and is never truncated.
  - An upload fills the list, which stays the one source of truth.
  - CSV reading: `sep=` or a separator sniffed over the first ten lines, and quoting per RFC 4180.
  - XLSX reading: a **dependency-free** reader (the zip central directory plus native
    `DecompressionStream('deflate-raw')`), reading the first sheet in workbook order.
  - File type is decided by bytes: the full zip signature, a UTF-16 BOM, and an OLE `.xls` refused.
  - The column is the one headed like "Delivery No". Otherwise it is chosen by **content** (the most 8+-digit
    values), because the rollout sheet heads its delivery numbers "Order No" beside "Store". Leading title and
    header rows are dropped.
  - The real rollout sheet reads as **84 distinct deliveries**, including the two 13-digit ids that spec 2094 says
    must be resolved by hand. The server will refuse those as not a delivery.
- **Menu.** `activePrefix` now also takes a list. Deliveries claims `/oms/deliveries`, `/oms/document` and
  `/oms/delivery` instead of all of `/oms`, so the new leaf is lit alone (unit-tested).
- **Proof run.**
  - vitest: 2693 passed.
  - typecheck, lint and build: clean.
  - `tools/central-invoice-drive.mjs`: **65/65**, all against stubbed envelopes. It covers:
    - the dialog: body, trim, no actor, the double click sending once, no dismissal in flight, and
      Queued/Wait/Refused plus code and message shown verbatim;
    - the bulk screen's pasted five: four rows, the summary, and the clipboard holding exactly the three to retry;
    - the over-cap hold-back and a 400 shown as the server sent it;
    - CSV, XLSX (the real sheet) and `.xls` files;
    - ungranted and unreachable sessions (hidden, denied card, zero POSTs);
    - a 403 from either POST removing the action, the leaf and the screen.
  - `tools/oms-access-drive.mjs` now answers the central-invoice probe as denied, because its catch-all stub would
    otherwise keep the OMS group drawn. It passes 28/28.
  - `order-attachments` (244/244) and `document-detail` (39/39) are unchanged and green.
  - `document-actions` and `no-access` fail the same assertions on HEAD b124dfe as with this change.
- **Still open: the owner smoke test on dev SIS.Api (cookie mode).** Nothing here has met a live SIS.Api. Run the
  2099 seed on dev, bind a user to `CENTRAL_INVOICE_ADMIN` (or use ADMIN), then walk the three Proof bullets above.
- **Review (code-review + standards/spec).**
  - Fixed:
    - the duplicated mutation and reason code, now one hook;
    - `Verdict` renamed to `CentralInvoiceVerdict`;
    - "door" wording renamed to grant wording;
    - the POST body typed;
    - the copy button relabelled "Copy the ones to retry", because it also copies an unknown verdict;
    - the header-preferring column pick;
    - title rows;
    - separator sniffing;
    - the file signature and encoding checks;
    - duplicate row ids;
    - the dialog flashing the last verdict on reopen.
    - CONTEXT.md gains **Central invoice** and the Billing cluster.
  - **Needs owner sign-off:**
    1. `features/oms/central-invoice/` has **no `api.ts`**. Its only call is shared in `core/`, but feature-structure
       lists `api.ts` as required, so either the rule gets an exception or this is ruled out.
    2. `core/` speaks in a namespace named after a feature. This departs from "namespace == feature name".
  - **Declined:**
    - A shared `core/csv` reader alongside ua-admin's `parseCsv`: the two read different things, and there is no
      second consumer.
    - An app-wide single-flight mutation helper: the same double-send window likely exists in the other dialogs
      (`ReturnDialog`, the document commands), which is a follow-up outside this ticket.
