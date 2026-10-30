---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3242-any-picking-source-may-host-a-donor-request-spec.md
blocked-by: — (live: BackOffice spec 3242, merged into pricing2 68c0870fd)
---

# 672 — Donor requests and Pick support name any host, not only a delivery

## What to build

BackOffice spec 3242 lets any picking source host a donor request: an OMS delivery, a prescription
session, a Wasfaty+ order, and later Nphies and Wasfaty approvals. The key in `deliveryNo` is now the
**host key**, and it can be up to 64 characters. The screens that today say "delivery" need to name the
host instead.

- **Donor requests list and inspector (429–432):** show the host label (`hostLabel` / `hostLabelAr`) beside
  the key. "Open its delivery" appears only when `hostSourceType` is `OMS`. For any other host, show the
  key as plain text.
- **Pick support (496, 499):**
  - The search takes keys up to 64 characters.
  - A new key kind, `DONOR_HOST`, returns `resolution.hosts[]` alongside the deliveries. Each row shows its
    label, key, current store, what it matched by, and its shapes.
  - A diagnosis shows `hostLabel` when `hostSourceType` is not `OMS`.
- **Older servers:** a blank or missing `hostSourceType` reads as a delivery, exactly as today.
- **Outcome reasons in words:** BackOffice 3232 adds two hook reasons that end a request on a host that isn't
  a delivery. Both arrive in `outcomeReason`:

  | Code | English (the till's words) | Arabic |
  |---|---|---|
  | `HOST_CANCELLED` | Order cancelled | تم إلغاء الطلب |
  | `HOST_STORE_CHANGED` | Order moved to another store | نُقل الطلب إلى فرع آخر |

  Today the donor requests grid (`columns.tsx`, `outcomeReason`) and the activity spine (`ActivitySpine.tsx`)
  print `outcomeReason` raw, so the existing hook codes `DELIVERY_CLOSED`, `DELIVERY_FORCE_CLOSED` and
  `DELIVERY_STORE_CHANGED` show raw too. Add one code → words map for every hook reason. Show an unknown
  code raw, as today.
- **The request read by host (BackOffice review fix):** `GET DonorRequest?delivery=` now takes an optional
  `sourceType` (the host type). Pass it when the screen knows the host. Without it the server behaves as before.
- **Timeline events:** two new donor-request event types appear on the trail: `REKEY` (adoption moved the request
  onto a session) and, on the session, `DONOR_CARRIED`. Give them words beside the reason codes.

## Wire fields (all additive, BackOffice 3234)

| Model | New fields | Notes |
|---|---|---|
| `DonorRequestModel` | `hostLabel`, `hostLabelAr` | beside `sourceType`, `deliveryNo` |
| `DonorRequestInquiryRow` | `hostLabel`, `hostLabelAr` | beside `hostSourceType`, `deliveryNo` |
| `PickSupportDiagnosis` | `hostSourceType`, `hostLabel`, `hostLabelAr` | `deliveryNo` is the host key |
| `PickSupportResolution.hosts[]` | `hostSourceType`, `hostKey`, `hostLabel`, `hostLabelAr`, `currentStore`, `matchedBy`, `shapes` | key kind `DONOR_HOST` |

`DonorPickSlipModel` gains the same fields, but only the till prints it, so it is not needed here.

## Spine reach

UI (donor screens, Pick support console), core models

## Proof

- [x] A WP-hosted donor row shows its host label and no "open delivery" link · vitest
- [x] A `DONOR_HOST` lookup lists its host rows with their shapes · vitest
- [x] A row without `hostSourceType` renders as a delivery, exactly as today · vitest
- [x] `HOST_CANCELLED` and `HOST_STORE_CHANGED` render in words, in English and Arabic, in the grid and on the spine; an unknown code renders raw · vitest

## Boundaries

Read-only. A fix on a non-delivery host goes through the existing fix door, which takes the host's
registry lock on the server. Only the donor-at-old-order-store shape is evaluated on a non-delivery
host.

## Done when

The proofs are green and the screens name the host against a spec3242 server.

## Comments

**Built (2026-10-30).** Proofs: `src/features/oms/donor-requests/inspector.test.ts` + `columns.test.ts` (WP row,
row without a source type, reason column EN/AR), `src/features/oms/pick-support/resolve-view.test.ts` (DONOR_HOST
→ host rows with shapes; an older server's answer unchanged), `src/core/pick-support/diagnosis.test.ts`
(`diagnosisHost`, `timelineEventWord`), `src/core/oms/donor-words.test.ts` (every hook reason and both events in EN
and AR; unknown → raw). New pure modules: `core/oms/donor-host.ts`, `core/oms/donor-words.ts` (its own
`donor-words` namespace, EN + AR, registered in `core/i18n.ts`).

**Where the server differs from this ticket** (checked against BackOffice `pricing2` at 68c0870fd / e4dc6b379):

- `DonorRequestModel` (the donor request list and Document Details' rows) carries the host type as **`sourceType`**,
  not `hostSourceType`. `hostSourceType` is on `DonorRequestInquiryRow` (the WPF/Mispick inquiry pane, which
  oms-react does not read), `PickSupportDiagnosis` and `PickSupportResolvedHost`. The list reads `sourceType`.
- `GET DonorRequest?delivery=&sourceType=` is the till's x-api-key door (`DonorRequestEndpoints.ForDelivery`);
  oms-react never calls it. Document Details reads `SdDocumentWeb/Delivery/{no}/DonorRequests`, which takes no
  `sourceType` and only ever serves a delivery page. So there was nothing to pass; no change.
- `DONOR_CARRIED` is a **prescription session** event (`PrescriptionSessionDonorEvents.CarriedOver`), not a donor
  request event; no oms-react screen shows a session's event trail today. Its words are in `donor-words` (so the map
  is whole), but only `REKEY` has a surface: the Pick support timeline, where the code stays and the words sit
  beside it. The English for both is the till's (`PrescriptionSessionWords.Event`).
- The search box had no client-side length cap, so "keys up to 64" needed no change (the server's `MaxLookupKey` is 64).
- A resolution may also carry `approvalDocuments[]` (ticket 2806); still not modelled here — out of scope.

**Judgement calls.**
- Grid: the `deliveryNo` column (id kept, so saved column state still finds it) is headed "Raised for"; a delivery
  row shows its bare number exactly as before, any other host the server's label in the screen's language. The
  inspector shows "Raised for" + "Number" for a non-delivery host and no Open button; Enter / double-click on such a
  row go nowhere (`requestOpenPath`).
- Pick support: a lookup naming any non-delivery host is a list (hosts are never opened straight away — one delivery
  alone still opens its diagnosis). The host rows open the diagnosis by host key under `?delivery=`, as delivery rows do.
- Only the hook reasons get words, as the ticket says. The person-chosen cancel/refuse codes (`PICKED_HERE`,
  `OUT_OF_STOCK`, …) still render raw; the till has words for them (`DonorRequestWords`) if a follow-up wants them.

**Arabic — drafts for the owner to check** (`src/locales/ar/donor-words.json` unless noted):
- `HOST_CANCELLED` تم إلغاء الطلب · `HOST_STORE_CHANGED` نُقل الطلب إلى فرع آخر (the ticket's drafts)
- `DELIVERY_CLOSED` تم إغلاق التوصيل · `DELIVERY_FORCE_CLOSED` تم إغلاق التوصيل قسرًا · `DELIVERY_STORE_CHANGED` نُقل التوصيل إلى فرع آخر
- `REKEY` نُقل طلب المتجر المانح إلى الجلسة · `DONOR_CARRIED` نُقل طلب المتجر المانح من التحضير السابق
- `donor-requests.json`: "Raised for" مطلوب لصالح · "Number" الرقم; `pick-support.json`: "Picked for" مُجهَّز لصالح,
  hosts title عمليات تجهيز أخرى يدل عليها هذا الرقم, `DONOR_HOST` جهة طلب المتبرع
