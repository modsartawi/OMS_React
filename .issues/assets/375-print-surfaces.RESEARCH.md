# 375 — Print surfaces under the Ops Console tokens (research)

Read-only sweep of `main` (`021168d`) plus the 362 prototype worktree `C:\Playground\oms-react-362`
(`da08890`). All paths are relative to the repo root. "B" means palette B, "Navy-led"
(`.issues/362-ops-console-colours-density-and-grid-look.md` §Answer, and the prototype's
`html[data-palette='navy']` block).

## Summary

- **The app renders exactly two print documents**, the collection receipt (voucher) and the ACR. They
  are two routes, `/collection/receipt/:collectionReceiptId` and `/collection/acr/:acrId`
  (`src/app/router.tsx:82-105`). Both share one sheet primitive, `PrintSheet` with `print-sheet.css`.
- **Neither document reads a single semantic token.** Every colour on both sheets is a literal in
  three exempted stylesheets: `#fff`, `#1a1a1a`, `#8a8a8a`, `#ededf2`, `#c00000` and `#b00020`.
  The font is pinned to `Tahoma` (`print-sheet.css:67`). Neither sheet uses any `border-radius`.
  So **the steel→B swap, Plex (359), dark mode, the rail, gold and `--input` cannot reach the
  document ink.**
- **The only token-coloured print-route pixels are the chrome**, which shows only when the route is
  not drawing a document:
  - `PrintPending`, `PrintMiss` and `PrintFailure` use `text-muted-foreground`, the body's
    `text-foreground` and `--font-sans`;
  - `ProtectedLayout`'s bootstrap states use `text-muted-foreground`, plus `bg-primary` and
    `rounded-md` on Retry.
- **The other candidate surfaces render no app-styled print output:**
  - ECR slips and prescriptions are uploaded files previewed in `<img>` or `<iframe>`;
  - the retail invoice is a server-rendered PDF saved to disk;
  - central invoice and IDoc downloads, settlement and deposits have no printable document.
- **Dark mode reaches the print routes today.** `index.html:18-23` adds `.dark` to `<html>` before
  first paint on *every* document load, including the new tab a print link opens. Nothing strips it
  for print. The sheets are immune because they carry literal white and ink, and the sheet covers the
  whole page at `margin: 0`. The chrome states would print light-on-white ink (`#ecf0f3`, `#98a6b4`).
- **The repo has zero `@media print` rules and zero `print:` variants** in `src/`. What the ticket
  calls "three print sites" are the three `print-color-adjust: exact` declarations and nothing else.
- **Ad-hoc Ctrl+P of any shell screen is unowned and unstyled today.** Under B, the navy rail's
  `--sidebar-foreground` `#D3DBE8` would print as near-invisible ink on white paper. The gold
  `--sidebar-active` marker and the 3:1 `--input` edges would print too.
- **308's "A4 red-box print check"** is 312's outstanding human paper check of the voucher's red box
  (`#c00000`). It is literal-coloured and does not change under B.

## Surface inventory

