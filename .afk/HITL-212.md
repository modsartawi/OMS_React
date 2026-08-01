# HITL — ticket 212 (spec 209, contract v1.0)

Decisions taken unattended while building the eligibility list. Each is the most conservative
reading of the ticket + the frozen contract + the diff 211 already landed; none invents a server
shape. Three of them are **named contract gaps** rather than choices.

## Q: The ticket says the shared status module lands "in this feature". It is already in `core/`.

**Decision taken:** taken as-is from `src/core/nphies/status.ts` — nothing moved, nothing copied.
This slice **extends** it (the `EligibilityAxisSource` parameter, the three exported value lists) so
214 still takes it unchanged.
**Why:** 211 already settled this and logged it (`.afk/HITL-211.md`), the runner's standing
instruction says the same, and `.claude/rules/feature-structure.md` forbids 214 importing a module
that lived under `features/nphies/eligibility/`.
**Revisit if:** never — 214 is what proves it.

## Q: 🚩 `NEligibility` has no `Outcome` column. What Request state does a stored row have?

**Decision taken:** a **separate entry point**, `deriveStoredEligibilityAxes`, on the same shared
module: `success:false → Failed`, otherwise `Complete`, and it defers to `deriveEligibilityAxes` if
a row ever does carry an outcome. **211's live derivation is untouched** — its no-outcome default is
still `Pending`.
**Why:** `Outcome` is read off the live FHIR bundle (`EligibilityService.cs:670`) and **never
persisted** — `Data/Eligibility/NEligibility.cs` has no such property, and the list projection
(`:1003-1032`) therefore cannot select one. So every row on this screen arrives with the field empty,
and the live reading would report the entire estate as still waiting, forever. `Success` is what
survives and is trustworthy in exactly this direction: `nEligibility.Success = true` is written on
**one** line (`:282`), after `FillResponse` ran to completion; the catch never writes it (`:293` sets
the *response*), so a row that threw keeps its default `false`.
**⚠ Corrected during review.** The first cut simply flipped the shared default from `pending` to
`complete`, on the reasoning that the branch was unreachable on the check side. **That was wrong**:
`FillResponse` sets `Outcome` only inside `if (eligibilityResponse != null)` (`:667-670`), while
`eResponse.Success = true` is unconditional after it returns (`:277`) — so a bundle carrying no
`CoverageEligibilityResponse` reaches that branch on a **live check**, and calling it `Complete`
would have published a verdict derived from `isEligible:false` for an answer the payer never gave —
the exact §5 rule the module exists to enforce. Two entry points is the honest shape: a stored row
carries less than the answer did.
**⚠ The cost, named:** a check the exchange answered `queued` is stored as `Success = true` with no
outcome, so it reads `Complete` on the list while the check result that produced it read `Pending`.
**The queued-ness is not persisted and no client can recover it** — which is also why the list's
Request filter offers only `Failed` and `Complete`. This is a contract gap: §5 should either state
the eligibility-side *stored* sources, or the re-modelled list should project a `requestState` the
client reads instead of deriving.
**Revisit if:** BackOffice's re-modelled list projects `outcome` (or a computed axis) onto the row —
then the delegation already handles it and `ELIGIBILITY_LIST_REQUEST_STATES` grows `pending` back.

## Q: The ticket names a **preauth reference** filter. The eligibility query has no such parameter.

