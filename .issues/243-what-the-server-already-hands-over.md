---
type: wayfinder-ticket
wayfinder: research
map: 240
status: done
blocked-by: —
---

# 243 — What the server already hands over

## Question

The map assumes "the logic is already there". Verify it, precisely, so the backend wave can be
sized and the frontend wave knows what it is fetching.

For each of the four screens, document the **existing** SIS.Api contract — route, query-parameter
names and binding (`[AsParameters]`), the response model field-by-field, and the auth/permission
gate on it:

- `Services\SIS.Api\Endpoints\Pos\PosCollectionEndpoints.cs` — `PosCollection/CollectionInquiry`,
  including the `AcrId` exclusive-filter drill-down the WPF ACR screen uses.
- `Services\SIS.Api\Endpoints\Pos\AcrEndpoints.cs` — which of `Inquiry`, `Report`, `My`, `MyReport`,
  `Open`, `Total`, `Unlinked` the web needs, and what `Acr/Report` returns versus what
  `AcrFormBuilder.Build` needs as input.
- `Services\SIS.Api\Endpoints\Pos\DepositEndpoints.cs` and `CollectionAttemptEndpoints.cs`.

Then answer the three questions that decide the backend wave's size:

1. **Is the data for both documents already reachable?** The WPF receipt is built by
   `CollectionVoucherBuilder.FromInquiryRow(row)` — pure row mapping off the inquiry response, no
   second fetch. Does that hold, or does the web need a per-collection read the WPF didn't?
   Same question for the ACR: is `Acr/Report`'s payload exactly `AcrFormBuilder.Build`'s input?