| Surface | Files | Route / mount | Shell? | Colour source | Tokens used |
|---|---|---|---|---|---|
| **Collection receipt (voucher, سند قبض)** | `ReceiptPrintPage.tsx`, `CollectionVoucher.tsx` (`PrintSheet` at `:31`), `collection-voucher.css`, `print-sheet.css`, `print-page-rule.ts`, `logo-aldawaa.png` (all in `src/features/collection/inquiry/`) | Its own route `/collection/receipt/:id` (`router.tsx:82-93`). It is opened in a **new tab** by `<a target="_blank">` (`RowActions.tsx:71-80`). | No. `<ProtectedLayout chromeless />` returns a bare `<Outlet/>` (`ProtectedLayout.tsx:39`). | **Literals only.** The sheet and doc are `#fff` (`print-sheet.css:37,63`), ink `#1a1a1a` (`:64`) and frame `#8a8a8a` (`:69`). The red box, stamp and description are `#c00000` (`collection-voucher.css:88,95,121,127,145,179`). The digit cells are `#ededf2` fill with a `#1a1a1a` edge (`:235-236`). The leaders are `#8a8a8a` (`:287`) and the label ink is `#1a1a1a` (`:308`). The font is Tahoma (`print-sheet.css:67`). The logo is a raster PNG (`CollectionVoucher.tsx:25,55`). | **None.** The component has only `cv-*` classes; no `bg-`, `text-`, `font-mono` or `style=` appears in either document component. |
| **ACR form** | `AcrPrintPage.tsx`, `CollectionAcr.tsx` (`PrintSheet` at `:72`), `collection-acr.css`, `print-sheet.css`, `print-page-rule.ts`, `logo-aldawaa.png` | Its own route `/collection/acr/:acrId` (`router.tsx:94-105`). It is opened in a new tab from the ACRs grid's `Form ▸` (`RowActions.tsx:99-106`). | No. Same `chromeless` path. | **Literals only.** Rules are `#8a8a8a` (`collection-acr.css:135-136,140,145,238,251-252,261`), the head fill is `#ededf2` (`:144`) and the shortfall mark is `#b00020` (`:170`). It also takes the sheet's `#fff`, `#1a1a1a` and Tahoma. | **None.** |
| **Print-route chrome** (pending, miss and failure) | `PrintMiss.tsx` | Rendered *in place of* the sheet by both routes (`ReceiptPrintPage.tsx:63-66`, `AcrPrintPage.tsx:55-58`). It can be printed with Ctrl+P while pending (`PrintMiss.tsx:65-67`). | No. | **Tokens.** | `text-muted-foreground` (`PrintMiss.tsx:38,55,75,98,100,101`). The title ink is inherited from `body { bg-background text-foreground }` (`global.css:339-341`). The font is inherited `--font-sans` through Tailwind's `--default-font-family` (`global.css:34`). No radius. |
| **Auth bootstrap on a print route** | `ProtectedLayout.tsx:41-63` | It is always hit first on a print tab: the session store is not persisted (`src/core/session.ts:16`, `loaded: false`), so a new document probes Auth/Me. | No. | **Tokens.** | `text-muted-foreground` (`:43,53`), `bg-primary`, `text-primary-foreground` and `rounded-md` on Retry (`:57`), plus the inherited `foreground` and `--font-sans`. |
| **Toasts and confirm dialog** | `src/app/main.tsx:14-15,31` | They mount beside `RouterProvider` on every route, print routes included. 251 found the toaster to be a sibling of the sheets (`print-sheet.css:24-28`). | n/a | Sonner's own theme, fed `dark` (`main.tsx:15`). | None of ours. |
| ECR slips (spec 319) | `src/core/attachments/AttachmentsPanel.tsx:539-551`, `features/collection/inquiry/slips.ts` | A drawer inside the shell screen. | Yes. | The slip's colours are those of the uploaded file. Only the frame is ours: `border-border/60` and `rounded-lg`. | Not a print surface; the app never prints a slip. |
| Prescriptions (spec 324) | the same `AttachmentsPanel`, `oms/document/AttachmentsTab.tsx` | In the shell. | Yes. | Same as the slips. | Not a print surface. |
| Retail invoice (261) | `features/reports/retail-invoice/RetailInvoicePage.tsx:181-198`, `src/core/api.ts:307-345` (`requestBlob`, `application/pdf`) | It saves a server-rendered PDF to disk (`saveBlob`). | n/a | The server's render rail (BackOffice). | Not ours. |
| Central invoice (332/333) | `features/oms/central-invoice/*` | Shell screens. | Yes. | n/a | The feature has no print, PDF or download code (grep came back empty). |
| IDoc Inspector, settlement, deposits | `reports/idoc-inspector/DownloadStrip.tsx`; `DepositsPage.tsx:67-68` ("no printable document") | Shell screens. | Yes. | n/a | Downloads only, or nothing to print. |
| **Any shell screen, printed ad hoc** | `src/layout/AppShell.tsx:356-362` (`<aside id="layout-sidebar" … bg-sidebar text-sidebar-foreground>`) | Every `/` child route (`router.tsx:106-436`). | **Yes. The rail and header print**, because no `@media print` hides them. | Tokens. | Everything, including `--sidebar*`, `--input`, `--primary` and `--ring`. |

## Dark-mode exposure today

