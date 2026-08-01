---
status: open
spec: 209
blocked-by: —
---

# 210 — `core` owns the latest-state guard, and the console still drives an order unchanged

## What to build

The rule that decides **whether an arriving session state may be rendered** — version ordering,
equal-version-different-etag, and the contract-version hard stop — moves out of the call-centre
console and into `core/`, so that a second feature can hold an engine session without importing
another feature.

Nothing about the rule changes. Its test suite travels with it. The call-centre console imports it
from its new home and behaves exactly as it does today — same ordering, same idempotent replay by
identity, same refusal to speak an unknown contract version.

This is a **prefactor**, done first because [217](217-a-live-engine-session.md) is the second
consumer and [feature-structure](../.claude/rules/feature-structure.md) forbids the sideways import
that would otherwise be the cheap way out. It is also the only ticket in this effort that touches a
screen already in production, which is why it is alone in its slice.

## Spine reach

store/logic (moved to `core/`) · test (moved with it) · no model/api, no component, no i18n

## Proof (→ `tdd` red-green cycles)

- [ ] the existing latest-state guard suite — **unchanged assertions**, running from its new
      `core/` home · pure
- [ ] `npm run lint` import-boundary gate — no `features/*` → `features/*` edge exists for this
      module, and `core/` imports no feature · pure (lint)
- [ ] the call-centre console drive still completes an order end to end · flow (Playwright,
      `tools/callcenter-drive.mjs`)

## Boundaries

No server dependency. No i18n keys. No new namespace, route or nav entry. No behaviour change of
any kind — a diff that alters an assertion has overreached.

Touches `features/callcenter/console`, a live screen. Keep `npm run typecheck` green across the
move rather than at the end of it.

## Done when

The guard lives under `core/`, its suite passes from there, both features import it by
`@/core/...`, the import-boundary lint gate passes, and `tools/callcenter-drive.mjs` completes.

## Blocked by

None — can start immediately.

## Open questions

- **Does `session-fault.ts` travel with it?** It is the sibling half of the same question — *may
  this response be rendered, and if not, what happened*. Move it only if its classification is
  genuinely contract-generic rather than call-centre-contract-specific; if it is specific, leave it
  where it is and let the Nphies session own its own fault mapping. Decide by reading it, not by
  symmetry.