**Decision taken:** **not built.** Four filters plus the two axes; no `preAuthRef` anywhere.
**Why:** §3.3's eligibility query string is `providerCode · payerCode · patientId · fromDate ·
toDate · showAll · page · pageSize · sort` — `preAuthRef` appears on the **authorization** line only,
and upstream `GetEligibilityResponses` has no field to match it against. An eligibility check has no
preauthorization reference because no authorization has been raised yet. Sending one would be
inventing a server shape on the exact ticket that warns against it; the filter belongs to 214.
**Revisit if:** the server track adds it to the re-modelled eligibility list — then it is one more
`put()` in `buildEligibilityListParams` and one more input.

## Q: The two status axes are filters, but §3.3's query string has no `request` / `verdict` param.

**Decision taken:** send `request=` and `verdict=` as query parameters on the **re-modelled**
endpoint, named after the axes the contract itself defines in §5, with the axis values as their
vocabulary (`failed|pending|complete`, `eligible|notInForce|notEligible`).
**Why:** the ticket's Proof requires both axes to narrow the query *independently*, and its Boundaries
name the re-modelled list as this slice's server dependency — SIS.Api owns sort, page and total here,
so it is the one endpoint in the contract with genuinely new logic to own two more predicates. The
alternative — filtering client-side — would filter one page of 50 and leave `total` describing a
different set, which is the same class of lie as the invisible window. **This is a named gap:** §3.3
should list the two parameters and their value sets.
**Revisit if:** the server track prefers different parameter names — a one-line change in
`buildEligibilityListParams`, and its test names them explicitly so the drift is loud.

## Q: `showAll` on the *eligibility* list — the contract only flags it for the authorization list.

**Decision taken:** always `true`, hard-coded, not a control.
**Why:** upstream is `if (!showAll) query = query.Where(c => c.IsEligible)`
(`EligibilityService.cs:976`) — so without it a *not eligible* check, a *not in force* one and every
failed request are invisible. §3.3 flags this trap on the auth side; it is **worse** here, because
the screen's whole subject is what the payer said and one of its filters is the verdict itself. A
verdict filter over a set the refusals had already been removed from would return nothing and look
like good news.
**Revisit if:** never on this screen.

## Q: What `sort` token does "newest first" send?

**Decision taken:** **none** — the parameter is not sent at all.
**Why:** §3.3 lists `&sort` but names no vocabulary for its value, this slice ships no sort control,
and "newest first" is the re-modelled endpoint's own stated default (upstream already orders
`OrderByDescending(RowIndex)`). Inventing a token would be inventing a server shape for no
behaviour. The test asserts the absence, so the day a sort control lands the omission is deliberate
rather than forgotten.
**Revisit if:** 214 or a later slice adds a sortable column — then the vocabulary has to be agreed
with the server track first.

## Q: 🚩 A removed chip sends no `fromDate`. Upstream defaults a null one to three days ago.

**Decision taken:** send nothing, and **name the hazard here and in the ticket** rather than
compensating for it client-side (e.g. by sending `fromDate=1900-01-01`).
**Why:** "removing the chip drops the window rather than substituting a wider one" is the ticket's
own Proof bullet, and a sentinel date *is* a substituted window. But `EligibilityService.cs:985`
defaults a null `fromDate` to `Now.AddDays(-3)`, so a re-model that passed the client's absent
parameter straight through would give a removed chip a window **four times narrower** than the one it
removed — the exact "that's everything" lie this ticket exists to remove, inverted. **SIS.Api owns
this**: the re-modelled read must treat an absent `fromDate` as *no lower bound*, not fall through to
the upstream default.
**Revisit if:** the server track cannot avoid the upstream default — then the client needs an
explicit "everything" bound and the contract needs to say what it is.

## Q: The default window — is "last 7 days" `today-6` or `today-7`?

**Decision taken:** `today - 6` … `today`, inclusive — **seven calendar dates**.
**Why:** the first cut used `-7` to match the service's own `AddDays(-3)` idiom, which with an
inclusive `toDate` is eight dates. Caught in review: **the chip says the number out loud**, so an
eight-day span under the words "Last 7 days" is a small version of the very lie this ticket exists to
remove. The ticket's words win over the other side's idiom. `list-params.test.ts` now asserts the
span arithmetically rather than restating the constant, and the drive has a row on the far edge that
disappears if the window shortens by a day.
**Revisit if:** never; the test would catch a regression.

## Q: Which Request values does the list's filter offer?

**Decision taken:** two — `Failed` and `Complete` (`ELIGIBILITY_LIST_REQUEST_STATES`).
`REQUEST_STATES` (all four) stays exported for 214, where the cancel act exists.
**Why:** `Cancelled` because 211 established an eligibility check is never one — no cancel act, no
field. **`Pending` because it is unreachable on a stored row**, per the outcome-column finding above;
this was caught in review, the first cut offered it. A filter option that can never match is worse
than no option: it reads as *"there are none this week"* and sends the agent to widen a window that
cannot help.
**Revisit if:** the re-modelled row projects an outcome — then `pending` becomes reachable and goes
back in the list.

## Q: The chip is rendered from the applied window. What does it say once that window is widened?

**Decision taken:** two strings. `list.window.chipDefault` ("Last 7 days · from → to") only while
`isDefaultWindow(window, today)`; otherwise the plain `from → to`.
**Why:** caught in review. The first cut hard-coded "Last 7 days" and rendered it over whatever
window was in force, so widening From to 2020-01-01 produced **"Last 7 days · 2020-01-01 →
2026-08-02"** — a six-year result set labelled as a week, with the chip itself telling the lie it was
built to prevent. Also fixed there: `openEnd` read "today" for an *unbounded* upper edge; it now
reads "no end date".
**Revisit if:** a named-preset control lands (a "last 30 days" chip), which would want a small map
rather than two keys.

## Q: With `keepPreviousData`, what does the chip describe while the next read is in flight?

**Decision taken:** the criteria **travel with the answer** — the query function returns
`{ criteria, page }`, and the chip, the total, the empty-state hint and the pager all read the
settled result rather than the requested one.
**Why:** caught in review. `criteria` advances the instant the agent clicks while `list.data` is
still the previous query's rows, so for the whole fetch the screen read **"No date window — showing
every check on record"** above the four rows the window was still hiding, and "Page 2 of 2" above
page 1's rows. Both are the "that's everything" confusion this ticket exists to remove, produced by
the screen itself. Pairing them means everything the agent reads describes one read.
**Revisit if:** never — this is the correct idiom for a paged list with placeholder data.

## Q: The envelope echoes `page` and `pageSize`. Use them, or the client's own?

**Decision taken:** the server's. The footer's page number is `data.page` and its page count is
computed with `data.pageSize`; the pager also stays mounted whenever `page > 1`.
**Why:** caught in review. A server that clamps an out-of-range page would have rendered page 1's
rows under "Page 5 of 2", and one that capped `pageSize` to 25 would have left the tail of a 64-row
result unreachable behind a **disabled Next** while the footer insisted there were only two pages.
The envelope carries the truth (§3.3) and a screen that ignores it is guessing. The always-mounted
Previous is the escape hatch for a refetch that shrinks the total under an agent standing on a page
that no longer exists.
**Revisit if:** never.

## Q: Where does the message column go, given §5's dual-meaning trap?

**Decision taken:** a column headed **"Could not reach the payer"**, whose value is empty unless
`showsFailureMessage(request)` — so a `Complete` row's cell is blank however much `errorMessage`
holds.
**Why:** §5 forbids rendering the field on `Complete` at all and requires a *failure* label on
`Failed`/`Pending`. A column headed "Message" would re-conflate exactly what the two axes exist to
keep apart. Putting the rule in the `valueGetter` rather than the renderer means a future CSV export
inherits it.
**Revisit if:** the contract gives `Pending` its own label (211 logged the same question).

## Q: Which nav leaf owns the `/nphies` active prefix now that there are two?

**Decision taken:** the **list** leaf carries `activePrefix: '/nphies'`; the check leaf drops its
prefix and matches its own exact route.
**Why:** the list is the area's landing screen, and 213's and 216's detail routes should highlight it
rather than each needing their own entry. `isActive` is exact-or-deeper with no exact-only option, so
`/nphies/eligibility/new` co-highlights both leaves — cosmetic, and the group is expanded either way.
**Revisit if:** the check screen moves to a route outside `/nphies/eligibility/*`, which would make
both leaves exact.

## Q: Client-side sorting and column filters on the grid?

**Decision taken:** neither. `sortable: false`, `filter: false` on every column.
**Why:** the list is server-paged, so a sort over the 50 rows of page 3 reorders a page and not a
result — the same class of lie as the invisible window, and on the same screen. Filtering is the
panel's job, where it reaches the whole set.
**Revisit if:** server-side sort lands with an agreed vocabulary.

## Q: SIS.Api is still down. How is the slice verified?

**Decision taken:** `tools/nphies-eligibility-drive.mjs` extended in place (the ticket names it),
**81/81 green** — 41 from 211 plus 40 new, against mocked `Nphies/EligibilityResponses` envelopes
whose rows carry no `outcome`, exactly as the table cannot. Rows are stamped from the real clock, not
a frozen date, so the fixture cannot fall out of the default window tomorrow. Plus `npm test` (874),
`typecheck`, `lint` and `build`.
**Why:** the wave's standing instruction. The stub filters and pages server-side so the pager and
every filter are driven rather than asserted from the query string alone.
**Revisit if:** the endpoint lands — the stub becomes a regression fixture.
