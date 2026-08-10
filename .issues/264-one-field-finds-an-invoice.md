---
status: done
spec: 261
blocked-by: 263
---

# 264 — One field finds an invoice

## What to build

The screen's content: **one required field**, a Search, and a candidate grid. No download yet — that
is [265](265-a-row-downloads-its-receipt.md).

**Templated on `features/pricing/bonus-buy-inquiry`**: access gate → toolbar producing a **criteria
draft** that only Search promotes to a query → AG Grid. ⚠ **Copied, not extracted** — collection's
244 §1 ruling stands and this screen does not overturn it.

### The toolbar

- **`trxNumber` — required.** Trimmed. Enter submits. Validated **locally** before the call: the
  server's `400 TRX_NUMBER_REQUIRED` exists as a defence and reaching it is a client bug.
- **`storeCode` — optional**, a narrowing convenience only. Dropped entirely when empty, never sent
  as `''`.
- A **criteria draft** that only Search commits — a half-typed number never fires a query. Reset
  clears both fields and the result.
- Focus lands on the number field on mount.

⚠ **Three deliberate departures from collection's four screens.** Do not "fix" them toward that
template:

| Collection's screens | Here | Why |
|---|---|---|
| Land on today, auto-fire on mount | **Land empty, fire nothing** | The screen cannot guess a transaction number; an auto-search is a guaranteed empty grid |
| Client-side paging (50/page over ~2,000 rows) | **No paging** | An exact-number search returns essentially one row |
| Floating filter row **on** by default | **No filter row** | Nothing to filter within one row |
| CSV export button | **No export** | See above |

### The call

```
GET RetailInvoice/Search?trxNumber=…[&storeCode=…]
→ 200 { rows: InvoiceCandidate[], capReached: boolean }
```

**Paste contract §2's `InvoiceCandidate` / `InvoiceSearchResult` interfaces verbatim** into
`@/core/models/` — they are wire types, and `api-envelope` puts those in `core/`. Do not add a field,
rename one, or soften a type to whatever is convenient: a model that drifts from the contract produces
a screen that fails on exactly the fields you changed, silently, the day it meets the real door.

### The grid — 14 columns, identity first

`storeCode` · `storeName` · `machineCode` · `trxNumber` · `receiptNumber` · `trxDate` · `trxTime` ·
`trxType` · `trxStatus` · `documentType` · `amount` · `itemLinesCount` · `customerId` · `customerName`

- 🚩 **`storeCode` is the store's identity, not `storeName`.** Measured, not assumed:
  `Store.Description` reads **`صيدلية الدواء <storecode>`** — the company name with the store number
  appended, 1508 distinct over 1540 stores. It carries no branch identity a code column does not
  already give. It stays on the row (it is on the wire) as a **secondary** column, and is never what a
  user reads to know which shop this was. **Do not raise a server change** — spec 261 rules it out.
- **`trxType` and `trxStatus` are visible columns.** They are the only thing on a row telling an
  operator that a candidate is **not a customer receipt**, and 265's confirm step depends on the user
  having seen them. Not tooltips, not behind a toggle.
- 🔑 **The enum values are C# identifiers, not labels** — `"CashClearance"`, not "Cash clearance".
  Prettify through `t()`. ⚠ **The list is NOT closed**: `RetailDocumentType` has 18+ members and
  grows, and when no member carries a code **the server sends the number as the name**. An unknown
  value must render as itself. Rendering it blank hides exactly the case the field exists for.
- **`amount` formats through `@/core/money`** (graduated at 250; already knows BHD is 3 dp).
  `itemLinesCount` is a count, not money — do not send it through the money formatter.
- **`trxDate` + `trxTime` are two raw fields** (`yyyy-MM-dd`, `HH:mm:ss`) joined for display via
  `@/core/util/date-format`. ⚠ **Do not build a `Date` from them.** The server does not format by
  estate convention and the two strings sort lexically; reconstructing an instant is how a client
  starts formatting.

### The four states

1. **Untouched** — the landing state. Says what to type. Not an "empty result".
2. **No matches** — 200 with `rows: []`. ⚠ "No invoice carries that number" is a **different
   sentence** from an error, and must read as a successful answer. Never a 404.
3. **One or more matches** — a list. ⚠ **A single match is still a one-row list**, never an automatic
   download (contract D14, re-confirmed at 988). The client parses exactly one success shape.
4. **Refused** — ⚠ a **bare 403 with no body**: no envelope, no `errorCode`, so `apiErrorCode(err)`
   is `null` and the message is the generic fallback. Branch on **`err.status === 403`** and say "you
   don't have access to invoices". An empty grid here would be a lie.

### `capReached`

Draws a **plain one-line warning**, never a pager. The 50-row cap is a **tripwire, not a page size**
(contract §6.4); on an exact-number search `capReached: true` means the *data* is wrong.

⚠ Do **not** reuse collection's `CapBanner` — it lives in `features/collection/inquiry/GridStates.tsx`
and **a feature may not import a feature**. Do **not** graduate it to `core/` for one sentence on a
path that should never fire. A local `t()` string.

## Spine reach

