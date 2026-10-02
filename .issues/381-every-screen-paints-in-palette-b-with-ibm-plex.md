---
status: done
spec: 380
blocked-by: —
---

# 381 — Every screen paints in palette B, "Navy-led", set in IBM Plex

**Slice 0 of [spec 380](380-ops-console-rebuild-spec.md), step S1 (Foundation).** Every later S1
ticket paints on these tokens, and the contrast gate proves them on day one.

## What to build

Every screen takes the new tokens and type with no call-site edits, because the token **names stay
082's**. Spec decisions **F1–F7** and **F19**.

- **Type (F1, [359](359-which-type-family-the-ops-console-uses.md), ADR 0003).** These are
  self-hosted woff2 files:
  - **IBM Plex Sans** (variable, Latin) replaces Inter;
  - **IBM Plex Mono** 400/600 becomes `--font-mono`;
  - **IBM Plex Sans Arabic** 400/500/600/700, gated by `unicode-range`, replaces Readex Pro, with
    **`size-adjust: 115%` on the four Arabic `@font-face` rules only**
    ([378](378-the-foundation-in-arabic-rtl.md) §4).

  Money stays in Plex Sans. The `tabular-nums` rule becomes a no-op, and `[data-numeric]` stays as
  a marker.
- **Palette B (F2–F5).** Every value is in [362](362-ops-console-colours-density-and-grid-look.md)
  §1 and §2 (light and dark):
  - neutrals at the navy's temperature;
  - the accent is the navy lifted (`#0F4C9C` / `#79A7EC`);
  - `--input` rises to 3:1;
  - 082's status families stay byte for byte (§3).

  The **new tokens**: `--sidebar-muted` (renamed with the rest in 385), `--gold` /
  `--gold-foreground`, `--cursor`, `--grid-head` / `--grid-head-foreground`. The `--sidebar*` → `--rail*` rename is
  **385's**, not this slice's.
- **Focus (F6).** A 2px `--ring` with a 2px offset, navy in light and **gold in dark**.
- **Radius and controls (F7).** `--radius` becomes 0.5rem (controls 6px, cards and menus 8px, dialogs
  10px). `core/ui/Button` drops `rounded-full` and keeps 28px. Global `accent-color: var(--primary)`
  ([377](377-notifications-toasts-and-dialogs-in-the-ops-console.md), handed to the foundation).
- **Dark mode is screen-only (F19, [375](375-printed-output-under-the-ops-console-tokens.md) R2).**
  - The `.dark` token block and the `dark` variant move under `@media screen`, and print gets
    `color-scheme: light`. Paper always resolves to light B from one copy of the values.
  - The contrast gate's `.dark {` match accepts indentation.
- **The contrast gate.** `check-contrast.mjs` takes 362 §7's pair changes:
  - It drops `--foreground` on the rail.
  - It adds the new pairs.
  - It adds the **negative assertion that gold on `--card` stays below 3:1 in light**.

