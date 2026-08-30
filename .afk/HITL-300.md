# HITL — ticket 300 (codes render raw with their label as secondary text)

## Q: The BackOffice doors 1387–1393 are ALL `status: done` now, and the real C# DTO disagrees with ticket 297's guessed payload. How much of that drift does 300 fix?

**Decision taken:** Reconcile the transaction wire model against the built
`IDocInspectorDocument.cs`, limited to the fields that are wrong or absent —
`idocType` → `iDocType`, `line.batch` → `line.batchNumber`, and DELETE
`billingType` / `paymentGroupId` / `splitAmount` / `splitRatio`, which the spec's
payload outline and the shipped DTO both lack. Fields the server ships and this
screen does not render (`isHeld`, `qualifier`, `conditionBaseValue`,
`conditionRateUnit`, `isPostItem`, `isPostCondition`, `currency`, `terminalId`,
`partner`, `fiCurrency`) stay OUT — the model file's own rule is that a field
lands when something renders it, and `isHeld` is 298's.

**Why:** 300 was told to hang legend labels off the billing type and the payment
group. Neither arrives. Labelling a field that is always `undefined`, on a strip
that already prints `Group undefined · SAR 0.00 · 0%`, would ship the exact defect
this ticket exists to prevent — and `iDocType` is the key 299 groups its download
buttons by.

**Revisit if:** BackOffice adds `BillingType` / `PaymentGroupId` / the split pair
to `IDocInspectorDocument` — then the attribute strip regains three entries and
two more vocabularies get a render site.

## Q: `.NET` camelCase turns `IDocType` into `iDocType`, not `idocType`. Is that really the wire name?

**Decision taken:** Yes — `iDocType`. SIS.Api configures no naming policy, so
minimal APIs use `JsonSerializerDefaults.Web`; `JsonNamingPolicy.CamelCase` stops
lowercasing at the first uppercase run followed by a lowercase letter. The same
policy is what already gives this repo `zReportIds` for C# `ZReportIds`.

**Why:** It is the only two-leading-caps property in the whole graph, so it is the
only one that drifts — and it is the one 299 keys its downloads on.

**Revisit if:** SIS.Api ever sets an explicit naming policy, or the DTO gains a
`[JsonPropertyName]`.

## Q: Where does the WORDING of a code label come from — the locale file, or the server's `name`?

**Decision taken:** The server's `name` (the declaring C# constant's identifier),
rendered verbatim. No per-code map ships in this bundle at all. The locale file
owns the chrome and the three empty-string meanings, and nothing else.

**Why:** 300's 🔑 is "never compile a copy of them into this bundle". A locale map
keyed on every code IS that copy, one file further down, and it would be wrong the
first time a constant changes — which is the failure the route was built to end.
BackOffice 1392 designed `name` for exactly this: "a constant added today ships
today, named, without either repository being edited."

**Revisit if:** a consultant reads `HungerStationLoad` and wants prose. Then the
locale file becomes an OVERLAY over `name` — never a replacement for it, and never
the thing that decides which codes exist.

## Q: `conditionClass` and `conditionControl` are two of the nine vocabularies and 297 renders neither. Add columns?

**Decision taken:** No new columns. They ride as two small dotted marks beside the
condition type code, with their legend label in the `title` — the idiom 1381 and
297 already settled for `conditionSource`.

**Why:** The expansion table is seven columns inside a `colSpan` cell. Two more
would cost the shape the whole screen rests on, to show two near-constant letters.
The established idiom is precisely for a code that must be readable without being
a column.

**Revisit if:** a consultant filters or scans on class/control.

## Q: The label as *visible* secondary text, or in a `title`?

**Decision taken:** Visible where the code appears once per document (the IDoc type
on the rail card and the attribute strip). In a `title` where it repeats on every
row (source tag, condition source, class, control). The raw code is ALWAYS visible.

**Why:** 1381's prototype — the design authority — does exactly this, and says why:
a label beside a chip that repeats on sixty rows is a wall of text that stops being
read. 300's rule is that the label never REPLACES the code, and it never does here.

**Revisit if:** the drive shows a consultant hunting for a label they cannot find.

## Q: `/code-review` high found the rail card's replacement sub-line carries no information. What goes there instead?

**Decision taken:** Nothing. The pharmacy line is dropped and the card is type +
label, receipt, counts, badge.

**Why:** The pharmacy is the same value on every document of one transaction, so
a line of it told the three cards apart by nothing — and it is already on the
document strip, once, where it belongs. A card with four things on it is not
improved by a fifth that is constant.

**Revisit if:** a transaction is ever found whose documents span two pharmacies.

## Q: `/standards-review` flagged nine `codes.vocabulary` labels of which seven have no caller, and a `markHint` that composes a tooltip from fragments. Keep or cut?

**Decision taken:** Cut both. A code mark's tooltip is now the legend's label
alone (`title={label}`), and `provenance.tagHint` — a key whose whole value was
one interpolation — went with them.

**Why:** The label is server-supplied data, and the i18n rule says server text is
data needing no key. Nine keys of which seven were dead is the bundled legend this
ticket forbids, arriving one file further down; and `"{{vocabulary}} {{label}}"`
built a sentence out of a fragment ending in a colon, which the same rule calls
out by name. The cost is a terser tooltip on two adjacent marks whose names —
`DiscountOrSurcharge`, `Fixed` — say what they are.

**Revisit if:** a consultant hovers a class mark and cannot tell it from the
control mark beside it.

## Q: `/standards-review` found the "label or nothing" hover shape repeated in four files.

**Decision taken:** One hook, `useCodeLabel`, in `CodeValue.tsx`. Every code site
— chip, mark, filter button, document strip — reads through it. The filter bar's
button became its own component to do so, because a hook cannot be called in a
`map`.

**Why:** The rule the hook holds is the ticket's central one (*no label ⇒ no
tooltip, and never the code echoed back*), and it was written out by hand in four
places. A change to the hover story was Shotgun Surgery across four files.

## Q: `/standards-review` (spec axis) — the module's blank table promised a `conditionSource` rendering the screen does not draw.

**Decision taken:** The behaviour stands — an empty condition source draws
nothing. The table was rewritten to say so, and to list the TICKET's three blanks
(source tag, error type, disc-type code) rather than the LEGEND's three.

**Why:** An empty origin only ever appears beside a source tag, so drawing it
would put a second dimmed mark next to the tag's own *unknown* — two kinds of
nothing on one row, read as one fact told twice. The defect was the docstring
claiming otherwise, not the code.

**Revisit if:** `conditionSource` ever gets a render site away from the tag.
