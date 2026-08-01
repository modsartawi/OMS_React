---
status: open
spec: 209
blocked-by: 214
---

# 215 — A pending authorization can be status-checked or retried, and a completed undispensed one cancelled

## What to build

The acts on a row, and the rule that decides which ones it offers.

Acts are **state-driven and disabled with their reason on hover**, so the row teaches its own
vocabulary instead of the agent learning it by being refused:

| Request state | Acts offered |
|---|---|
| `Pending` | Status check · **Retry** |
| `Complete`, not dispensed | Cancel |
| `Complete`, dispensed | — |
| `Failed` | **Open the refusal** — the affordance lands in [221](221-reopening-replays-and-reports.md) |
| `Cancelled` | — |

**Retry belongs to `Pending`, not to `Failed`** — a correction of record this ticket must carry.
Retry re-POSTs the **stored request payload verbatim** and takes the newer answer, which means
*"ask again"*. That is meaningless for a request the exchange never accepted, and offering it there
would invite an agent to press it repeatedly on a request that can only be fixed on the form.

The server stays authoritative. These are affordances, not permissions: a refusal that arrives
anyway renders as a **business outcome** with its message, never as a crash — an authorization
already dispensed will be refused by the service for both retry and cancellation regardless of what
the row believed.

## Spine reach

model/api (status check, retry, cancellation) · store/logic (the row-acts module) ·
component/route (row act menu on the existing list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `retryIsOfferedOnPendingAndNotOnFailed` — the correction, stated as an assertion so it cannot
      regress back to the original mapping · pure
- [ ] `everyWithheldActCarriesItsReason` — no act is ever merely absent or merely greyed; each
      unavailable act has a reason string · pure
- [ ] `aDispensedAuthorizationOffersNothing` — both cancel and retry are withheld once dispensed ·
      pure
- [ ] each act fires and its refusal renders as a message rather than an error · flow (Playwright,
      extend `tools/nphies-authorizations-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** status check, retry, and cancellation passthroughs.

**Envelope handling:** a business refusal arrives as `success:false` with a code and must be
explained from that code per [api-envelope](../.claude/rules/api-envelope.md) — it is a designed
outcome, not an error. Do not collapse it into a generic failure toast.

The `Failed` row's act is *rendered* here so the table is complete, and *wired* in
[221](221-reopening-replays-and-reports.md). Until then it may be present and inert only if it says
so; a live-looking button that does nothing is worse than one that is disabled with a reason.

## Done when

Every row offers exactly the acts its state permits, each withheld act explains itself on hover, the
three acts fire, and a server refusal reads as a business outcome — drive green.

## Blocked by

[214](214-an-authorization-row-states-both-facts.md) — the rows and their state must exist first.