**Reference:** palette B on the live app is commit `da08890` (362's prototype), reachable through
branch `prototype/377-overlays` or `prototype/378-rtl`. `PALETTE=navy TABLE=1 node
tools/proto-362-contrast.mjs` on that commit re-measures all 143 pairs.

## Spine reach

Tokens and fonts (global stylesheet, font assets) · `core/ui/Button` · lint gate · drive. No model,
api or i18n.

## Proof (→ `tdd` red-green cycles)

- [x] `npm run lint`: `check-contrast` passes palette B in both modes on 362 §7's pair list, and
  **fails** when gold on `--card` is set at or above 3:1 in light (prove the negative assertion by a
  temporary red run) · lint gate
- [x] `check-palette` still exempts the printed documents (voucher and ACR) unchanged · lint gate
- [x] `tools/foundation-drive.mjs` (new; S1's drive, extended by later S1 tickets): Deliveries and
  Delivery details paint B in light and dark. A painted cell's computed `font-family` resolves to
  Plex, and an Arabic string resolves to Plex Sans Arabic. A focused button shows the navy ring in
  light and the gold ring in dark. Buttons are not pills · flow (Playwright)
- [x] `collection-print-drive.mjs` gains a **dark + print** case: emulated print media on a print
  route resolves light tokens · flow (Playwright)

## Boundaries

- No new i18n keys or endpoints.
- No rail, shell or grid-param changes. Those are 382 and 385.
- The step ships to `main` only as part of S1's one merge, after the owner's live sign-off (R1, R2;
  [361](361-how-the-ops-console-reaches-main.md)).

## Done when

The whole app renders in palette B with Plex in light and dark, a dark-mode print resolves light,
and `npm run lint`, `typecheck`, `test` and `build` are green, with the contrast gate carrying 362
§7's pairs and the gold negative assertion.

## Blocked by

None — can start immediately.

## Open questions

- **First task: does React "Maximum update depth exceeded" on Deliveries reproduce on `main`?**
  [378](378-the-foundation-in-arabic-rtl.md) saw it on the 362/363 prototype base with every 378
  flag off.
  - Open `/oms/deliveries` on `main` **before** touching tokens, run a search, and read the console.
  - Record the finding under `## Comments` on this ticket.
  - Fix it here **only if this slice causes it**. Otherwise note it for the owner and move on.

## Comments

**2026-10-02 — done (AFK).** Unattended decisions are in `.afk/HITL-381.md`.

**Open question: "Maximum update depth exceeded" on `/oms/deliveries` does NOT reproduce on this base.**
Probed before any token was touched, on `473f770` (= `main`'s content), with the network stubbed at
Playwright. Light and dark were each opened and a search was run (Load → 2 rows). The console showed only
the known warnings (`No HydrateFallback`, TanStack `Duplicate Queries`). There was no React depth error
and no `pageerror`. The foundation drive re-checks for page errors on every pass after the change
(0, in light, dark and RTL). 378's sighting belongs to the 362/363 prototype base, not to `main`.
Noted for the owner; nothing to fix here.

**What landed.**
- **Fonts.** The seven Plex woff2 files are restored from `prototype/377-overlays`, and Inter and Readex
  Pro are deleted.
  - `--font-sans` is Plex Sans + Plex Sans Arabic, and `--font-mono` is Plex Mono.
  - `size-adjust: 115%` is on the four Arabic faces only.
- **Palette B** (362 §1–§2) under 082's names. The status families are byte-identical. The new tokens are
  `--sidebar-muted`, `--gold` / `--gold-foreground`, `--cursor` and `--grid-head` /
  `--grid-head-foreground`, all bridged.
- **Focus, radius and controls.** The ring is navy in light and gold in dark. `--radius` is
  `0.5rem`, Button is `rounded-md` and still `h-7`, and `accent-color` is global.
- **Dark is screen-only.** The `dark` variant and the `.dark` block sit under `@media screen`, and
  print gets `color-scheme: light`. That includes the AG Grid's own `.ag-styled-root`, which keys off
  the unscoped `data-ag-theme-mode`. `/code-review` found this.
- **Contrast gate.** It takes 362 §7's pair changes plus the light gold-on-card negative assertion,
  for 144 pairs (was 129).
  - `.dark` matches indented. `:root` stays column-0, so a nested print or `@layer` `:root` is
    never read as the light table.
  - A guard fails the gate if no `.dark` block is found.
  - `resolve()` now reports a missing token instead of crashing.
- **Shell fixes the navy `--sidebar` forced** (HITL Q1). Group-label ink is `--sidebar-muted`,
  there is a gold ring and `--sidebar-accent` rules inside the sidebar, and the link ink in
  `LoginPage` and `ua-admin/cards.ts` is `text-primary`. `CustomerRail` and the routed
  `__prototype__` asides are `bg-card-2`.
- **Grid font.** `ag-grid-theme.ts` `fontFamily` is `var(--font-sans)`. That is the one 382 line
  taken here (HITL Q2). Every other grid param and the cursor bar stay 382's.

**Proof run.**
- **Lint.** `npm run lint` is green (boundaries 714, contrast 144, palette 719 with 5 exclusions,
  unchanged). That proves the printed documents' exemption is untouched.
- **Red runs (temporary).**
  - Light `--gold` set to `#8a6d00`: the negative assertion failed, "light: --gold on --card
    4.92:1 — expected BELOW 3:1".
  - `.dark` renamed: the gate failed with "no `.dark { … }` token block found".
  - Both were restored.
- **`tools/foundation-drive.mjs`: 72/72** in light/ltr, dark/ltr, light/rtl and dark/rtl. The
  rendered face is read through CDP `CSS.getPlatformFontsForNode`, not `font-family`.
  - A cell renders in IBM Plex Sans, an Arabic cell in IBM Plex Sans Arabic, and a `font-mono` code in
    IBM Plex Mono.
  - The Arabic faces stay unfetched until Arabic renders.
  - The rings are navy and gold, and gold inside the sidebar.
  - Buttons are 6px × 28px.
  - A dark-mode Ctrl+P prints the page and the grid light.
- **`collection-print-drive.mjs` §8b.** All three 381 checks pass: dark on screen as the control, light
  B under print media, and `color-scheme: light`. The run is 154/156.
  - ⚠ The two failures are **pre-existing and unrelated**: `acr → الموافق restored…` and `acr OPEN →
    تاريخ التحصيل is BLANK`.
  - On `473f770`, `acr-header.ts:31` already records that الموافق was removed by owner ruling
    (BackOffice 2145), so those drive assertions are stale. This slice touches nothing under
    `collection/`.
- **Other gates.** `grid-theme-drive.mjs` is 36/36. `npm test` is 166 files / 3133 tests,
  `typecheck` is clean, and `build` is green. Only the seven Plex woff2 files are emitted.

**Outstanding (not this slice's proof).**
- **`tools/palette-drive.mjs` is re-baselined to B but not run.** It needs a live SIS.Api and stubs
  nothing.
- **Owner live sign-off of S1** in light, dark and RTL (R2) comes at 391.
- **Hand-rolled pill buttons outside `core/ui/Button`** (Deliveries' GridToolbar, Broadcast and the
  login page) are left to S3 and the 391 sweep (HITL Q4).
- **Dialogs are 8px until 388's recipe** (HITL).

