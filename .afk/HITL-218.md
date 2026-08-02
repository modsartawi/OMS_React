# HITL — ticket 218 (the agent's five money inputs, and nothing else editable)

Decisions taken unattended. Each is the most conservative reading of spec 209 / frozen contract
v1.0 that keeps the slice shippable; anything that needed a shape the contract does not carry is
named as a gap rather than invented.

## Q: Where does the line-rules module live — `core/` or the feature?

**Decision taken:** `src/features/nphies/authorizations/line-rules.ts`.
**Why:** the run brief's "shared status module must land in `core/`" is 212's two-axis derivation,
which two *features* render. These rules are read by one feature only (the authorization form), and
`.claude/rules/feature-structure.md` graduates code to `core/` when a second feature needs it — not
before.
**Revisit if:** a second feature ever renders an editable engine line (a till-side web screen would).

## Q: The contract states no upper bound on a deductible rate. What does the box accept?

**Decision taken:** 0–100, refused at the box, never sent.
**Why:** the field is a percentage of the line the patient carries (`DeductibleG1` … `G3`), and a
rate above 100 would ask the patient for more than the item costs. §4 gives no bound and neither
does the door today, so the cell is the only place it can be caught.
**Revisit if:** the server track's `setInsurance` validation admits a rate over 100 for a reason
nobody here knows — then this is a client-side invention and must come out.

## Q: A blank box in the deductible block — is that zero?

**Decision taken:** a refusal (`notANumber`), not zero.
**Why:** reading an empty cap as `0` would turn a cleared box into "no cover at all" without the
agent typing a digit, and the same value is what NPHIES adjudicates against.
**Revisit if:** the owner wants a clear-to-zero gesture; it should then be an explicit `0`, typed.

## Q: When exactly does the zero-cap warning fire?

**Decision taken:** whenever the agent **types** a zero into a line's Max Coverage — including over a
stored zero — and never on an untouched cell.
**Why:** the engine lands `maxCoverage: 0` on every line, so warning on the stored value would put a
warning on every row of a fresh request and train the agent past it. But "I typed 0 and nothing
happened" is exactly the silent no-op §4 says the cell must speak up about, and that case has the
stored value already at zero. The first cut treated it as `unchanged` and said nothing; the drive
caught it.
**Revisit if:** SIS.Pos ever honours `<= 0` — then the whole rule goes, cell and all.

## Q: Is the client's `Generic` rule or the projection's `selectionReasonEditable` the authority?

**Decision taken:** the server flag is the authority; the category rule (`deductibleGroupName !==
'Generic'`) is the same rule, used only when the projection omits the flag.
**Why:** §2 says the flag is `false` on Generic lines ONLY, and the server is what knows an item's
insurance category. Hard-coding the client rule as the decision would mean the browser disagreeing
with what actually reaches the payer; ignoring the category entirely would leave the picker
mis-rendered against a door that has not filled the flag in yet (which is every door today).
**Revisit if:** the two ever disagree in a real response — that is a §8 gap, not a client fix.

## Q: Blocked selection-reason codes — offered or not?

**Decision taken:** filtered out, exactly as 215's cancel dialog filters `TaskReasonCode`, **except**
a blocked code the line already holds, which is still shown.
**Why:** a blocked code is one NPHIES no longer accepts. But dropping the option the line currently
carries would silently reset the request's own value to blank on first render.
**Revisit if:** §3.8 freezes `blocked` as something other than the stringly-typed flag it is.

## Q: `setInsurance` — send the changed group, or all three?

**Decision taken:** all three, always, on every commit.
**Why:** §1.2's body is `{ g1, g2, g3 }` whole. A partial body would leave the server deciding what
the untouched groups now hold, and nine header money fields answering that question differently in
two places is the drift law 1 exists to prevent.

## Q: What are the three groups called on screen?

**Decision taken:** "Group 1 / 2 / 3", matching the contract's `g1`/`g2`/`g3` keys.
**Why:** the contract carries no display names for them, and `deductibleGroupName` is *not* the
bucket (§4: it is `InsuranceItemCategory` under a second name). Inventing "Generic / Brand /
Non-medical" as group labels would assert exactly the equivalence §4 warns against.
**Revisit if:** the owner has the till's own labels for the three pools.

## Q: A voided line's Max Coverage, Days Supply and Selection Reason?

**Decision taken:** read-only values, like its quantity.
**Why:** 217 settled that a voided line is kept, drawn struck through and **inert** — there is no
un-void verb, and re-adding the item is the way back. Editing an insurance term on a line that is
off the request would put a write in the audit trail with nothing to price.

## Q: Days supply typed as the value it already holds?

**Decision taken:** `unchanged` — no verb.
**Why:** every mutating verb re-prices and lands an audit row. An idle tab-through the grid is not
an edit, and this matches 217's quantity cell exactly.

## Q: Two tables now live on the form. How does anything address them?

**Decision taken:** both carry a `t()`-backed `aria-label` ("Request lines", "Deductible terms") and
the drive addresses them by accessible name.
**Why:** the drive's `main table tbody tr` would otherwise sweep three insurance rows in with the
request's lines. An accessible name is real for a screen reader too, which a `data-testid` is not.

## Q: SIS.Api is down and none of the three verbs exists. What is the proof?

**Decision taken:** the Playwright drive stubs the three verbs against §1.2's own bodies and answers
the whole `NphiesAuthSessionState` from a small stubbed engine that re-prices every line from the
header terms and shares a per-group cap pool across its lines.
**Why:** the run brief's instruction, and 211–217's posture. The pool is what makes "a cap
re-buckets siblings" an observable assertion rather than a comment; the re-pricing is what makes
"one rate edit re-prices the request" one.
**Revisit if:** the real engine's bucket resolution differs — the stub's arithmetic is a fiction
that exists only to move numbers the client renders, and no client code depends on it.
