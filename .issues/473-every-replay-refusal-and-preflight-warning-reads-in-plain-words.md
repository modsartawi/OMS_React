---
status: open
spec: 470
blocked-by: 472
---

# 473 — Every replay refusal and preflight warning reads in plain words

## What to build

- **Preflight warnings** on the Replay page. Each of these keeps Push disabled and names its reason:
  - a return;
  - a voided sale;
  - a training sale;
  - a sale that is not completed;
  - tenders that do not add up to the total. This shows both figures.

  Invalid JSON already says where (472).
- **Server refusals** each get their own words, from a pure refusal map (`replayRefusal(code)`):
  - `NO_STORE`, `NOT_NEWPOS_STORE`, `STORE_UNREACHABLE` and `NO_REGISTER`. The first three show inline
    at the store field when the registers door refuses.
  - `BAD_SNAPSHOT`, `NOT_A_SALE`, `NOT_COMPLETED`, `TRAINING` and `UNBALANCED`. These show in the
    result area on push.
- An unknown code, or a codeless 500, falls back to the console's shared failure words, as 468 did.

## Spine reach

logic (`replayPreflight` warnings, `replayRefusal`) · component (page) · i18n (`replay.warn.*`, `replay.refusal.*`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `replayPreflight` gives a warning for a return, a void, training, not completed, and unbalanced (to the cent), and none for a balanced completed sale · pure (vitest)
- [ ] `replayRefusal`: every code has its words, and an unknown code falls back · pure (vitest)
- [ ] Replay drive section: each warning disables Push and shows its words. Each stubbed refusal shows its words where it belongs. A 500 shows the shared failure · flow (Playwright)
- [ ] Gates green.

## Boundaries

oms-react only, no new door. New keys in `sync-console`.

## Done when

Every warning and refusal in spec 470's contract shows its own words in the drive.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)
