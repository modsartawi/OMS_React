---
type: spec
status: ready
---

# 209 — Nphies on the web: eligibility checks and prior authorizations

Synthesized by `/to-spec` from wayfinder map [196](196-nphies-to-web-map.md) and its twelve
resolved tickets. Every decision below traces to one of them; where a ticket corrected an earlier
one, this spec carries the correction and not the original. The estimate is
[204](204-nphies-the-estimate.md) — **35–46 developer-days, engineering-complete, across two
teams**.

## Problem Statement

An insurance back-office or call-centre agent who needs to check whether a patient is covered, or to
get a payer's approval for a basket of medicines, must open the WPF till application to do it. That
is the wrong tool for them twice over.

It is wrong because the till is a *dispensing* device. Its Nphies screens are four modal dialogs
bolted onto a live point-of-sale basket: raising an authorization means opening a retail
transaction, and the form is built from whatever the cashier happens to have scanned. An agent who
is not standing at a till has no basket, so the screens fight them at every step — mode dropdowns
that must be set correctly, patient identity typed by hand into a form that talks to a national
exchange, a request-type combo whose wrong value silently changes what is asked, and validation that
arrives as a message box after everything else has been filled in.

It is wrong a second time because these agents work at a different tempo. A pharmacist raises an
authorization and waits at the counter for the answer. An agent raises one, moves on, and comes back
to it — sometimes days later — to see what the payer said, chase a slow one, or work out why one was
refused. The till has no good surface for that: the authorization list is dominated by dispensing
acts the agent will never press, a status is scattered across seven fields, and the reason a payer
rejected something is buried behind a dialog that opens another dialog.

The result is that work which is fundamentally back-office — check coverage, ask for approval, watch
the answer, fix a refusal — is being done through a cashier's tool, by people who do not have one in
front of them.

## Solution

Two screens on the web portal, under a new **Nphies** nav group, that do exactly the back-office half
of the job and stop cleanly where the pharmacist's half begins.

An agent runs a **check eligibility** for a patient — filling the form from that patient's last
check with one button, picking the provider they are acting for — and sees, in two plain columns,
whether an answer came back and what it said, with every policy the patient holds listed underneath.
From that check they **raise one prior authorization**: the patient, payer and policy come across
already filled and read-only, so there is nothing to mistype; they add items on an inline row that
prices in place; they record the diagnoses, attach the prescription, and submit. If the national
exchange refuses the request on validation, they stay on the form with the reasons attached to the
rows that caused them, and fix it there. If it goes through, the authorization joins a list where
they can watch it, status-check it, retry it or cancel it — and where a refused one can be reopened
and replayed into a fresh request rather than retyped.

Three things make it feel unlike the tool it replaces. **No modal opens anywhere in the flow** — the
form is one scrolling page. **Nothing is a mode** — one claim type and one request type mean both
dropdowns simply do not exist, and every rule that WPF enforced by refusing after the fact is
instead stated where it applies: a required field appears with its cause, a duplicate item is
refused at the moment it is added, an out-of-range value cannot be typed. And **no money is
calculated in the browser** — the same pricing engine that prices the till prices this basket, so
what the payer is asked is what the payer would have been asked at the counter, and the audit trail
records what the engine landed alongside whatever the agent then changed.

What the screen never does is dispense. When an authorization is approved and ready, the agent's job
is done and the pharmacist's begins, at the till, exactly as today.

## User Stories

### Getting in

1. As an insurance back-office agent, I want a **Nphies** group in the portal nav, so that the two
   screens are findable in the same place I find every other back-office screen.
2. As a portal administrator, I want the whole Nphies area gated behind **one grant**, so that
   granting an agent access is a single decision and not a matrix of read/write permissions per act.
3. As an agent without that grant, I want the nav group hidden and a direct URL to refuse cleanly,
   so that I never land on a screen whose every call will fail.
4. As a security reviewer, I want the pre-existing ungated eligibility endpoint brought under the
   same grant, so that the web's arrival closes a hole rather than inheriting it.

### Checking eligibility

5. As an agent, I want an eligibility list defaulting to the **last 7 days, newest first**, so that
   the screen opens on the work I am actually doing rather than on everything ever recorded.
6. As an agent, I want that 7-day window shown as a **removable chip**, so that I can tell the
   difference between "that's everything" and "that's everything this week" — and widen it when I
   need to.
7. As an agent, I want to filter the list by patient id, payer, provider and the two status axes, so
   that I can find one patient's check without paging through the estate's.
8. As an agent, I want the provider filter to default to **all providers**, so that I see the whole
   back-office's work rather than being pinned to one branch's, which is what a till does.
9. As an agent, I want to open a past eligibility response as its own page, so that I can link
   someone to it and it survives a refresh.
