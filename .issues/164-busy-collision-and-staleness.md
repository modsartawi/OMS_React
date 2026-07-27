---
status: open
spec: 160
blocked-by: 162
---

# 164 — aBusyCollisionLooksRoutineAndTheBasketNeverGoesBackwards

## What to build

The console's resilience spine, built **early on purpose** so every verb added after this inherits
it rather than retrofitting it.

- **`SESSION_BUSY` is routine and must look routine.** The 15 s strict claim is the cross-pod mutex;
  a collision is a business outcome carrying `retryAfterMs`. The client retries automatically with
  backoff `0 · 400 · 800 · 1600 · 3200 ms` — a ~15 s ceiling matching the worst-case self-lockout.
  🚩 **This lives in `features/callcenter/api.ts` and never in `src/core/api.ts`**: lease semantics
  have no business in the layer every back-office grid shares.
- It renders as a **non-blocking strip**, primary-toned with an indeterminate hairline, that says it
  is retrying **and** says typing still works. Never a spinner over the basket — it is not a fault.
- After the ceiling, a **still-busy** state offering a manual retry. The agent is never left without
  an action.
- **The basket never goes backwards.** A response whose `version` is lower than the one on screen is
  discarded, not applied — which is what stops a slow response landing after a fast one and rewinding
  the screen. (162 hung the guard; this slice completes and proves it.)
- **A stale tab can never write onto the new order.** `transactionId` is explicit on every verb, so
  an action from a tab showing an abandoned order is refused `SESSION_CLOSED` with its `reason`, and
  that tab returns to the start rather than silently landing on the agent's *current* caller's
  basket.
- **A major `contractVersion` mismatch is a hard stop** with its own screen: the console refuses to
  run and asks to be updated rather than mis-rendering money. Minor drift, in either direction, is
  ignored by rule — unknown fields are ignored, so an additive server change needs no client release.

## Spine reach

api (retry wrapper in the feature's `api.ts`) · logic (pure backoff schedule; version guard;
contract-version check) · component (busy strip, still-busy state, version hard stop) · i18n ·
test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [ ] `busyRetriesOnScheduleThenSurrenders` — driven with a fake verb and an injected sleep: the
      delays are `0 · 400 · 800 · 1600 · 3200`, a success mid-schedule stops it, the ceiling is
      bounded, and **any other `ApiError` is rethrown untouched rather than retried** · pure
- [ ] `theScreenNeverRewinds` — a lower `version` is discarded, equal is idempotent, higher applies;
      and a `replayed: true` response renders identically to a fresh one · pure
- [ ] `aBusyCollisionKeepsTheScreenUsable` — drive: a stub answering `SESSION_BUSY` twice then
      succeeding shows the strip, never a blocking spinner, and the basket stays interactive; the
      exhausted case offers a manual retry · flow (Playwright, extends `tools/callcenter-drive.mjs`)

## Boundaries

No new endpoint — this is behaviour over the verbs 162 already added. Envelope codes: `SESSION_BUSY`
(409, auto-retried), `SESSION_CLOSED` (409, carries `reason: submitted | abandoned | swept`),
`NOT_YOUR_SESSION` (403, hard stop offering `getState` on the agent's own order). 🚩 The
import-boundary rule and this ticket agree: nothing here may be lifted into `src/core/api.ts`.

## Done when

A busy collision retries itself, says so without blocking, and surrenders to a manual retry; a
late-arriving older state cannot rewind the basket; a stale tab is refused rather than misrouted;
and a major contract mismatch stops the console instead of mis-rendering it.

## Blocked by

[162](162-console-opens-an-order.md) — there must be a verb path and a rendered state to protect.
