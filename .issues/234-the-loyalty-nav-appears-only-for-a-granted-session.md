---
status: open
spec: 231
blocked-by: 233
---

# 234 — The Loyalty nav group appears only for a granted session, and fails closed

## What to build

The screen exists but has no way in. This slice adds the **Loyalty** nav group with the member lookup
under it, gated by the screen's own access probe — and makes a deep link by an ungranted user land on
the portal's denied backstop rather than on a PII surface.

One probe, one TanStack Query key, **two consumers**: the menu item's `accessProbe(...)` and the
page's own in-page guard. That is the established shape (`omsAccessApi`, `uaAdminApi`,
`sessionMonitorApi`, `authzAdminApi`) and it exists so the nav and the screen can never disagree
about whether the session is allowed in.

🚩 **Fails closed, and this is the point of the ticket.** Any error, an unseeded grant, a missing
table, an engine fault — all hide the nav item and deny the screen. The failure mode being designed
against is a PII lookup surface left open because a probe threw and the client treated the throw as
"probably fine". Show/hide is hygiene only; the server grant stays authoritative, which is why the
in-page guard exists as well as the menu one.

The nav group is new: `/loy/*` is its own URL prefix and its own menu group, which is exactly the
condition under which [feature-structure](../.claude/rules/feature-structure.md) says a new area
appears.

## Spine reach

api (`LoyWeb/Access`) · logic (the probe's `visible` predicate) · **component/route** (menu model +
the page guard) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] the probe's predicate — a granted answer shows the item; a denied answer, a thrown error, and
      a malformed answer each hide it · **pure**
- [ ] `tools/loy-member-drive.mjs` (extended) — granted: the Loyalty group appears and the item
      routes; denied: the group is absent **and** a typed deep link to `/loy/members` lands on the
      denied backstop · **flow (drive, stubbed envelopes)**

## Boundaries

- **New API dependency:** `GET LoyWeb/Access` — BackOffice, not built. Cookie-only, **not**
  grant-gated, reading the same gate object as the route filter. It is the fifth `LoyWeb` route and
  the only one that is not a read.
- **Nav visibility:** a new top-level menu group. Until this ticket lands, `/loy/members` is reachable
  by URL only — deliberate, so the screen never appears in the nav ungated.
- i18n: the nav group and item labels.

## Done when

A granted stub shows the Loyalty group and opens the screen; a denied stub hides it and turns a deep
link into the denied backstop; a probe that throws behaves exactly like a denial. `npm run typecheck`
and `npm run lint` green.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[233](233-one-field-resolves-a-member.md) — there is no screen to gate until the route exists.