- **How it is applied.** The pre-paint script in `index.html:18-23` reads `localStorage['oms.darkMode']`
  and falls back to `prefers-color-scheme`. It then sets `.dark` on `<html>` and
  `data-ag-theme-mode`.
  - The store (`src/layout/theme.ts:5-8`) mirrors that class. Its toggle (`:17-29`) is reachable only
    from AppShell (`AppShell.tsx:284,338`).
  - The `.dark` token block is `global.css:202-266`, and the variant is
    `@custom-variant dark (&:is(.dark *))` (`global.css:3`).
- **Print routes get `.dark` too.** A print link opens a fresh document (`RowActions.tsx:74`), so the
  `index.html` script runs again and applies the stored choice. Not mounting AppShell does **not**
  avoid dark mode.
- **Nothing strips it for print:**
  - `src/` has no `@media print`;
  - no `color-scheme` is declared anywhere;
  - `print-color-adjust` appears only on `.print-sheet` (`print-sheet.css:43-44`), `.acr-th`
    (`collection-acr.css:148-149`) and `.cv-cell` (`collection-voucher.css:243-244`).
- **What prints in dark mode today:**
  - **The documents print correctly.** `.print-sheet` is `210mm×297mm`, `#fff`, with
    `print-color-adjust: exact` (`print-sheet.css:29-45`), on an `@page { size: A4; margin: 0 }`
    (`print-page-rule.ts:26`). The sheet covers the whole page, so the dark `body` ground
    (`#121c27`) has nowhere to show. Chrome and Edge don't print a `body` background anyway
    (`print-sheet.css:41-42`). The doc sets its own ink (`print-sheet.css:64`), so the dark
    `--foreground` does not reach it.
  - **The chrome states would not print correctly.** Pending, miss and failure, and the bootstrap
    states, take their ink from `.dark`: `--foreground #ecf0f3` and `--muted-foreground #98a6b4`
    (`global.css:205,210`). With backgrounds not printed, that is pale ink on white paper.
    (Not verified: whether a browser darkens text in economy mode. These notes did not test it.)
  - **A shell screen prints with dark-mode ink:** rail ink `--sidebar-foreground #ecf0f3`
    (`global.css:253`) and body ink `#ecf0f3`.
- **No drive covers dark mode in print.** `tools/collection-print-drive.mjs` uses
  `emulateMedia({ media: 'print' })` at `:697` and `:715` and never sets `colorScheme` or `.dark`
  (a grep for `dark` and `colorScheme` finds nothing).

## Existing print sites (there are no `@media print` or `print:` rules)

- `src/features/collection/inquiry/print-sheet.css:43-44`: `print-color-adjust: exact;
  -webkit-print-color-adjust: exact;` on `.print-sheet`, so the sheet's `#fff` ground is printed.
  Its comment: "Never on `<body>` — Chrome and Edge print no body background even with
  print-color-adjust: exact, which applies to descendants only (241)" (`:41-42`).
- `src/features/collection/inquiry/collection-acr.css:147-149`: "The grey fill must survive the
  printer." The ACR header cells' `#ededf2` is printed exactly.
- `src/features/collection/inquiry/collection-voucher.css:242-244`: the same rule for the voucher's
  `S.R. | H.` digit cells, `#ededf2`.
- Related print plumbing that is not a colour site: the route-scoped
  `@page { size: A4; margin: 0; }` injected as a `<style data-print-page="a4">` and removed on
  unmount (`print-page-rule.ts:22-29`). It is called by `ReceiptPrintPage.tsx:32` and
  `AcrPrintPage.tsx:34`. The stylesheet deliberately does not declare it (`print-sheet.css:19-22`).
- Only comments mention `@media print`: `router.tsx:80`, `ReceiptPrintPage.tsx:15` and
  `AcrPrintPage.tsx:15`. Each says the print route has "nothing hidden behind `@media print`".

## Steel → B diff, limited to tokens that a print surface uses

"Steel" means `src/app/global.css` on `main`. "B light" means the prototype's
`html[data-palette='navy']` block (`oms-react-362/src/app/global.css:441-478`).