10. As an agent, I want a **new check** form, so that I can ask about a patient whose coverage I do
    not yet know.
11. As an agent, I want to type a patient id and press **Fill**, so that the form completes itself
    from that patient's last check instead of me retyping identity into a national exchange.
12. As an agent, I want Fill to work on a cold form — not only from a row I selected — so that I can
    start from the patient id I was given on the phone.
13. As an agent, I want to **pick the provider** I am acting for on every check, with no default and
    no memory of my last pick, so that I never submit under a provider I did not consciously choose.
14. As an agent, I want submit blocked until a provider is chosen, so that the block is visible on
    the form rather than arriving as a refusal from the exchange.
15. As an agent, I want only unblocked providers offered, so that I cannot pick one the exchange will
    reject.
16. As an agent, I want the result to say both **whether we got an answer** and **what they said**,
    so that "we could not ask" is never mistaken for "they said no".
17. As an agent, I want site eligibility folded into the verdict at the moment the result arrives —
    "Eligible · outside network" — so that I learn it when it is discovered, not as a surprise when I
    press a later button.
18. As an agent, I want the detail to list **every coverage** the patient holds with its member id,
    in-force flag, network, plan, class and policy holder, so that I can see which policy is worth
    raising an authorization under.
19. As an agent with a patient holding exactly one coverage, I want it selected silently, so that the
    99% case costs me no click.
20. As an agent with a patient holding two or more coverages, I want to be **made to pick one** with
    no default, so that the authorization is raised under the policy I meant.
21. As an agent, I want a lone expired coverage still auto-selected, so that the verdict column is
    what tells me it is not in force rather than an empty screen.

### Raising an authorization

22. As an agent, I want a **Raise authorization** action on an eligibility, so that the natural next
    step is where I just finished.
23. As an agent, I want that action to open a form addressed by the eligibility's id, so that I can
    raise the authorization days later from a row on the list and land in exactly the same place.
24. As an agent, I want the patient, payer, policy and provider shown as **read-only values, not
    disabled controls**, so that I can read them at a glance and cannot be confused by a greyed-out
    box holding nothing.
25. As an agent, I want the provider inherited from the eligibility and not re-pickable, so that the
    check and the authorization can never disagree about who is asking.
26. As an agent, I want to add items by typing into a row above the grid, so that building the
    request feels like building a basket and not like filling a table.
27. As an agent, I want each added line to **price in place**, showing that it is working, so that I
    know the money is being calculated rather than missing.
28. As an agent, I want a **second scan of an item already on the request refused at that moment**,
    with the quantity control named as the remedy, so that I fix it while I am looking at it rather
    than at submit.
29. As an agent, I want to change a line's quantity, so that I can ask for the right amount without
    removing and re-adding.
30. As an agent, I want to **void** a line, so that I can take something off the request.
31. As an agent, I want a voided line to leave a trace rather than vanish, so that the record shows
    what was considered and withdrawn.
32. As an agent, I want the unit price, net, VAT and discount to be **read-only**, so that I cannot
    accidentally change the merchandise terms — I am correcting insurance, not selling.
33. As an agent, I want to override a line's **Max Coverage**, so that I can correct a cap the
    engine could not know about.
34. As an agent, I want the deductible to stay derived after I change a cap, so that the numbers
    remain internally consistent instead of half hand-set.
35. As an agent, I want to set **Days Supply** per line, with the header's default stamped onto each
    line as it lands, so that the usual case needs no per-line work.
36. As an agent, I want Days Supply validated **1–100 at the cell**, so that an out-of-range value
    can never exist — rather than being silently reset at submit and reported in a warning.
37. As an agent, I want the **Selection Reason** picker disabled on generic lines only, so that the
    control matches the rule the till has always applied.
38. As an agent, I want the **deductible rate block editable** — the group rates and their caps — so
    that I can correct terms inherited from the coverage.
39. As an agent, I want one rate edit to re-price the whole request, so that the lines stay
    consistent with the header instead of drifting from it.
40. As an agent, I want to record **paid-outside** amounts, so that a cap already partly spent is
    asked about correctly.
41. As an agent, I want paid-outside **stored**, so that a later reader can tell a 300 cap from a 500
    cap with 200 already spent.
42. As an agent, I want to add diagnoses on a compact row against a code lookup, so that I am not
    hunting through a modal.
43. As an agent, I want **principal** to be a radio in the row, so that selecting one deselects the
    other and "exactly one" is enforced by the control rather than by a message box.
44. As an agent, I want the **morphology field to appear only when the principal diagnosis is a
    neoplasm**, carrying its own "required because…" heading, so that the requirement arrives with
    its cause instead of as a refusal after submit.
