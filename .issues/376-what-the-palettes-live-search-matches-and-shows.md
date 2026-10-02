---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: 374
---

# 376 — What the palette's live search matches on and shows

## Question

[What read backs the palette's live delivery search](374-what-read-backs-the-palettes-live-delivery-search.md)
found that no existing read serves [364](364-what-the-command-palette-holds.md)'s live search
cheaply. It priced a new BackOffice read, `DeliveryQuickFind`
([research](assets/374-palette-search-read.RESEARCH.md)). Three owner calls follow from it:

- **Drop the mobile suffix?** The research recommends **exact mobile across its stored formats**
  (`05…` / `9665…` / `+9665…`), which is one plain index. Suffix matching would need a `REVERSE()`
  column on 20.9M rows, and a 4-digit suffix matches about 2,000 strangers. This amends 364's
  "exact or by suffix".
- **Does a hit show the customer's name?** The prototype labels each hit `deliveryNo · name`, and
  364 ruled only that search never *matches* on name. The default in the research is no name, and
  no phone echoed.
- **Does live search ship with the keyboard-layer step, or after it?** It is blocked on a
  BackOffice route and two DBA-run indexes. Jump to number covers exact numbers with no read in the
  meantime.

## Answer

Resolved 2026-10-02 by owner grilling. All three calls went with the research's recommendation.

### 1. Mobile matches exactly, in any stored format. The suffix is dropped.

- A mobile-shaped term matches the **full number** in any of its stored forms: `05…`, `9665…` or
  `+9665…`. The server expands the term into all three and runs
  `CustomerPhone IN (@local, @intl, @plusIntl)` on the new `IX_SdDocumentCustomer_CustomerPhone`.
  That is one plain index and no schema change.
- **No suffix, at any length.** Seeking a suffix needs a persisted `REVERSE(CustomerPhone)` column
  and an index on 20.9M rows. A short suffix would also match strangers' records
  ([research §3](assets/374-palette-search-read.RESEARCH.md)). The case the suffix was meant to
  cover, a number typed in the other format, is already caught by the format expansion.
- The three numbers keep **exact or prefix** matching (≥4 chars), as in 374's branch table.
- **This amends 364's "exact or by suffix"** (an inline note is added in
  [What the Ctrl+K palette holds](364-what-the-command-palette-holds.md)).

### 2. A hit row shows no name and no phone.

- **The hit row shows:** `deliveryNo` (mono), the **status pill** from 369's derivation over the
  hit's row fields, the store code, the entry date, and a **matched-on tag**: delivery, document,
  order or mobile.
- **Left out:** the customer name (the prototype's `deliveryNo · name` label is not adopted), the
  phone (the operator just typed it, so showing it again adds nothing), and always `customerOtp`.
  This holds 374's payload exactly: `deliveryNo · documentNo · orderNo · storeCode · entryTime ·
  matchedOn` plus the status fields. There is no `customerName` and no `customerPhone`.
- **Why:** the palette is an always-open box that may be screen-shared, and a mobile search can
  return several deliveries. Store, date and status are enough to tell them apart without showing
  PII.
- Opening a hit goes through Delivery details' own gate, the same as Jump to number.

### 3. Live search ships after the keyboard step, as its own ticket.

- **The keyboard step** (361's second step) ships the palette **without the live-search group**:
  This screen · Recent · Go to · Jump to number. **Jump to number** covers exact numbers in the
  meantime, with no read.
- **Live search becomes a later spec ticket,** blocked on BackOffice `DeliveryQuickFind` (gated by
  both OMS grants) and the two DBA-run `ONLINE` indexes (`IX_DeliveryHeader_OrderNo` and
  `IX_SdDocumentCustomer_CustomerPhone`). This is the same pattern as Retry
  ([370](370-retry-job-drop-it-or-ask-backoffice.md)). Its client half is a `quickFind` in an
  `@/core/oms` API, with a 250 ms debounce, `signal` cancellation, and fail closed on both grants.
- **No feature-flagged stub.** The group doesn't exist until the route exists.
- **The BackOffice ask is filed at `/to-spec`**, along with 374's §6 pre-build checks: whether
  index 028 is applied in prod, whether an unscripted phone or OrderNo index already exists, and
  the histogram of phone formats at rest.
