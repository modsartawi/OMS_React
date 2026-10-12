---
status: done
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

- [x] `replayPreflight` gives a warning for a return, a void, training, not completed, and unbalanced (to the cent), and none for a balanced completed sale · pure (vitest)
- [x] `replayRefusal`: every code has its words, and an unknown code falls back · pure (vitest)
- [x] Replay drive section: each warning disables Push and shows its words. Each stubbed refusal shows its words where it belongs. A 500 shows the shared failure · flow (Playwright)
- [x] Gates green.

## Boundaries

oms-react only, no new door. New keys in `sync-console`.

## Done when

Every warning and refusal in spec 470's contract shows its own words in the drive.

## Blocked by

[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md)

## Comments

**Done 2026-10-12 (AFK, /implement).** Every proof is STUBBED. The BackOffice replay doors have no spec yet.

- **Logic** (`replay-helpers.ts`):
  - `ReplaySummary` gains `warnings` (return, void, training, notCompleted, unbalanced, in that order). A void never also warns notCompleted, and a voided return warns return and void.
  - `pushReady` is now "no warning". This closes 472's carry-over (training and unbalanced sales could still be pushed).
  - `replayRefusal(code)`: the nine contract codes get `replay.refusal.<CODE>`, words alone. Any other code falls back to 468's shared failure (`failures.*` or the raw message, with the code). A codeless 500 shows the failure sentence over core's server words.
  - `rereadsRegisters(code)`: after a store or register refusal on push, the registers are read again.
- **Page:**
  - The warnings show in an attention-token box under the summary. The unbalanced warning gives both figures, each in `fsi()`. It replaces 472's "Only a completed sale can be pushed." line, whose key is gone.
  - Registers-door refusals show under the store field. Push refusals moved out of the confirm into the result area, and the confirm closes.
- **vitest:** `replay-helpers.test.ts` has 38 cases, 13 of them new. The full suite is 268 files, 4780 tests, green.
- **Drive:** `tools/sync-console-replay-drive.mjs` is 110/110 on :5199 (it was 51). The new section 8 covers:
  - each of the five warnings, plus the voided return and several warnings at once, each keeping Push disabled with a store and register picked;
  - the three registers refusals, plus an unknown code;
  - all nine push refusals, plus `BAD_FIELD` (shared words), an unknown code and a 500, each in the result area with the confirm closed;
  - the re-read of the registers.

  🚩 **Assertions of 472 changed on purpose**, each flagged in the drive:
  - §2 now finds the return's warning instead of the removed not-ready line;
  - §3 checks NOT_NEWPOS_STORE's own words instead of "console failure + code";
  - §6 expects the push refusal in the result area with the confirm closed, in words, and the 500 as the shared failure.
- **Store drive:** 307/307, unchanged and untouched.
- **Gates:** typecheck, lint (4/4), vitest and build are all green.
- **Judgement calls** are in `.afk/HITL-473.md`.
- **Outstanding (not AFK):**
  - A human look at the warnings box and the refusal placement.
  - The live doors' real codes and messages (476).
