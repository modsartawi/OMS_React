---
status: open
spec: 249
blocked-by: 259
---

# 260 — Both documents print correctly on real paper

## What to build

Nothing. **This is the wave's closing gate**, and it is a ticket rather than a Proof box because both
facsimile sign-offs explicitly deferred it and split across two tickets it would evaporate.

⚠ **No assertion can close this.** Everything else in the wave is verified in a headless browser
against a fixture. These two questions are **hardware**, and
[241](241-what-a-browser-can-print-a-paper-form-with.md) named them at charting time as the ones that
must meet a printer:

1. **The browser header/footer stamp.** No script or CSS turns it off — it is injected *outside* the
   document. The only lever is `@page { margin: 0 }`: no margin box, nothing to stamp into. ⚠ **A user
   who re-enables margins in the print dialog gets the stamp back**, so what needs verifying is the
   default experience on the users' actual machines, not the CSS.
2. **The background fills.** Chrome and Edge **never** print a `<body>` background, even with
   `print-color-adjust: exact` — it applies to descendants only. Every grey cell fill and rule must
   land on a descendant. A missing fill is invisible on screen and obvious on paper.

**Both must be checked on real Chrome *and* real Edge** — they are different print stacks, and the
users have both.

**What to actually do:**

- Print the **receipt**: single-page and a **multi-shift** one, on A4.
- Print the **ACR**: all four paging scenarios — 47 rows (3 pages), 25, ⚠ **23 (one row alone on the
  last page beneath the whole summary block)**, and 0 (the idle ACR).
- Put each printed sheet **beside its WPF original** and confirm every mark is present, positioned,
  flowed and coloured.
- Check the outer frame survived: ⚠ the WPF's 24px page padding is ≈6.35mm, **below the ~10mm many
  lasers leave unprintable**. [246](246-the-receipt-side-by-side-with-the-paper.md) kept it
  deliberately — matching WPF is what makes the two sheets identical — but whether the frame clips is
  precisely what only paper can answer.

**The standard is fidelity, not millimetres.** Both printers already shrink-to-fit at ≈0.956, and the
paper original itself prints at ~96%. ⚠ **Do not chase 100% scale**; "exactly" here means every mark
correct, not a millimetre match.

## Spine reach

none — verification only.

## Proof (→ `tdd` red-green cycles)

- [ ] **Chrome, receipt** — single-page and multi-shift, no header/footer stamp at default settings,
      every fill present, frame not clipped · manual
- [ ] **Edge, receipt** — the same · manual
- [ ] **Chrome, ACR** — all four paging scenarios; the header repeats on every page, the `م` sequence
      runs unbroken, the summary lands on the last page only and where the paper puts it · manual
- [ ] **Edge, ACR** — the same · manual
- [ ] **Side by side with the WPF originals**, both documents, signed off by the user · manual
- [ ] Scans or photographs of the printed sheets attached under `.issues/assets/` · manual

## Boundaries

- Needs a **real printer, real paper, real Chrome and real Edge** on a users' machine, plus the WPF
  client to print the originals from.
- No code expected. ⚠ If code *is* needed, it is a finding: fix it here and record what changed, since
  a CSS change discovered on paper is exactly the class of defect this gate exists to catch.
- **Blocks wave completion.** The screens can ship without it; the documents cannot be called done.

## Done when

Both documents print correctly from both browsers across every scenario, match their WPF originals
side by side, and the user signs off — or a defect is found, fixed, and re-printed.

## Blocked by

[259](259-the-screens-call-the-real-door.md) — print the real thing, not a fixture. A fixture would
prove the CSS but not that a real receipt's data fits the boxes.

## Open questions

- **Failure here is the documented trigger for the PDF effort** — not a reason to patch around it. If
  Chrome and Edge visibly disagree, or the stamp proves unsuppressible on the users' machines,
  [241](241-what-a-browser-can-print-a-paper-form-with.md) says: open a separate effort and take
  **headless Chromium over QuestPDF** — same HTML, no licence, zero drift. Record which trigger fired.
- **The logo is still unresolved** and will be visible on every sheet printed here — the paper original
  prints **DMSCO**, the WPF prints al-dawaa, and the pad's *horizontal* lockup exists in neither repo
  ([251](251-a-collection-receipt-prints-as-one-a4-sheet.md),
  [252](252-an-acr-form-prints-across-its-pages.md), BackOffice 1088). ⚠ Do not let this gate block on
  it, and do not let it pass unmentioned: note on the sign-off which mark was printed.
