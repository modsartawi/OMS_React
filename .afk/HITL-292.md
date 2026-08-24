# HITL log — ticket 292 (the reason fork and the pickup address)

## Q: What control is the district "picker" — a native `<select>` or an AG Grid like Change Store's?

**Decision taken:** A native `<select>`, populated from the same cached `SdDocument/Districts` read.
**Why:** 1270's approved build target draws a `<select>` there, and spec 289 says the artifact is the
picture where it and the spec disagree. Change Store's grid exists because that flow is *searching*
for a district it has no starting value for; here the district is pre-filled and correct nearly
always, so the control only has to make a correction possible.
**Revisit if:** an operator has to scroll ~1.7k options to find a district, at which point the answer
is a filterable combobox rather than the grid.

## Q: An `<option>`'s value — `districtCode` alone?

**Decision taken:** The pair, `cityCode|districtCode`.
**Why:** the lookup carries ~1.7k rows across every city and nothing guarantees a district code is
unique across them; a colliding code would derive the wrong city, which is the one thing this control
exists to get right.
**Revisit if:** BackOffice confirms `districtCode` is globally unique, in which case the key is
noise rather than wrong.

## Q: The delivery's own district is not in the lookup (or the lookup has not arrived yet).

**Decision taken:** Prepend it as an option labelled with the delivery's `districtName`, carrying no
district object — choosing it restores the delivery's own district and city (see the /code-review
entry below, which is what made it a way back rather than a no-op).
**Why:** the alternative is a picker that silently shows nothing selected, which reads as *this
delivery has no district* on a delivery that plainly names one. Carrying no district row keeps the
panel from deriving a city out of a row the lookup does not have.
**Revisit if:** the lookup turns out to be authoritative enough that an unmatched district is itself
the error worth surfacing.

## Q: The delivery carries no district at all — what does the picker show?

**Decision taken:** A leading empty option, `returnDocument.address.districtChoose` — *Choose a
district*.
**Why:** a `<select>` with no matching value silently shows its first option, which would claim a
district the operator never chose. Neither spec writes this copy; it is the plainest thing that
states the state.
**Revisit if:** the address panel gains a required-district rule, which would make this an error
state rather than a placeholder.

## Q: Is the pickup address panel shown before a reason is chosen?

**Decision taken:** No — absent until `RTRF` is chosen, exactly as under `RF`.
**Why:** the ticket says the panel "exists only under Return and Refund", and nothing collects until
a collection has been decided on. Showing it under `null` would make the *default* look like the
collecting reason, which is the one thing D5 forbids.
**Revisit if:** operators want to see the address before committing to a reason.

## Q: Where does the gate's third sentence sit — before or after the quantity one?

**Decision taken:** Last of the three: lines → quantity → reason → summary.
**Why:** the ticket says it is "the third and last sentence the submit bar names — after 291's two",
and the reason is the sentence that should be left standing in front of an otherwise-complete form,
because it is the only one guarding an irreversible refund.
**Revisit if:** 293's fee grid or 294's submit finds a fourth sentence that belongs between them.

## Q: 291's drive asserted the summary appears once lines and quantities are valid. It now names the reason instead.

**Decision taken:** Updated those two assertions in `return-dialog-drive.mjs` rather than adding a
reason click to keep them reading as they did.
**Why:** they were transcribing the gate's terminal outcome as 291 knew it, and 291's own HITL log
recorded that 292 inserts a sentence there. The count assertion (*2 lines, not 3*) does now choose a
reason first — the count is a property of the summary, so it has to be reachable.
**Revisit if:** nothing; the ticket's own Proof names the new order.

## Q: The `city` field — editable or derived?

**Decision taken:** Derived from the district and rendered read-only.
**Why:** spec 289 D6 says city is derived "the way `change-store.ts` already does it", and a district
and city that disagree is a collection that fails. The pair only stays consistent if one of them is
not typeable.
**Revisit if:** a district's lookup city is wrong often enough that correcting it by hand is the
lesser evil.

## Q: /code-review — a cross-city district change leaves the delivery's GPS (and postcode) pointing at the old city.

**Decision taken:** Left as is. GPS is carried through from the delivery unedited; `SdDistrictModel`'s
`latitude`/`longitude` are deliberately not read.
**Why:** spec 289 D6 and the ticket's own Boundaries say it in as many words — *"GPS is carried
through from the delivery unedited. No map picker."* A district's coordinates are its centroid, not
the customer's door, so writing them in would replace a stale pin with a confidently wrong one. The
street, building and postcode beside it are the operator's to correct and are all editable.
**Revisit if:** the carrier routes on GPS rather than on the short address, in which case the answer
is the map picker 289 explicitly deferred, not a centroid.

