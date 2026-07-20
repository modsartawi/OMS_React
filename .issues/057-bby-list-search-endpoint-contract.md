---
type: wayfinder-ticket
wayfinder: grilling
map: 053
status: done
blocked-by: 054
---

# 057 — List/search endpoint contract

## Question

Design the **request/response contract** for the list-search endpoint (built later on SIS.Api;
called via `src/core/api.ts`). Pin:

- **Path & verb** (e.g. `Bby/List` or `BbyInquiry/Search`) and params:
  - `bbyNumber` — exact vs prefix/contains (decide);
  - `validFrom` / `validTo` range → **validity-window-overlap** semantics computed against the
    `yyyyMMdd` **string** fields (string-range vs parsed-date on the server — from ticket 054);
  - `activeOnly` default (screen opens on currently-active; togglable to all);
  - paging/limit + ordering (WPF used top-1000 by `CreatedAt` desc).
- **Row DTO**: which of the 28 `BbyHeader` fields the summary row carries (grid columns come from
  this — ticket 059), and how status/dates are shaped for the client (raw strings vs formatted).
- Envelope conformance (`HttpGeneralResponse<T>`, `ApiError` kinds) per the api-envelope rule.

Deliverable: a concrete contract sketch (params table + row DTO) ready for the spec and for the
backend team. Reference: `BbyInquiryController.cs` (current NHibernate query), `BbyHeader.cs`.

## Answer

Contract designed (grill, 2026-07-20). Four preference calls settled with the human: **exact-match**
number search, **top-N cap** (no paging), **access-probe folded in here**, **full 28-field parity**
row. Everything else falls out of the grounding in [054](054-bby-domain-glossary.md) (active =
`BbyStatus=="A"` AND `ValidFrom≤today≤ValidTo`, ordinal `yyyyMMdd` string compare) and
[055](055-bbymodel-field-inventory.md) (every summary scalar already lives on flat `BbyHeader`).

The endpoints are **designed contracts only** — built later on SIS.Api, called through
`src/core/api.ts` (api-envelope rule). Two endpoints are specified: the **list/search** GET and the
folded-in **access probe** GET. The detail-by-number endpoint stays with ticket
[058](058-bby-detail-endpoint-contract.md).

### 1. List/search endpoint

**`GET Bby/List`** (sibling of the flagged `Bby/Access` below and the 058 endpoints `Bby/Detail` /
`Bby/GroupingMembers` — the inquiry read endpoints share the `Bby/*` prefix that ticket 058 settled
on). Response envelope is the universal `HttpGeneralResponse<T>`; `request()` unwraps `.data`.

**Query params** (all optional; `null`/`undefined`/`''` dropped by `buildQuery`, so the client never
pre-filters them):

| Param | Type | Semantics | Default |
|---|---|---|---|
| `bbyNumber` | string | **Exact match** — `BbyNumber = @q`. Keyed lookup; the user types the whole number. When present, `activeOnly` is sent `false` (a number lookup must find inactive/deleted BBYs too). | — |
| `validFrom` | string `yyyyMMdd` | Start of the **validity-overlap** window (see §1a). Not `CreatedAt`. | — |
| `validTo` | string `yyyyMMdd` | End of the validity-overlap window. | — |
| `activeOnly` | bool | `true` ⇒ server applies the active gate (§1b). The screen opens with `activeOnly=true` and no other param; issuing any search (number or date range) sends `activeOnly=false`. The endpoint is a **pure function of its params** — no implicit server override; the client owns the UX rule (for ticket 059). | `true` |

**Ordering & cap:** `ORDER BY CreatedAt DESC`, `TOP 1000` (WPF `BbyInquiryController.Limit` parity).
No paging. When the cap is reached the response flags it so the UI can prompt "refine your search".

**1a. Validity-overlap semantics (on the `yyyyMMdd` strings).** Zero-padded `yyyyMMdd` is
ordinally sortable, so a **plain string compare equals a date compare** — no server-side parse needed
(this resolves the map's "string-range vs parsed-date" fog). A row's window `[ValidFrom, ValidTo]`
overlaps the query window `[validFrom, validTo]` iff:

```
ValidFrom <= validTo   AND   ValidTo >= validFrom      (all string comparisons)
```

Half-open windows: if only `validFrom` is given ⇒ `ValidTo >= validFrom`; if only `validTo` ⇒
`ValidFrom <= validTo`. **Day granularity** — `ValidFromTime`/`ValidToTime` (`HHMMSS`) are **not**
used in overlap (they ride along on the row for display only).

**1b. Active gate (`activeOnly=true`).** `BbyStatus == 'A'` AND `ValidFrom <= @today <= ValidTo`,
where `@today` is server-local `yyyyMMdd`, ordinal string compare — exactly the 054 definition. This
is **not** the engine's fire-time gate (`SyncApprovalStatus`, cond-level dates, intra-day time,
loyalty) — the inquiry deliberately does not reproduce it.

### 2. Row DTO — `BbyInquiryRow` (full 28-field parity)

Every column the WPF `BbyInquiryView.xaml` grid showed, straight off `BbyHeader`. **Raw strings/codes
— no server formatting**: dates stay `yyyyMMdd`, times `HHMMSS`, `bbyStatus`/`linkCategory*`/
`condTargetType` stay single-letter codes. The client formats dates, maps codes to labels, and renders
the status badge via `t()` (i18n-zero-literal rule — server text is data, labels around it are keys).

