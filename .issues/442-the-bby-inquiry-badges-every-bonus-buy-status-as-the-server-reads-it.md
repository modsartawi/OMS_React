---
status: done
spec: 441
blocked-by: —
---

# 442 — The BBY Inquiry badges every bonus buy status as the server reads it

## What to build

Every place the BBY Inquiry shows a **BBY status** reads it as SAP's code, the same way Bonus Buy
Maintenance does:

| Code | Reads as | Severity |
|---|---|---|
| blank (present empty, or SAP space-padded) | **Activated** | `ok` |
| `1` | **Planned** | `warn` |
| `3` | **Tested** | `go` |
| `2` | **Deactivated** | neutral |
| `null` / missing / any other code | **Unknown**, with the raw code beside it (isolated with `Ltr`) | neutral |

- **Prefactor first:** Maintenance's pure status reading (code → `activated | planned | tested |
  deactivated | unknown`, and reading → severity) moves from the maintenance feature up to the shared
  bonus-buy core. Maintenance imports it from there, with no behaviour change: its existing overview
  tests stay green unchanged.
- The core status badge reads through it and **always renders**. Blank is Activated, no longer
  "nothing".
- The badge appears in three places: the grid's Status column, the pinned identity cell and the
  Details modal. Because the modal is shared, it is also fixed on the Simulation screen.
- The retired `A`/`I`/`D`/`X` status code set, its labels and its severity map are deleted. The
  other code sets (link, condTarget, …) are untouched.
- The inquiry row model's comments describe SAP's codes and the blank-status `isActive` (BackOffice
  2384).
- The Status column's own grid filter (if it has one) filters by the readable label.
- When done, remove the ⚠️ note under **BBY status** in `CONTEXT.md` that says the inquiry still
  badges the old codes.

## Spine reach

model (comments) · core logic (status reading, moved) · component (badge, column, identity cell,
modal) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `bbyStatusReading` (as `readBbyStatus` + `bbyStatusSeverity` in `src/core/bonus-buy/status.test.ts`) — blank, space-padded blank, `1`, `2`, `3`, `null`, `undefined`, `'Z'` each
  map to the reading and severity in the table · pure (vitest)
- [x] Maintenance's existing `overview.test.ts` passes against the moved module, with no assertion
  changes · pure (vitest)
- [x] `tools/bby-inquiry-drive.mjs` — stubbed `Bby/List` + `Bby/Detail` rows with blank/`1`/`2`/`3`/`Z`:
  each badge reads Activated / Planned / Deactivated / Tested / Unknown (with `Z`) in the grid, the
  pinned cell and the Details modal. The raw-CSV check moves from `A` to a blank status cell. ~~Under
  `ar`, the labels render translated~~ (not possible: no ar `bonus-buy-inquiry` namespace exists, see
  Comments) · flow (Playwright, manual-run)
- [x] `tools/sim-bby-gate-drive.mjs` re-run green (the shared modal) · flow

Plus `npm run typecheck`, `npm run lint`, `npm test`.

## Boundaries

- No server change (`Bby/List` already sends SAP's codes since BackOffice 2384).
- i18n: status labels keyed by reading (`activated` / `planned` / `tested` / `deactivated` /
  `unknown`) in the `bonus-buy-inquiry` namespace, en + ar. The old `status.A/I/D/X` keys are removed.
  The core modal must not read Maintenance's namespace, so the five labels are a deliberate duplicate
  of Maintenance's.
- `bidi`: the Unknown raw code is a machine value, so `Ltr` goes around it in JSX and never inside a
  grid `valueFormatter`.
- CSV export stays raw (spec 441, Out of Scope).

## Done when

Every bonus buy on the inquiry, in its Details modal, and in that modal on Simulation, shows its
status as the table reads it. The proofs above are green.

## Blocked by

None — can start immediately.

## Comments

**Done 2026-10-08.**

- **Shared status reading:** `readBbyStatus` / `bbyStatusSeverity` / `compareBbyStatus` live in
  `@/core/bonus-buy/status`. Maintenance's `overview.ts` keeps `overviewStatus` / `overviewSeverity` /
  `OverviewStatus` as aliases, so its tests pass unchanged, as the ticket asked.
- **Badge:** `BbyStatusBadge` takes only `code` and resolves its own label. Unknown shows the raw code
  through a `<Trans>` slot (`status.unknownCode`, `Ltr`) inside one inline span. The badge is
  `inline-flex`, so a bare label + isolate collapsed into "UnknownZ".
- **Beyond the ticket's words:**
  - The Details modal's "Active now" marker keyed on `'A'` and could never fire again. It now reads
    blank as Activated (`detail-view.test.ts`).
  - The Status column also sorts by reading (Activated, Tested, Planned, Deactivated, Unknown),
    instead of by code.
- **Proof:**
  - vitest: 4149 pass, plus the new `status.test.ts` / `detail-view.test.ts`.
  - typecheck, lint and build all green.
  - `bby-inquiry-drive` 89/91, all new 442 checks green. The 2 failures ("Pricing menu shows the BBY
    Inquiry leaf", "access 404 → menu leaf still shown") fail identically on unmodified HEAD.
  - `sim-bby-gate-drive` 22/22 (`DRIVE_PORT=5199`). Everything is **stubbed**.
- **ar:** `src/locales/ar/` has no `bonus-buy-inquiry.json` (the namespace is en-only, and ar falls
  back to en), so the ar labels and the ar drive check could not be done. Creating the ar namespace
  is a follow-up for whoever owns the Arabic rollout.
- **Status column filter:** the label `filterValueGetter` is not drive-proven. An Unknown row filters
  as "Unknown" without its code.
- **Reviews:**
  - `/code-review`: nothing blocking.
  - Standards: no hard violations.
  - Spec: no blocking findings.
  - Not taken, by ticket or scope:
    - Maintenance still renders its own badge copies and labels, so for an unknown code it shows a
      bare "Unknown". Unifying it onto `BbyStatusBadge` would be a follow-up.
    - The aliases stay.
    - The CSV stays raw, so null and blank both export empty.
    - The `codeText` duplicate between columns.tsx and DetailModal predates this ticket.
- `CONTEXT.md`: the ⚠️ under **BBY status** is removed. **Active / current** is marked as half-built
  until 443.
