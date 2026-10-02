---
status: open
spec: 380
blocked-by: 406
---

# 407 — The call center console sits inside the rail shell, with the rail collapsed

## What to build

The first S6 slice (spec 380 **C1**; ruled in [363](363-the-rail-shell.md) "Call center" and
[379](379-does-the-call-center-customer-rail-collapse-into-a-caller-header.md) §1).

- **`/callcenter` stops being `chromeless`.** It mounts inside `AppShell` like every screen, with the
  navy rail and the 44px top bar (crumb, palette field, store chip, bell).
- **The rail is collapsed on this route by default**, but it is never forced. The per-user
  expanded/collapsed preference still applies if the agent pins it open.
- **The console fills the content area below the top bar.** Today's full-viewport sizing is reworked
  to the shell's content height, so the receipt and basket still scroll in their own columns. The
  layout stays three columns in this slice (the customer rail · centre · receipt). The rail goes in
  409.
- **The console's palette is already the core one (395)**, so no second Ctrl+K appears.
- **The print routes keep their own chromeless layout.**
- **Caret rules hold:** the `cc-phone` box still takes the caret on open (165/153). The shell's top
  bar must not steal initial focus.

## Spine reach

route (`app/router.tsx`: the console moves under the shell) · component (console height under the
shell) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/callcenter-shell-drive.mjs`: light, dark and RTL at 1280 and 1440; the rail, top bar and store chip are present on `/callcenter`; the rail starts collapsed; the caret lands on `cc-phone` on open; the receipt and basket scroll independently with no page scroll; Ctrl+K opens the core palette once · flow (Playwright)
- [ ] The existing `tools/callcenter-drive.mjs` still passes · flow (Playwright)

## Boundaries

- **No new endpoint and no new i18n namespace.** The crumb label for the console comes from
  `menu-model`.
- 🚩 **Behaviour change.** The console gains the shell, so **an operator lead from the call center
  team must accept it at S6 sign-off** (R2). Bundle that acceptance with 409's caller bar.

## Done when

`/callcenter` renders inside the rail shell with the rail collapsed, the caret on `cc-phone`, and
the drive green in light, dark and RTL.

## Blocked by

- [406](406-simulations-ctrl-enter-is-a-registered-process-command.md) — S5 closes first (step order
  R1). The real dependencies are 385/386 (the shell) and 395 (the console palette joins core).
