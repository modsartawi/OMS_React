---
status: done
spec: 819
blocked-by: —
---

# 821 — A v1 board runs through the six ready-made parameters, unchanged on screen and in its links

## What to build

**Slice 0, the tracer bullet.** It is the prefactor that the rest of v2 builds on. v1's typed six-filter board shape (period, city, region, store, channel, country) is used by the filter strip, the effective query and the permalink. It becomes **parameters + bindings + values** (spec 819 §C), and nothing changes for the user.

- **The model:** `Param`, `ParamValue` (all seven kinds), `Bindings` and `BindReason` join the analytics models, in the shape the spec inlines from the 798 prototype.
- **A tolerant read:**
  - A board definition with `params` and `bindings` is used as it is.
  - A v1 board, with `filters` and `optOut`, is converted client-side the way the server will convert it (797 item 6):
    - the saved filters become the six ready-made parameters' defaults;
    - v1's implicit rule (the dimension breaks down the panel's measures, minus `optOut`) becomes explicit bindings.
  - The server's conversion stays the authority once it lands.
- **The effective query** of a panel is computed from the parameter values and that panel's bindings. The cross-filter and its opt-out are unchanged.
- **The permalink** reads and writes parameter values by name. v1's six keys keep their exact meaning.
- **The strip** renders from `params`, showing the same six controls as today.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model (analytics models) · store/logic (conversion, effective query, permalink) · component (the strip renders from params) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `convertV1Board` — a v1 board's filters become the six defaults, and implicit rule minus optOut becomes the bindings, over v1's board fixtures · pure
- [ ] `permalink parity` — every v1 permalink fixture decodes to the same effective query keys as before the change · pure
- [ ] `effectiveQuery with bindings` — a value change alters the key only for panels bound to that parameter · pure
- [ ] drive: the existing `analytics-drive` board steps pass unchanged · flow (Playwright)

## Boundaries

No new door. It reads `params` and `bindings` when the stub sends them, and converts otherwise. No new keys beyond what the strip already has. It is a wide change inside the `boards` feature only, so keep `typecheck` green by converting at the read seam first and then moving each caller.

## Done when

The three pure tests are green, and every v1 board step in `analytics-drive` passes with no visible change.

## Blocked by

None — can start immediately

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