45. As an agent, I want an **exception prescription** checkbox, so that I can mark a request that
    takes one group for all its items.
46. As an agent, I want **no mode or claim-type selectors anywhere**, so that there is no wrong
    setting for me to leave behind.

### Attachments

47. As an agent, I want to attach files from a file picker, so that I can send the prescription the
    payer needs.
48. As an agent, I want a **banner while there are no attachments and Submit disabled**, so that the
    mandatory attachment is a visible form state rather than an exception thrown after I have filled
    in everything else.
49. As an agent, I want a large photo **downscaled in the browser** before it is sent, so that a 6 MB
    phone picture does not put the submission at risk of timing out.
50. As an agent, I want the file's type derived from the file itself, so that there is no type
    dropdown for me to set wrongly.
51. As an agent, I want to pick the attachment's **title from a fixed list**, so that a typo cannot
    reach a national exchange.
52. As an agent, I want to use the **same title twice**, so that two prescriptions can be two
    prescriptions.
53. As an agent, I want a PDF over 5 MB refused at the picker with a re-scan message, so that I find
    out before I have built the whole request.
54. As an agent, I want to preview an attachment inline before submitting, so that I see exactly what
    will be sent.
55. As an agent, I want to remove an attachment row, so that I can correct a wrong file.
56. As an agent chasing a rejection, I want to see the attachments **as submitted** on the detail
    screen, so that I can check what the payer was actually given without opening WPF.

### Submitting

57. As an agent, I want the **clinical-edit check to run before submission**, so that restrictions
    are surfaced before the exchange sees the request.
58. As an agent, I want a *warning* restriction to list what it found and let me **submit anyway**,
    so that I can proceed on a judgement call.
59. As an agent, I want a *fatal* restriction to show the same surface with the confirm button
    removed, so that the rule reads the same way and is simply not overridable.
60. As an agent, I want the request refused **on the form** when the exchange rejects it on
    validation, so that I fix it where I built it.
61. As an agent, I want each refusal reason attached to the row that caused it, so that I know which
    line or field to change.
62. As an agent, I want a submit that times out to be reported as **in flight, not failed**, so that
    I never raise a second authorization for a request that already reached the payer.
63. As an agent, I want a slow submit to be visibly working for its full window, so that I do not
    give up on one that is still going.
64. As an agent, I want to be warned before navigating away from a part-built authorization, so that
    I do not discard work by accident.
65. As an agent, I want an abandoned request genuinely discarded, so that no half-built authorization
    lingers where someone might act on it.

### Watching and following up

66. As an agent, I want an authorizations list on the same two-column status shape as the eligibility
    list, so that I learn one vocabulary and not two.
67. As an agent, I want the **verdict column blank until an answer has arrived**, so that a blank
    cell honestly says "nothing to report yet" instead of implying a refusal.
68. As an agent, I want a **payer-query marker** on any row where the payer has asked a question, so
    that I can see the ones that now need WPF.
69. As an agent, I want a **dispensed marker**, so that I can tell which authorizations have reached
    their end of life.
70. As an agent, I want **refused requests to appear in the list**, so that the ones most needing my
    attention are not the ones hidden from me.
71. As an agent, I want each row to offer only the acts its state actually permits, so that the row
    teaches me its vocabulary rather than my learning it by being refused.
72. As an agent, I want an unavailable act **disabled with its reason on hover**, so that I
    understand why rather than guessing.
73. As an agent, I want to **status-check** a pending authorization, so that I can chase one that has
    waited too long.
74. As an agent, I want to **retry** a pending authorization — re-asking with the same payload and
    taking the newer answer — so that a transport failure does not cost me the request.
75. As an agent, I want to **cancel** a completed, undispensed authorization, so that I can withdraw
    one that is no longer needed.
76. As an agent, I want a **Refresh** button with the load time beside it, so that I know how stale
    what I am looking at is and can decide for myself when to reload.
77. As an agent, I want the detail to show **per line: the verdict, approved quantity, rejected
    amount and the payer's reason in words**, so that a partial approval is legible without my
    decoding anything.
78. As an agent, I want the payer's header disposition and process note shown when they sent them, so
    that I have their summary alongside the line detail.
79. As an agent, I want a failed request's message rendered under a **"could not reach the payer"**
    label and never shown on a completed one, so that a transport error is never mistaken for the
    payer's words.
80. As an agent, I want to infer readiness to dispense from the row's own facts, so that the screen
    never claims something the till will refuse.

### Reopening a refused request

81. As an agent, I want to **open the refusal** on a failed authorization, so that I can act on it
    rather than starting over.
82. As an agent, I want that to open a fresh request **prefilled from what was actually submitted**,
    so that I do not retype a basket I already built.