| # | Field | Type (wire) | Codes / format |
|---|---|---|---|
| 1 | `bbyNumber` | string | business key (grid rowKey) |
| 2 | `description` | string | server text (passthrough) |
| 3 | `bbyProfile` | string | |
| 4 | `validFrom` | string | `yyyyMMdd` raw |
| 5 | `validTo` | string | `yyyyMMdd` raw |
| 6 | `validFromTime` | string | `HHMMSS` raw |
| 7 | `validToTime` | string | `HHMMSS` raw |
| 8 | `promoNumber` | string | |
| 9 | `linkCategoryBuy` | string | `A`=And / `O`=Or |
| 10 | `linkCategoryGet` | string | `A`=And / `O`=Or |
| 11 | `bbyStatus` | string | `A`ctivated / `I`nactive / `D`raft / `X`Deleted (display-only; distinct from engine `SyncApprovalStatus`) |
| 12 | `offerId` | string | |
| 13 | `limitNumber` | int | |
| 14 | `minValue` | decimal | |
| 15 | `maxValue` | decimal | |
| 16 | `condTargetType` | string | `R`=Document / `P` / `M` / `G` |
| 17 | `includes` | string | |
| 18 | `excludes` | string | |
| 19 | `score` | int | |
| 20 | `originFilter` | string | |
| 21 | `priceListType` | string | |
| 22 | `isStackable` | bool | |
| 23 | `allowNestedStacking` | bool | |
| 24 | `stackingExcludes` | string | |
| 25 | `loyGroups` | string | |
| 26 | `loyTiers` | string | |
| 27 | `createdAt` | string | ISO-8601 (`DateTime` → serialized); client formats |
| 28 | `createdBy` | string | |

Plus one **server-computed convenience** (not a `BbyHeader` column, clearly derived):

| — | `isActive` | bool | result of the §1b gate for *this* row against server `@today`. Lets the grid render the "active now" state and the default-filter chip without re-implementing the date compare client-side. Purely derived; `bbyStatus` stays raw. |

**Response `data` shape** (object, not a bare array — carries the cap flag):

```jsonc
{
  "rows": BbyInquiryRow[],   // ≤ 1000, CreatedAt desc
  "capReached": boolean      // true when the 1000-row cap truncated the result → UI shows "refine your search"
}
```

### 3. Envelope conformance (api-envelope rule → `ApiError` kinds)

- **200 / `success:true`** ⇒ `data:{rows,capReached}`. Empty result is `{rows:[],capReached:false}`,
  not an error.
- **400 business** ⇒ malformed input (e.g. `validFrom` not `yyyyMMdd`, or `validFrom > validTo`).
  Envelope `success:false` + machine code (`INVALID_DATE_FORMAT` / `INVALID_DATE_RANGE`) + message;
  surfaced via `apiErrorMessage`/`apiErrorCode`, never a bare `.message`.
- **403 business** ⇒ caller lacks the `BbyInquiry` grant. Envelope `success:false`, code
  `ACCESS_DENIED`. This is the **real security boundary** — enforced server-side even though the
  access probe (§4) already hides the screen. Defense in depth: the probe is UX, the grant is the gate.
- **401** ⇒ not handled in feature code; `handle401` clears session + redirects centrally.
- **≥500** ⇒ `'server'` kind, generic message.

### 4. Folded-in access-probe contract (`Web/Access`, from ticket 056)

**`GET Bby/Access`** → `HttpGeneralResponse<{ screenAllowed: boolean }>`. Mirrors the
existing `Pricing/CacheAccess` (ticket 051) and NC `Notifications/Access` (ticket 038) probes. Gates
the menu item + route on a `BbyInquiry` screen grant (`screenAllowed`), consumed by the
`layout/menu-model.ts` `accessProbe` per the feature-structure rule.

**Graceful pre-build behaviour** (the endpoint ships after the client, like NC 038): while the probe
is **absent** — HTTP 404 or network error — the client **fails open (screen shown)**. Rationale: this
is a *read-only* inquiry, and §3's `403 ACCESS_DENIED` on the list endpoint is the actual security
boundary, so an over-permissive menu entry can't leak data. Once the probe **exists** and returns
`screenAllowed:false`, the menu item and route are hidden. (This is the one judgement call in the
contract — fail-open was chosen over fail-closed *because* the list endpoint enforces the grant
independently; a screen with no server-side enforcement would fail closed instead.)

### Notes for downstream tickets

- **Ticket 059** (list + search UX prototype) now unblocked — consumes this params table, the
  `capReached` "refine your search" affordance, the `activeOnly` client UX rule, and the raw-code →
  badge/label formatting. **Export** (WPF Export-to-Xlsx) stays fog on the map, decided at 059 once
  list UX is pinned.
- **Ticket 058** (detail contract, resolved concurrently) is independent; it shares the `Bby/*`
  prefix (`Bby/Detail`, `Bby/GroupingMembers`) and the same envelope/`ApiError` conventions.
- The `isActive` computed field + `@today` server-local basis should be echoed in the spec so the
  UI's "active" chip and the server gate never drift.
