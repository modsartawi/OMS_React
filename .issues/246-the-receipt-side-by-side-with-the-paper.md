---
type: wayfinder-ticket
wayfinder: prototype
map: 240
status: done
blocked-by: 241, 242
---

# 246 — The receipt, side by side with the paper

## Question

**This is the breaker's first gate.** Build the سند قبض / RECEIPT VOUCHER as a throwaway React
facsimile and get the user's side-by-side sign-off against the WPF original.

Use `/prototype`. Hard-code a realistic voucher's values from the fidelity inventory (242) — this
prototype answers "does it look right", not "does it fetch right", so no API, no screen chrome, no
route. Style it for the print path 241 chose.

What it must reproduce, per 242:

- 780px fixed width, RTL flow, Tahoma-equivalent Arabic, the bordered outer frame.
- The bilingual company header — Arabic block, Al-Dawaa logo (LTR-forced so it never mirrors),
  English block — including the Arabic-Indic digits in `س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢` and `هاتف : ٩٢٠٠٠٠٨٣٨`.
- The red `خصم فائض` box, the red `Store.` and `No.` runs, the underlined `RECEIPT VOUCHER`,
  and the letter-spaced `سـنـد قـبـض`.
- The `S.R.|H.` digit cells — grey fill, ink border, whole and minor split, LTR island inside the
  RTL parent so `S.R.` stays left of `H.` — for the grand total and for each of the cash and
  bank rows.
- The dotted fill-lines carrying date, receiver name, the two amount-in-words, the weekday and the
  date, and the two name/employee-number blocks at the foot.
- The green `تم الترحيل — POSTED` banner in its shown state.

Then **run the comparison**: render the WPF voucher from the same values (`CollectionVoucherWindow`
in the BackOffice solution, or the paper scan `Collection Receipt.jpg`) and put the two in front of
the user — on screen *and* on paper if 241's answer makes printing the real test.

