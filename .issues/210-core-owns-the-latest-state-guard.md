---
status: done
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

- [x] the existing latest-state guard suite — **unchanged assertions**, running from its new
      `core/` home · pure — `src/core/engine-session/session-state.test.ts`, every `it()` body
      character-identical to its old one. Its fixture is not: in `core/` it cannot reach the
      call-centre `EMPTY_SESSION`, so it builds the two fields the guard reads. The one block that
      was never about the guard — `describe('the open fixture')`, which asserts the *call-centre
      projection's* shape — stayed in the feature as `console/open-fixture.test.ts`.
      `session-fault.test.ts` moved verbatim, byte for byte. **814/814 green across 51 files.**
- [x] `npm run lint` import-boundary gate — no `features/*` → `features/*` edge exists for this
      module, and `core/` imports no feature · pure (lint) — all three gates clean, 319 files
- [x] the call-centre console drive still completes an order end to end · flow (Playwright,
      `tools/callcenter-drive.mjs`) — **508/508 passed**, unchanged

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

  **Answered: it travelled.** Read, not assumed: the frozen Nphies contract's error taxonomy (§6)
  names the same two codes with the same meanings and the same three closed reasons —
  `NOT_YOUR_SESSION` 403 "belongs to another agent, hard stop", `SESSION_CLOSED` 409
  `reason: submitted | abandoned | swept`. The module reads nothing call-centre-specific (only
  `apiErrorCode` / `ApiError`). What *is* feature-specific is where a fault sends the agent, and
  that stayed in `CallCenterConsolePage`.

## As built

`src/core/engine-session/` — `session-state.ts`, `session-fault.ts` and both suites, moved with
`git mv`. The folder disambiguates from `core/session.ts`, which is the auth cookie: `CONTEXT.md`
gains an **Engine session** entry naming that collision, which spec 209 §13 asked for in the same
change as the code that uses the term.

One change beyond the move, and it is type-surface only: `applyState` is generic over
`applyState<S extends VersionedSessionState>` (`{ version, etag }`), returning `S`. The body is
byte-identical, no call site changed, and no assertion moved — but a guard hard-typed to the
call-centre projection would have forced [217](217-a-live-engine-session.md) to widen `core/` from a
Nphies ticket, which is the sideways coupling this ticket exists to prevent. `CLIENT_CONTRACT_VERSION`
stays a single constant, flagged: both contracts are major 1, only the major is load-bearing, and a
per-consumer expectation is the change for whichever ticket first sees a 2.x.

Judgement calls are logged in `.afk/HITL-210.md`.
