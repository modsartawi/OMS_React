# Rule: all server calls go through `src/core/api.ts`

The SIS.Api universal envelope, error taxonomy, and 401 handling live in one place —
`src/core/api.ts`. Feature code never calls `fetch` directly and never re-implements the envelope.

## How to call the server

- Add a typed function to the feature's `api.ts` (e.g. `src/features/deliveries/api.ts`) that calls
  `api.get<T>(path, params)` or `api.post<T>(path, body)`. Return the domain model type, not the
  raw response — `request()` already unwraps `HttpGeneralResponse<T>.data` for you.
- Endpoint path is a bare string (`'SdDocument/DeliveryDocumentList'`), no leading slash, no base —
  `request()` prepends `BASE` (the `/api` Vite proxy in dev, same-origin `/` under IIS in prod).
- Model types live in `src/core/models/`. Query params: `null`/`undefined`/`''` are dropped by
  `buildQuery` — don't pre-filter them yourself.

## How to handle failure

`request()` throws a typed `ApiError` with `kind: 'auth' | 'business' | 'server' | 'network' | 'unknown'`.

- **Never** swallow it into a generic string. Use `apiErrorMessage(err, fallback)` for display and
  `apiErrorCode(err)` to branch on a machine code (`LAST_ADMIN`, `SYSTEM_ROLE`, `IN_USE`, …).
- **401 is not yours to handle** — `handle401` already clears the session, toasts once (coalesced),
  and redirects to `/login`. Don't catch-and-redirect on 401 in feature code. The anonymous auth
  endpoints (`Auth/Login`, `Auth/Ua*`) are already excluded from the redirect.
- A non-2xx that still carries the envelope with `success:false` is a **business** outcome (guard
  denial, rule violation), not a crash — surface its `message` + code, don't show "unexpected".

## The tell

A raw `fetch(` outside `src/core/api.ts`, a hand-built `{ statusCode, success, data }` shape, or a
`catch` that turns an `ApiError` into a bare `.message` string without the `apiErrorMessage` helper.
