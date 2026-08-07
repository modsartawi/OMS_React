---
status: done
spec: 249
blocked-by: —
---

# 251 — A collection receipt prints as one A4 sheet

## What to build

**🔑 Slice 0 — the tracer bullet.** It retires the wave's biggest genuine unknown: *does an Arabic
paper facsimile survive as production code?* The prototype proved the marks and the CSS in a
prototype context — inline styles standing in for XAML setters, a hard-coded model, no i18n, no
tests, and a lint gate it was excused from. This ticket proves the same sheet under the real build,
the real router, and the real lint gates.

`/collection/receipt/:collectionReceiptId` renders the سند قبض on a **dedicated print route whose
entire body is the document** — no AppShell, no nav, nothing hidden behind `@media print`. Ctrl-P
produces one clean A4 sheet per model page.

**⚠ The prototype is not on main.** Ticket [246](246-the-receipt-side-by-side-with-the-paper.md)
captured it off-main per the `/prototype` skill. Recover the assets from branch
**`prototype/246-collection-voucher`** (`f0bb4bf`):

```
git show prototype/246-collection-voucher:src/features/oms/collection/__prototype__/voucher/voucher-mock.ts
git show prototype/246-collection-voucher:src/features/oms/collection/__prototype__/voucher/VariantC.tsx
# plus logo-aldawaa.png and paper-collection-receipt.jpg
```

**Recover the fixture and the assets; rewrite the component.** Variant C is the ruling on every mark,
not an implementation to promote.

**The marks, as signed off** (the full inventory is
[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md) §1–§3, §7):

- 780px fixed width, RTL flow, `font-family: Tahoma, sans-serif` (no webfont — Tahoma is a Windows
  system font with Arabic coverage and these users are on Windows Chrome/Edge), bordered outer frame.
- The bilingual company header — Arabic block, al-dawaa logo **LTR-forced so it never mirrors**,
  English block — with `س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢` and `هاتف : ٩٢٠٠٠٠٨٣٨` in Arabic-Indic digits.
  `P.O. Box …` **bold** with the rest of the block; the English address **wraps** rather than
  colliding with the logo.
- `No.` hard left and `Store.` hard right, **dropped onto the `RECEIPT VOUCHER` line** — the pad's
  placement, not the XAML's tucked-against-centre one. Underlined `RECEIPT VOUCHER`, letter-spaced
  `سـنـد قـبـض`.
- The red `خصم فائض` box on the **right**, and **always empty** — a hand-fill slot, not an output
  field.
- **No POSTED banner.** A receipt that took a number *is* posted.
- The `S.R.|H.` digit cells — grey fill, ink border, whole/minor split, **LTR island** inside the RTL
  parent so `S.R.` stays left of `H.` — for the grand total and for each of the cash and bank rows.
  `core/ui/Ltr.tsx` already exists for this. The minor cell **sizes to `minor.length`** (2 for SAR, 3
  for BHD), never to a currency lookup.
- **Dot leaders** on the fill-lines — the pad's texture, not the WPF's solid rules.
- `Receiver` and `Pharmacist` **restored** (the XAML comments them out for no stated reason).
- ISO `yyyy-MM-dd` dates and `Store. {code}` filled — this is a printed system record, so a hand-fill
  slot would be a regression.
- An empty `pharmacistName`/`pharmacistId` renders an **empty fill-line, never a `0`**.

**Print geometry** (from [241](241-what-a-browser-can-print-a-paper-form-with.md)):
`@page { size: A4; margin: 0 }`, one 210×297mm block per model page with `break-after: page`, the
document at `scale(0.956)` — WPF's own `min(1.0, (pageWidth − 48) / 780)`. **Every fill lives on a
descendant, never on `<body>`** — Chrome and Edge never print a body background even with
`print-color-adjust: exact`; ship both the unprefixed property and `-webkit-`. Keep the WPF's 24px
inner padding deliberately, even though it is below the ~10mm many lasers leave unprintable: matching
WPF is what makes the two sheets identical, and whether the frame survives is
[260](260-both-documents-print-on-real-paper.md)'s hardware question.

**A multi-page receipt is a real case, not an edge one.** The fixture carries a multi-shift receipt
stamped `0000000005-1` / `0000000005-2`, and the renderer maps one A4 block per `VoucherPage`.

The contract, from [245 §3](245-the-shape-of-a-print-ready-document.md) — it carries **no
reconciliation data at all**, and nothing on it is a number, a `Date` or a currency code:

```ts
type AmountParts = { whole: string; minor: string }

type VoucherPage = {
  noText: string; storeCode: string; collectedAtText: string
  collectorName: string; collectorId: string
  pharmacistName: string; pharmacistId: string   // '' is legal
  grand: AmountParts; cash: AmountParts; card: AmountParts
  cashWords: string; cardWords: string           // فقط … لا غير
  shiftDayName: string; shiftDayText: string
}
```

