---
type: wayfinder-ticket
wayfinder: grilling
map: 222
status: done
blocked-by: 223
---

# 226 — What each tab puts in a row

## Question

Three tabs, three payloads, and 223 will have said what is in each. This ticket picks. For
**Activities**, **Sales**, and **Actions** separately:

- **Columns.** Which fields earn a column, in what order, and what is the row's headline — the
  thing an agent's eye lands on first. Fields left out are a decision, not an omission; say which
  and why.
- **Formatting.** Dates, points, and money. Points arrive `.Round()`ed from one endpoint and raw
  from elsewhere — is a fraction ever shown? Is a negative points row (a redemption, an expiry)
  visually distinct from an earning, or just a signed number?
- **Order and volume.** What sorts by default, and how many rows come back. If a report answers
  hundreds, does the tab page, virtualize (AG Grid does), or cap with something said out loud —
  a silent truncation reads as "that's all there is". If it answers "last N", the heading should
  say N rather than leaving the agent to assume completeness.
- **Empty, loading, and failed — per tab.** Three tabs fetch independently; one failing must not
  take the screen down. Does an inactive member's empty Sales tab read differently from a failed
  fetch? Are the tabs fetched eagerly on resolve, or lazily on first open?
- **Does any row lead anywhere?** A sales row points at an invoice; an action row points at a
  request. Phase 1 has no detail route, and a dead link is worse than no link — so this is likely a
  "no", but it should be a decided no.

Settle it with `/grilling`; capture the column sets concretely enough that the spec can be written
from them.

## Answer

Settled by `/grilling` on 2026-08-05 (twelve decisions). Two of them rest on facts read from
BackOffice source during the session that **correct [What the four Loy reads actually
return](223-what-the-four-loy-reads-actually-return.md)** — they are recorded first because they
changed the answers that follow.

### 🚩 Two corrections to 223's inventory

1. **`Points` arrives already signed — no client-side debit/credit table is needed.**
   223's asset closed with "if the Activities tab wants +120 / −80 rather than a bare magnitude,
   that sign has to be derived client-side from `ActivityType`". That is **wrong**, and it was
   inferred from the wrong query. `LoyActivityService.AddActivity` — the single write site for every
   `LoyActivity` row — computes the magnitude and then negates it in place:

   ```csharp
   SpendPoints = (pointAmount * spendPointsFactor).Round5(),           // :971
   if (debitCreditIndicator == LoyDebitCreditIndicatorConstants.Debit)  // :984-988
   { activity.TierPoints *= -1; activity.SpendPoints *= -1; }
   ```

   So `SELECT LoyActivity.SpendPoints AS Points` yields negatives for `RDEM`/`EXPS`/transfer-out.
   The `LastPurchases` SQL that suggested otherwise re-derives the sign from `PointsAmount`, which
   **is** the unsigned magnitude — a redundant second derivation, not evidence of an unsigned column.
   Corroborated by consumers that `Math.Abs()` the value when they want magnitude
   (`LoyActivityStatisticsService.cs:147`) and by `LastActivityModel.ExpiryDateString`'s own
   `if (Points <= 0) return string.Empty;`. Direction lives on a data-driven
   `LoyActivityType.DebitCreditIndicator` column, denormalised onto `LoyActivity` — there is no C#
   enum of debit types to copy, and the client needs none.

2. **Sales money is multi-currency; "always 2 decimals" is wrong for it.**
   `RetailTrxDetail.Currency` is per-row master data (`plant.CurrencyKey`, SAP `WAERS`), not the
   `"SAR"` C#-side default. **Bahrain stores are live** (`B001`–`B005`,
   `AuditRevenueAndVatController.cs:49-50`) and BHD is the footprint's only 3-decimal currency
   (`CurrencyFormatService.cs:37-40`); the column is nullable, so old rows can be empty. The report
   SQL does **not** select `ExchangeRate`, so nothing on this tab may be summed across currencies —
   which is fine, because nothing on this tab is summed at all.

   A third fact from the same read, which the Sales row displays verbatim: `AmountValue` and
   `QuantityValue` are the **signed** reporting twins (`POSController.cs:2322-2354` negates both for
   `RetailTrxType.Return`), but `UnitPrice` has **no signed twin** and stays positive. A return line
   therefore reads `Qty -1.00 · Unit price 12.00 · Amount -12.00`. Also: `RetailTrxType` is only
   `Sales`/`Return`/`CashClearance`, `RetailDocumentType` has 29 members, and both are emitted with
   `Enum.ToString()` — an undefined value serialises as **the number as a string**, so neither is a
   closed union in TypeScript.