**Input from 242:** the inventory is
[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md) — build
from its §1, §2, §3 and §7. Its **§8 is this sign-off's agenda**: O1 (RTL-mirrored alignment — judge
against the paper, and confirm which side the `خصم فائض` box sits), O2 (`P.O. Box …` bold or not),
O3 (the `Receiver` / `Pharmacist` English words the XAML commented out), O4 (`مطابق` never renders
on the HQ path the web uses — dead mark, or does 245's model carry the rounding flags?).

The ticket resolves only on the user's explicit sign-off. Record in the answer: the sign-off, every
discrepancy found and whether it was fixed or accepted, and anything the exercise taught about the
print path or the model that 245 must absorb. Link the prototype.

## Answer

**Signed off — variant C, with four amendments, all applied.** *"i want the c … other things is
perfect."* Breaker gate 1 is passed for the receipt.

**The prototype:** `src/features/oms/collection/__prototype__/voucher/` — three readings on
`/prototype/collection-voucher?variant=A|B|C&state=…`, the paper scan pinned beside them, on 241's
print geometry.

**Throwaway, and captured off main** — `.claude/skills/prototype` step 6. The full variant set is
the primary source behind this sign-off and lives on branch
**`prototype/246-collection-voucher`** (`f0bb4bf`), which also carries the route entry and the
`check-palette.mjs` exclusion. Main keeps only the decision — this ticket. To look at it again:

```
git checkout prototype/246-collection-voucher
npx vite --port 5199    # → /prototype/collection-voucher?variant=C
```

The build wave **rewrites** the winner rather than promoting it: variant C was written under
prototype constraints (inline styles standing in for the XAML setters, no i18n, hard-coded model,
zero tests). What it settles is every mark's ruling, not its implementation.

### What C settled

The rule the winning variant applies, and the one a builder should carry forward: **where the WPF
departed from the paper because it knows something the blank pad could not, keep the departure;
where it departed by accident or omission, go back to the paper.** Concretely —

| | ruling |
|---|---|
| **O1** alignment | **The paper.** `No.` hard left, `Store.` hard right, both dropped to the `RECEIPT VOUCHER` line; the XAML tucks them against the centre. `خصم فائض` box on the **right**, confirmed against the scan. |
| **O2** `P.O. Box …` | **Bold**, with the rest of the English block. The XAML's lone non-bold line is a slip. |
| **O3** `Receiver` / `Pharmacist` | **Restored.** They are on the pad; the XAML comments them out for no stated reason. |
| **O4** `مطابق` | **Gone — and wider than the question asked.** See below. |
| fill-lines | **Dot leaders**, the pad's own texture, not the WPF's solid rules. |
| `Store. {code}` | **Kept over the pad's bare `PH.`** — the web always knows the store, so leaving a hand-fill slot would be a regression. |
| dates | **ISO `yyyy-MM-dd`** kept over the pad's `__/__/__` cells: this is a printed system record, nothing on it is hand-written. |

### The four amendments — and the two that reach the model

1. **No POSTED banner.** *"since it took number it's posted"* — `No.` **is** the posted state, so a
   green band restating it is chrome the paper never had. `IsPosted` leaves the print-ready model.
   An unposted receipt stays legible as one: `NoText` renders `—`.
2. **The `خصم فائض` box is ALWAYS EMPTY.** Red label, ruled box, nothing inside — a hand-fill slot,
   not an output field, exactly as the pad prints it.
3. **The English address wraps.** Held on one line it runs into the logo, which is worse than the
   extra line the WPF already lives with. C's `nowrap` reverted.
4. Everything else as built.

**⚠ Amendments 1 and 2 are the map's largest input to ticket 245, and they SHRINK the contract.**
242 §8-O4 asked whether the model must carry `CashRoundingMatched` / `CashRoundingAbsorbed` so the
green mark could fire on the HQ path. The answer is neither: the mark is gone, **and `VarianceText`
goes with it**. So the receipt's print-ready model carries **no reconciliation data at all** — no
variance, no rounding flags, no `IsPosted`. The endpoint owes strictly less than 243 assumed, and
`CashRounding.Reconcile` never needs to run on the receipt path. (It still runs per-row on the ACR,
where `MatchText` is a real output — 247 is unaffected.)

### Discrepancies found, and their disposition

| Found | Disposition |
|---|---|
| The **colour-literal lint gate** fires on the facsimile — `#C00000` *is* the form | **Fixed.** Whole-file exclusion in `tools/check-palette.mjs`, same shape of permission the brand SVG has. **This widens map 240's documented-exception list from two rules to three** (i18n-zero-literal, logical-tailwind, *and* the palette gate); the shipped facsimiles inherit it. |
| The **logo is the wrong lockup** — WPF ships the *stacked* `logo-aldawaa.png`; the pad carries the *horizontal* one with `care for life / نهتم بالحياة` | **Accepted, unresolved.** Neither repo holds the horizontal asset. Flagged rather than faked. Reappears on the ACR (247, §8-O8 is already about that logo) — sourcing the mark is one decision for both documents. |
| WPF's `*` header column **wraps `Towers.`** onto a second line, taller than the pad's header | **Accepted** — amendment 3 above chose the wrap over the collision. |
| The facsimile is **vertically denser** than the pad (which is airier throughout) | **Accepted.** A WPF-inherited trait the user passed over; the receipt occupies the top third of the sheet either way. |
| WPF's `FixedPage` margin is **24 units ≈ 6.35mm**, below the ~10mm many lasers leave unprintable — 241 had asked for ≥10mm inner padding | **Deliberately kept at 24px.** Matching WPF is what makes the two sheets identical; whether the outer frame survives the printer is a **hardware** question for the paper test, not one to pre-empt by drifting off the geometry. |

### For the print path (241's ruling, now implemented rather than described)

`@page { size: A4; margin: 0 }`, one 210×297mm block, the document at `scale(0.956)` — WPF's own
`min(1.0, (pageWidth − 48) / 780)` — every fill on a descendant, switcher and paper pane
`display:none` in print. It renders one clean sheet.

**Still owed, and it is not this ticket's to close:** 241's two gotchas are hardware questions —
the header/footer stamp and the fills — and must be verified on **real Chrome and real Edge, on
actual paper**. That belongs to the build wave's proof, alongside 247's page-break test. Nothing in
the sign-off suggests the CSS is wrong; it has simply never met a printer.
