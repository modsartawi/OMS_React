---
status: done
spec: 261
blocked-by:
---

# 262 — The API client learns to fetch a file

## What to build

The **prefactor**, and it lands before anything consumes it. Two additions to `core/`, both of which
the invoice screen cannot be written without, and both of which belong to `core/` on their own merits
rather than because this screen needs them.

### 1. `api.blob()` — a binary door on `core/api.ts`

`core/api.ts` has exactly one transport function, `request<T>`, and it **always** calls `res.json()`
and unwraps the `HttpGeneralResponse` envelope. Hand it a raw `application/pdf` body and the
`res.json()` throws, `body` stays `null`, `res.ok` is `true`, and it falls through to
`throw new ApiError('unknown', …)`. There is no way to reach a file through it, and `api-envelope`
forbids hand-rolling a `fetch` beside it.

```ts
export interface FileResponse {
  blob: Blob
  /** From Content-Disposition. Null when the header is absent or unparseable. */
  filename: string | null
}

// on `api`:
blob(path: string, params?: Record<string, unknown>): Promise<FileResponse>
```

🔑 **The whole ticket is one branch: success and failure read different body types off the same
response.** On `res.ok`, `res.blob()`. On anything else, `res.json()` and the *existing* envelope →
`ApiError` mapping, unchanged and not duplicated. Refactor the shared tail out of `request` rather
than writing a second copy of it — the 400 arm, the coded-refusal arm, the `>= 500` arm and the
`handle401` redirect must all behave identically on this path, because the download's error table is
mostly the same table.

Everything else is `request`'s existing behaviour and must be preserved exactly:

- `BASE + cleanPath`, with the leading slash stripped.
- `credentials: 'same-origin'`. ⚠ **Not `'include'`**, even though the wire contract's example says
  so — vite proxies `/api` → SIS.Api, so the call already *is* same-origin, and `include` would
  change every existing caller for nothing.
- The **`X-Web-Client: '1'` header**. This is not optional decoration: SIS.Api's cookie branch
  requires it on every cookie-authenticated request, which is exactly why a `<a href>` download is
  impossible and this method has to exist.
- `handle401` on a 401, with its redirect-debounce.

**`Content-Disposition` parsing** is a pure exported function, not an inline regex. The real header
from the live server carries **both** forms:

```
attachment; filename="Invoice-P001-REG-01-O426250B87CB7A.pdf"; filename*=UTF-8''Invoice-P001-REG-01-O426250B87CB7A.pdf
```

Prefer `filename*` (RFC 5987, percent-decoded) when present, fall back to plain `filename`, handle it
quoted and unquoted, and return `null` rather than a guess when there is no header. ⚠ A `;` **inside**
the quoted value must not split the parameter — a naive `split(';')` is the bug to avoid.

### 2. `attemptId` on the envelope

The render rail's failures carry an `attemptId` — the row id in the HQ `ReportRenderAttempt` log,
present on **422 and 504**, absent on 400/401/403/404/503. It is the only support handle a user can
quote, and **there is no separate audit table**; that log is it.

⚠ It is a **top-level sibling** of `message` and `errors`, *not* an entry inside `errors[]`:

```jsonc
{ "statusCode": 422, "success": false, "message": "…", "errors": [ … ], "attemptId": "01J8ZC9K3M7Q…" }
```

So: `HttpGeneralResponse` grows an optional `attemptId`, `ApiError` carries it alongside `errors` and
`data`, and `apiErrorAttemptId(err): string | null` joins the existing `apiErrorCode` /
`apiErrorKind` / `apiErrorMessage` readers. It goes on the **shared** envelope rather than in the
feature because it is SIS.Api's field, not this screen's.

### 3. `downloadCsv` graduates to `@/core/util/download-file.ts`

Pure move, and **pre-authorized by the code itself**. The `URL.createObjectURL` + parked-anchor +
deferred-revoke helper is byte-for-byte duplicated in `features/admin/ua-admin/export.ts` and
`features/collection/inquiry/export.ts`, and collection's copy says so in its own docblock:

> 🚩 A near-copy of `ua-admin/export.ts`'s own `downloadCsv`, and copied rather than imported
> **because a feature may not import a feature**. It graduates to `@/core` with the rest of the CSV
> primitives when a **third consumer** lands, not before.

The invoice download is the third consumer. New shape:

```ts
// @/core/util/download-file.ts
export function saveBlob(fileName: string, blob: Blob): void
export function downloadCsv(fileName: string, contents: string): void   // saveBlob on top
```

- **Both existing call sites are repointed in this same commit.** A graduation that leaves two
  copies behind is worse than the duplication it set out to fix.