### 1. Fetching — lazy on first open

Activities (the default tab) fetches when the member resolves; **Sales and Actions fetch on first
open** and stay cached for that member. Eager fetching buys the tab strip nothing — only Actions has
a real total, so no tab label could carry a count anyway — while costing every lookup a 500-line
`RetailTrxDetail` scan nobody asked for. The consequence that simplifies the rest of this ticket:
**only the open tab can be in flight or failed**, so there is no invisible broken tab to signal.

### 2. Activities — six columns

Source: `TOP (100)`, `ORDER BY ActivityId DESC` — **insertion order, not date order**, so a
backdated posting sorts by when it was written.

| # | Column | Field | Notes |
|---|---|---|---|
| 1 | Date | `ActivityDateTime` | `formatStamp` (`yyyy-MM-dd HH:mm`, local) |
| 2 | Activity | `Description` | server-supplied English from the `LoyActivityType` join |
| 3 | **Points** | `Points` | **the headline** — signed, `text-end`, tabular numerals, 2dp always |
| 4 | Status | `ActivityStatus` | `A`/`P`/`N`/`E`, an undecoded code — [229](229-a-code-the-server-did-not-translate.md)'s problem, not this ticket's |
| 5 | Expires | `ExpiryDate` | blank when `Points <= 0` (the server's own rule) and on a sentinel date |
| 6 | Reference | `ReferenceNumber` | the till receipt / source document |

**Dropped, deliberately:** the whole points-engine machinery (`PointsAmount`, `SalesAmount`,
`SpendPointsFactor`, `PointsAmountInCurrency`, `Currency`) — that is *how* the engine computed the
points, not *what happened*; the keys (`ActivityId`, `RelatedActivityId`); `RefLoyId`;
`EffectiveTime`; `BranchId`; `TierPoints`.

**Status earns its place** because a Pending accrual is the single commonest "why isn't my balance
right", and without the column a pending row looks identical to a posted one — the tab would
silently misexplain the balance it exists to explain.

🚩 **No client-side total, ever.** The server rounds each row to 2dp away-from-zero, so a sum of the
rounded rows will not equal `PointsBalance` in the header (223 §2).

### 3. Points presentation — signed, never coloured

`+120.00` / `-450.00`, right-aligned with tabular numerals so signs and decimal points align into a
scannable column. **No colour, no badge, no row tint.** The Activity column already names the
direction in the server's own English, so the sign is a *second* reading of a fact already stated in
text rather than the only one — a colour-blind agent loses nothing, and the restyle deliberately
made this grid zebra-less. Precision is **exactly two decimals, always**: `AccrualFactor` is
`0.285714286`, so fractional points are routine, and trimming zeros would both ragged the column and
imply points are integers.

### 4. Sales — eight columns, Currency conditional

Source: `TOP (500)`, `ORDER BY TrxDate DESC`. A row is **one sales line** (one item on one receipt),
so a five-item basket is five rows sharing a `TrxNumber`. `TrxDate` is date-only.

| # | Column | Field | Notes |
|---|---|---|---|
| 1 | Date | `TrxDate` | **date-only** — see below |
| 2 | Receipt | `TrxNumber` | repeated across the lines of one basket |
| 3 | Store | `StoreCode` | bare code, no name |
| 4 | Item no. | `ItemNumber` | |
| 5 | **Item** | `ItemDescription` | **the headline** — "what did they buy" |
| 6 | Qty | `Qty` | signed; negative on a return |
| 7 | Unit price | `UnitPrice` | 🚩 **not** signed — positive on a return row |
| 8 | Amount | `Amount` | signed; per-currency decimals |
| 9* | Currency | `Currency` | **only when the fetched rows hold more than one distinct currency** |

🚩 **Date-only, not `formatStamp`.** `TrxTime` is a separate column the report does not select, so
rendering `HH:mm` would print a fabricated `00:00` on every row and imply a midnight purchase. Use a
date-only formatter. The corollary already noted in 223: lines within one day tie, and their
relative order is undefined.

**Money formats per its row's currency** — 2 decimals for SAR, **3 for BHD**, per correction 2.
The Currency column is conditional so the SAR-only member (the overwhelming case) spends no width on
a constant, while the Bahrain member has the currency stated rather than implied.

**Dropped:** `TrxTypeNumber` and `DocumentTypeNumber` (raw twins of the enum-name strings), and
`TrxType`/`DocType` themselves — the signed Qty/Amount already mark a return, and the channel
(`Insurance`, `Wasfaty`, `CallCenter`, `ECommerce`…) is not what an agent opens this tab for.

Two caveats to carry into the spec, both from source: the SQL has **no `LineType` filter**, so
non-item lines (discount, donation) can appear as rows; and the `INNER JOIN Item` means a line whose
item no longer exists **vanishes silently**.

### 5. Actions — seven columns

Source: real `OFFSET/FETCH` paging, `ORDER BY ActionNo DESC`, with a true `recordsCount`.

| # | Column | Field |
|---|---|---|
| 1 | When | `ActionDateTime` (`formatStamp`) |
| 2 | **Action** | `MainActionDescription` — **the headline** |
| 3 | Sub-action | `SubActionDescription` |
| 4 | Details | `ActionData` |
| 5 | Details 2 | `ActionData2` |
| 6 | By | `UserId` — the point of an audit tab |
| 7 | Branch | `BranchId` |

🚩 **The entire member snapshot is dropped** — `Mobile`, `FullName`, `Email`, `Gender`, `CityName`,
`ProfileUpdated`, `InsuranceCompany`, `BlockedReason`, `JoinedDate`. It is the member already on
screen in the header, repeated 25 times per page, and it puts PII into a grid for no reading benefit.
(Note `BlockedReason` here is the *description*, unlike `LoyMemberModel.BlockedReason` which is the
*code* — 223 §5.4. Dropping it sidesteps the trap; no shared TS type spans the two payloads.)

`ActionData2` **is shown** — the user's ruling, over the recommendation to drop it: nothing is hidden
from the agent, even where the field is undocumented and empty on most rows.

Both description fields are **LEFT JOIN**s and go `null` on an unknown code — each falls back to its
raw code rather than rendering an empty cell.

🚩 **`LoyId` is always sent.** 223's strongest correctness constraint: a bare
`GET Loy/Reports/LoyMemberActions` returns the first 25 actions of the **whole estate**, newest
first, across all members — a silent cross-member data leak, not an error.

### 6. Volume — the ceiling is always stated

The two capped tabs **cannot** say "100 of 4,000": there is no total and no more-rows flag. So a
caption above each grid always names the ceiling, and adds a warning when the returned count equals
the cap:

```
Most recent 100 activities.                                    (40 rows)
Most recent 100 activities — there may be older activity not shown.   (100 rows)
Most recent 500 sales lines — there may be older lines not shown.     (500 rows)
```

At exactly-100 that warning is a harmless false positive; staying silent would be a false **negative**
on a 4,000-row member, which is the failure that matters. A bare row count is never shown, because it
reads as completeness.

**Actions is the exception and says so by contrast** — it states its real total (`128 actions`, no
hedging) and pages **25 at a time** (the server's own default) through the existing
`GridPager` (`features/admin/ua-admin/GridPager.tsx`: Prev/Next + "Page N of M", no numbered pages).
Per that component's house rule, a one-page result grows no pager — which is most members.

### 7. Sort and filter — sort what you hold, never what you're paging through

| Tab | Sortable | Filter |
|---|---|---|
| Activities (100 held) | ✓ | ✓ |
| Sales (500 held) | ✓ | ✓ |
| Actions (page 1 of N) | ✗ | ✗ |

The Nphies lists set `sortable: false, filter: false` for a stated reason — *"a sort over the 50 rows
of page 3 would reorder a page, not the result — the same class of lie the invisible window is"*
(`nphies/authorizations/list-columns.tsx`). That binds **Actions** exactly. It does **not** bind the
other two: their entire window is already in the browser, so sorting it is truthful given the caption
from §6 says which window it is. On 500 sales lines a filter is the difference between answering
"did they ever buy X" and scrolling. The line is principled, not inconsistent.

### 8. Empty, loading, failed — per tab, scoped to that tab

- **Loading** — in the tab body, with the §6 caption already visible.
- **Empty** — a per-tab sentence in that tab's own words ("No loyalty activity for this member.",
  "No sales lines for this member.", "No actions recorded for this member."), never a shared
  "No data". A rejected option was one generic `EmptyState`/`ErrorState` pair; it costs the sentence
  that tells the agent *what* was absent.
- **Failed** — the existing `core/ui/ErrorBanner` inline in the tab body, message via
  `apiErrorMessage(err, fallback)` per [api-envelope](../.claude/rules/api-envelope.md), plus a
  **Retry that refetches only that tab**. The member header and the other two tabs are untouched; no
  toast (the state is already fully visible in the tab the agent is looking at).

Retry earns its place on the specific evidence that the likeliest Sales failure is a **SQL timeout on
a heavy member**, which 223 §0 shows arrives as a **raw 500 with no envelope** (`ExecuteAsync`
rethrows anything that is not a `DomainException`) — transient, and often fine on a second attempt.
The fallback string is therefore what an agent actually reads there, not the server's message.

Empty and failed are never conflated: a tab answering `[]` for a member with no history and a tab
that could not be read are different facts, and 223 §0 confirms only the *member* call can refuse a
bad key — by the time a tab fetches, the member exists.

### 9. Row links — a decided no

**No row links anywhere.** Receipt number, activity reference and action number render as plain
selectable text.

Checked rather than assumed: no route in `src/app/router.tsx` accepts a retail transaction number, an
`ActivityId`, or an `ActionNo`. The one route that *looks* like a candidate,
`oms/document/:documentNo`, resolves an **OMS delivery document** — a different identifier space
entirely, so pointing a receipt at it would 404 on every row. Phase 1 has no detail route and this is
a read; a dead link is worse than no link.

### 10. Export — none in phase 1

This resolves the map's **Export** fog item, which was parked to ride with this ticket once volumes
were known.

Ruled out with a reason rather than forgotten: two of the three tabs are silently capped with no
total, so an exported file is the **one artifact §6's caption cannot travel with**. A 500-row sales
CSV looks exactly like a complete purchase history, is not one, and will be forwarded, attached and
cited long after the screen that qualified it is closed. Revisit when the server offers a real count
for Activities and Sales. Consistent with the map's standing "read-only, and simple — take the
smaller phase 1".

### What this ticket did **not** decide

- **Code translation** — `ActivityStatus` (`A`/`P`/`N`/`E`), `StoreCode`, `BranchId` and the Sales
  enum-name strings all reach the grid as codes. Whether they are passed through, `t()`-ed as a
  closed set, or decoded by a lookup call is
  [A code the server did not translate](229-a-code-the-server-did-not-translate.md)'s question. This
  ticket only settled that the columns **exist**.
- **Tab strip and header layout** — order of the tabs, how the member header sits above them, and
  where the §6 captions physically live belong to
  [The shape of the member screen](227-the-shape-of-the-member-screen.md).
- **Nothing was driven against a live SIS.Api**, per the map's standing verification rule from
  [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md) — the `LoyWeb/*`
  door does not exist. This is a decision ticket with no build, so the rule is recorded rather than
  exercised; the column sets above are written to be verifiable against **mocked envelopes** built
  from 223's field inventory.