83. As an agent, I want the prefill to work even when the request failed so early that no lines were
    recorded, so that the worst refusals are not the least recoverable.
84. As an agent, I want the replay to **report what did not come back** — an item since blocked, one
    that repriced — so that a silent restore never hands me a request that is quietly different from
    the one I am replaying.
85. As an agent, I want the replay to be a genuinely new request, so that there is no ambiguity about
    which authorization the payer is answering.

### Failures and refusals

86. As an agent, I want a payer's rejection to render as **information on the screen**, so that a
    normal business outcome is not presented to me as a crash.
87. As an agent, I want a server-side refusal — an unconfigured provider, an unknown item — to
    explain itself in words, so that I know whether it is mine to fix.
88. As an agent, I want a genuine transport failure to be distinguishable from both of the above, so
    that I know whether to retry.
89. As an agent whose portal session has expired, I want the standard single-toast bounce to login,
    so that this screen behaves like every other screen in the portal.
90. As an agent, I want a cap I enter that the engine will not apply to say so in the cell, so that I
    do not walk away believing an override took effect when it did not.

## Implementation Decisions

### 1 · A new area, two features, six routes

Per [feature-structure](../.claude/rules/feature-structure.md), a new nav group and a new URL prefix
arrive together, so `features/nphies/` is a **new area** holding two features — `eligibility` and
`authorizations` — each with its own i18n namespace registered centrally
([203](203-nphies-screen-shape.md)).

```
/nphies/eligibility          list + filters      /nphies/authorizations
/nphies/eligibility/new      the check form      /nphies/authorizations/new?from=<eligId>&coverage=<memberId>
/nphies/eligibility/:id      response detail     /nphies/authorizations/:id
```

**The seam between the two features is a route transition carrying an id, not a shared object.** WPF
carried the eligibility response in a controller field; the web fetches it by id. This is what makes
the two screens independently buildable, and it is chosen because an authorization is often raised
days after the check it references — a wizard step would serve only the same-sitting case and then
need a second entry point anyway.

Reopen rides the existing form route as `?copyOf=<authId>` ([207](207-nphies-reopening-a-refused-request.md)).
There is no draft route and no draft state: leaving discards
([208](208-nphies-the-auth-is-an-engine-document.md)).

### 2 · The authorization form is a live engine session, not a form post

This is the spec's largest structural decision ([208](208-nphies-the-auth-is-an-engine-document.md)).
The browser drives a real `NphiesAuth` transaction on the Till Submission Platform, the same way the
till does, because the owner's motivation for that platform is an audit of **what the engine landed
versus what the agent changed** — and "added then voided" cannot be reconstructed from a payload
that only ever carried the survivors.

| Agent act | Session verb | Recorded |
|---|---|---|
| form opens | `Open` (shift-less) | transaction OPEN |
| add item | `AddItem` | engine line |
| change qty | `ChangeQty` | engine line |
| void a line | `VoidLine` | **voided line, kept** |
| set rates / caps / paid-outside | `SetInsurance` | header insurance |
| bucket at scan, cap on override | `UpdateLineInsurance` | audited before/after |
| days supply, selection reason | `UpdateLineMeta` | final value only |
| submit | `Submit` | attempt journal + SUBMITTED |
| leave | `Abandon` | transaction VOIDED |

Plus `State` for the read. **Eleven verbs** in total
([208](208-nphies-the-auth-is-an-engine-document.md) §2 + [205](205-nphies-who-computes-the-money.md) §7).

Three consequences the UI must honour:

- **The acting store is the pricing plant**, bound once at open and never changeable
  ([208](208-nphies-the-auth-is-an-engine-document.md) §4, correcting
  [200](200-nphies-identity-and-context.md)). It is invisible in the request and decisive in the
  money. The acting store must therefore be resolved *before the first item*, and the screen cannot
  offer a store switch mid-request.
- **Sessions are shift-less**, per the call-centre device precedent.
- **No resumable drafts.** Leaving calls `Abandon`; anything that escapes it — a crashed tab — is
  swept server-side. Re-creating drafts would reintroduce the unswept-OPEN-transaction litter the
  till has just retired.

### 3 · Every verb returns the whole state, and the client renders the latest

The Nphies session client follows the call-centre console's proven contract shape: each mutating verb
returns the complete session state, so there is no reducer and no delta protocol; the client's only
job is deciding **whether an arriving state may be rendered**. That decision — version ordering,
equal-version-different-etag, and the contract-version hard stop — is today
`features/callcenter/console/session-state.ts`, and features may not import features.

