---
status: done
spec: 380
blocked-by: 381
---

# 384 — Ranges, pairs and server text read the right way round under RTL

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F24, F26,
F27**. The measurements are in [378](378-the-foundation-in-arabic-rtl.md) §2 and §3 (table of breaking shapes,
bench at `/prototype/bidi` on branch `prototype/378-rtl`). The shipped slot chip's break was found in
[373](373-the-call-center-order-header-as-a-sentence.md).

## What to build

Under Arabic/RTL a time window, a phone, a negative amount, a count, a `code · name` pair and `n / m`
read the right way round everywhere outside grid cells. The rule that guarantees it is written down.

- **The rule (F24), restated:**
  - **Isolate by kind, not by shape**, and isolate **the whole value, never its parts**.
  - Machine values take `Ltr` (`<bdi dir="ltr">`). Free text in either script takes `<bdi>` (auto).
  - A range, a pair or `n / m` is **formatted to one string and isolated once**. Isolating each end
    reverses it.
  - Rewrite `Ltr`'s documentation, replacing 095's shape rule, and add a **bidi rule file under
    `.claude/rules/`** (link it from CLAUDE.md's conventions list).
- **Pure formatting helpers** in core for a range (`from–to`), a `code · name` pair and `n / m`,
  each returning one string.
- **The FSI…PDI string helper (F26)** for string-only sinks: `title`, `placeholder`, native
  `<option>`, toast strings, `document.title` and AG header names. It is **never** applied to grid
  values or exports, because its invisible characters would reach Ctrl+C and CSV.
- **The range sweep (F27).** These are the places on `main` today:
  - the **shipped call center slot chip** (`${from}–${to}`, which reads `21:00–18:00` in RTL);
  - the Delivery details slot (`from - to`);
  - collection `daySpan`;
  - bonus-buy inquiry's range line;
  - the bonus-buy download and broadcast `a / b` counters;
  - every non-grid place `formatDateTime` is shown.

  Ranges written with words ("from {{from}} to {{to}}") only isolate each value. Interpolated values
  isolate through `<Trans>` slots or the FSI helper.

Server-supplied **toast** text is 388's, through this ticket's helper.

## Spine reach

Core pure helpers · `Ltr` doc · rule file · the swept call sites in collection, pricing, broadcast,
document and the call center · locale JSON where a template changes shape · drive.

## Proof (→ `tdd` red-green cycles)

- [x] `formatRange returns one string with both ends` and
  `fsi wraps the whole value once and nothing else` — pure · vitest
- [x] `exports never contain FSI or PDI characters`: a grid-export helper's output over values that
  went through the formatting helpers has no U+2068/U+2069 — pure · vitest
- [x] `tools/foundation-drive.mjs` (extend) under `dir="rtl"`: the call center slot chip reads
  `18:00–21:00` for an 18:00–21:00 window, the Delivery details slot reads in order, and a
  broadcast counter reads `40 / 200` · flow (Playwright)

## Boundaries

- Locale JSON changes are only where a template must interpolate one formatted value instead of two
  ends. No new namespace.
- Grid cells are 383's.

## Done when

The rule file exists, every item in 378 §3's sweep reads in order under RTL in the drive, and the
helper tests are green.

## Blocked by

[381](381-every-screen-paints-in-palette-b-with-ibm-plex.md)

## Comments

**Done 2026-10-02 (AFK).** Decisions are logged in `.afk/HITL-384.md`.

**Shipped:**
- **Core helpers.** `@/core/util/bidi` holds `formatRange`, `formatPair`, `formatCount`, `fsi` and `stripIsolates`.
  - Each formatter returns one plain string. `fsi` wraps the whole value once and never nests.
  - The xlsx writer strips isolates from header names, the one F26 sink that reaches a file.
- **Docs.** `Ltr`'s documentation is rewritten around "isolate by kind, the whole value". The new rule file `.claude/rules/bidi.md` is linked from CLAUDE.md. `i18n-zero-literal.md` now allows the three bidi separators.
- **The §3 sweep:**
  - **Call center slot chip:** `formatRange` plus `Ltr`. Each chip value is now isolated by kind through the chip model's `ltr` flag.
  - **Delivery details window:** `formatRange`, which reads `20:00–22:00`.
  - **Collection `daySpan`:** `formatRange`, the text unchanged. The `collection:grid.daySpan` key is gone.
  - **BBY members range:** `Showing {{range}} of {{total}}`, with both values passed through `fsi`.
  - **Both counters:** `formatCount` plus `Ltr`. The two locale keys are gone.
  - **Every non-grid `formatDateTime`:** `Ltr` in JSX, `fsi` inside `t()` sentences. The sites are:
    - active sessions;
    - the call center's existing order;
    - the eight settlement sites;
    - iDoc's exported-at.
  - **Native `<option>` sinks (HITL-383's item):** store pickers and assignment staff names take `fsi`.

**Proof:**
- **vitest:** `src/core/util/bidi.test.ts` has 8 tests, including the two named ones, and the export test runs through `gridSheet`. There is also a chip-model test in `header-chips.test.ts`. The full suite is 3147/3147.
- **`npm run lint`:** all four gates are green.
- **`npm run build`:** green.
- **`tools/foundation-drive.mjs` 208/208** (light/dark × ltr/rtl; `DRIVE_ONLY=ranges` runs this ticket's part). It checks:
  - the slot chip reads `18:00–21:00`, with a strip-the-isolate control that reverses it under RTL;
  - the store pair is one LTR isolate with an Arabic name;
  - the existing-order opened-at and line count;
  - the Details window reads `18:00–21:00`;
  - the broadcast counter reads `40 / 200`, with a control that reverses it to `200 / 40`;
  - the BBY download counter, held mid-run at `2 / 12`;
  - an active session's started-at.
- **`tools/bby-inquiry-drive.mjs` 74/74:** the members footer carries the range as one FSI isolate, and the range reads in order under RTL.
- **Re-driven green:** document-cards 45/45, document-rtl 53/53, callcenter 508/508, settlement-change 337/337, settlement-approval 42/42, idoc-inspector 127/127.

**How the remaining sweep items are covered:**
- **Collection `daySpan` under RTL:** it is a grid cell, isolated whole by 383's base `<bdi>`. Its text is checked by `four-filters-drive`, and RTL order for a cell range is proven by 383's slot check.
- **The settlement `formatDateTime` sites:** they sit in English sentences, where an FSI isolate cannot be told apart from bare text. Their isolation is structural (`fsi` at each interpolation).

**Outstanding, not this ticket's:**
- A human eye on real Arabic copy, which does not exist yet.
- The grid-cell interpolations that HITL-383 deferred. They are left unowned: Boundaries say "Grid cells are 383's", and the fix needs `<Trans>` slots. See HITL-384.

**Pre-existing drive failures, the same on HEAD:**
- four-filters: 3 landing-date checks;
- collection: 2 landing-date checks;
- settlement: flaky, with a different set each run.
