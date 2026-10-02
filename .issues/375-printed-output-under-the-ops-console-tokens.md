---
type: wayfinder-ticket
wayfinder: research
map: 358
status: done
blocked-by: —
---

# 375 — Printed output under the Ops Console tokens

## Question

The palette is settled: [Ops Console colours, density and grid look](362-ops-console-colours-density-and-grid-look.md)
picked B, "Navy-led". This ticket decides how printed output stays the way it prints today.

The printed output in scope:

- A4 collection documents, such as the ACR and the voucher (`features/collection/inquiry/*Print*`);
- ECR slips;
- invoices;
- every other route that 364's palette opts out as a print route.

Under the new tokens, none of them may pick up **dark mode**, the **navy rail**, **gold** or the
**3:1 field edge**.

Find out:

- **Which print surfaces read the semantic tokens today, and which hold their own colours.** Only
  three `@media print` / `print:` sites exist, and the A4 red-box print check from spec 308 is
  still pending.
- **How print pins the light palette.** The options are a `@media print` scope that re-declares the
  light B tokens, a print-route class on `<html>`, or "print routes never mount the shell". Also
  whether `.dark` must be stripped for print.
- **Whether any printed colour changes visibly** between steel and B, for example
  `--primary` ink on a voucher. List every one so the owner can sign it off.

Output: a short research note as an asset. Each surface is listed with its colour source and the
recommended print scope.

## Answer

**The two printed documents are already safe from B. Only screen chrome needs a print scope, and
the scope is "dark is screen-only" plus "the shell hides on paper".** The findings and the
per-surface table are in [the research note](assets/375-print-surfaces.RESEARCH.md).

- **What prints.** The app renders exactly two print documents: the collection receipt (voucher) and
  the ACR, at `/collection/receipt/:id` and `/collection/acr/:id`.
  - Both are chromeless routes that never mount AppShell.
  - Every colour on them is a literal in the three stylesheets that `check-palette.mjs` exempts, and
    the face is pinned to Tahoma. B, Plex, dark mode, the rail, gold and the 3:1 `--input` cannot
    reach them.
  - ECR slips and prescriptions are uploaded files. The retail invoice is a server PDF. Central
    invoice, IDoc and settlement print nothing.
- **Facts the ticket assumed wrongly.**
  - The repo has **no** `@media print` rule and no `print:` variant. The "three sites" are three
    `print-color-adjust: exact` declarations.
  - Dark mode **does** reach the print routes: `index.html:18-23` sets `.dark` on every load, the
    print tab included. It only fails to show because the sheets are literal-white.
- **R1. Print documents never read a semantic token.** This rule exists already and is gated.
- **R2. Dark becomes screen-only.**
  - The `.dark` token block and the `dark` variant move under `@media screen`, plus
    `color-scheme: light` for print. Paper then always resolves to `:root` light B, from one copy of
    the values, and the AG Grid theme follows because it reads only `var(--token)`.
  - It fixes today's pale-ink print of the pending, miss and failure states in dark mode.
  - The gate's `.dark {` regex (`check-contrast.mjs:39`) must accept indentation.
  - A dark + print case joins `collection-print-drive.mjs`.
  - **Rejected:** re-declaring the light tokens under `@media print` (a duplicate copy of the values
    for the gates to track) and a print-route `<html>` class (it flashes dark for a frame, desyncs
    Sonner and covers only two routes).
- **R3. The shell hides itself on paper.** `print:hidden` goes on the rail `<aside>` and the top bar,
  which takes the navy band, the pale rail ink and gold off a Ctrl+P. It lands with the rail in
  foundation step 1.
- **R4. The print routes opt out of Ctrl+K through an explicit route flag** (for example
  `handle.print`), never through `chromeless`, because `/callcenter` is chromeless and keeps the
  palette.
- **Owner sign-off list.**
  - Print-route chrome: `--muted-foreground` `#586674`→`#46546a`, `--foreground`
    `#19232e`→`#0f1b2d`, Inter→Plex, and the Retry button `--primary` `#2f63a6`→`#0f4c9c` with
    8→6px corners.
  - An ad-hoc printed screen: heavier field edges (`#cbd6e2`→`#8590a3`), slight border shifts, and a
    navy focus ring.
  - **The documents: none.**
- **Not this map's blocker.** 312's A4 red-box check (spec 308) is geometry on literal `#c00000`
  and Tahoma. B does not touch it, and it stays 312's open item.
