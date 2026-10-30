---
status: open
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

- [ ] A WP-hosted donor row shows its host label and no "open delivery" link · vitest
- [ ] A `DONOR_HOST` lookup lists its host rows with their shapes · vitest
- [ ] A row without `hostSourceType` renders as a delivery, exactly as today · vitest
- [ ] `HOST_CANCELLED` and `HOST_STORE_CHANGED` render in words, in English and Arabic, in the grid and on the spine; an unknown code renders raw · vitest

## Boundaries

Read-only. A fix on a non-delivery host goes through the existing fix door, which takes the host's
registry lock on the server. Only the donor-at-old-order-store shape is evaluated on a non-delivery
host.

## Done when

The proofs are green and the screens name the host against a spec3242 server.
