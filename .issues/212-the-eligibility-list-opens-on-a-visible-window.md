---
status: open
spec: 209
blocked-by: 211
---

# 212 — The eligibility list opens on the last 7 days and says so with a removable chip

## What to build

The eligibility list an agent lands on: **last 7 days, newest first, server-paged**, with the
window rendered as a **removable chip** rather than applied silently.

The chip is the point of the ticket. The underlying read is an unordered bulk take, and a silently
truncated list reads as *"that's everything"* — which is exactly the failure mode this screen
inherits if the window is invisible. Making the window a chip means the agent can see what they are
looking at and widen it deliberately.

Filters: **patient id, payer, provider, preauth reference, and the two status axes**. The provider
filter defaults to **all providers** — deliberately the opposite of the till, which is pinned to its
own store. Note that this means the provider filter does *not* narrow the underlying read; the date
window and the patient/status filters are what do.

This slice also introduces the **shared two-axis status module** — the derivation of Request and
Verdict from the raw fields — which [214](214-an-authorization-row-states-both-facts.md) reuses
unchanged. Both lists show the same pair, so an agent learns one vocabulary and not two.

## Spine reach

model/api (list request/response, paging + total) · store/logic (filter/query builder, the shared
status derivation) · component/route (`/nphies/eligibility`, the list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `theDefaultWindowIsTheLastSevenDaysAndItIsRemovable` — the built query carries the window by
      default, and removing the chip drops it from the query rather than substituting a wider one ·
      pure
- [ ] `emptyFiltersAreDroppedFromTheQuery` — a blank patient id or an unset status axis contributes
      nothing, matching the envelope helper's own contract · pure
- [ ] `bothStatusAxesFilterIndependently` — Request and Verdict narrow the query separately, and a
      Verdict filter with no Request filter is legal · pure
- [ ] the list opens on 7 days, the chip removes the window, and paging moves through results ·
      flow (Playwright, extend `tools/nphies-eligibility-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** the **re-modelled eligibility list** — sort, page and total over
the service's unordered bulk read. This is the only genuinely new logic in the proxy, and it is
this ticket's dependency rather than a passthrough.

Reuse the repo's existing AG Grid list screens as the precedent for columns, paging and the filter
panel; do not invent a new list shape here.

The status module lands in this feature but is written to be read by two features' lists — keep it
free of anything eligibility-specific so [214](214-an-authorization-row-states-both-facts.md)
takes it as-is.

## Done when

`/nphies/eligibility` opens on the last seven days with the window visible as a removable chip, all
five filters narrow the list, paging works, and both status columns render — drive green.

## Blocked by

[211](211-an-eligibility-check-answers-in-two-axes.md) — the area, namespace, nav group and access
probe must exist before a second route joins them.
