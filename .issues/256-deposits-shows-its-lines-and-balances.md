---
status: done
spec: 249
blocked-by: 254
---

# 256 — Deposits shows its lines and balances in place

## What to build

The one screen in the suite that **isn't a flat list**, which is why it is its own ticket rather than
folded into [255](255-acrs-and-attempts-list-on-the-same-template.md).

`/collection/deposits` keeps the template's skeleton — criteria draft, today-defaulted landing, client
paging at 50, cap banner, More-columns toggle, floating filter row — and adds two regions beneath the
grid.

**Filters:** From · To · Deposit No# · Collector · **Bank** · **Status** (segmented All / POSTED /
VOID, from the WPF's radio group).

**The response is not a bare list.** `DepositInquiryResultModel` is `{ rows, balances }` — the grid
rows each carrying their own `lines` and `attachments`, plus a per-collector outstanding-balance
summary alongside. ⚠ **Everything arrives in the one response, so no region costs a fetch.** Do not
add a second call for the detail.

**Rendered stacked, as the WPF has it:**

1. The deposit grid.
2. Below it, a **detail region following the selected row** — its claimed-ACR lines with **drift
   flagged**, and its slips as links.
3. Below that, the **per-collector balance** table in a collapsible panel labelled *POSTED only*.

⚠ **A detail modal was considered and rejected.** A deposit whose banked total no longer matches its
claimed ACRs is precisely what the accountant opens this screen to find — drift should be visible **in
place**, not behind a click that has to be taken on faith.

**Slips are ordinary links opening in a new tab** — that is all `Open Slip(s)` ever did. The mobile
backend hosts the files; the API never takes bytes. No document renderer is involved: ⚠ **Deposit
Inquiry has no printable document** — the WPF `DepositInquiry` folder has no form/printer pair.

Money throughout via `@/core/money.ts`, on the same terms as 254.

## Spine reach

api (mocked) · logic (criteria, selection, drift) · component · route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `deposit-criteria.test.ts` — Bank and Deposit No# dropped when empty; the segmented Status maps
      to `""` / `POSTED` / `VOID` with **All sending nothing**; the date pair holds · pure
      *(24 tests)*
- [x] `deposit-drift.test.ts` — a claimed-ACR line whose figure no longer matches the banked total is
      **flagged**, and one that matches is not. This is the screen's whole reason to exist, so it is
      asserted on the data rather than left to the eye · pure *(7 tests, including the one that pins
      the ruling: the flag reads the server's own `hasDrift` and never subtracts the two amounts —
      `1234.30 - 1234.10` is `0.19999999999995` in doubles, which would flag a deposit that balances
      to the halala)*
- [x] `tools/collection-drive.mjs` extended — selecting a row moves the detail region to it **with no
      second network call** (assert the request count); the balances panel collapses and reopens and
      is labelled *POSTED only*; a slip link carries `target=_blank`; a drifted line renders its flag ·
      flow (Playwright) *(153/153 green; the deposits section adds 41 checks)*
- [x] `deposit-columns.test.ts` — added beyond the named Proof, matching 254/255: the forensic tail
      **hides nothing**, and the three withheld fields (`depositId` plus the two lists) are argued
      rather than skipped · pure *(22 tests)*

## Boundaries

- **New API dependency:** `CollectionWeb/Deposits`, returning `{ rows, balances }` — **mocked here.**
  ⚠ Backend-side this is the **hardest door of the four**: it rides `CollectorEndpointFilter`, which
  demands an api-key *plus* a `Mobile`-channel Bearer session and explicitly rejects a browser-minted
  token, so it has **no cookie branch to mark** and needs a genuinely new door. Owned by
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md).
- i18n keys into the existing `collection` namespace.
- No row action opening a document — there is no deposit document.

## Done when

`/collection/deposits` opens on today; selecting a deposit shows its claimed-ACR lines and slips in
place with drift flagged and **no extra fetch**; the per-collector balances collapse under a *POSTED
only* label; the pure tests and the drive are green.

## Blocked by

[254](254-cash-collections-opens-on-today.md) — the template skeleton this screen extends.

## As built

`deposit-criteria.ts` · `deposit-drift.ts` · `deposit-columns.ts` · `DepositsToolbar.tsx` ·
`DepositDetail.tsx` · `CollectorBalances.tsx` · `DepositsPage.tsx`, all screen-prefixed as 254/255
established. The five wire models (`DepositInquiryRow`/`Line`, `DepositAttachment`,
`DepositCollectorBalance`, `DepositInquiryResult`) are `DepositModel.cs` verbatim, camel-cased, with
nothing added and nothing renamed.

**The selection is real, not implied.** The grid genuinely selects its first row on arrival
(`onRowDataUpdated`) and the region follows the grid's own selection. Defaulting the region to
`rows[0]` *without* selecting it was the first shape and was wrong: the grid highlights nothing while
the panel names a deposit, and one sort desyncs the two. A CTRL-click deselect is honoured rather
than swallowed — the region then says "select a deposit", which is true.

🚩 **`drift`/`hasDrift` are read, never re-derived.** They are get-only C# properties computed in
`decimal`, so both are on the wire. Subtracting the two amounts client-side would run in IEEE-754
doubles and manufacture the very drift this screen exists to surface.

🚩 **Two recorded departures, both SERVER gaps for BackOffice 1090** (see `.afk/HITL-256.md`):
`DepositInquiryRowModel` has **no `CurrencyKey`**, so deposit money draws at 2 dp with no header code
— the same position 255 recorded for the ACR row, and a BHD deposit would be misstated; and
**`DepositNumber` is not on `DepositInquiryOptions`** — the box ships sending it, deliberately not as
`DepositId` (a ULID compared against `"5501"` returns nothing, silently) and deliberately not filtered
client-side. If 1090 declines it, **delete the box**, don't fake it.

⚠️ **`diffAmount` and `outstanding` carry opposite signs and both are the server's own**:
`DiffAmount` is `Real − Calculated` (a negative figure is a shortfall), `Outstanding` is
Σ(`Calculated − Real`). Documented on the model, because reading one as the other flips a shortfall
into an overage.

**Bank is a free-text code box, not a picker** — the `CollectionWeb` door spec 249 settles has seven
routes and a bank lookup is not one of them; adding an eighth to label a filter would be this slice
inventing backend scope. The grid still shows the resolved `bankName`.

Small graduation: the amber cap banner moved into `GridStates.tsx` as `CapBanner` on acquiring its
**fourth** caller — the escalation path that module's own header describes, and not the screen
*shape* 244 §1 rules must stay duplicated. Each Page still owns its sentence and its condition.

🚩 Envelopes stubbed at Playwright, **never driven against a live SIS.Api** — Deposit is the hardest
of the four doors (`CollectorEndpointFilter` has no cookie branch at all, so it needs a genuinely new
one), and [259](259-the-screens-call-the-real-door.md) is that event.
