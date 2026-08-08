# HITL — ticket 255 (ACRs and Collection Attempts on the same template)

Decisions taken unattended, and the findings the ticket asked to be *recorded rather than
absorbed*.

## Q: The ACR grid row carries no currency at all — what do its money columns do?

**Decision taken:** `netCollectedTotal` and `cardTotalSum` render through `@/core/money.ts`'s
`formatMoneyIn(value, undefined)` — grouped, blank rather than `0.00`, but at the **default two
decimals** and with **no currency code in the header**. The header code and the row's-own-decimals
rule that 254 settled cannot be honoured here, because `AcrInquiryModel`
(`Sartawi.Retail.Data/Modules/Pos/Services/Models/Acr/AcrModel.cs`) has **no `CurrencyKey`
property** — unlike `CollectionInquiryModel`, which does.

**Why:** the client cannot format what is not on the wire, and inventing `'SAR'` at the column
would be the client deciding a fact about the money. A blank header is honest; a wrong one is not.

**Revisit if:** this is a **SERVER change, logged not taken** — see the server-dependency section
below. An ACR whose linked collections are all Bahraini is summed in BHD and renders here at 2 dp,
which is a misstated amount rather than an untidy one. It is the ticket's *"structural departure
worth recording"* clause firing.

## Q: The ACR No# filter has no server parameter — invent one, or drop the filter?

**Decision taken:** the toolbar carries **ACR No#** as the ticket and 244 §5 specify, and
`buildAcrsParams` puts it on the wire as **`AcrNumber`**, dropped when empty. Logged as a server
dependency below.

**Why:** `AcrInquiryOptions` has `AcrId` (the ULID, an exact-row filter the 257 drill-down rides)
and no `AcrNumber` at all — the WPF's own filter strip is From · To · Collector · Status · Limit,
with no ACR No# box. The web adds one because the number is what a supervisor holds in their hand
and the ULID is not. `CollectionWeb/Acrs` does not exist yet (BackOffice 1090), so this is the
moment the contract is stated rather than a change to a shipped door. Sending it as `AcrId` would
be worse than useless: the server would compare a ULID column against `"41"` and return nothing,
silently.

**Revisit if:** 1090 declines the parameter. Then the honest fallback is to delete the box rather
than to filter client-side — a filter that quietly narrows only the 2,000 rows that came back is
the same silent truncation this wave exists to end.

## Q: Test-file names — the Proof says `columns.test.ts` extended.

**Decision taken:** two new screen-prefixed suites, `acr-columns.test.ts` and
`attempts-columns.test.ts`, plus `acr-criteria.test.ts` and `attempts-criteria.test.ts`.

**Why:** 254's Proof note is explicit — *"`features/collection/` is ONE feature holding four
screens, so `criteria.test.ts` / `columns.test.ts` would collide… **255 and 256 follow the same
prefix**."* The Proof line in 255 is the older wording.

**Revisit if:** never — the collision is real.

## Q: `depositNumber = 0` on an unbanked ACR — render `0` or blank?

**Decision taken:** blank.

**Why:** the server's own comment on `AcrInquiryModel.DepositId` reads *"Empty/0 means 'not yet
banked'"*. `0` in a column headed **Deposit No#** reads as *the deposit whose number is zero*, the
same misreading 254 blanked `0001-01-01` out of `salesDate` to avoid. `linkedCollectionCount` is
**not** treated this way — an idle ACR really has zero collections, and that is a fact, not an
absence.

**Revisit if:** a real deposit is ever numbered 0.

## Q: The `Limit` constant now has three call sites.

**Decision taken:** `GRID_LIMIT = 2000` moves into `cap.ts` (which already owns `GRID_PAGE_SIZE`
and `isCapReached` for all four screens); the two new screens import it directly, and 254's
`COLLECTIONS_LIMIT` is re-pointed at it as a one-line alias. No behaviour changed;
`collections-criteria.test.ts` is untouched and still green.

**Why:** the cap and the banner that reads it must be the same number or the banner lies. Three
independent `2000` literals is exactly how they stop being. `COLLECTIONS_LIMIT` survives as an
alias only because it is 254's shipped exported name and its suite asserts on it; the two new
screens deliberately do **not** mint `ACRS_LIMIT`/`ATTEMPTS_LIMIT` twins, which would be two more
names to keep in sync for the value the comment says must never diverge (a /standards-review
finding, applied).

**Revisit if:** a screen ever needs its own cap — then the alias becomes a real constant again.

## Q: The WPF heads the ACR's Σ NetCollected column `Cash (Deposit)`.

**Decision taken:** headed **Net Collected** instead. Every other header on both grids is the XAML
caption verbatim; this one is not.

