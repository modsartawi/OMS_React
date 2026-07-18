---
type: wayfinder-ticket
wayfinder: prototype
map: 001
status: done
blocked-by: 002
---

# 004 — Interactive design mock for the Active Sessions screen

## Question

A 390 / 449-style interactive mock (claude.ai artifact) of the **live monitoring table**,
for the owner to react to before the spec (005) locks the shape. Render what 002's contract
can answer:

- **Live monitoring table** — one flat grid of estate-wide live sessions; columns
  User (id + name), Store, Channel badge, Started, Last seen (relative + absolute), IP,
  User agent; per-row **Revoke**. No detail pane — a row is the whole record.
- **Search-first + 50-cap** — one search box (user id/name · store · IP), "first 50 of N —
  refine to narrow", consistent with Ua Admin.
- **Filter chips** — All / Web / Mobile / Idle > N (server counts).
- **revoke-all-for-user** — the action surfaced when the list is narrowed to one user
  (kick a person out everywhere), plus the per-row revoke.
- **Guardrail / confirm UX** — revoke-one and revoke-all confirmation modals; the denied
  card (no grant), empty, and loading states.
- **Consistency** — the shipped restyle (warm neutrals + terracotta accent, Inter, pill
  buttons, zebra-less grid) so it reads as one product with Ua Users / Authorization Admin.

HITL via `/prototype`; link the mock artifact from this ticket. The confirmed shape becomes
the spec's screen section.

## Answer

Confirmed 2026-07-18. Drafted as v1 in the map-charting session, then iterated with the owner:
**v2 added the BackOffice channel chip** (channels = Web / Mobile / BackOffice; POS folds into
All — a POS chip is a later option, noted in the map). Owner reviewed and advanced ("next") —
the **v2 shape is the build target** for the spec's screen section.

Confirmed shape: live-monitoring table (flat, no detail pane); search box + 50-cap
("first 50 of N — refine to narrow"); server-count chips All / Web / Mobile / BackOffice /
Idle>30m; columns User(id+name) · Store · Channel badge · Started · Last seen(rel+abs) · IP ·
Client; per-row Revoke; revoke-all-for-user context bar when the result set narrows to one
user; revoke-one and revoke-all confirm modals; loading / no-matches / no-access states; light
+ dark; shipped restyle tokens. Remaining polish (refresh cadence, idle threshold value,
revoke-all audit shape, copy) → spec (005), not further prototyping.

## Working asset

- Interactive mock (v2): https://claude.ai/code/artifact/e2e07599-d259-4e37-b20a-4633852c6fdc
  - v2 (2026-07-18, owner reaction): added a **BackOffice** channel chip (channels now
    Web / Mobile / BackOffice; POS still folds into All — add a chip if wanted later).
  - Live-monitoring table; search box + 50-cap ("first 50 of 128 — refine to narrow"); chips
    All / Web / Mobile / BackOffice / Idle>30m (server counts); per-row Revoke; revoke-all-for-user context
    bar appears when the result set narrows to one user; revoke-one and revoke-all confirm
    modals; loading / no-matches / no-access states (mock preview toggle); light+dark; mirrors
    the shipped restyle tokens.