**Decision: the guard graduates to `core/`** and both features import it, which is the boundary
rule's own remedy for logic shared by two features. Its existing test suite moves with it. Because
that touches a live screen, the move is its own ticket and lands before the Nphies session client is
built.

### 4 · Nobody computes money in the browser

The engine computes all of it ([205](205-nphies-who-computes-the-money.md)). The agent supplies
**five inputs** — header deductible rates, header paid-outside, line quantity, line Max Coverage,
line Days Supply — plus Selection Reason, which is a code and not an amount. Everything else on the
line is derived and read-only. This ruling is load-bearing rather than merely safe: the Nphies
service is a **transcription layer** that checks no amount at all, so whatever is sent is what the
national exchange sees ([206](206-nphies-does-the-service-check-the-money.md)).

Per-field ownership, from the request builder as it actually is:

| Field | Owner |
|---|---|
| `ItemNumber`, `Sequence` | session — engine line identity |
| `Quantity` | **agent** |
| `UnitPrice`, `ExtendedPrice`, `Amount`, `NetAmount`, `Vat` | engine — priced at the plant |
| `DiscountPercentage`, `DiscountAmount` | engine |
| `Factor` | **omitted** — the service recomputes it as `Amount / ExtendedPrice` |
| `ActualPatientShare` | engine — **the only per-line money the payer adjudicates** |
| `DeductibleG`, `DeductibleGroupName`, `MaxCoverage` | engine; `MaxCoverage` agent-overridable — **none of the three reach NPHIES**, they are read back by the dispensing till |
| `ServiceDate`, `Diagnosis` | header, stamped onto every line |
| `DaysSupply` | **agent** — header default + per-line, 1–100 |
| `SelectionReason` | derived, **agent-overridable** — disabled on `Generic` lines only |

`DeductibleGroupName` **is** `InsuranceItemCategory` — same value, two names. The category rides the
engine line and the category→G1/G2/G3 mapping is already server-side, so the item picker's response
is unchanged: [197](197-nphies-pricing-machinery.md)'s second server change costs nothing and is
dropped.

Rounding: the web rounds `ActualPatientShare` to 2dp, matching the till — the service rounds the
others but not this one, and it is the only adjudicated figure
([206](206-nphies-does-the-service-check-the-money.md)).

### 5 · A status is two axes, and the row's acts follow the first one

Both lists carry **Request** (`Cancelled` · `Failed` · `Pending` · `Complete` — did we get an
answer) and **Verdict** (blank until Complete — what they said), with `NeedComm` and `IsDispensed` as
**row markers**, since neither is a value of either axis ([201](201-nphies-rejection-detail.md)).
Both terms are already in `CONTEXT.md`.

`ErrorMessageShort` carries a transport error *or* the decoded adjudication display depending on
branch. **The Request state picks both the label and the source**: Failed/Pending render it under a
failure label; Complete never renders it at all. The ambiguity is designed out by only ever reading
the field in one branch.

Acts are **state-driven and disabled with their reason on hover**
([203](203-nphies-screen-shape.md) §6):

| Request state | Acts offered |
|---|---|
| `Pending` | Status check · **Retry** |
| `Complete`, not dispensed | Cancel |
| `Complete`, dispensed | — |
| `Failed` | **Open the refusal** |
| `Cancelled` | — |

Two corrections of record this spec carries rather than the originals: **`Failed` means the exchange
refused on validation before the payer saw it** — a form state the agent fixes in place, not a
transport blip — and **Retry belongs to `Pending`, not `Failed`**, because retry re-POSTs the stored
payload verbatim, which is meaningless for a request never accepted. `Failed` has **two sources**:
the exchange's validation, and the Nphies service's own guards, which throw *before the lines are
built* and so leave a header-only row ([207](207-nphies-reopening-a-refused-request.md)).

**The row never asserts "ready to dispense."** The real predicate lives in the service's `Dispense()`
and includes a follow-up clause the list data does not carry, so a browser copy could only lie. The
reader infers it: Complete + a good verdict + no dispensed marker.

### 6 · Lists: a visible window, and refused rows included

Default **last 7 days, newest first, server-paged**, with the window rendered as a **removable
chip** rather than applied silently — a silently truncated list reads as "that's everything", which
is the exact failure mode the source has today (an unordered `Take(20000)`). Filters: patient id,
payer, provider (defaulting to **all**), preauth reference, and the two status axes.

**The authorizations list must send `showAll=true`** or the service filters refused rows out
entirely, and a reopen affordance on a row nobody can see is worth nothing
([207](207-nphies-reopening-a-refused-request.md)).

**No browser polling.** The Nphies service already runs a background worker polling the exchange
every 15 seconds, so a pending authorization becomes complete on its own; the normal path to a
verdict is *waiting*. Manual **Refresh** with the load time stated beside it, and no `refetchInterval`
anywhere ([203](203-nphies-screen-shape.md) §7).