- Keep the deferred revoke and the comment explaining it — a synchronous `revokeObjectURL` is fine in
  Chrome and **can abort the download elsewhere**, which is precisely the kind of knowledge a move
  loses.
- Follow `money.ts` at [250](250-money-graduates-to-core.md) and `pager.ts` at 232: existing tests
  **move unedited** and are the whole regression net.

## Spine reach

Nothing user-visible. This is the seam three later tickets stand on, landing separately so it is not
tangled into a screen's diff — and it touches two **shipped** features (`ua-admin`, `collection`),
which is the other reason it goes first and alone.

## Proof

- [x] `npm test` — new pure tests for `Content-Disposition` parsing: both forms present (prefer
      `filename*`), only plain, quoted, unquoted, **a `;` inside the quotes**, percent-encoded UTF-8,
      header absent → `null`. — `src/core/util/content-disposition.test.ts`, 11 cases.
      **Mutation-checked**: replacing the quote-aware walk with `header.split(';')` fails exactly one
      test — *"does not split on a ; INSIDE the quoted value"* (it reads `Invoice` and drops
      ` final.pdf`), and nothing else. The gate is load-bearing; reverted.
- [x] `npm test` — `apiErrorAttemptId` reads a top-level `attemptId`, and returns `null` for an
      envelope without one and for a non-`ApiError` value. — `src/core/api.test.ts`, and it is read
      off the envelope's top level, so an `errors[]`-digging reader would find nothing.
- [x] `npm test` — the graduated `download-file` tests pass **unedited** at their new path.
      ⚠ **Neither feature copy had any test to move**: the DOM half was deliberately parked outside
      the pure CSV writers their suites cover (`ua-admin/export.test.ts` covers `collectAllRows` /
      `needsConfirm` / `estimateWalkSeconds` only). So `src/core/util/download-file.test.ts` is
      written *at* the new path instead, pinning the two things the move could lose — the anchor is
      parked in the document before the click, and the revoke is **deferred**, not synchronous. Its
      docblock says so. (Logged in `.afk/HITL-262.md`.)
- [x] `api.blob` returns the blob on 2xx and throws the **same** `ApiError` shape as `api.get` on
      400 / coded refusal / 5xx — asserted against a stubbed `fetch`, including that a **bare 403
      with no body** yields `status: 403` and a `null` code (the case the screen must branch on).
      — 8 cases in `src/core/api.test.ts`, including 503-vs-504 kept apart with their codes and
      `attemptId` on the 504 only, and that the call carries `credentials: 'same-origin'` +
      `X-Web-Client: '1'`.
- [x] `npm run typecheck`, `npm run lint`, `npm run build` all clean. — typecheck clean; `npm test`
      93 files / 1473 tests; lint all three gates (465 boundaries, 117 contrast pairs, 470 colour
      files with the same 4 documented exclusions — no fifth); build ✓.
- [x] `git grep 'createObjectURL'` finds it in **`core/util/download-file.ts` only** — the two
      feature copies are gone, not orphaned. — confirmed (`--untracked`, since the new file is not
      yet in the index): `core/util/download-file.ts` + its own test, nothing under `features/`.
- [x] The existing CSV exports in `ua-admin` and `collection` still write a file: run
      `tools/collection-drive.mjs` and confirm its export assertions are unchanged and green.
      — **220/220**, every 258 export assertion green (all four screens' files, the BOM + `sep=`
      line, the `="…"` wrappers, the Arabic collector name). `tools/ua-users-scale-drive.mjs` was run
      too, since `ua-admin` is the other shipped feature touched: the whole-estate walk still writes
      one 6,002-line file. It reports 83/85 — the two failures both assert the label "Activation
      done", which the app renamed to "Authenticator active" at commit `8e5eca4`; **pre-existing
      drive staleness in another feature, not this change** (logged in `.afk/HITL-262.md`).

## Boundaries

- **No new npm dependency.** No `file-saver`, no `content-disposition` package. Both pieces are a few
  lines and the repo adds nothing for them.
- **Do not change `request<T>`'s behaviour** for any existing caller. Extracting the shared error tail
  is a refactor, and every current call site must be byte-equivalent in outcome.
- **Do not add a `downloadPdf`** or any invoice-shaped helper here. `core/` must not know what a
  retail invoice is; `saveBlob` takes a name and a blob.
- **Do not touch `credentials`.**

## Done when

`api.blob` fetches a file and maps every failure through the existing envelope logic, `attemptId` is
readable off an `ApiError`, `download-file.ts` lives in `core/util/` with both old call sites
repointed and no third copy anywhere, and all four gates are clean.

## Blocked by

—

## Open questions

None. Every shape here is either already in `core/api.ts` or fixed by the wire contract.
