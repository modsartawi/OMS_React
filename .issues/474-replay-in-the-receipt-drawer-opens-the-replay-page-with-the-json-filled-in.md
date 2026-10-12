---
status: done
spec: 470
blocked-by: —
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

- [x] Store drive section (extends the 468 drawer sections):
  - Operate-only sees no Replay… button.
  - Operate + Replay sees it, and pressing it lands on the Replay page with the same JSON and summary.
  - Leaving for the Fleet page and coming back keeps the draft.
  - A reload empties it.
  - · flow (Playwright)
- [x] The page never writes the draft to `localStorage` or `sessionStorage`. The drive checks both are free of the receipt number after a replay · flow
- [x] Gates green: typecheck, lint, vitest (269 files / 4788 tests), build.

## Boundaries

oms-react only, no door. It touches the same drawer as 471 but doesn't depend on it. If 471 has landed,
keep its status line.

## Done when

Replay… carries a receipt's JSON to the Replay page, it is held only in memory, and the drive is green.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)

## Built (2026-10-12)

- `replay-draft.ts` (+ `.test.ts`): the feature-local zustand **replay draft** — `text` + `source`
  (store code, receipt number), `edit` / `replace` / `clear`. Module memory only: no `persist`, no
  storage, no router state, no URL. A push leaves it alone. 🚩 One addition: it also empties when
  the session's `userId` changes (sign-out, 401, another user) — a sign-out is no reload (HITL-474).
- `SnapshotDrawer`: **Replay…** beside Copy JSON (471's status line kept), only with `canOperate`
  (the drawer's own grant) **and** `canReplay` — absent otherwise; disabled only while the snapshot
  loads. It replaces the draft with `prettyJson(snapshot)` + source, closes the drawer and navigates
  to `REPLAY_PATH`, without a second snapshot read.
- `ReplayPage`: the JSON box reads/writes the draft; a muted "Brought from receipt … of store …"
  line (each value `Ltr`) shows only while the box still reads as that receipt (`shownSource`).
- Store drive section 21 (stubbed, snapshot in the engine's REAL shape, obviously fake values):
  Operate-only sees no Replay…; Operate + Replay lands on the page with the same JSON, summary and
  source; Fleet-and-back keeps it (an edit too); a push keeps it; a paste replaces it; a reload
  empties it; localStorage, sessionStorage, the URL and the console never carry it. **No existing
  assertion changed.** Store drive **336/336**, replay drive 110/110, controls drive 110/110.

## Outstanding (not AFK's)

- A human's eye on the Replay… button and the "Brought from" line (no prototype covers them).
- Live: the Replay doors are stubbed until the BackOffice replay spec ships (476).