2. **Where do the builders live relative to SIS.Api?** They are in `Sartawi.Retail.Data`
   (`Modules\Pos\Services\Voucher\`). Does SIS.Api already reference that assembly (the endpoints
   resolve `PosCollectionInquiryService` from Retail.Data's DI extensions, which suggests yes), or
   is there a target-framework or dependency wall in the way? This is the difference between
   "add an endpoint" and "port the builders".
3. **Is the browser allowed in?** The Loy effort found its reads shut to cookie-auth by the
   default-deny branch. Check the same for `PosCollection/*`, `Acr/*`, `Deposit*`,
   `CollectionAttempt*` — and note which permission each screen's WPF controller checks
   (`Permissions.Check("CollectionInquiry", Display)` and its siblings) and what the web equivalent
   would be for a collection supervisor and an accountant.

Deliver as a markdown asset under `.issues/assets/` and link it here.

## Answer

Full contract documentation — every route, parameter and response field for all four screens —
is in the asset: [243-server-read-spine.RESEARCH.md](assets/243-server-read-spine.RESEARCH.md).

The three sizing questions:

**1. Is the data for both documents already reachable? — Yes, both, exactly as the map assumed.**

`CollectionVoucherBuilder.FromInquiryRow(row)` is pure row-mapping off one
`PosCollection/CollectionInquiry` row: no I/O, no second fetch, and unlike `BuildPages` it needs no
staff-name resolver, because the 101 spine already resolved names and currency into the row. Its two
legacy degradations (pre-107 `NetCollected = 0` → `CountedCashNet`; pre-shift-day
`SalesDate = 0001-01-01` → `ClosedAt.Date`) are handled inside the builder and must not be
re-implemented client-side.

The ACR side is an exact type match: `Acr/Report` returns `AcrReportModel`, which is *precisely*
`AcrFormBuilder.Build`'s parameter type. No adapter, no missing field. The whole chain is
`Acr/Report` → `Build` → `Paginate(form, 22)`.

Both builders already carry the entire presentation layer as computed getters — Arabic tafqeet,
the S.R.|H. digit-box splits, `VarianceText`, the tri-state `MatchText`, `PageText`, and every
money string as invariant `F{currency decimals}`. `System.Text.Json` serializes get-only properties
by default, so returning these types ships all of it to the browser with no DTO work. **This is
strong support for the map's print-ready-model decision — it is nearly free server-side.**

**2. Where do the builders live relative to SIS.Api? — No wall. "Add an endpoint", not "port".**

`SIS.Api.csproj` already carries `<ProjectReference Include="..\..\Sartawi.Retail.Data\…" />`, both
builders are explicitly compiled members of that project, and the four endpoints already resolve
inquiry services from its DI extensions. Both builders are `static`, pure and dependency-free, so
they cross as plain calls on plain types. The one wrinkle is a known, tolerated TFM skew —
Retail.Data is **net472**, SIS.Api is **net8.0** — which `DepositEndpoints.AddServices` already
documents and dodges with an object-typed boundary; a new dependency edge should expect CS1705 and
do the same.

**3. Is the browser allowed in? — No. All four screens answer a browser 403 today.**

This is the ticket's real finding and it **enlarges the backend wave**. Issue 802 inverted
`ApiKeyEndpointFilter`'s cookie branch to default-deny (it was "cookie-session OR api-key", leaving
394 routes open to any signed-in session); the branch now opens only via `.AllowCookieSession()`,
and refuses with a deliberate bare **403, not 401**, so a missed marker breaks one screen instead of
logging the whole tab out. I grepped every call site: none of `PosCollectionEndpoints`,
`AcrEndpoints`, `DepositEndpoints` or `CollectionAttemptEndpoints` is marked.

Deposit is a harder no — it rides `CollectorEndpointFilter`, which demands `x-api-key` **plus** a
Bearer session whose channel is `Mobile`, explicitly rejecting a browser-minted token. It has no
cookie branch at all, so a marker there would do nothing; Deposit Inquiry needs a genuinely new door.

The established pattern is a sibling `*Web/*` door — `ApiKeyEndpointFilter` + a screen-grant filter
+ `AllowCookieSession()` — as `BbyInquiryWebEndpoints` / `LoyWebEndpoints` / `CallCenterWebEndpoints`
do. The grant filter is the real boundary; the `Access` probe only hides the menu, so the web needs
both. On permissions the mapping is a clean 1:1 with the WPF `ControllerID`s —
`CollectionInquiry`, `AcrInquiry`, `DepositInquiry`, `CollectionAttempts`, each
`BackOfficeScreen[<name>, '03']`, and grants under those names **already exist** in the WPF seed
(DepositInquiry's controller cites seed 021). So the supervisor/accountant question is largely
grant *assignment*, not new permission design — handed to
[244 — Four inquiry screens in our clothes](244-four-inquiry-screens-in-our-clothes.md), which
already asks for it.

**Backend wave sizing:** five `*WebEndpoints.cs` files (Collection inquiry + receipt, ACR inquiry +
report, Deposit inquiry, Collection Attempts) plus four screen gates — likely one parameterised gate
over `BackOfficeScreen[CONTROLLER,'03']`, following `OmsGrantEndpointFilterBase`. Larger than
"expose the builders" (which is two call sites inside it), but entirely boilerplate the codebase has
done five times, with **zero new SQL**.

### Three things that graduated out of this

- **Mocking is required, not optional.** The frontend wave cannot make one live call until the doors
  exist — 403 is the only answer a browser gets today. This settles part of the map's
  *"How the two waves are sequenced"* fog in the affirmative, and by necessity rather than
  preference. [245](245-the-shape-of-a-print-ready-document.md) already asks the mock question and
  now has its answer's premise.
- **One place the "no new query" claim is strained.** `CollectionInquiryOptions` has **no
  `CollectionReceiptNo`/`CollectionReceiptId` filter** — only store/collector/ACR/date/limit. The
  WPF opens the voucher from a grid row already in memory. A deep-linkable web `/receipt/:no` URL
  therefore needs either a new option field (a small but real server change) or the ruling that the
  receipt is only reachable from a loaded grid. Homed in
  [245](245-the-shape-of-a-print-ready-document.md), which explicitly asks what identifies a
  document.
- **A fidelity risk for the sign-off gate.** `FromInquiryRow` never sets
  `CashRoundingMatched`/`CashRoundingAbsorbed`, so the **مطابق** box never renders on an
  HQ-sourced receipt though it does on a POS-sourced one. The web facsimile will faithfully
  reproduce the *HQ* WPF output (same gap) but not the POS one. The user must rule on this
  deliberately at the side-by-side gate — reproduce the gap, or fix the builder (the inquiry row
  carries `SystemCash`, `CountedCash` and `CurrencyKey`, everything `CashRounding.Reconcile` needs).
  Carried into [242](242-every-mark-on-both-forms-written-down.md)'s inventory and
  [246](246-the-receipt-side-by-side-with-the-paper.md)'s prototype.

### Incidental findings

- **Deposit Inquiry has no printable document** — the WPF `DepositInquiry` folder has no
  form/printer pair. Instead it carries attachment **URLs** (the mobile backend hosts the files; the
  API never takes bytes) and an unusual response shape: `DepositInquiryResultModel` is *not* a bare
  list but `{ Rows, Balances }`, with a per-collector outstanding-balance summary alongside the grid.
- **Collection Attempts is the smallest screen** — one flat list, six filters, no document, no
  drill-down. It does not justify a wave of its own.
- **ACR Inquiry's "Detail" drill-down is not a second endpoint** — it re-calls
  `PosCollection/CollectionInquiry` with `AcrId` set.
- **`Acr/Unlinked`** exists as an advisory ops surface (mirrored receipts unlinked past SLA).
  Outside the four screens; noted for a possible future collection-health screen, not proposed.
- **Export parity input:** `AcrFormExcelWriter` binds the *same* `AcrForm`/`AcrFormPage` presentation
  strings the WPF control does, so a server-side XLSX writer would already have its input in hand.
- **Serialization caveat for the contract:** every `AcrFormPage` shares one `AcrForm` instance, so
  naively returning `List<AcrFormPage>` repeats the full header *and all rows* once per page.
  Hoist the form or `[JsonIgnore]` it — a decision for
  [245](245-the-shape-of-a-print-ready-document.md).
