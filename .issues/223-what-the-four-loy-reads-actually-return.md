---
type: wayfinder-ticket
wayfinder: research
map: 222
status: done
blocked-by: —
---

# 223 — What the four Loy reads actually return

## Question

Four endpoints will feed this screen. Nobody has yet read what they answer with. Produce the field
inventory the spec will pick from, from **source, not inference**:

- `GET Loy/Member/{loyId}` and `GET Loy/MemberByMobile/{mobile}` → `LoyMemberModel`. Every field,
  its type, and which are nullable. Both take an optional `branchId` — what does it change, and what
  should the portal pass (nothing? the acting store?). Note that `MemberByMobile` is cached 45 s
  (`FusionCache`) and `Member` is not.
- `GET Loy/Reports/LastActivities/{loyId}` → `LastActivityModel[]`, via `LoyReportService`. What is
  a row, is it capped or "last N", what determines its order, and what does `Points.Round()` on the
  endpoint imply about the raw value.
- `GET Loy/Reports/LoyaltySales/{loyId}` → `LoyReportService.GetLoyaltySales`. Same questions —
  **plus** how its row compares to what the WPF `SalesViewModel` grid shows out of `RetailTrxDetail`
  (`SalesView.xaml` is the reference). Name explicitly what a WPF user would lose.
- `GET Loy/Reports/LoyMemberActions` → takes `[AsParameters] LoyMemberActionParams` and returns
  `LoyMemberActionReportResult` with a `.Records` collection. What are the params (is `loyId` one of
  them, is a date range required, is it paged?) and what is a record.

Also: what does each answer when the member does not exist, and does the response ride the standard
`HttpGeneralResponse<T>` envelope `core/api.ts` already unwraps, or something else?

Read `Services/SIS.Api/Endpoints/Loy/LoyEndpoints.cs`, `Sartawi.Retail.Data/Modules/Loy/Services/`
(`LoyMemberService`, `LoyReportService`, `Reports/`), and the WPF views under
`Sartawi.Retail/IC/Views/` for what the original chose to show. Capture the result as a linked
markdown asset, not inline.

## Answer

Full inventory: [223 — What the four Loy reads actually return](assets/223-loy-reads-field-inventory.RESEARCH.md).
Read from source in `C:\Work\DMSCO\BackOffice` — every field taken off a C# class, a SQL string, or a
WPF view. **No backend change is needed for phase 1.**

The findings that change what gets specified:

- **Envelope: standard.** All five reads go through `EndpointHelpers.ExecuteAsync`, so
  `HttpGeneralResponse<T>` holds and `core/api.ts` unwraps unchanged. Only `DomainException` becomes
  a 400; anything else is a raw 500 with no envelope.
- **A miss is a business 400 on the member call only** — `LOY-00100`, and `LOY-00101` for an archived
  member. The three tabs answer `200` with an empty list, so they **cannot tell "no such member" from
  "no rows"**. The member read is the single gate.
- **`Loy/Member/{loyId}` refuses an archived member; `Loy/MemberByMobile/{mobile}` does not.** Same
  member, two answers, depending on which key was typed. Bears directly on
  [One field that resolves a member](225-one-field-that-resolves-a-member.md).
- **`branchId` is a currency-conversion knob and nothing else** — it restates `PointsBalanceAmount`
  in the branch plant's currency and sets `ExchangeRate`; it touches no other field and never the
  points balance. All-SAR estate ⇒ **the portal should pass nothing**, which is also what WPF does.
- **Activities is capped at 100, Sales at 500** — hard `TOP`, no total, no more-rows flag, no paging.
  The screen can honestly say "the most recent 100", never "100 of N". **Actions is the exception**:
  genuinely paged, with a real `recordsCount`.
- **`Loy/Reports/LoyMemberActions` has no required parameter.** Called without `LoyId` it returns the
  first 25 member actions *of the whole estate*. The strongest correctness constraint here.
- **Codes arrive without decoders**, except activity `Description`, action
  `MainActionDescription`/`SubActionDescription`, and action-row `CityName`. `Tier`, `Gender`,
  `Nationality`, `CityCode`, member `BlockedReason`, `ActivityStatus`, `StoreCode`, `BranchId` are
  bare codes; tier and blocked-reason have lookup endpoints, gender/nationality/city have none.
- **`BlockedReason` means the code on `LoyMemberModel` and the description on `LoyMemberActionModel`.**
  Same name, different content — one shared type would be wrong.
- **Three member fields are inert**: `Profile` (always `"W|D"`), `PointsExpireSoonDays` (always `30`),
  `RedemptionFactor` (always `22.2222222222`).
- **Dates are never null** — unset ones arrive as sentinel dates. The server's own guards are
  `EffectiveTime < 2000-01-01` ⇒ unset and `Points <= 0` ⇒ no expiry.
- **`Points.Round()`** is `decimal.Round(v, 2, AwayFromZero)` over `LoyActivity.SpendPoints`: the raw
  value carries more decimals, the client gets 2 dp, and **summing the rows will not equal
  `PointsBalance`**. Sibling decimals are not rounded.
- **What a WPF Sales user loses**: the WPF grid auto-generates columns over the whole
  `RetailTrxDetail` entity, unbounded. The endpoint's twelve fields drop every discount and promotion
  field, all tax/gross detail, receipt/line identity, insurance amounts, the flags, the navigation
  objects, and `TrxTime` — and cap at 500. Line total survives; the money breakdown below it does not.
  That loss is real for a discount dispute and belongs in the spec out loud.

**Holds for the web door too.** [Who may look a member up](224-who-may-look-a-member-up.md) landed
concurrently and found the browser must go through a gated `*Web/*` sibling. Checked:
`CallCenterWeb/Member/{loyId}` and `CallCenterWeb/MemberByMobile/{mobile}` are one-line delegations
to `LoyEndpoints.GetLoyMember` / `GetLoyMemberByMobile` — **same payload, same 45 s cache, same
`LOY-00100`/`LOY-00101` semantics, same archived divergence.** This inventory is door-independent;
whichever route the spec lands on, the fields are these.

Noticed and **not** claimed: WPF's Account view also carries an **Activity Summary** grid (year ·
month · last visit · store · net sales · redeem · visits) off a fifth read the map never named, and
an **Old Account (Mobile)** field with no endpoint at all. Both are flagged on the map for a scope
ruling, not decided here.