### 7 · What the browser never sends

Four values are **server-stamped and must not be trusted from the body**
([200](200-nphies-identity-and-context.md)): `distributionChannel` (pinned to the Saudi constant —
the only other value is Bahrain, out of scope), `UserId` / `StaffId` (the session user id, stamped by
the existing session filter), and `SourceCode` (the constant `'WEB'`). `ProviderCode` is the sole
exception: it *is* operator input and passes through, with the Nphies service as the authority on
whether it is configured.

`distributionChannel` never leaves the browser at all — it is not a hidden field, it is absent.

### 8 · Scope of acts: one claim type, one request type, nine acts

v1 is **claim type 0 (prior authorization)** and **request type `WithReferenceToEligibility`**, both
constants ([199](199-nphies-scope-of-acts.md)). Two structural savings follow and they exceed
everything they drop: **both mode dropdowns leave the screen** (no picker, no branch in
request-building, no "which kind is this" column) and **nothing is hand-typed identity** (the patient
block is always prefilled read-only from an eligibility).

Nine acts: eligibility **search · display · new**; authorization **search · display · status check ·
retry · cancel · clinical-edit validate**. Clinical edit is a **submit**-time gate, not a
dispense-time one.

**Exception prescription is in v1** — it means one item group for the whole request, so it reduces to
a checkbox and a grouping rule that is *cheaper* than the per-line path it replaces. Its
scary-looking branches in the source all sat inside the direct-dispense path and died with it.

The accepted consequence, ruled explicitly: an authorization the payer answers with a **payer query
stalls on the web**. The agent sees it and finishes it in WPF — acceptable precisely because the
marker is required to be visible.

### 9 · The visibility-flag soup needs no replacement

WPF's eight booleans were dissolved by scope, not by design ([203](203-nphies-screen-shape.md) §3).
Five went out of v1; `WithRef` was superseded by the patient-id Fill; `ViewOnly` was WPF reusing one
dialog as both form and detail, which a separate detail route makes unnecessary;
`IsReferenceToDocument` became the `?from=` parameter — the presence of a reference, not a mode.
**One checkbox and one conditional block survive.** Recorded explicitly so nobody builds a state
machine for flags that no longer exist.

### 10 · Attachments

File picker only, **no camera** — both audiences already hold the file
([202](202-nphies-attachments-in-a-browser.md)). Images are canvas-downscaled to a 2000 px longest
edge at JPEG q0.85 before base64; PDFs pass through untouched and are refused over 5 MB. The type
dropdown **dissolves** (MIME derives it) and the title becomes a **closed seven-value select** with
duplicates allowed — a sequence number already distinguishes the rows, so a duplicate title does not
collide the way a duplicate item does. Mandatory-at-least-one is a **form state** (banner + Submit
disabled), not a submit-time throw. Preview is an inline lightbox off the same data URL that will be
sent, so the agent previews exactly what goes. The detail screen renders submitted attachments for
free — the proxied detail response already carries the base64.

Transport is base64 inside the auth JSON. A real upload endpoint was **priced at zero and dropped**:
after the downscale there is nothing left for it to buy.

### 11 · Error taxonomy is three-way, and SIS.Api owns every translation

Not two ([198](198-nphies-proxy-contract.md)). A **payer rejection arrives as success-shaped data
and must render, not toast.** A **business refusal** (unconfigured provider or payer, unknown item, a
duplicate-submission collision) arrives as an envelope `success:false` with a code, and the UI
explains it from that code per [api-envelope](../.claude/rules/api-envelope.md) — it is a designed
outcome. A **transport failure** is the third case and the only one that is an error.

Submission is synchronous at an explicit 100 s, and **a timeout means in-flight, never failed** —
the UI's response is to send the agent to status-check, never to resubmit.

### 12 · The server contract this depends on

The SIS.Api work is **another team's** and is stated here as a dependency, not ticketed by this repo.
It is **16 proxied endpoints plus 11 session verbs**, ~15–20 developer-days
([204](204-nphies-the-estimate.md)).

> 📄 **The buildable form of this section is
> [the frozen contract, v1.0](assets/209-nphies-contract/CONTRACT.md)** — endpoint-by-endpoint routes
> and bodies, the session state projection, the ordering rule, the 19-field line ownership table, the
> three-way error taxonomy with its codes, and twelve conformance fixtures. Every field name in it
> was read from the Nphies service's own source, not inferred. **The BackOffice server tickets cite
> it by section**, the way BackOffice 875–878 cite the call-centre contract. This section stays as
> the prose summary; the contract is what anyone builds against, and it is the only one of the two
> that changes under a revision protocol.

