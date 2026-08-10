---
type: spec
status: ready
---

# 261 — An invoice receipt downloads from the web — spec

> **Backend is built and live.** This spec covers the **frontend only**. The server half is
> BackOffice spec
> [1042](file:///C:/Work/DMSCO/BackOffice/.issues/1042-headless-retail-invoice-render-rail-spec.md)
> (map 984), whose §"Out of Scope" hands this repo the form and *"nothing more"* (decision D13).
>
> **The wire contract is settled and is not this spec's to invent**:
> [`988-search-download-contract.md`](file:///C:/Work/DMSCO/BackOffice/.issues/assets/988-search-download-contract.md).
> Read it before the tickets. §2's TypeScript is pasted **verbatim** so the row shape cannot drift
> between the two repos.

## Problem Statement

A back-office user who has a customer on the phone, or a finance query on a receipt, can get the
invoice PDF **only from a till** — the Stimulsoft report engine is Windows-only, net472, and
references `Stimulsoft.*.Win`, so SIS.Api (net8.0, IIS) cannot render one in-process. BackOffice map
984 solved that server-side: a resident `BackOffice.exe renderhost` on the loopback renders on
demand, and SIS.Api exposes three cookie-authenticated routes over it.

**Those routes have no caller.** There is no screen. That is the whole of this effort.

Two constraints make it more than a form and a link:

1. **A plain `<a href>` or `window.open` cannot download this file.** The cookie branch of SIS.Api's
   `ApiKeyEndpointFilter` requires the `X-Web-Client` CSRF header on *every* cookie-authenticated
   request, and a browser navigation cannot send one — the answer is a 401. The PDF must be fetched
   and turned into a Blob.
2. **`core/api.ts` cannot fetch a non-JSON body.** Its single `request<T>` always calls
   `res.json()` and unwraps the `HttpGeneralResponse` envelope; a raw `application/pdf` body falls
   through to `throw new ApiError('unknown', …)`. The download needs a new door in `core/`, and
   `api-envelope` forbids hand-rolling a `fetch` beside it.

## Solution

One feature, one screen, in a **new `reports` area**:

```
src/features/reports/retail-invoice/     →  /reports/invoice
```

`reports` is a new top-level area because it is a new nav group and a new URL prefix — the two
conditions `feature-structure` names, and the example that rule itself gives
(*"e.g. a future `features/reports/` behind `/reports/*`"*). It is deliberately not `oms/`: an
invoice receipt is a store/finance artefact, not an OMS delivery document. It is deliberately not
`pricing/`: nothing here prices anything. **The area is also the point** — the render rail was
designed reusable (1042 D1) and the ~160 BackOffice report screens are its likely tenants, so the
folder that will hold the second report is worth creating with the first.

The screen is the estate's plainest possible inquiry: **one required field**, a candidate list, and
a download per row.

```
┌─ Invoices ────────────────────────────────────────────────────┐
│  Transaction number *  [ 00114600051234 ]   Store [      ]    │
│                                             [ Search ]        │
├───────────────────────────────────────────────────────────────┤
│ Store  Name       Till  Trx number       Date/Time   Type   … │
│ P001   …الدواء     01   00114600051234   04/08 14:22  Sales  ⤓│
└───────────────────────────────────────────────────────────────┘
```

Three server calls, no more: `RetailInvoice/Access` (nav visibility), `RetailInvoice/Search`
(candidates), `RetailInvoice/Download` (the PDF).

## User Stories

### Getting in

1. A user **whose session holds the grant** sees a **Reports** group in the menu with **Invoices**
   in it. A user without it sees no Reports group at all.
2. `RetailInvoice/Access` answers `{ screenAllowed }` on the cookie alone and returns **200 even
   when it denies** — so a denial is a boolean to read, not an error to catch.
3. ⚠ **The probe only hides the menu.** `Search` and `Download` re-check the grant server-side and
   refuse with a **bare 403 and no body at all** — no envelope, no `errorCode`. A user who pastes
   `/reports/invoice` reaches the screen and every call fails; the screen must say so in words, not
   show an empty grid.

### Finding an invoice

4. **Transaction number is the only required input.** The user types it and presses Search (or
   Enter). Store is an optional narrowing box.
5. A number that matches nothing is **an empty result, not an error** — 200 with `rows: []`. The
   grid says "no invoice carries that number", which is a different sentence from "something went
   wrong".
6. A single match is still **a one-row list**, never an automatic download. The client parses
   exactly one success shape (contract D14, re-confirmed at 988).
7. An empty Search box is refused **before the call**: the server answers
   `400 TRX_NUMBER_REQUIRED`, and reaching that state is a client bug. The field validates locally.
8. **Every candidate shows its `trxType` and `trxStatus`.** These are the only thing on the row that
   tells an operator a candidate is not a customer receipt — see story 11.

### Getting the PDF

9. The user clicks the download action on a row. The PDF arrives as a file named by the server's
   `Content-Disposition`, and the page does not navigate.
10. While it renders — **expect 1.5–3 s warm, more after a host recycle** — the row's action shows a
    pending state. The request times out at 30 s server-side.
11. ⚠ **The search returns rows that cannot be rendered, and this is an owner ruling, not a gap
    (988).** `RetailTrx` also holds **cash clearances** (`trxTypeCode: 700`), **training** receipts
    and **suspended** (parked) sales, and they come back unfiltered and unflagged. Downloading one
    is a `422 RENDER_FAILED`. So: anything that is not `Sales` or `Return` gets a **confirm step**
    before the call — the contract's own suggested client behaviour, and the only place a client
    may act on this at all. **Do not filter the list** and do not derive a `renderable` flag.
12. A failure says what a person can do about it, per the contract's error table. **503 and 504 are
    different sentences** and must not be collapsed: 503 is "the receipt service is unavailable, try
    again shortly" **with a retry button** (a host is recycling and a second later works); 504 is
    "the receipt took too long", retry once, and a recurrence is an incident. By the time a 503
    reaches the browser, SIS.Api has already retried twice (250 ms, 1 s).
13. `attemptId` — present on **422 and 504**, absent on 400/401/403/404/503 — is shown in the error
    detail and is copyable. It is the row id in the HQ `ReportRenderAttempt` log and the thing to
    quote in a support conversation. **There is no separate audit; that table is it.**

## Implementation Decisions

### Where the code lives

| Thing | Path |
|---|---|
| Feature | `src/features/reports/retail-invoice/` |
| Route | `/reports/invoice` (lazy-imported in `app/router.tsx`) |
| Menu group | **Reports**, in `layout/menu-model.ts`, `accessProbe` = this feature's own access call |
| i18n namespace | `reports` → `src/locales/en/reports.json`, registered in `src/core/i18n.ts` |
| Wire models | `src/core/models/…` — they are wire types, and `api-envelope` puts those in `core/` |

Namespace is `reports` (== the area's first feature cluster) rather than `retail-invoice`: the
second report screen joins this namespace instead of minting another. Registration is central and
**one-time** — an unregistered namespace renders raw keys to users and no gate catches it.

### The prefactor: `core/api.ts` learns two things

Ticket [262](262-the-api-client-learns-to-fetch-a-file.md), landing **before** anything consumes it.

1. **A binary door.** `api.blob(path, params)` — same `BASE`, same `credentials`, same
   `X-Web-Client` header, same `handle401` redirect, but on `res.ok` it returns
   `{ blob, filename }` from `res.blob()` + the parsed `Content-Disposition`, and on failure it
   parses the JSON envelope exactly as `request` does and throws the same `ApiError`. **Success and
   failure read different body types off the same response** — that branch is the whole ticket.
2. **`attemptId` on the envelope.** It is a **top-level sibling** of `message`/`errors`, not an
   entry inside `errors[]`. `HttpGeneralResponse` grows an optional `attemptId`, `ApiError` carries
   it, and `apiErrorAttemptId(err)` reads it. Adding it to the shared envelope is correct rather
   than local: it is SIS.Api's field, not this screen's.

⚠ `credentials` stays **`'same-origin'`**, not the contract's `'include'`. The contract was written
without the proxy in the room: vite proxies `/api` → SIS.Api on `:5111`, so every call already *is*
same-origin, and `include` would be a change to every existing caller for no gain.

### The second prefactor: `downloadCsv` graduates to `core`

Same ticket. `URL.createObjectURL` + parked-anchor + deferred-revoke is **already duplicated** in
`features/admin/ua-admin/export.ts` and `features/collection/inquiry/export.ts`, and collection's
copy carries the instruction in its own docblock: *"It graduates to `@/core` … when a **third
consumer** lands, not before."* This screen is the third consumer, so the graduation is
pre-authorized, not a judgement call.

It moves up as `@/core/util/download-file.ts` — `saveBlob(fileName, blob)` plus the CSV-flavoured
`downloadCsv(fileName, contents)` on top of it — and **both existing call sites are repointed in the
same commit**. Following `money.ts` at 250 and `pager.ts` at 232: a pure move, its existing tests
move unedited, and it lands before anything new consumes it rather than being tangled into the
screen's diff.

### The screen's shape

**Templated on `features/pricing/bonus-buy-inquiry`**, like collection's four were — access gate →
toolbar producing a criteria draft that only Search promotes to a query → AG Grid → row action.

⚠ **Copied, not extracted.** No shared inquiry shell in `core/`. Collection's ruling (244 §1) stands
and this screen does not overturn it: one more copy is cheaper than an abstraction designed across
two areas.

Three deliberate departures from the collection template, each because this screen is *not* an
HQ-wide list:

- **It lands empty, not on today.** There is no date filter and no default query — the screen cannot
  guess a transaction number, so an auto-fired search on mount would be a guaranteed empty grid.
  Focus goes to the number field.
- **No client-side paging, no export.** An exact-number search returns essentially one row (see
  below). AG Grid Community's pagination and a CSV writer would both be machinery for a result set
  that does not exist.
- **No floating filter row.** Same reason: nothing to filter within one row.

### Volume — why there is no paging

`POSHelpers.GetInvNo()` builds a transaction number as `StoreCode.Right(3)` +
`MachineCode.Right(1)` + OADate day (5 digits) + time-of-day fraction (5 digits) — 14 characters,
granular to ~0.86 s. A full number is **near-unique by construction**: a genuine collision needs two
stores sharing their last three characters, two tills sharing their last digit, *and* the same
sub-second slot. Expect one row essentially always.

The candidate list exists so the rare case is **visible** rather than guessed at, not because it is a
busy path. The server's **50-row cap is a tripwire, not a page size** (contract §6.4) — this rail has
no paging and adding it would be a new decision, not a parameter. `capReached: true` on an
exact-match search means **the data is wrong**, so it draws a plain warning line, not a pager.

⚠ The warning is a **local** one-line `t()` string. Collection's `CapBanner` lives in
`features/collection/inquiry/GridStates.tsx` and **a feature may not import a feature**; graduating
it to `core` for one sentence on a path that should never fire would be motion, not reuse.

### Columns

Identity first, then the two that answer "is this a real receipt", then the money:

`storeCode` · `storeName` · `machineCode` · `trxNumber` · `receiptNumber` · `trxDate` · `trxTime` ·
`trxType` · `trxStatus` · `documentType` · `amount` · `itemLinesCount` · `customerId` ·
`customerName` · the download action.

- 🚩 **`storeCode` is the store's identity, not `storeName`** — and that is now measured, not
  assumed. Contract §6.3 flagged "nobody has checked `Store.Description` is the name humans use for
  a branch"; it has now been checked against the live sandbox: it reads
  **`صيدلية الدواء <storecode>`** — the company name with the store number appended, 1508 distinct
  values over 1540 stores. It carries **no branch identity a code column does not already give**.
  So it stays on the row (it is on the wire, and hiding a server field to make a point is worse),
  but it is a secondary column and never the thing a user reads to know which shop this was.
  **No server change** — see Out of Scope.
- **`trxType` / `trxStatus` are visible columns, not tooltips.** Story 11 depends on the user
  seeing them.
- **The enum names are C# identifiers, not labels** (`"CashClearance"`, not "Cash clearance").
  Prettify client-side through `t()`, and ⚠ **do not assume the list is closed** —
  `RetailDocumentType` has 18+ members and grows, and the server sends the **number** as the name
  when no member carries the code. An unknown code must render as itself, never as a blank.
- **`amount` formats through `@/core/money`** (which graduated at ticket 250 and already knows BHD
  is 3dp). `itemLinesCount` is a count, not money.
- **`trxDate` and `trxTime` are two raw fields** (`yyyy-MM-dd` + `HH:mm:ss`, contract §6.1) — the
  server does not format, by estate convention. They are joined for display through
  `@/core/util/date-format`. ⚠ They stay two fields on the wire; do not build a Date from them (see
  Testing Decisions).

### The download call

```ts
const { blob, filename } = await api.blob('RetailInvoice/Download', {
  storeCode, machineCode, trxNumber,
})
saveBlob(filename ?? `Invoice-${storeCode}-${machineCode}-${trxNumber}.pdf`, blob)
```

- **The key is built from the clicked row, never from user input** — three parts, always all three.
  A missing part is `400 INVALID_KEY`, which means the row was malformed, i.e. a client bug.
- ⚠ **`Client` is not on the wire.** `RetailTrx`'s primary key is four parts —
  `Client` + `StoreCode` + `MachineCode` + `TrxNumber` — but `Client` is a fixed `'000'` estate-wide
  and slated for removal (owner ruling, 988). **Do not add a fourth part.**
- **The filename comes from `Content-Disposition`**, with the contract's shape as the fallback only.
  It carries **no date** (§6.5); if the folder wants chronological sort the row already knows the
  date and can rename client-side — but that is not in this spec.
- **Identity is never sent.** SIS.Api reads the user from the session row and passes it to the
  renderer as `requestedBy` for the journal. `staffid`/`storecode` headers are ignored on the cookie
  path — do not send them.

### The error table, verbatim from the contract §4

| Status | `errorCode` | The screen says |
|---|---|---|
| 400 | `TRX_NUMBER_REQUIRED` | "Enter a transaction number." (unreachable — validate locally) |
| 400 | `INVALID_KEY` | A bug. The row was malformed. |
| 401 | — | Re-login (handled centrally by `handle401`). |
| 403 | `ACCESS_DENIED` | "You don't have access to invoices." ⚠ **bare 403, no body** |
| 404 | `INVOICE_NOT_FOUND` | "That invoice no longer exists." |
| 422 | `RENDER_FAILED` | "This document can't be produced as a receipt." **Retrying will not help** — no retry button. |
| 503 | `RENDERER_UNAVAILABLE` | "The receipt service is unavailable. Try again shortly." **With a retry button.** |
| 504 | `RENDER_TIMEOUT` | "The receipt took too long." Retry once; a recurrence is an incident. |
| 500 | `SERVER_ERROR` | Generic failure. |

⚠ **403 is the one that will be got wrong.** It is a bare refusal with **no envelope at all**, so
`apiErrorCode(err)` is `null` and the message is the generic fallback. The screen must branch on
`err.status === 403`, not on the code.

## Testing Decisions

The repo's four tiers (spec 249's, unchanged). **React Testing Library is still not installed** and
this spec does not add it.

### Tier 1 — pure vitest, where the real logic is

Everything that can be a pure module is one, and this is where the coverage lives:

- **`core/util/download-file.ts`** — the graduated tests, moved unedited, plus `saveBlob`.
- **`core/api.ts`'s `Content-Disposition` parsing** — the real one from the live server is
  `attachment; filename="Invoice-P001-REG-01-O4….pdf"; filename*=UTF-8''Invoice-…`, i.e. **both**
  the plain and the RFC 5987 form. Test both, the quoted and unquoted plain form, a missing header,
  and a header with a `;` inside the quotes.
- **`invoice-criteria.ts`** — the draft→query promotion, trimming, the dropped empty store, and
  the local required-field refusal.
- **`invoice-columns.ts`** — the enum-name prettifier including **an unknown code arriving as a
  number** (the case a closed-list assumption breaks), and the renderable/confirm predicate
  (`Sales`/`Return` pass, `CashClearance`/training/suspended confirm).
- **`download-outcome.ts`** — status+code → the sentence, the retry-button predicate, and whether an
  `attemptId` is expected. Model it on `collection/print-outcome.ts`, which split `miss` from
  `failure` for exactly this reason. **503-vs-504 gets its own assertion**, because collapsing them
  is the specific mistake.

### Tier 2 — the screen, against checked-in fixtures

Fixtures are the contract §1's response bodies. **Type them from the pasted §2 interfaces** so a
fixture that drifts from the wire fails `typecheck` rather than at runtime.

⚠ **Do not build a `Date` from `trxDate`/`trxTime` in a test helper.** Two raw strings that sort
lexically are the wire's shape; reconstructing an instant to compare against is how a client starts
formatting, which is the drift the estate convention exists to prevent.

### Tier 3 — Playwright drive

A new `tools/invoice-drive.mjs` (nearest prior art: `tools/bby-inquiry-drive.mjs`). Vite on
**:5199**, not 5173, so it cannot collide with a dev server left running; kill the server the drive
started. Playwright is borrowed from `C:/Playground/frontend/node_modules` via the existing
`createRequire` shim — it is not a dependency of this repo.

The drive stubs the three routes and must assert, at minimum: the empty-result sentence, a 403 on
Search reading as a refusal rather than an empty grid, the confirm step firing on a
`CashClearance` row and **not** on a `Sales` row, 503-with-retry vs 504-without, and that a
successful download **triggers a file save and does not navigate**.

### Tier 4 — the live door, its own ticket

[266](266-the-screen-calls-the-real-door.md), and it is **excluded from any AFK run**: it needs a
live SIS.Api *and* a live render host, which is a two-process manual setup. Everything in 262–265 is
proven on fixtures.

**The live leg is known to work end to end as of 2026-08-10** — login → Access → Search → Download
returned a 251,615-byte PDF for `P001/REG-01/O426250B87CB7A`. Do not treat a failure there as
"expected because nothing is deployed".

## Out of Scope

- **The whole BackOffice report catalogue on the web.** The `reports` area is created for it and the
  rail is designed reusable (1042 D1), but every `ReportController` is WPF-bound and would need a
  headless parameter contract and a web parameter UI. A later effort.
- **Paging on the search.** The 50-row cap is a tripwire; paging is a new decision, not a parameter.
- **Filtering unrenderable rows out of the list, or a `renderable` flag.** The owner's explicit
  choice over both alternatives (988). The client confirm in story 11 is the sanctioned mitigation;
  a server flag only if that fails.
- **Any server change.** All seven of contract §6's guesses are taken **as contracted** — see
  Further Notes. The one that turned out to be substantively wrong (`storeName`) is handled by
  demoting a column, not by touching the wire.
- **A date in the download filename** (§6.5) and **renaming after save.**
- **Emailed or queued delivery**, and **an A4 variant of the receipt** — both considered and
  declined server-side (1042 D8/D11).
- **Distinguishing search-permission from download-permission.** `Access` returns one boolean; a
  second would be BackOffice ticket 989's to settle.
- **Graduating `ScreenGate` to `core`.** Collection has the only one; this screen copies the shape.
  A third area is the trigger.

## Further Notes

### The seven contract guesses, and what each is now

§6 of the contract listed seven things chosen without this repo in the room. All are taken as
contracted; two moved from "guess" to "measured":

| § | Guess | Disposition |
|---|---|---|
| 6.1 | `trxDate`/`trxTime` as two raw fields | **Kept.** Joined for display only. |
| 6.2 | `amount` is `RetailTrx.Amount`, unverified as the number a person recognises | **Kept, still unverified.** Ticket 266 checks it against the PDF it downloads — the cheapest possible proof, since that ticket already has both in hand. |
| 6.3 | `storeName` is `Store.Description` | 🚩 **Measured and substantively wrong**: it is `صيدلية الدواء <storecode>`, the company name plus the code. Demoted to a secondary column; no server change. |
| 6.4 | The 50-row cap | **Kept** as a tripwire. `capReached` draws a warning, never a pager. |
| 6.5 | Date-less filename | **Kept.** `Content-Disposition` is the authority. |
| 6.6 | No filtering, no `renderable` flag | **Kept.** Answered with the client confirm (story 11). |
| 6.7 | `Access` returns only `{ screenAllowed }` | **Kept.** |

### One thing worth knowing about the server half

`RetailInvoice/Search` **shipped answering 500 to every request** — the query used a LINQ group-join
that NHibernate 5.2 cannot translate, so it threw at translation time on every call. It compiled and
passed review; the projection was unit-tested but is deliberately NHibernate-free and could not
reach the failure. Fixed in BackOffice on 2026-08-10 (`QueryOver` + two explicit
`LeftOuterJoin`s, 15 live-session tests, mutation-verified).

Two things follow for this repo. First, **`Search` working is recent** — a stale local SIS.Api build
will still 500. Second, it is the reason ticket 266 exists as a ticket rather than a Proof checkbox:
a screen built entirely on fixtures can be perfect against a door that does not open.

### Registration points, so nothing is half-wired

A new area touches all of these, and a missed one fails silently:

- `app/router.tsx` — the lazy route.
- `layout/menu-model.ts` — the **Reports** group + its `accessProbe`.
- `src/core/i18n.ts` — import, `ns` array, `resources`. ⚠ **An unregistered namespace renders raw
  keys and no gate catches it.**
- `src/locales/en/reports.json` — created by 263; 264–266 **add keys to it** and must not
  re-register the namespace.
