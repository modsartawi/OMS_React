---
type: wayfinder-ticket
wayfinder: grilling
map: 017
status: done
blocked-by: 019, 020, 021
---

# 022 — Lock the stale-BBY cache-reset spec

## Question

Synthesize the resolved decisions (scope 019, trigger surface 020, blast-radius/auth 021, grounded
by feasibility 018) into a single coherent spec ready for `/to-spec` → `/to-tickets`. It must name:

- the server endpoint(s) — path, request/response envelope, grant, whole-clear vs targeted;
- the client trigger(s) — where in the simulator (and/or BBY download) they live, i18n, confirm/UX;
- what is explicitly deferred (the fog items: freshness UX, non-BBY repos, auto-evict-on-download if
  not chosen as primary).

Only takeable once 019/020/021 are done and mutually consistent. If they conflict, this ticket
surfaces the conflict rather than papering over it.

## Answer

The four decisions are mutually consistent — no conflicts to surface. Synthesized into a build-ready
spec: **[Spec — POS Simulation stale-BBY cache reset](022-cache-reset.SPEC.md)**.

Shape in one breath: **two mechanisms** — (A) a manual whole-cache `Pricing/ClearCache` fired from a
simulator-header button, and (B) targeted auto-evict of `bby:{n}` on successful BBY download — behind
a **new, distinct cache-admin grant** (new seed + gate + filter + `Pricing/CacheAccess` probe to
show/hide the button), with **confirm + audit + rate-limit** guardrails on the manual clear only.
Freshness UX and the bypass flag are explicitly deferred / out of scope.

**One open detail flagged for the build, not a blocker:** confirm the new grant's CONTROLLER identity
with the owner (proposed `PricingCache`). Everything else is specified. Ready for `/to-tickets` — the
spec lists three suggested build slices.