## Q: /code-review — `submitGate` lets `RTRF` report ready with a completely blank pickup address.

**Decision taken:** Not added. The gate keeps exactly the three sentences spec 289 D3 names.
**Why:** the gate is specified as an ordered list of three, and a fourth would be a rule neither spec
carries — capture `8000000253`'s own shipping address is blank on the live wire, so an address
requirement invented here would block a real delivery on data the server may well accept. It is also
inert until 294 wires the POST.
**Revisit if:** BackOffice spec 1283 §2 states which of `CreateReturnAddress`'s fields are required
under `RTRF` — then the gate gains a fourth sentence naming the missing one, and it is 294's or 295's
to add.

## Q: /code-review — the picker's synthetic "current district" row disappeared once the district changed.

**Decision taken:** Fixed. The row is now pinned off the DELIVERY's address rather than the draft,
and choosing it restores the delivery's district *and* city.
**Why:** as written, an accidental change to a delivery whose district the lookup does not carry was
unrepairable without cancelling the dialog and losing every ticked line. The drive's fixture now
omits that district from the lookup on purpose, so the pin and the way back are both driven.

## Q: /standards-review — the En→Ar name fallback was spelled three ways, and the picker's label disagreed with what applying it wrote.

**Decision taken:** Fixed. `districtLabel` is exported from `return-order.ts` and used by both the
`<option>` label and `applyPickupDistrict`; the city half reuses `change-store.ts`'s
`districtCityName` rather than re-spelling it.
**Why:** the option label fell back to `districtCode` and the apply did not, so picking a name-less
district blanked the field the label had just shown. A test now asserts the two agree.

## Q: /standards-review — `ReturnDialog.tsx` is becoming three screens, and 293/294 add more.

**Decision taken:** Extracted `PickupAddressPanel.tsx` (props: `delivered`, `address`, `onChange`).
The districts query, the picker's rows and the field set went with it; the panel owns its own
expanded/collapsed state, the caller owns the draft.
**Why:** the draft must survive an `RF` → `RTRF` toggle (an edit is not undone by changing one's mind
twice), but *expanded* need not — so the state that can live in the panel does. Extracting now keeps
293's fee grid and note from landing in a file that already holds three regions.
**Revisit if:** 293 finds the two panels want a shared container.

## Q: /spec-review — 1270's artifact renders the address panel under a null reason; this hides it.

**Decision taken:** Kept hidden. Confirmed as a knowing divergence.
**Why:** the ticket's own sentence is explicit — *"The pickup address, which exists only under Return
and Refund"* — and the artifact is the tie-breaker on **arrangement**, not on a rule the ticket
states in words. Showing it under `null` would make the unchosen state look like the collecting one,
which is what D5 forbids.
**Revisit if:** the operator wants to check the address before committing to a reason.

## Q: /spec-review — the artifact's collapsed summary reads *King Abdulaziz Rd, Building 7420*; ours reads *King Abdulaziz Rd 7420*.

**Decision taken:** Left without the word *Building*.
**Why:** `pickupAddressSummary` is pure and owns no copy — the same D3 principle that makes the gate
return a key rather than a sentence. Adding the word means either copy in the pure module or the
component re-splitting the parts, for a cosmetic difference in a one-line summary.
**Revisit if:** the summary is ever read out of context, where a bare number beside a street is
ambiguous.

## Q: /spec-review — `districtKey` could pin a duplicate when the delivery's `cityCode` is blank or stale.

**Decision taken:** Fixed. `matchDistrict` resolves an address to its lookup row on the pair first
and on the district code alone second; the delivery row is pinned only when neither matches, and the
`<select>`'s value is the matched row's key.
**Why:** as written, a delivery carrying a real district code with a blank city drew two identical
options.

## Q: /spec-review + /standards-review — the reason cards are `role="radio"` with no arrow-key navigation.

**Decision taken:** Fixed. The group handles all four arrows, focus follows the selection, and the
group is one tab stop (the chosen card, or the first when nothing is chosen).
**Why:** a `role="radio"` that ignores an arrow key is a claim the control does not honour, and D5
calls this the screen's spine control. Driven.
