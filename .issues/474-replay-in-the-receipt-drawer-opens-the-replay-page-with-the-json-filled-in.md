---
status: open
spec: 470
blocked-by: 472
---

# 474 — Replay… in the receipt drawer opens the Replay page with the JSON filled in

## What to build

- The receipt drawer (View JSON, 468) gains a **Replay…** button beside Copy JSON. It shows only when the
  user holds both `canOperate` (the drawer's own grant) and `canReplay`.
- Pressing it puts the pretty-printed snapshot and its source (store code, receipt number) into a
  feature-local, **in-memory** zustand **replay draft**, closes the drawer and navigates to
  `/admin/sync/replay`. The page opens with the box filled in and the preflight summary showing.
- The draft has these properties:
  - It is never persisted: no `persist` middleware, no session or local storage, no router state.
  - It survives moving between console pages.
  - A reload empties it.
  - A successful push keeps it, so the tester can replay again.
  - Typing in the box updates it.
  - Pasting over the box replaces it.

## Spine reach

store/logic (replay draft) · component (drawer button, page reads the draft) · i18n (`transactionsTab.snapshot.replay`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] Store drive section (extends the 468 drawer sections):
  - Operate-only sees no Replay… button.
  - Operate + Replay sees it, and pressing it lands on the Replay page with the same JSON and summary.
  - Leaving for the Fleet page and coming back keeps the draft.
  - A reload empties it.
  - · flow (Playwright)
- [ ] The page never writes the draft to `localStorage` or `sessionStorage`. The drive checks both are free of the receipt number after a replay · flow
- [ ] Gates green.

## Boundaries

oms-react only, no door. It touches the same drawer as 471 but doesn't depend on it. If 471 has landed,
keep its status line.

## Done when

Replay… carries a receipt's JSON to the Replay page, it is held only in memory, and the drive is green.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)
