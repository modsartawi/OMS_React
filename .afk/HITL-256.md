# HITL — ticket 256 (Deposits shows its lines and balances in place)

Decisions taken unattended, and the server changes this slice states rather than works around.

## Q: `DepositInquiryOptions` has no `DepositNumber` filter — what does the Deposit No# box send?

**Decision taken:** it travels as `DepositNumber`, a param the current
`DepositInquiryOptions` does not carry. `CollectionWeb/Deposits` does not exist yet (BackOffice
1090), so this states the contract the new door must bind rather than changing a shipped one.

**Why:** exactly 255's ruling for `AcrNumber`. The number is what an accountant holds in their
hand; `DepositId` is a ULID. Sending the typed number as `DepositId` would compare a ULID column
against `"5501"` and hand back nothing, silently — worse than not filtering. Filtering client-side
would narrow only the rows that already came back, which is the silent truncation this wave was
chartered to end.

**Revisit if:** BackOffice 1090 declines to add `DepositNumber` to the inquiry options. Then the
box has to go, not degrade — a filter that does nothing is worse than an absent one.

## SERVER CHANGE NEEDED: `DepositInquiryRowModel` carries no `CurrencyKey`

**Decision taken:** the three money columns (`Calculated`, `Banked`, `Difference`), the detail
region's line figures and the balances table all render at the default two decimals with **no
currency code in any header**.

**Why:** 244 §7 asks for "the row's own currency's decimals" and there is no currency on the wire
to read. `CollectionInquiryModel` has one; the deposit aggregate does not. A bare label beats an
invented one, and the client may not state a currency it was not told. Same position 255 recorded
for `AcrInquiryModel`.

**Revisit if:** Bahrain deposits ever reach this grid. BHD is the estate's only 3-decimal currency
and every figure on this screen would be wrong by a factor of ten, invisibly. Adding `CurrencyKey`
to `DepositInquiryRowModel` (and to `DepositCollectorBalanceModel`) is the fix, and it is a server
change.

## Q: Bank — picker or free-text code box?

**Decision taken:** a free-text `Bank code` box, like Store and Collector on the sibling screens.

**Why:** `Deposit/Banks` exists on the mobile door, but the `CollectionWeb` door spec 249 settles
has exactly seven routes and a bank picker is not one of them. Adding an eighth to label a filter
would be this slice inventing backend scope at 3am. The grid still shows the resolved `bankName`,
so the code is only what you type, never what you read.

**Revisit if:** 1090 ships a `CollectionWeb/Banks` lookup, or accountants report typing the wrong
code. A `<datalist>` off the result's own distinct banks was considered and rejected: it would
only ever offer banks already on screen, which is the filter you do not need.

## Q: what does the detail region show before anything is selected?

**Decision taken:** the grid **really selects** its first row on arrival (`onRowDataUpdated`), and
the region follows the grid's actual selection. The "select a deposit" sentence is what remains for
the two cases that reach it: an empty result, and a CTRL-click that deselects.

**Why:** the region exists because "drift should be visible in place, not behind a click that has
to be taken on faith" (ticket 256, 244 §9). An empty panel on arrival reintroduces exactly the
click the modal was rejected for. ⚠️ Defaulting the region to `rows[0]` *without* selecting that row
was the first shape and was wrong: the grid would highlight nothing while the panel named a
deposit, and sorting would desync the two. Selection is held as the row's **ULID**, not as the row
object, so a refetch cannot leave the region following a stale object.

**Revisit if:** the first row's detail is mistaken for a summary of the whole result. The region
names its deposit (`Deposit 5500 · Collector 4470`) specifically to prevent that.

## Q: is the balances panel open or collapsed on arrival?

**Decision taken:** **open**.

**Why:** it arrives in the same response as the grid — that is what the `{ rows, balances }` shape
is for — so it costs nothing to show, and a supervisor who has to discover it is a supervisor who
reconciles without it. The collapse is there to reclaim height on a long result, the same bargain
the filter-row toggle strikes.

**Revisit if:** the three stacked regions push the grid off screen on a laptop. Collapsing this
one by default is the cheapest lever.

## Note: `drift` / `hasDrift` are read, never re-derived

`DepositInquiryLineModel.Drift` and `.HasDrift` are get-only C# properties, so the serializer emits
them and both are on the wire, computed in `decimal`. `deposit-drift.ts` reads them and never
subtracts the two amounts beside them: in IEEE-754 doubles `1234.30 - 1234.10` is
`0.19999999999995`, so re-deriving would flag a deposit that balances to the halala — manufacturing
the very drift the screen exists to surface. Pinned by `deposit-drift.test.ts`.

## Note: no row action, and none is coming

Deposit Inquiry has **no printable document** — the WPF `DepositInquiry` folder has no
form/printer pair — so ticket 257's `Receipt ▸` / `Form ▸` work lands on Cash Collections and ACRs
and not here. `depositId` is therefore withheld from the grid as identity only, unlike the
receipt's and the ACR's ULIDs which key a document.

## Note: `diffAmount` and `outstanding` carry OPPOSITE signs, and both are the server's

`PosDeposit.DiffAmount` is **`RealAmount − CalculatedAmount`** (the column's own SQL comment,
`Sql/063_create_pos_deposit.sql:52`), so a negative figure in the `Difference` column is a
shortfall. `DepositCollectorBalanceModel.Outstanding` is Σ(**Calculated − Real**) — the other way
round. Neither is wrong and nothing here derives either; both render as they arrive. Documented on
the model because reading one as the other silently flips a shortfall into an overage.

## Findings from earlier slices, seen during 256's review and NOT fixed here

Raised by the built-in `/code-review` over the whole wave's diff. Both are outside this ticket's
files and are left for their owners to triage:

- **251/252** — `ReceiptPrintPage` / `AcrPrintPage` render the checked-in fixtures on real routes
  with **no `ScreenGate`**, so any authenticated session (holding zero collection grants) can print
  a fabricated al-dawaa RECEIPT VOUCHER at e.g. `/collection/receipt/posted`. Fixtures-on-a-real-
  route is the wave's agreed posture until the door lands (259), but the missing gate is a
  separate question and worth a look before the paper proof (260).
- **250** — `src/core/money.ts:54`'s `(code && CURRENCY_DECIMALS[code]) || DEFAULT_DECIMALS`
  collapses a legitimate `0` to `2`. Latent today (no 0-decimal currency is in the table), but the
  module has just graduated to `core/` as the shared multi-currency formatter and its own doc
  invites the one-line addition that would trip it.

## Outstanding, not this ticket's

- **The door itself.** `CollectionWeb/Deposits` does not exist; ticket 259 is the wave-joining
  event. Everything here is proven against envelopes stubbed at Playwright. Nothing in this slice
  has been driven against a live SIS.Api. Deposit is the hardest of the four doors: it rides
  `CollectorEndpointFilter`, which demands an api-key *plus* a `Mobile`-channel Bearer session and
  explicitly rejects a browser-minted token, so it has no cookie branch to mark.