| Token | Steel light | B light | Visible on paper? | Which surfaces |
|---|---|---|---|---|
| *(document ink, frame, fills, red marks)* | literals (see the inventory) | same literals | **No.** These are not tokens. | Voucher, ACR |
| *(document font)* | `Tahoma, sans-serif` (`print-sheet.css:67`) | unchanged | **No.** | Voucher, ACR |
| `--foreground` | `#19232e` (`global.css:94`) | `#0f1b2d` | Marginally: still near-black, now navy-tinted. | Chrome notices (title), bootstrap |
| `--muted-foreground` | `#586674` (`:99`) | `#46546a` | **Yes, slightly darker.** | `PrintMiss` hints and icons, bootstrap text |
| `--background` | `#f4f7fa` (`:93`) | `#f2f4f8` | No. The body ground is not printed. | `body` behind the chrome |
| `--primary` / `--primary-foreground` | `#2f63a6` / `#ffffff` (`:109,113`) | `#0f4c9c` / `#ffffff` | **Yes, a deeper blue**, but only with background graphics on. | Bootstrap Retry button (`ProtectedLayout.tsx:57`) |
| `--radius` → `rounded-md` | `0.625rem` → 8px (`:176,335`) | `0.5rem` → 6px | Barely. | Bootstrap Retry button only. The sheets have no radius. |
| `--font-sans` | `'Inter','Readex Pro',system-ui` (`global.css:34`) | `'IBM Plex Sans','IBM Plex Sans Arabic',system-ui` (`oms-react-362/src/app/global.css:520-523`; ADR 0003) | **Yes, a different face.** | Chrome notices and bootstrap only. The documents are pinned to Tahoma. |
| `--sidebar` / `--sidebar-foreground` | `#e9eef4` / `#19232e` (`:159-160`) | `#002554` / `#d3dbe8` | **Yes, and it is a defect.** The ground is dropped (white paper) while the ink stays `#d3dbe8`, so the rail text nearly vanishes. With background graphics on, a navy band prints. | Ad-hoc print of a shell screen only |
| `--sidebar-active` | `#2f63a6` (`:162`) | `#fdc801` gold | **Yes.** A gold marker or ink on white measures 1.56:1 (362 §2). | Ad-hoc shell print only |
| `--input` | `#cbd6e2` (`:106`) | `#8590a3` (3:1) | **Yes.** Field edges print visibly heavier; borders print regardless of background graphics. | Ad-hoc shell print only |
| `--border` / `--border-strong` / `--divider` | `#e3e9f0` / `#cbd6e2` / `#edf1f5` | `#dfe4ec` / `#c6cedb` / `#e8ecf2` | Marginally. | Ad-hoc shell print (cards, grid rules) |
| `--ring` | `#2f63a6` | `#0f4c9c` (light); dark is gold `#fdc801` | Only if a control is focused at print time. | Ad-hoc shell print |
| Status families (`--success`, `--attention`, `--danger`, `--post`, `--prescription`, `--fam-*`) | 082's | 082's, byte for byte (362 §3) | **No.** | Badges on a shell print |

**Owner sign-off list.** These are the visible changes on a *deliberate* print surface, which means
the print-route chrome only. The two documents have none.

1. `--muted-foreground` goes from `#586674` to `#46546a` on the miss, pending and failure hints and
   icons.
2. `--foreground` goes from `#19232e` to `#0f1b2d` on the chrome titles.
3. The chrome face goes from Inter to IBM Plex Sans.
4. On the bootstrap Retry button, `--primary` goes from `#2f63a6` to `#0f4c9c` and the radius from
   8px to 6px.

## The 308 "A4 red-box print check"

- Spec 308's slice table lists it: "312 | 1984 | The collection voucher's red box carries the
  accountant's description" (`.issues/308-collection-cycle-web-half-spec.md:23`).
- The open item is in `.issues/312-the-voucher-red-box-carries-the-accountants-description.md:55-56`:
  "Outstanding (not AFK's): a human eye on the printed A4 voucher's red box with a 200-character
  description, and any drive against a LIVE SIS.Api with 1984. Every check above is stubbed."
- The stubbed half did pass. Drive §6c includes "under `@media print` the three long cases stay
  inside the box and on the sheet, and the PDF is exactly **1** sheet for each" (`312…:49-50`).