Proxied, by kind ([198](198-nphies-proxy-contract.md), [199](199-nphies-scope-of-acts.md)):

- **Eligibility acts** — check, last-eligibility-by-patient.
- **Eligibility reads** — responses list, response by id.
- **Authorization acts** — submit, status check, retry, cancel, clinical-edit validate.
- **Authorization reads** — responses list, response by id.
- **Lookups** — payers, providers, code systems, diagnoses, morphologies.

Shape is **split by kind**: acts and lookups pass through; the two **lists are re-modelled in
SIS.Api** (sort, page, total) because the underlying read is an unordered bulk take — the only
genuinely new server logic in the proxy. The whole surface is JSON in / JSON out; the multipart
uploads are never ported. Environment is server config. One required guard: **SIS.Api refuses a zero
`ExtendedPrice`**, because the service divides by it
([206](206-nphies-does-the-service-check-the-money.md)).

Reopen needs one small read — the write-ahead journal row by authorization id — which already
carries the whole submitted request and requires **no new table, column or write**
([207](207-nphies-reopening-a-refused-request.md)).

Storage: one new column persists paid-outside, because a stored cap cannot otherwise distinguish a
300 cap from a 500 cap with 200 already spent ([205](205-nphies-who-computes-the-money.md)).

**Zero Nphies-service change.** No ticket on the map found work for the team that owns it.

### 13 · Domain vocabulary

`CONTEXT.md` already carries **Request state**, **Verdict** and **Payer query** from
[201](201-nphies-rejection-detail.md). `/domain-modeling` adds, in the same change as the code that
uses them: **eligibility check**, **prior authorization**, **provider** (distinct from **store**),
**Nphies session** (explicitly distinguished from the existing **Session** entry, which means the
auth cookie — a genuine collision worth naming), **plant** (the acting store as pricing plant),
**deductible group**, **paid-outside**, **clinical edit**, **exception prescription**, and **replay**
(distinct from retry: retry re-asks with the same payload, replay builds a new request from an old
one).

## Testing Decisions

**A good test here states an external behaviour and would survive the screen being rebuilt.** It
asserts what an agent sees or what the server is sent, never which hook fired or how state is
shaped internally. The house style is already set by the call-centre console's 30-odd
`*-view.test.ts` files and this spec follows it rather than inventing anything.

**Tier 1 — pure modules, vitest, in-memory. This is where nearly everything lives.** The rules in
this feature are overwhelmingly derivations and gates, which are pure functions with a table of
cases, and they are where regression would otherwise be silent:

| Module | What it decides |
|---|---|
| status axes | Request and Verdict from the raw fields, both act kinds; verdict blank unless Complete; which branch may read the dual-meaning message field, and under which label |
| row acts | the state → offered-acts table, and the disabled reason for every act not offered |
| line rules | which cells are editable; Selection Reason disabled on `Generic` only; Days Supply 1–100; the cap-will-not-apply warning |
| submit blockers | no items · no attachment · no principal diagnosis · morphology required · coverage unpicked when two or more · provider unpicked |
| diagnosis form | principal uniqueness as a structural rule; morphology visibility keyed to a neoplasm principal |
| attachment prepare | MIME → derived type; PDF over cap refused; which files are downscaled; the title list |
| list filters | query construction, the default 7-day window and its removable chip, `showAll=true` |
| replay | what is replayed from a stored request, and what is reported as not-come-back |
| session guard (in `core/`) | version ordering, equal-version-different-etag, contract-version hard stop — its existing suite moves with it |

**Tier 2 — component. Not used: React Testing Library is still not installed and this feature does
not bootstrap it.** Confirmed with the requester. Component and screen slices are verified by
driving the app, exactly as the call-centre console and Simulation screens were. The pure modules
above are deliberately drawn to carry the logic that would otherwise need a component test.

**Tier 3 — Playwright drives, `tools/nphies-*-drive.mjs`, manual-run and not CI gates**, matching
`tools/callcenter-drive.mjs`. Three paths earn one: the **two lists** (filters, the window chip, the
markers, act availability per row state), the **eligibility check** end to end, and the
**authorization session** — open, add, refuse a duplicate, change quantity, void, attach, hit both
clinical-edit shapes, submit, and land on a `Failed` form with reasons on rows. The session path is
the one a unit test structurally cannot reach and is the reason drives are in this spec at all.

`npm run typecheck` remains the fast loop, and `npm run lint`'s three gates (import boundaries,
token contrast, colour literals) apply — the new area is the first consumer of the boundary check
under a fresh area folder.