## Spine reach

fixture (model) · component · route · print stylesheet · lint-gate config · test

## Proof (→ `tdd` red-green cycles)

- [x] `tools/collection-print-drive.mjs` — a new drive: navigate `/collection/receipt/:id` against the
      fixture and assert the sheet renders with **no AppShell chrome**, one 210×297mm block per page,
      a multi-shift receipt producing **two** blocks stamped `-1` and `-2`, the `S.R.`/`H.` cells
      resolving **left-to-right** inside the RTL parent, an empty `pharmacistName` rendering an empty
      fill-line rather than `0`, and **no `خصم فائض` content and no POSTED banner anywhere in the
      DOM** · flow (Playwright)
- [x] `npm run lint` passes with the facsimile added to `check-palette.mjs`'s `COLOUR_SOURCES` —
      and **verify the exclusion is load-bearing** by removing it once and seeing the gate fire, so a
      later reader neither deletes it as noise nor widens it by precedent · flow (lint gate)
- [x] `npm run typecheck` clean against the `VoucherPage` contract types · pure

**Outstanding, and not this ticket's to close** — the paper proof is [260](260-both-documents-print-on-real-paper.md):
whether `@page { margin: 0 }` actually suppresses the browser's header/footer stamp, and whether
every grey fill and red rule survives a real laser, on real Chrome *and* real Edge. The drive gets as
close as a machine can — it prints the route to PDF and counts the sheets — but a printer is not a
headless renderer. The **logo lockup** is also still open (see below).

No unit test for the renderer, deliberately: [245 §0](245-the-shape-of-a-print-ready-document.md)
makes the client **unable** to compute any displayed value, so there is no logic to assert. A test
that reimplemented a server string to compare against it would manufacture the very drift this design
exists to prevent.

## Boundaries

- **No API.** Fixture only — every route answers a browser 403 until the backend wave lands
  ([243](243-what-the-server-already-hands-over.md)), so mocking is required, not convenient.
- **New `collection` i18n namespace** may be created here for the surrounding chrome (the error state
  in [259](259-the-screens-call-the-real-door.md)), but **the document itself is exempt** —
  see below.
- **This ticket establishes the three-rule documented exception** the facsimiles inherit:
  `i18n-zero-literal` (the Arabic *is* the form), `logical-tailwind` (the form's geometry is physical
  and mirrors nothing), and **the colour-literal gate** (`#C00000` *is* the form) via a whole-file
  entry in `COLOUR_SOURCES`. **Screen chrome around the document obeys every rule, unexceptionally.**
- The route must **not** sit inside `ProtectedLayout`'s AppShell — the body *is* the document.

## Done when

`/collection/receipt/:collectionReceiptId` renders the signed-off facsimile from the checked-in
fixture; Ctrl-P in Chrome produces one clean A4 sheet per page with no browser header/footer stamp and
every grey fill printing; the multi-shift fixture prints two correctly-stamped sheets; the drive is
green; `typecheck` and `lint` are clean.

## As built

`src/features/collection/inquiry/` — the same folder 253's four Pages live in, per its *As built*
note: `check-boundaries.mjs` classifies `features/<a>/<b>` as feature id `a/b`, so a
`features/collection/documents/` would be a **different feature** to the gate and could not import
this feature's `api.ts` when 259 wires the door.

- `voucher-fixture.ts` — `AmountParts` / `VoucherPage` / `VoucherDocument` **verbatim from 245 §3**,
  plus four scenarios keyed by the id that stands in for `:collectionReceiptId`: `posted`,
  `multishift`, `bhd`, `zero`. The prototype's `over` / `short` / `matched` scenarios died with the
  fields they bound (246 deleted every reconciliation field), and `unposted` died with 245 §6c — the
  `—` is unreachable on the web, so the drive asserts its **absence** instead, which is stronger.
  🚩 Both multi-shift pages carry BASE's amounts: every money string here is a §7.1/§7.5 **pinned
  pair**, and a second pair would put a figure on the page whose tafqeet nobody has computed.
- `CollectionVoucher.tsx` + `collection-voucher.css` — the sheet, **rewritten** from Variant C's
  rulings, not promoted: class names against a stylesheet rather than inline `CSSProperties`, the
  contract type rather than a hard-coded model.
- `ReceiptPrintPage.tsx` — chrome, and it holds **no exception**: `t()`, tokens, logical utilities.
  Renders one `CollectionVoucher` per server-paginated page and the "no longer exists" state on a
  stale link — never a blank A4 sheet.
- `print-page-rule.ts` — 🚩 `@page { size: A4; margin: 0 }` is mounted **by the route** and removed
  on unmount. It cannot live in the stylesheet: `@page` is global and an imported CSS chunk is never
  unloaded, so one visit to a receipt would print every other screen edge-to-edge for the rest of the
  session. 252 calls the same hook.
