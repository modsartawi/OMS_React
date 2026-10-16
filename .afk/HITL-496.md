# HITL — ticket 496 (Pick support: find a delivery, show its diagnosis)

## Q: How does a row of the pick list (or a STUCK hold) open its diagnosis?
**Decision taken:** It writes `?delivery={no}` beside the `?key=` (URL state, replace), and the shared diagnosis is drawn under the list. The list stays visible, with the opened row marked "Shown below".
**Why:** Re-resolving the delivery number as a new `?key=` could match more than one kind and land back on a list. Keeping the key keeps the case shareable as one link.
**Revisit if:** The owner prefers the brief's other option (a drawer), or wants Back to step from the diagnosis back to the bare list. Today it is a replace, so Back leaves the screen.

## Q: Timestamps are "shown as sent". Is the ISO `T` kept?
**Decision taken:** Yes, verbatim (`2026-10-02T14:03:11`). There is no reformatting at all, only the floor → "—".
**Why:** Rule 6 and the ticket's Proof say "shown as sent, never converted". Swapping the `T` for a space would be a client-side format the brief never asked for.
**Revisit if:** Support finds the `T` hard to read. A string-only `T`→space swap would still involve no conversion.

## Q: Where does the Pick support menu leaf sit in the OMS group?
**Decision taken:** Just before Delivery statistics. Ticket 484 pinned statistics as the last leaf, and a test asserts that.
**Why:** It leaves 484's shipped ordering and its test untouched.
**Revisit if:** The owner wants Pick support last, or next to the donor screens.

## Q: Does the feature folder get an `api.ts`, as the feature-structure checklist asks?
**Decision taken:** No. The two door calls live in `src/core/pick-support/api.ts`, as the wave layout directs, because Document Details (499) reads the same diagnosis. The page imports them from core.
**Why:** An empty or re-exporting `api.ts` would be a barrel with nothing in it. The `core/attachments` precedent has its api in core too.
**Revisit if:** 498 wants the StuckNow call feature-local. It is page-only, so it could go in `features/oms/pick-support/api.ts`.

## Q: Is a "tab strip" drawn with only one tab (Search)?
**Decision taken:** Yes. A one-tab `tablist` with Search selected, so that 498 adds "Stuck now" without restructuring the page.
**Why:** The wave layout says 496 builds the tabs and later slices extend them.
**Revisit if:** A single tab looks odd before 498 lands.

## Q: Does the UNKNOWN escalate card repeat the refusal block that section 2 also draws?
**Decision taken:** No. Under UNKNOWN the `refusalText` is drawn inside the escalate card (the brief's §1 UNKNOWN bullet) and section 2 is not drawn separately. At the other verdicts, section 2 draws it on its own.
**Why:** It avoids showing the same sentence twice. The brief puts it in the UNKNOWN state.
**Revisit if:** The owner wants section 2 present at every verdict.

## Q: Store history's "which document (delivery or order)": is it labelled?
**Decision taken:** It shows the `actionType` code (`DCST`/`DPOL`/`OCST`/`OPOL`) and the `documentNo` as sent. There is no client-made "Delivery"/"Order" label.
**Why:** Rule 1: the client derives no domain wording. The code and the number already say which one moved.
**Revisit if:** Support asks for a label. Then it would be a UI chip keyed on the action code's first letter.

## Q: The verdict card's "Unknown — escalate" adds a hint sentence. Is that domain wording?
**Decision taken:** Cut to the next step only: "Copy the diagnosis and escalate it." The standards review read the earlier "no known shape explains this delivery" as a reason, so that part was removed. The reasons stay the server's (`refusalText`, `copy`).
**Why:** The brief allows "Unknown — escalate" as UI wording. The hint only tells support what to do next.
**Revisit if:** The owner wants only the label, with no hint.

## Q: Is a refusal's sentence `errors[0].errorMessage` or the envelope's `message`?
**Decision taken:** `errors[0].errorMessage`, falling back to `apiErrorMessage` (which is the envelope's `message`).
**Why:** The brief says to show `errors[0].errorMessage` with `errors[0].errorCode`, and the two are identical in its example.
**Revisit if:** `errors[0].errorMessage` should become the general display rule. Then the reading belongs in `@/core/api`.

## Q: CONTEXT.md vocabulary
**Decision taken:** No glossary terms were added. The standards review notes that CONTEXT.md's **Verdict** (ten client-worded codes) clashes with Pick support's server-worded `HEALTHY | STUCK | UNKNOWN`, and that "stuck" is listed under Avoid for the sync queue.
**Why:** Glossary changes are `/domain-modeling`'s job, not a build slice's.
**Revisit if:** Before 497–499 add more vocabulary. A `/domain-modeling` pass should add Pick support, diagnosis, shape and hold, and scope "Verdict".

## Q: Is an empty `refusalText` ("") a refusal?
**Decision taken:** No. A blank or whitespace `refusalText` reads as null and draws no refusal block.
**Why:** The brief says null means nothing refuses. An empty sentence gives support nothing to match.
**Revisit if:** The server ever means something by "".

## Contract gap
None found. The models match `PickSupportModels.cs`, `PickDocumentModel.cs` and `DonorRequestModels.cs` field for field.