**Prior art to copy rather than re-derive:** `session-state.test.ts` and `session-fault.test.ts` for
the session contract; `submit-blockers.test.ts` for a gate list; `line-edit.test.ts` for editable-cell
rules; `item-search.test.ts` for the add-row; `status-severity.test.ts` for a status derivation;
`tools/callcenter-drive.mjs` for driving a live engine session in a browser.

**Not tested here:** the money. The engine computes it, the service transcribes it verbatim, and the
production formula is empirically valid — the web's obligation is to reproduce inputs faithfully, and
the assertions worth writing are about *which inputs are sent*, not about arithmetic this repo does
not perform.

## Out of Scope

Inherited from map [196](196-nphies-to-web-map.md), in substance:

- **Dispensing and invoicing, in any form.** Invoice creation, dispense, robot dispense, GS1 serial
  scanning and the OMS links — roughly 75% of the WPF authorization-list controller. The pharmacist
  keeps the till; the web's job ends when the authorization is approved and ready.
- **HIDP**, the national insurance-directory lookup — obsolete and not ported.
- **Payment reconciliation and claim submission** — not ported at all.
- **The multipart upload** — attachments ride as base64, which costs nothing.
- **Claim types 1 (claim) and 3 (direct dispense) — never.** Type 3 *is* a till act.
- **Claim types 2, 4 and 6, direct authorization, follow-up, the payer communication loop,
  update-auth-from-eligibility, update-advance — deferred past v1.** These are scope boundaries for
  this spec, not permanent rulings; the deferred set is the requester's stated next planning round.
  Direct authorization in particular is out because it would restore the hand-typed identity form
  this spec exists to remove.
- **Bahrain and Vitality.** Bahrain is a deployment fork, not a user choice; Vitality is visibly
  being retired.
- **Rebuilding the pricing engine in the browser.** Money is computed server-side or it is not
  computed.
- **Browser polling for freshness** — the server already polls; manual refresh only.
- **Resumable drafts** — abandon eagerly, sweep the rest.
- Three affordances priced and consciously left out: **View JSON** on an authorization, **camera
  capture** for attachments, and **before/after audit events** for Days Supply and Selection Reason
  (final-value-only accepted by the requester).
- **QA, UAT and the production deploy** are outside the 35–46-day figure — a 30–50% tail, to be
  quoted as a tail and not read as a discount.

## Further Notes

**The honest headline, for anyone reading the estimate.** The NPHIES integration is already built and
already in production; none of this buys it again. A standalone service does every exchange with the
national system, and both this portal's server and today's till are only callers of it. What the till
gave the WPF screens for free was everything *around* the exchange — a live basket that knows what
each item costs and what the insurer covers. The cost of this port is reproducing that, and the
chosen route is not to re-implement pricing but to let the browser drive the same engine transaction
the till drives.

**The riskiest figure** is the engine-session surface at 8–12 server-days, which could be 6 or 18. It
is a *parallel* build: the call-centre engine services are document-type-aware but call-centre-bound,
so the recipe is reused and the code is not. A ~2-day de-risking spike was priced and declined; the
term is carried as a range ([204](204-nphies-the-estimate.md)).

**Staging is a schedule dependency, not an effort figure.** Testing needs the planned staging
deployment of the Nphies service. Production is the **live national exchange** and must never be
submitted to from a development or test run.

**A quirk to carry deliberately, not fix.** On a `Brand-IR` line the agent may pick a selection
reason and the Nphies service overwrites it at submit with its own value; it also blanks the field
entirely for certain items. WPF behaves identically. Say so in the spec's implementation, or someone
will "fix" it and change what reaches the payer.

**Three defects were found while charting and reported rather than fixed.** They belong to the WPF
and Nphies-service owners and none is inside this spec's figure: PNG attachments are submitted to the
national exchange mislabelled as JPEG; the submission path divides by zero on a zero-priced line
(which is why the SIS.Api guard above is required rather than defensive); and a stray-semicolon guard
in both copies of the deductible manager. A fourth, milder one is inherited rather than fixed: the
engine silently ignores a cap of zero, which is why the cell says so rather than accepting a value
that will not apply.

**Prototypes** are the layout reference, not a visual design —
[screen shape](assets/196-nphies/screen-shape-prototype.html) and
[attachments](assets/196-nphies/attachments-prototype.html). Component choices, AG Grid usage and the
token pass are the build's job.

**Suggested first slices for `/to-tickets`:** the `core/` session-guard graduation (it blocks the
session client and touches a live screen, so it goes first and alone); then the eligibility list as a
tracer through the new area — route, namespace, menu, access probe, one proxied read — because it is
the cheapest end-to-end path and proves every registration point; then the eligibility check and
detail; then the authorization list and detail, which need no session; and only then the
authorization form, which is the one slice that cannot start before the server's session verbs exist.
