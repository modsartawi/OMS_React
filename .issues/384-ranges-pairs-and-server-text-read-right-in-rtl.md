---
status: open
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

- [ ] `formatRange returns one string with both ends` and
  `fsi wraps the whole value once and nothing else` — pure · vitest
- [ ] `exports never contain FSI or PDI characters`: a grid-export helper's output over values that
  went through the formatting helpers has no U+2068/U+2069 — pure · vitest
- [ ] `tools/foundation-drive.mjs` (extend) under `dir="rtl"`: the call center slot chip reads
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
