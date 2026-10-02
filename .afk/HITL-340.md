# HITL — ticket 340 (settlement screens say Shortage, Surplus and Settlement Account)

## Q: What do the two headline figure labels read once "owed" leaves "Shortage owed"?
**Decision taken:** "Shortage" and "Surplus" — "Surplus kept back" was shortened too, so the pair match.
**Why:** The ticket says the headline "says Shortage and Surplus"; a lopsided pair would read as two different kinds of figure.
**Revisit if:** the owner wants "kept back" to stay on the surplus figure.

## Q: What replaces "this branch owes head office" beside the net figure?
**Decision taken:** "shortage — to be handed over to head office", and its twin "surplus — may be kept back by this branch" (was "this branch may keep back"). "square with head office" is unchanged.
**Why:** The sentence leads with the kind, so the reader never works out who owes whom; "hand over" / "keep back" is the wording the post dialog already uses.
**Revisit if:** finance prefers a bare "shortage" / "surplus" with no direction sentence.

## Q: How are the other "owe" sentences the sweep found reworded?
**Decision taken:** subtitle → "What a branch must hand over (shortage · عجز) or may keep back (surplus · فائض)…"; standing warning → "already carries {{total}} on an open shortage"; bulk warning → "can genuinely carry a second one"; rejected batch row → "there is nothing on it to settle"; estate figure note → "The estate's total is nobody's to settle"; rejected approval → "If the branch should still have a surplus"; empty states → "No open shortage." / "No branch has a shortage left to hand over." and "No open surplus." / "No branch has a surplus left to keep back."
**Why:** Each keeps its meaning using words already in the file ("carries", "hand over", "keep back").
**Revisit if:** any of these reads wrong to an accountant — they are copy, one line each in `src/locales/en/settlement.json`.

## Q: The bulk-upload help still prints the sheet column name "Reason". Rename it?
**Decision taken:** Left as is. The help text beside it already says "the description".
**Why:** It is the column header the server matches in the uploaded sheet — a wire name, which D13 says is not renamed, and the upload templates are out of bounds for this wave.
**Revisit if:** BackOffice renames the template column to "Description" (the web help would then follow).

## Q: Should "settlement account" in the access-denied sentence be capitalised like the title?
**Decision taken:** Left lower-case.
**Why:** It is prose, not a menu entry or title; and the existing drive tells the denied screen from the granted one by the title's absence, which a capitalised sentence would break.
**Revisit if:** the owner wants the proper name capitalised in running text too (the drive's check would need a different discriminator).

## Q: Rename the locale keys `owing` / `owed` / `position.owes` to match their new values?
**Decision taken:** No key renamed. `open-lane.ts` now carries a note that the keys are an address, not what the reader sees.
**Why:** The ticket is labels only, and `?tab=owed` is a saved address.
**Revisit if:** a later ticket wants the identifiers tidied — the old tab values must then still resolve.

## Q: CONTEXT.md has no settlement vocabulary (Shortage, Surplus, Settlement Account, Description). Add it here?
**Decision taken:** Not added in this ticket (the standards review raised it).
**Why:** The glossary has no settlement section at all; writing one is a domain-modelling job wider than a labels ticket, and theft (339) would change it again.
**Revisit if:** the owner wants D13's names recorded in the glossary — run `/domain-modeling` after 339 lands.

## Note: one drive check flaked once
`270 → a broad query is capped and says how many matched` failed on the first of four runs of `tools/settlement-drive.mjs` (it read "Showing 1 of 1 branches" 200 ms after a scope switch) and passed on the other three. It does not touch any label this ticket changed.
