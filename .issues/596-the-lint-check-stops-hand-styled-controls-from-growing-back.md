---
status: done
spec: 590
blocked-by: 594, 595
---

# 596 — The lint check stops hand-styled controls from growing back

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

The **fifth lint gate,** built from 583's inventory script.

- **What it counts:** hand-styled `<button>`, `<input>`, `<select>` and `<textarea>` per
  feature, outside `__prototype__` folders. The counts come from 583's bucket rules, tuned so the
  shared controls aren't counted.
- **A checked-in baseline:** today's count per feature, after 594/595. **No feature's count may
  rise.** An area ticket lowers its feature's baseline to its allowlist, the documented one-offs
  and pickers with a reason each.
- **Wired into `npm run lint`** beside the other four gates.
- **It must not depend on a global TypeScript 5:** the repo's TypeScript 7 has no compiler API. Use
  a parser the repo ships (pin the TypeScript 5 API as a dev dependency, or a JSX parser), and say
  which in the ticket.

## Spine reach

test (lint gate) · tooling

## Proof (→ `tdd` red-green cycles)

- [x] the gate passes on main and fails when a hand-styled `<input>` is added to a feature (shown in the ticket) · lint gate
- [x] the gate runs with no global install (fresh shell, `npm run lint`) · check

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **Tooling only.** No change to screens.

## Done when

`npm run lint` runs five gates, and the ratchet fails on a new hand-styled control.

## Blocked by

[594](594-buttons-are-pills-and-icon-buttons-and-chips-are-shared.md), [595](595-fields-share-one-input-select-textarea-and-field.md)

## Comments

**2026-10-26 — built (branch `impl/590-596`).**

- **Files.** `tools/check-controls.mjs` (the CLI, the fifth gate), `tools/control-ratchet.mjs` (the
  pure core: scan, baseline parse, check, lower), `tools/control-ratchet.test.mjs` (16 vitest tests;
  `vitest.config.ts` now also includes `tools/**/*.test.mjs`), `tools/control-baseline.txt` (the
  baseline), `package.json` `lint` (fifth `&& node tools/check-controls.mjs`), `CLAUDE.md` (five gates).
- **Parser: oxc, via `parseSync` from `vite`.** Vite 8 re-exports rolldown's oxc parser and `vite` is
  already a pinned dev dependency, so the gate adds **no** dependency. Pinning the TypeScript 5 API as
  an npm alias (`typescript5: npm:typescript@5.9.3`) was tried first and **dropped**: its package also
  declares a `tsc` bin, which replaced TypeScript 7's in `node_modules/.bin` — `npm run typecheck` ran
  tsc 5.9.3 and failed on `LeaveGuard`/`AuthorizationFormPage`. Both parsers gave the same count
  (56 features, 813 controls).
- **What counts.** Lowercase `<button>` (every 583 bucket), `<input>`, `<select>`, `<textarea>` under
  `src/features/**/*.tsx`, outside `__prototype__`. Not counted: the shared capitalised controls
  (Button/IconButton/Chip/Input/Select/Textarea/Field — 594/595), and inputs spec 590 keeps native
  (`checkbox`, `radio`, `hidden`, `file`). Links are out of scope (the ticket names the four tags).
  A file that does not parse fails the gate (it is never counted as clean).
- **The baseline** (`tools/control-baseline.txt`): one block per feature, sorted, a **blank line
  between blocks** — `<area>/<feature> <ceiling>`. Checked with `git merge-file`: three edits to
  three neighbouring blocks (two lowered, one turned into an allowlist) merge with no conflict. An
  indented line under a feature allowlists one control, `  <repo path> <tag>: <one-line reason>`
  (reason optional today; 606 can make it required). A feature with an allowlist is **swept**: its
  ceiling must equal its allowlist's length, and each (file, tag) may hold only as many controls as
  its lines name — so a swept feature fails on a NEW control even at the same total.
- **Rules.** A rise fails; a feature not in the baseline has ceiling 0; a fall is a `note:` (not a
  failure) pointing at `--lower`. `--lower [feature…]` rewrites only that feature's count line (never
  up, never deletes a block — a feature swept to nothing stays `<feature> 0`); `--list <feature>` prints
  `file:line tag (kind)`; `--init` wrote the first baseline and refuses to overwrite.
- **Baseline at the integration tip `abbdbca7`** (after the main merge: location-link + call-center
  console files included): 56 features, 813 controls; heaviest `campaigns/workspace 82`,
  `callcenter/console 69`, `collection/inquiry 67`.

**Red/green demo** (one hand-styled `<input className="h-7 rounded-md border px-2" />` added inside the
denied panel of `src/features/oms/deliveries/DeliveriesPage.tsx`, then reverted):

```
$ npm run lint            # with the input
...
oms/deliveries: 19 > 18 hand-styled controls — use the shared controls in @/core/ui; `node tools/check-controls.mjs --list oms/deliveries` lists them

control ratchet: 1 feature(s) above the baseline, 0 baseline error(s)
(exit 1)
$ npm run lint            # reverted
control ratchet: 56 features, 813 hand-styled controls, none above the baseline
(exit 0)
```

**No global install:** in a fresh PowerShell with the global npm folder removed from `PATH` (no `tsc`
resolvable) and `NODE_PATH` empty, `node tools/check-controls.mjs` → `control ratchet: 56 features,
813 hand-styled controls, none above the baseline`, exit 0; the gate has no `npm root -g` / `TS_PATH`
fallback (583's inventory still does — it is a ticket asset, untouched).

Gates: `typecheck` clean, `lint` 5/5, `npm test` 424 files / 6728 tests.

**2026-10-27 — superseded in part (code review of spec 590, S5/P1, see 606 Comments).** `--init`, `--lower`, `lowerBaseline` and `formatBaseline` are removed: since 606 every ceiling equals its allowlist, so a baseline is edited by hand. The ratchet now also scans `src/core/**` outside `core/ui` (`core/<module>` blocks).
