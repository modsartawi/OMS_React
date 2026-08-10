---
status: open
spec: 261
blocked-by: 262, 264
---

# 265 — A row downloads its receipt

## What to build

The point of the whole effort: a row action that puts the invoice PDF on the user's disk. This is the
only ticket in the wave that consumes [262](262-the-api-client-learns-to-fetch-a-file.md)'s binary
door, and the only one whose failure taxonomy is the content rather than a footnote.

### The call

```ts
const { blob, filename } = await api.blob('RetailInvoice/Download', {
  storeCode, machineCode, trxNumber,
})
saveBlob(filename ?? `Invoice-${storeCode}-${machineCode}-${trxNumber}.pdf`, blob)
```

- 🔑 **The key is built from the clicked row, never from user input** — three parts, always all
  three. A missing part is `400 INVALID_KEY`, which means the row was malformed: a client bug, not a
  message for a user.
- ⚠ **`Client` is not on the wire.** `RetailTrx`'s primary key is four parts —
  `Client` + `StoreCode` + `MachineCode` + `TrxNumber` — but `Client` is a fixed `'000'` estate-wide
  and slated for removal (owner ruling 988). **Do not add a fourth part.**
- **`Content-Disposition` is the filename authority**; the literal above is the fallback only. It
  deliberately carries **no date** (contract §6.5) and renaming after save is out of scope.
- ⚠ **Identity is never sent.** SIS.Api reads the user from the session row and passes it to the
  renderer as `requestedBy` for the journal. `staffid` / `storecode` headers are **ignored** on the
  cookie path — do not send them and do not add a "who" parameter.
- **Every download is journalled** — one row per attempt in the HQ `ReportRenderAttempt` table,
  written *before* the render starts. **There is no separate audit; that is it.** The client adds no
  logging of its own.

### The confirm step — the one place the client may act on renderability

⚠ The search returns rows that **cannot be rendered**, unfiltered and unflagged, and that is an owner
ruling (988) rather than a gap: `RetailTrx` also holds **cash clearances** (`trxTypeCode: 700`),
**training** receipts and **suspended** (parked) sales. Downloading one is a `422 RENDER_FAILED` the
user could not have predicted.

So anything whose `trxType` is not `Sales` or `Return` gets a **confirm dialog** before the call,
naming what the row actually is. This is the contract's own suggested client behaviour and the
sanctioned mitigation.

- **`Sales` and `Return` download with no confirm.** A confirm on the normal path would train people
  to click through it.
- ⚠ **Do not filter the row out, do not disable the action, and do not derive a `renderable` flag.**
  A server flag is only on the table if the confirm fails in practice.

### The pending state

**Expect 1.5–3 s for a warm render**, more after a host recycle, 30 s server timeout. The row's
action shows a pending state for the duration; the rest of the screen stays usable, and the page
**must not navigate**.

### The failure table — verbatim from contract §4

| Status | `errorCode` | Sentence | Retry button |
|---|---|---|---|
| 400 | `INVALID_KEY` | a bug — the row was malformed | no |
| 401 | — | handled centrally by `handle401` | — |
| 403 | `ACCESS_DENIED` | "You don't have access to invoices." | no |
| 404 | `INVOICE_NOT_FOUND` | "That invoice no longer exists." | no |
| 422 | `RENDER_FAILED` | "This document can't be produced as a receipt." | **no — retrying will not help** |
| 503 | `RENDERER_UNAVAILABLE` | "The receipt service is unavailable. Try again shortly." | **yes** |
| 504 | `RENDER_TIMEOUT` | "The receipt took too long." | yes, once |
| 500 | `SERVER_ERROR` | generic | no |

Three things this table hides, all of which are the actual work:

1. 🔑 **503 and 504 are different sentences and must not be collapsed.** 503 means a render host is
   recycling or handing over to its successor and **a retry one second later works**. 504 means a
   render **hung** and a watchdog is about to kill the host. Different advice, different alert. This
   is the specific mistake the ticket exists to prevent, and it gets its own test.
2. ⚠ **By the time a 503 reaches the browser, three attempts have already failed.** SIS.Api retries
   the internal call twice (250 ms, then 1 s) on connect-refused/503 **only** — never on a timeout, a
   404 or a 422. So the client adds **no automatic retry of its own**; the retry button is a *user*
   action.
3. ⚠ **403 carries no body at all** — a bare refusal, no envelope, no `errorCode`. `apiErrorCode(err)`
   is `null` and the message is the generic fallback, so branch on **`err.status === 403`**. Every
   other row in the table branches on the code.

### `attemptId`

Present on **422 and 504** (the render was attempted and journalled), **absent** on
400/401/403/404/503 (nothing was attempted). Read it with 262's `apiErrorAttemptId`, show it in the
error detail, and make it **copyable** — it is the row id in the render log and the only handle a
user can quote in a support conversation.

### Where the logic goes

A pure `download-outcome.ts`, modelled on `features/collection/inquiry/print-outcome.ts` — which
split `miss` from `failure` for exactly this reason. Status + code → `{ sentence key, retryable,
expectsAttemptId }`. The component stays a thin renderer; **all of it is unit-tested without a DOM.**

## Spine reach

The effort's whole purpose, end to end on fixtures: click a row, get a PDF.

## Proof

- [ ] `npm test` — `download-outcome.ts` over **every row of the table above**, with 🔑 **an explicit
      assertion that 503 and 504 map to different sentences and different retry-ability**.
- [ ] `npm test` — `expectsAttemptId` is true for 422/504 and false for 400/401/403/404/503.
- [ ] `npm test` — the confirm predicate: `Sales`/`Return` → no confirm; `CashClearance`, a training
      status and a suspended status → confirm. Include an **unknown numeric `trxType`** → confirm
      (unknown is not "normal").
- [ ] `tools/invoice-drive.mjs` **extended**, asserting against stubbed responses:
      - a success **triggers a file save and does not navigate**;
      - the filename comes from `Content-Disposition`, and the fallback is used when the header is
        absent;
      - 503 shows a retry button, **504 does not show the same sentence**;
      - 422 surfaces a copyable `attemptId`, and 503 shows **none**;
      - a bare 403 reads as a refusal, not a generic error;
      - the confirm fires on a `CashClearance` row and **not** on a `Sales` row;
      - the pending state appears and clears.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` clean.
- [ ] `git grep` finds **no** `createObjectURL` and no hand-rolled `fetch` in this feature — the blob
      goes through `api.blob` and the save through `@/core/util/download-file`.

## Boundaries

- **No client-side retry loop.** SIS.Api already retried twice; a third layer would triple a
  recycling host's load at the worst moment.
- **Do not open the PDF in a tab or an embedded viewer.** A save, per the spec. An `<iframe>`/
  `<embed>` preview is a separate decision nobody has taken.
- **Do not send `Client`, `staffid` or `storecode`.**
- **Do not collapse 503 and 504**, and do not map either to the generic server sentence.
- **Do not filter or disable unrenderable rows** — confirm, don't prevent.
- No new npm dependency (no `file-saver`, no PDF library).

## Done when

A `Sales` row downloads its PDF with the server's filename and no navigation, a `CashClearance` row
confirms first, every row of the failure table produces its own sentence with 503 and 504 distinct,
`attemptId` is visible and copyable where the server sends one, and the drive covers all of it.

## Blocked by

[262](262-the-api-client-learns-to-fetch-a-file.md) — `api.blob`, `attemptId`, `saveBlob`.
[264](264-one-field-finds-an-invoice.md) — the rows to act on.

## Open questions

None.
