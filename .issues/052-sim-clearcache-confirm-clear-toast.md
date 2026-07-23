---
status: done
spec: 022
blocked-by: 051
---

# 052 — clickingClearCacheConfirmsClearsAndToasts

> Client slice 3b of spec [022](022-cache-reset.SPEC.md). Adds the behaviour behind the gated button
> that [051](051-sim-clearcache-button-gated.md) renders: confirm → clear the whole pricing cache →
> toast, with the rate-limit business error surfaced. Consumes BackOffice `POST Pricing/ClearCache`.

## What to build

Clicking the Clear-cache button opens a **confirm dialog** (it evicts every user's warm pricing on
the instance — never a stray click), and on confirm fires the whole-cache clear and reports the
result.

- `simulationApi.clearCache()` → `api.post('Pricing/ClearCache')` (no body) through `@/core/api`,
  returning the `{ cleared: true }` data. Wrapped in a TanStack mutation at the Page.
- **Confirm before firing** via the existing `confirmAction` pattern (as the BBY delete confirm):
  title "Clear the whole pricing cache?", body warning it affects every user.
- **On success:** a sonner success toast.
- **On the rate-limit business error** (`request()` throws a typed `ApiError`, `kind:'business'`,
  from the server's 1-per-N-seconds guardrail): surface its envelope `message` via
  `apiErrorMessage(err, …)` — **no retry**, no "unexpected" wording (see api-envelope rule).
- i18n: new `simulation.json` keys — `clearCache.confirmTitle`, `clearCache.confirmBody`,
  `clearCache.success`, `clearCache.denied`. Logical Tailwind only.

## Spine reach

api (`clearCache()` mutation) · logic (confirm gate, error branching) · component (dialog + toasts
in `SimulationPage`) · i18n (4 new keys) · test (drive: confirm→clear→toast; rate-limit→message).

## Proof (→ `tdd` red-green cycles)

- [x] `typecheck` + `build` green.
- [x] Drive (Chromium, SIS.Api mocked at the envelope): clicking Clear-cache opens the confirm
      dialog; cancelling fires no clear; confirming POSTs `Pricing/ClearCache` exactly once and shows
      the success toast; a mocked business envelope (429 `success:false`, rate-limit) surfaces its
      `message` with no retry. 5/5 checks passed via typecheck + drive (no client test tier — spec 503).

## Boundaries

- **New API dependency:** `POST Pricing/ClearCache` — BackOffice endpoint (spec 022 slice 1),
  behind the cache-admin grant filter + a rate-limit that returns a `success:false` **business**
  envelope this slice must surface (not treat as a crash). Runtime-blocked until deployed.
- New i18n keys in the existing `simulation` namespace.
- oms-react repo only.

## Done when

An authorised analyst clicks Clear-cache, confirms, and sees a success toast after
`Pricing/ClearCache` returns; a rate-limited clear shows the server's business message with no retry;
typecheck + build green.

## Blocked by

[051](051-sim-clearcache-button-gated.md) — the button + `cacheAccess` gating it hangs off.
Also consumes BackOffice `POST Pricing/ClearCache` (spec [022](022-cache-reset.SPEC.md) slice 1).