- One `COLOUR_SOURCES` entry (the CSS only — the component's single hex was in a comment and was
  reworded away, so a literal creeping into the *markup* still trips the gate). Verified
  load-bearing: removed once, the gate fires with **12 violations**, all in that file.
- Assets: `logo-aldawaa.png` into the feature; the paper scan into
  [`assets/246-paper-collection-receipt.jpg`](assets/246-paper-collection-receipt.jpg) beside 242's
  ACR original.

**Three things the build found that no amount of reading would have.**

1. 🚩 **`collectedAtText` needed an LTR island the WPF does not have.** `2026-08-06 21:14` mixes
   digits with a space, so bidi paints the halves right-to-left and the sheet printed
   `21:14 2026-08-06`. Caught by *looking at a screenshot* — the DOM order is fine. Wrapped in
   `core/ui/Ltr`; the drive now measures the painted x of both halves, because reading the text back
   cannot see it. 252's ticket already flags the ACR's negative figure as the same class of bug; this
   is a second one the fidelity inventory's list of required islands also missed.
2. **The document was being squeezed to 745.7px** before it was scaled — `.cv-doc` is a flex child of
   the A4 block and shrank to its content box, so the 0.956 scale applied on top of an already-short
   width. `flex: 0 0 auto`. The drive asserts `offsetWidth === 780` *and* the painted 745.7.
3. **A `break-after` on the last sheet printed a trailing blank page**, and `:last-child` did not
   suppress it — the sheets are not the only children of `#root` (the app's toaster renders a sibling
   `<section>`). Now `break-before` on every sheet *after* the first. Found by the built-in
   `/code-review`, which printed real PDFs; the drive now counts PDF pages so it cannot come back.

**Reviewed** — `/code-review` (which found fault 3 by printing real PDFs) and `/standards-review`,
both green on their own axes. Four notes taken and applied: the pages are keyed by **position**, not
by `noText` (a server string 245 §3 records as historically duplicated across a multi-shift
receipt's pages — the exact bug the `-1`/`-2` suffix fixes, and a keyed-by-value list collides
silently if it ever arrives unfixed); the scenarios' prototype-era `label` / `proves` fields became
**comments** (the switcher that read them off the model no longer exists, and they were shipping
prose to users); `cv-name-row` became `cv-inline-row`, since the date row is not a name; and one
stale comment about which edge the money island sits on.

Two notes deliberately **not** taken. Spec 249 Tier 2 asks the fixtures for "a negative figure for
the LTR island" — §7.1 pins the *split* of `-3.25 SAR → -3 | 25`, but **no pinned tafqeet exists for
a negative amount**, and both of the receipt's money rows carry an amount-in-words line, so the
scenario cannot be built without inventing Arabic. The receipt's cells are LTR islands by
construction, so a `-3` paints minus-left there regardless; the figure that genuinely needs the
assertion is [252](252-an-acr-form-prints-across-its-pages.md)'s variance column, which carries no
words. And story 57's "sizes to the value's own length" is implemented as `min-width` + auto growth
rather than a computed width: the floor is the WPF's own `MinWidth`, which is the fidelity mark, and
what the ruling forbids — a **currency lookup** — is absent either way.

Drive **41/41** (`tools/collection-print-drive.mjs`, which 252 EXTENDS rather than starting a third
file). `typecheck`, `lint` (all three gates, 4 documented exclusions) and `build` green; `npm test`
unchanged at 78 files / 1224 tests — no unit test for the renderer, deliberately, per §0.

## Blocked by

None — can start immediately.

## Open questions

- **The logo lockup, and it is a file rather than a decision.** The paper pad carries a *horizontal*
  al-dawaa lockup with `care for life / نهتم بالحياة`; the WPF ships the *stacked* `logo-aldawaa.png`;
  the ACR's paper original prints **DMSCO** entirely. **The horizontal asset exists in neither repo.**
  Render the stacked al-dawaa the WPF ships as the interim — as the prototype did, and as BackOffice
  ticket 1088 records for the WPF side — and raise the request with the brand side. One decision
  covering both documents ([252](252-an-acr-form-prints-across-its-pages.md) carries the same
  question). It blocks nothing structurally, but neither facsimile is truly finished until it lands.

  **Still open as built.** The stacked mark ships, marked with a 🚩 at the render site; the asset
  request is a human's to raise.

- **The print route carries no `CollectionWeb/Access` backstop**, unlike the four inquiry screens.
  Deliberate here — 251's boundary is *no API*, so the probe would be the slice's only network call,
  and `ScreenGate` renders a titled `<section>` inside a body that must be only the document. The
  real boundary is the endpoint's grant filter. **[259](259-the-screens-call-the-real-door.md)
  decides** whether a refused `Receipt/{id}` should read as the gate's sentence rather than the
  document-missing one.