- The red box is `#c00000` (`collection-voucher.css:88,95,121,127,145`). Its text box is
  `max-width: 340px` with `overflow-wrap: anywhere` (`:144-150`).
- **B does not touch it.** The check is about geometry and wrapping on paper, not tokens. Plex does
  not reach it either, because the font is Tahoma.

## Facts bearing on the three print-scope options

### (a) A `@media print` scope that re-declares the light B tokens

- **For:**
  - It covers every surface at once, including ad-hoc Ctrl+P of shell screens, which is the only
    place B visibly breaks paper (the `--sidebar-foreground` rail ink, gold, `--input`).
  - It is the one mechanism that neutralises `.dark` without touching `<html>`'s class.
  - Specificity is already worked out in the prototype: `html[data-palette=x]` (0,1,1) beats `.dark`
    (0,1,0) (`oms-react-362/src/app/global.css:335-336`). An `@media print { :root, .dark { … } }`
    block at least ties `.dark`, and source order decides the tie.
- **Against:**
  - It would be the repo's first `@media print`.
  - Re-declaring the tokens does not *hide* the rail; 362 says a print scope must also "hide the
    rail" (`362…:203`). That takes a second rule (`#layout-sidebar { display: none }` or similar).
  - A second copy of the light B values must stay in sync with `:root`. `check-contrast.mjs` and
    `check-palette.mjs` would need to know about it.
  - The two documents don't need it at all.

### (b) A print-route class on `<html>`

- **For:**
  - There is precedent for route-scoped global effects: `usePrintPageA4` already injects and
    removes a global `@page` rule per route (`print-page-rule.ts:22-29`), and the same hook could
    toggle a class.
  - The theme lives entirely in `<html>`'s class and `data-ag-theme-mode` (`index.html:20,23`;
    `theme.ts:20-22`), so the route could strip `.dark` while it is mounted.
- **Against:**
  - Pre-paint, `index.html` has already applied `.dark` before React mounts, so there would be one
    dark frame before the route's effect runs. The sheet itself is literal-white, so only the
    bootstrap and pending states flash.
  - It covers only the two print routes, not ad-hoc shell prints.
  - Stripping `.dark` would also flip Sonner's toasts out of sync: `main.tsx:15` reads the store,
    not the class.
  - On those two routes the only token consumers are the chrome states.

### (c) "Print routes never mount the shell"

- **For:**
  - This is **already true.** Both print routes are top-level siblings of the `/` subtree
    (`router.tsx:77-105`) and use `<ProtectedLayout chromeless />`, which returns `<Outlet/>`
    instead of `<AppShell/>` (`ProtectedLayout.tsx:39`). So no rail, no gold marker and no fields
    reach a printed document today.
  - The documents carry no tokens, so they need no palette pinning.
- **Against:**
  - It does nothing about `.dark`. The class arrives from `index.html` on the print tab, and the
    chrome states would print pale ink.
  - It does nothing for ad-hoc Ctrl+P of shell screens.
  - 364 hosts the Ctrl+K palette **at `ProtectedLayout`** (`.issues/364-what-the-command-palette-holds.md:105-107`),
    and the print routes mount `ProtectedLayout`. "Never mount the shell" therefore does not
    automatically keep the palette off them. The opt-out has to be explicit, for example keyed on
    `chromeless` plus a print flag, because `/callcenter` is also `chromeless` and *does* want the
    palette.

### Other facts

- The documents' immunity is enforced by `tools/check-palette.mjs`. Its `COLOUR_SOURCES` exempts
  only `print-sheet.css`, `collection-voucher.css` and `collection-acr.css`, and its comment says
  they are "theme-independent by construction: a document prints on white paper in black ink, in
  either theme" (`tools/check-palette.mjs:38-57`). The components take no exemption, so a token or
  colour that creeps into markup trips the gate.
- The only `var()` read of a token outside Tailwind utilities is `:focus-visible { outline: … var(--ring) }`
  (`global.css:348-353`). The selected-row bar `background: var(--primary)` (`:380-389`) is the
  other one. Neither appears on a print route.

## Recommendation (the 375 session, on the facts above)

**Each surface and its print scope:**

