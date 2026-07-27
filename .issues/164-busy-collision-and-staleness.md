---
status: done
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

- [x] `busyRetriesOnScheduleThenSurrenders` — driven with a fake verb and an injected sleep: the
      delays are `0 · 400 · 800 · 1600 · 3200`, a success mid-schedule stops it, the ceiling is
      bounded, and **any other `ApiError` is rethrown untouched rather than retried** · pure
- [x] `theScreenNeverRewinds` — a lower `version` is discarded, equal is idempotent, higher applies;
      and a `replayed: true` response renders identically to a fresh one · pure
- [x] `aBusyCollisionKeepsTheScreenUsable` — drive: a stub answering `SESSION_BUSY` twice then
      succeeding shows the strip, never a blocking spinner, and the basket stays interactive; the
      exhausted case offers a manual retry · flow (Playwright, extends `tools/callcenter-drive.mjs`)
- [x] `aStaleTabIsRefusedNotMisrouted` — `readSessionFault` maps `SESSION_CLOSED` (with and without
      its `reason`, known and unknown) and `NOT_YOUR_SESSION`, and is silent about every other code ·
      pure (added — the Spine reach names *"logic (… contract-version check)"* and this is its twin:
      the codes that end an order needed reading in exactly one place)
- [x] `theContractVersionIsCheckedOnce` — same major passes whatever the minor, a different major
      hard-stops, an unreadable version hard-stops, and an **absent** one degrades · pure

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

## Comments

**Built 2026-07-27.** Green: `typecheck` · `vitest` 368/368 (18 new across `busy-retry`,
`session-fault` and `session-state`) · `lint` (boundaries, contrast, palette) · `build` ·
`tools/callcenter-drive.mjs` **113/113** against the stubbed envelope (76 were 162/163's, 37 are
this slice's).

Five decisions worth carrying forward:

1. **One seam, `runGuarded`, and every call goes through it.** The ticket asks for this slice early
   so later verbs *inherit* the spine; a wrapper that each verb has to remember to use would not be
   inherited, it would be re-decided ten times. So the page has exactly one place a server call is
   made from, and it does three things: rides the collision out on the contract's schedule,
   publishes it as a strip, and reads a dead-order refusal **once** — which is what stops
   return-to-start becoming a branch per verb. Everything else stays the caller's.
2. **`ApiError` now carries the refusal envelope's `data`** (`src/core/api.ts`). `SESSION_CLOSED`'s
   `reason` rides there, and so will `REBIND_REFUSED`'s `unpriceableLines[]` (167) and
   `COUPON_REJECTED`'s sub-code. Unwrapping the envelope is `core/api.ts`'s job on the success path,
   so it is its job on the failure path too — a feature re-reading the body would be
   re-implementing the envelope. 🚩 This is **not** the thing the ticket forbids lifting into core:
   the retry schedule and every call-center code stay in the feature, and core learns `data` only as
   `unknown`. Named `data`, not `payload` — `CONTEXT.md`'s envelope entry lists *payload* as the
   avoided word.
3. **`getState` got the agent's hand on it.** The busy strip needed a verb on a live order that can
   actually meet the claim, and §6.1 already names one: *"`getState` is the universal recovery
   action after any conflict"*, which until now the agent had no way to invoke. So the top bar
   carries a *Refresh*. It is a pure read, safe to press twice, and it doubles as the still-busy
   strip's manual retry. **Scope note, honestly:** this is one affordance beyond the ticket's three,
   and it is also the drive's collision trigger. It looked better than the alternative — a strip
   provable only behind the abandon modal, where "the basket stays interactive" is false.
4. 🚩 **An absent `contractVersion` degrades; only a stated one can hard-stop.** First cut refused on
   absence too, on the reasoning that a response which cannot state its version cannot be shown to
   be safe. The spec review pushed back and was right: §9's whole design is that additive changes
   ship server-first, and refusing on silence would brick the console against the very server (804)
   this slice is waiting on — a server defect is not evidence of a *major* change. Present but
   unreadable still stops: the server named something this client cannot speak.
5. **The strip is two facts, not one slot.** `colliding` and `stalled` are separate state because
   calls overlap — which is not a corner case here but the exact condition `SESSION_BUSY` announces.
   One slot let a second call's first retry overwrite the first call's *manual retry* and take the
   agent's only handle on an unfinished action with it. A live collision outranks a spent one; a
   success anywhere clears the standing offer, because the claim is demonstrably free.

Two things the drive had to be taught, and one that was left alone:

- **Chromium logs every non-2xx as a console error**, so the existing "no console errors" assertion
  failed in all three boxes whose whole subject is a refusal the app handles. The collector now
  ignores that one browser-authored line; `pageerror` and app-authored errors are still collected.
- The busy fixtures are **08's own** — `busy` and `staleTab` lifted out of the file whole, statuses,
  codes and `data` included, rather than a hand-rolled 409. Box 15 spends ~6 s in the strip on
  purpose: that IS the bounded ceiling.
- **`retryAfterMs` is reachable now and is still not honoured.** The schedule is the contract's, and
  a bounded client ceiling is what guarantees the agent reaches an action; a server hint could
  postpone that indefinitely. Asserted as its own case.

Still standing from 162/163, and now overdue: `CONTEXT.md` glosses neither the engine `session` (as
distinct from `sis_session`) nor `caller`/`basket`/`plant`. This slice adds `SessionFault` and
"return to the start" to the pile of terms leaning on the undefined one. `/domain-modeling`'s.
