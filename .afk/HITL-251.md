# HITL — ticket 251 (a collection receipt prints as one A4 sheet)

Decisions taken unattended, and the one thing a human still owes this slice.

## OUTSTANDING (not a blocker): the logo lockup

Ticket 251 and 252 both carry this as an open question, and it is a **file**, not a decision.
The paper pad prints a *horizontal* al-dawaa lockup with `care for life / نهتم بالحياة`; the WPF
ships the *stacked* `logo-aldawaa.png`; the ACR's paper original prints **DMSCO**. The horizontal
asset exists in neither repo.

**Interim shipped:** the stacked al-dawaa the WPF ships, recovered from
`prototype/246-collection-voucher` and checked in at
`src/features/collection/inquiry/logo-aldawaa.png`, exactly as the prototype rendered it and as
BackOffice ticket 1088 records for the WPF side. Marked with a 🚩 comment at the render site.
**A human must raise the asset request with the brand side**; one decision covers both documents.
Neither facsimile is truly finished until it lands, but it blocks nothing structurally.

## OUTSTANDING (not mine): the paper proof

Ticket **260** owns it and is not in this run — real Chrome and real Edge, on actual paper: the
browser header/footer stamp actually suppressed by `@page { margin: 0 }`, and every grey fill and
red rule actually printing. No assertion can close a hardware question. The drive proves the
geometry and the `print-color-adjust` declarations under `@media print`; it cannot prove a printer.

---

## Q: Does the receipt's `التاريخ` value need an LTR island the WPF does not have?

**Decision taken:** Yes — `collectedAtText` is wrapped in `core/ui/Ltr`.

**Why:** `2026-08-06 21:14` mixes digits with a space, so the bidi algorithm treats the halves as
weak runs and the RTL paragraph paints them right-to-left. Caught by *looking at a screenshot*, not
by the DOM: the sheet printed `21:14 2026-08-06`. The runner's standing note says the fidelity
inventory's list of required LTR islands was one short and that matching the WPF is not sufficient
here — this is that one. Every other value on the sheet was already isolated (the money cells and
the two red stamps sit inside `direction: ltr` islands; `2026-08-06` alone has no space to break
on). The drive now measures the painted x of the two halves, because reading the text back cannot
see it.

**Revisit if:** the server ever changes `collectedAtText`'s shape, or 260's paper proof shows the
WPF sheet printing the flipped order and a reviewer wants the two to match bug-for-bug.

## Q: Where do the receipt's files live — `collection/inquiry/` or a new `collection/documents/`?

**Decision taken:** `src/features/collection/inquiry/`, alongside 253's four Pages.

**Why:** Not mine to decide — 253's *As built* section rules it explicitly, and empirically:
`tools/check-boundaries.mjs` classifies `features/<a>/<b>` as feature id `a/b`, so a
`features/collection/documents/` would be a **different feature** to the gate and could not import
this feature's `api.ts` when 259 wires the real door. Spec 249's "one feature, not four siblings"
points the same way.

**Revisit if:** the boundary gate's classification changes, or the two documents grow enough
surface to justify graduating shared pieces to `core/`.

## Q: Which fixture scenarios survive the graduation out of `__prototype__/`?

**Decision taken:** four — `posted`, `multishift`, `bhd`, `zero`. Dropped: `over`, `short`,
`matched`, `unposted`.

**Why:** the first three dropped ones bind `varianceText` / `matchedMarkText`, which **246's
sign-off deleted from the contract** — the `خصم فائض` box is a hand-fill slot that is always empty,
so there is nothing on the wire to scenario. `unposted` renders `NoText: '—'`, which 245 §6c calls
unreachable on the web ("a `—` on screen is a bug to chase, not a state to design for") — the drive
asserts its **absence** instead, which is the stronger statement. `multishift` is new and is the
ticket's own headline case.

**Revisit if:** the backend wave puts any reconciliation field back on `VoucherPage`.

## Q: The multi-shift fixture's two pages — different amounts per shift?

**Decision taken:** No. Both sheets carry BASE's amounts; only `noText` and `collectedAtText`
differ.

**Why:** every money string in this fixture is a §7.1/§7.5 **test-pinned pair** (a split *and* its
Arabic amount-in-words). Inventing a second pair would put a figure on the page whose tafqeet
nobody has ever computed — a fabricated datum, which is the exact thing spec 249 story 95 says the
fixture exists to rule out. What the multi-shift case is *about* is the stamp, and the stamp
differs.

**Revisit if:** `Data.Tests` pins more splits, or 260's paper proof wants two visibly different
sheets.

## Q: Should the print route stand behind `ScreenGate` (the `CollectionWeb/Access` probe)?

**Decision taken:** No. It sits behind `ProtectedLayout chromeless` (session auth) and nothing
more.

**Why:** 251's boundary is **no API** — the fixture is checked in, so there is nothing to gate and
the probe would be a network call the slice does not otherwise make. `ScreenGate` also renders a
titled `<section>` shell, which is chrome inside a body that must be *only* the document. The real
boundary is the endpoint's grant filter, which arrives with 259.

**Revisit if:** 259 decides a refused `Receipt/{id}` should render the gate's sentence rather than
the document-missing one.

## Q: Which files take the `COLOUR_SOURCES` whole-file exclusion?

**Decision taken:** exactly one — `src/features/collection/inquiry/collection-voucher.css`. The
`.tsx` takes none; its one hex was in a comment and was reworded away.

**Why:** the narrowest exclusion that is **load-bearing**. Verified by removing it once: the gate
fires with 12 violations, all in that file. Keeping the component out of the map means a colour
literal creeping into the *markup* still trips the gate. Ticket 252's ACR adds its own entries.

**Revisit if:** 252 finds a colour it cannot move into a stylesheet.

## Q: The receipt fixture and the "negative figure for the LTR island" spec 249 Tier 2 asks for?

**Decision taken:** not added to the receipt fixture. Left to 252's ACR.

**Why:** §7.1 pins the *split* of `-3.25 SAR → -3 | 25`, but **no pinned tafqeet exists for a
negative amount**, and the receipt's two money rows each carry an amount-in-words line — so a
negative receipt scenario cannot be built without inventing Arabic. The receipt's money cells are
LTR islands by construction (`direction: ltr` on the cell), so a `-3` paints minus-left there
regardless. The negative figure that genuinely needs the assertion is the ACR's variance column,
which carries no words.

**Revisit if:** `ArabicTafqeetTests` pins a negative case, or 252 finds the ACR does not cover it.

## Note for the backend wave (BackOffice 1089–1093) — read only, not edited

Nothing in `C:\Work\DMSCO\BackOffice` was touched. The fixture types in
`voucher-fixture.ts` are 245 §3 / spec 249 **verbatim** — `VoucherPage` with no reconciliation
field, no `currencyCode`, no number, no `Date`. If the door ships a different shape, the mismatch
surfaces at 259, which is the wave-joining event by design.