Type a number → see the invoice that carries it. The screen is useful (as a lookup) before it can
download anything.

## Proof

- [x] `npm test` — `invoice-criteria.ts`: draft→query promotion, trimming, empty `storeCode` dropped
      (not `''`), the local required-field refusal, and Reset returning the landing state.
      — 20 assertions in `invoice-criteria.test.ts`. 🚩 The refusal has exactly **one** reading:
      `buildInvoiceSearchParams` returns `null` for a blank number, and a `canSearch` predicate
      beside it was written and then **deleted** at review (a second reading of the same rule that
      nothing called). `sameQuery` joined it for the retry arm below.
- [x] `npm test` — `invoice-columns.ts`: the enum prettifier over a known code, and 🔑 **over an
      unknown code arriving as a number** — assert it renders as that number, not blank. Money via
      `@/core/money` including a 3 dp currency; a count not going through it.
      — 16 assertions. The prettifier is tested against the **real `reports.json` bundle** (not a
      key-echoing stub), so the arm proves both the fallback and that the keys exist; `'37'` and
      `'742'` render as themselves at the helper **and** at the cell. `itemLinesCount` has no
      `valueFormatter` at all, which is the assertion. `formatMoneyIn(1.5, 'BHD') === '1.500'` pins
      that the amount goes through the currency-aware formatter — ⚠️ the wire carries **no
      currency**, so an amount draws 2 dp today; logged in `.afk/HITL-264.md` for 266's §6.2 check.
- [x] `npm run typecheck` proves the fixtures against the pasted contract types — break one field's
      type once and confirm typecheck fails (the fixture-drift guard).
      — **Done, and it fails.** `itemLinesCount: 3` → `'3'` in `invoice-columns.test.ts`'s `ROW`
      gave `error TS2322: Type 'string' is not assignable to type 'number'` at line 45; restored,
      clean. Contract §2 is pasted verbatim as **one block** (`InvoiceCandidate`,
      `InvoiceSearchResult`, `RetailInvoiceKey`) — field for field, doc comments included.
- [x] `tools/invoice-drive.mjs` **extended** (not replaced), asserting all four states: landing ≠
      empty-result, `rows: []` reads as a successful "no invoice", a one-row result renders as a
      **list**, and a bare 403 reads as a refusal.
      — **47/47**, up from 263's 19/19, scenarios 6–14 added to the same file. The bare 403 is
      stubbed with **no body at all** (not through the `envelope()` helper), which is the arm's
      whole point. 263's "no search box and no grid yet" check **inverted** rather than being
      deleted — the toolbar is now asserted present, the grid still absent.
- [x] Drive asserts `trxType`/`trxStatus` are **visible without any toggle**, and that a
      `CashClearance` row appears in the list at all (the search filters nothing).
      — both, plus an unknown `documentType` of `'37'` rendering as `37` in the cell, no floating
      filter, no pager (⚠️ `:visible` — AG Grid always renders a hidden paging panel), no export.
- [x] `npm run lint` clean — no user-visible literal, no physical Tailwind utility.
      — **475 boundaries** / 117 contrast pairs / 480 colour files with the same **4** documented
      exclusions (no fifth). `npm test` 96 files / **1516 tests**; `npm run build` ✓.

### Two `/code-review` findings, fixed in this slice

- **A failed search could not be repeated.** The query key IS the params, so pressing Search again
  on the same number was answered from cache — and with `retry:false` here and
  `refetchOnWindowFocus:false` app-wide, a transient 500 left a live-looking dead button. Now
  `sameQuery(params, appliedParams)` → `refetch()`. Driven.
- **Emptying the number and searching left the previous rows on screen**, under a message saying
  there was nothing to search — and 265 is about to hang a Download on those rows. The local
  refusal now clears the issued query too. Driven.

### One argued departure — 13 columns, not 14

`trxTime` is **rendered inside the joined `Date / time` cell** rather than in a column of its own:
spec 261 §Columns, its wireframe and the wave's own runner all say the two raw fields are "joined
for display through `@/core/util/date-format`", and drawing the time twice was the only way to
satisfy both readings literally. All **14 wire fields are still rendered** —
`COLUMN_FIELDS ∪ JOINED_FIELDS ∪ NON_COLUMN_FIELDS === the wire row` is a test — and the join is a
**string** join (`joinDayAndTime`), never a `Date`. Recorded in `.afk/HITL-264.md` §1.

## Boundaries

- **No download action, no PDF, no `api.blob` call.** 265 owns all of it.
- **Do not filter the result** by type or status, and do not derive a `renderable` flag. Cash
  clearances, training and suspended rows come back and are **meant to be seen** (owner ruling 988).
- **No paging, no export, no floating filter row.**
- **Do not import from `features/collection/` or `features/pricing/`** — copy shapes.
- No new npm dependency.

## Done when

A transaction number finds its invoice, all four states read correctly and distinctly, an unknown enum
code renders as its number, and the drive covers every arm.

## Blocked by

[263](263-the-reports-group-appears-only-for-a-granted-session.md) — the area, route, gate and
namespace.

## Open questions

None.