| Surface | Colour source | Recommended print scope |
|---|---|---|
| Collection receipt (voucher) | Literals + Tahoma | **None needed.** Its immunity is structural, and `check-palette.mjs` already guards it. |
| ACR form | Literals + Tahoma | **None needed.** Same as the voucher. |
| Print-route chrome (`PrintMiss`, the bootstrap states) | Tokens | **Screen-only dark** (R2). Paper always resolves to light B. |
| Any shell screen, printed with Ctrl+P | Tokens | **Screen-only dark** (R2), plus **the rail and top bar hidden on paper** (R3). |
| ECR slips, prescriptions, retail invoice, central invoice, IDoc, settlement | Not app-printed | Out of reach. Nothing to scope. |

**R1. The documents stay token-free.** A print document never reads a semantic token. It holds its own
literal ink and its own pinned face. This is already the case, and `check-palette.mjs` enforces it
by exempting only the three print stylesheets. B, Plex, dark mode, the rail, gold and the 3:1
`--input` therefore cannot reach the voucher or the ACR. **The documents need no owner sign-off for
any colour, because none of their colours change.**

**R2. Dark mode becomes screen-only, so paper always gets light B, from a single copy of the values.**

- **How:** wrap the `.dark { … }` token block in `@media screen`, and make the `dark` custom variant
  screen-only in the same way. Add `@media print { :root { color-scheme: light } }` for the
  browser's own controls.
- **Why this covers everything:**
  - The AG Grid theme reads only `var(--token)` (`ag-grid-theme.ts:50-75`), so the grid follows.
  - No component carries a `dark:` utility (grep: the only hits are comments and the store's
    `dark: boolean`), so nothing else needs editing.
  - Sonner is fed the store (`main.tsx:15`). On screen nothing changes.
- **It beats (a), re-declaring the light B tokens under `@media print`,** because (a) keeps a second
  copy of the values that the lint gates would have to track.
- **It beats (b), a print-route class on `<html>`,** because (b) flashes dark for a frame before React
  mounts, desyncs Sonner and covers only two routes.
- **It also fixes a defect that exists today.** A dark-mode user who prints a pending, miss or failure
  state today gets `#ecf0f3` / `#98a6b4` ink on white paper.
- **The build has to adjust the gate.** `check-contrast.mjs:39` finds `.dark {` only at column 0
  (`(^|\n)\.dark\s*\{`). It must also accept an indented `.dark {`, and must still report every pair
  in both modes.
- **The build has to add a drive.** `collection-print-drive.mjs` should gain a **dark + print** case:
  set `oms.darkMode=true`, emulate print, and assert that the chrome ink resolves to light B.

**R3. The shell hides itself on paper.** Put `print:hidden` on AppShell's rail
(`<aside id="layout-sidebar">`, `AppShell.tsx:356`) and on the top bar. That takes the navy band,
the pale rail ink and the gold marker off paper; 362 asked for this. The rest of an ad-hoc printed
screen is printed as it looks on screen, and nothing more is designed for it. This lands with the
rail, in the foundation merge (361 step 1).

**R4. Print routes keep not mounting the shell (option c), and opt out of Ctrl+K with an explicit
route flag.** For example, the two print routes could carry a `handle: { print: true }` that
`ProtectedLayout` reads. The flag must not be keyed on `chromeless`, because `/callcenter` is also
chromeless and keeps the palette (364).

**Owner sign-off list: the visible steel → B changes on anything printed.**

- **Print-route chrome** (shown only while the document isn't drawn):
  1. `--muted-foreground` `#586674` → `#46546a`;
  2. `--foreground` `#19232e` → `#0f1b2d`;
  3. the face, Inter → IBM Plex Sans;
  4. the bootstrap Retry button: `--primary` `#2f63a6` → `#0f4c9c`, and 8px → 6px corners.
- **An ad-hoc printed shell screen:**
  5. field edges print heavier (`--input` `#cbd6e2` → `#8590a3`);
  6. borders and dividers shift slightly;
  7. a focused control's ring prints navy `#0f4c9c`.
- **Gone from paper by R3:** the rail, its gold marker and the navy band.
- **Documents:** none.

**Not a blocker for this map.** 312's A4 red-box check (spec 308) is about geometry and wrapping on
the voucher, with literal `#c00000` and Tahoma. B does not touch it, and it stays 312's open item.