**Why:** `CONTEXT.md` reserves *deposit* for **the bank end, several ACRs later**, and explicitly
lists it under _Avoid_ for a collection. This column is Σ `NetCollected` — cash that left the store
— and 254 already named the identical quantity `Net Collected`. Worse, the same grid carries three
real deposit columns (`Deposit No#`, `Deposit Status`, `Deposit Id`), so the WPF's caption would
name the banking end twice, meaning two different things. (A /standards-review finding, applied.)

**Revisit if:** finance reads the grid and asks for the WPF wording back — then it is a glossary
change, argued in `CONTEXT.md`, not a header change.

## Q: `dayText`, `ListShimmer`, `EmptyState` and the two pill toggles were about to be triplicated.

**Decision taken:** `dayText` graduates to `@/core/util/date-format` as **`formatDay`** (all three
columns modules use it); `ListShimmer`, `EmptyState` and a new `ToggleChip` live in the feature's
own `GridStates.tsx` and all three Pages compose them.

**Why:** 244 §1's "copied, not extracted" ruling is about the screen's **shape** — the
gate/toolbar/draft/grid skeleton — which stays literally duplicated so a fourth screen's departure
costs nothing. A date helper and three presentational components are not a shape; three
byte-identical copies of each would drift in spacing and wording rather than in structure. (Two
/standards-review findings, applied.)

**Revisit if:** a screen needs a different shimmer or a differently-shaped chip — then it declares
its own, which is what composition is for.

## Q: ACR — 14 WPF columns, but the ticket says 15.

**Decision taken:** 15 columns, and the discrepancy is not one. `AcrInquiryView.xaml` declares
**14** (`AcrNumber` … `DepositStatus`); the wire row carries **16** properties. `acrId` is the
document's ULID and is the single argued `NON_COLUMN_FIELDS` entry (257's key, exactly as
`collectionReceiptId` is on 254). `depositId` — a ULID the WPF grid never showed — folds into the
forensic tail rather than being dropped, because "nothing is dropped" is a statement about the
**row**, not about the WPF's column picker (254's own ruling, which put five unshown wire fields
into its tail for the same reason). 14 + 1 = the 15 the ticket names.

**Revisit if:** 258's export ever wants `acrId` in the file — it is in `NON_COLUMN_FIELDS`, named,
not lost.

## SERVER DEPENDENCY — logged for BackOffice 1090, not taken here

Both are in `C:\Work\DMSCO\BackOffice`, which this session may read but must not edit.

1. **`CollectionWeb/Acrs` needs an `AcrNumber` filter.** `AcrInquiryOptions` has `AcrId`,
   `CollectorOperatorId`, `Status`, `FromDate`, `ToDate`, `Limit`. The web's ACR No# box sends
   `AcrNumber`; without it the parameter is ignored and the box silently does nothing.
2. **`AcrInquiryModel` needs a `CurrencyKey`.** `CollectionInquiryModel` has one (`Plants.CurrencyKey`
   by store code); the ACR aggregate does not, so the web cannot draw a BHD ACR's totals to three
   decimals. An ACR sums receipts across stores, so the honest server answer may be a *set* of
   currencies rather than one — which is itself a question worth a human, since a single ACR
   spanning two currencies would make `NetCollectedTotal` a meaningless sum.

## Findings raised by /code-review that are NOT in this slice

Both were raised against code that landed on earlier tickets of this wave and are left untouched
here, per the stage-narrowly rule. Flagged so a human triages them rather than losing them.

1. **The two print routes are grant-free and serve fabricated fixtures at a production URL**
   (`ReceiptPrintPage.tsx`, `AcrPrintPage.tsx`; routes at `router.tsx:83,95`). They sit behind
   `ProtectedLayout chromeless`, which only proves a session exists — there is no
   `CollectionInquiry`/`AcrInquiry` check — and they resolve `:id` against checked-in sample data.
   So any logged-in user can print a full-fidelity سند قبض that is indistinguishable from a real
   voucher. Tickets 251/252's, and 259's when the real door lands.
2. **`core/money.ts:54` collapses a legitimate 0-decimal currency to 2** —
   `(code && CURRENCY_DECIMALS[code]) || DEFAULT_DECIMALS` should be `??`. Latent today (BHD is the
   only entry), but the module invites one-line table additions. Ticket 250's.

## OUTSTANDING PROOF

None for this ticket. Both pure suites and the extended `tools/collection-drive.mjs` ran green
against a Playwright-stubbed envelope. ⚠️ **Nothing here has been driven against a live SIS.Api** —
`CollectionWeb/Acrs` and `CollectionWeb/Attempts` do not exist yet, and ticket 259 is the
wave-joining event. That is 254's posture unchanged, not a new gap.
